#!/usr/bin/env node
/**
 * Ontology / term-consistency gate for the IXO namespace (a reasoner-lite check).
 *
 * Part A — vocab lint (vocab/v1/index.json):
 *   - every class / property declares rdfs:label and rdfs:comment (WARN if not)
 *   - no duplicate term @id (ERROR)
 *   - subClassOf targets are classes; subPropertyOf targets are properties (WARN on mismatch)
 *
 * Part B — no dangling ixo: reference (ERROR), across the vocab AND every SKOS
 *   scheme. Resolves the target of every semantic-reference predicate
 *   (subClassOf, subPropertyOf, domain/rangeIncludes, inverseOf, equivalent*,
 *   domain, range) and confirms each ixo: target is actually defined somewhere —
 *   as a vocab term, a concept scheme, or a concept. External namespaces
 *   (rdfs:, owl:, schema:, qudt:, dbpedia, …) are assumed valid; an unknown
 *   prefix is a WARN.
 *
 * This catches the failure a full OWL reasoner would catch in this codebase:
 * a subPropertyOf / inverseOf / domainIncludes pointing at a term that does not
 * exist (typo or drift). Exit 0 if no errors, 1 otherwise.
 */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const toPosix = (p) => p.split(path.sep).join('/');
const SKIP = new Set(['node_modules', '.git', 'fixtures', 'schema', 'templates', 'context', 'docs', 'scripts', '.github']);

const IXO_ROOT = 'https://w3id.org/ixo/';
const IXO_VOCAB = 'https://w3id.org/ixo/vocab/v1#'; // the ixo: prefix
const REF_PREDS = ['rdfs:subClassOf', 'rdfs:subPropertyOf', 'schema:domainIncludes', 'schema:rangeIncludes',
  'owl:inverseOf', 'owl:equivalentClass', 'owl:equivalentProperty', 'rdfs:domain', 'rdfs:range'];
const KNOWN_PREFIXES = new Set(['rdf', 'rdfs', 'owl', 'xsd', 'skos', 'dcterms', 'dc', 'schema', 'prov',
  'foaf', 'sec', 'did', 'cred', 'dpv', 'vann', 'qudt', 'unit', 'sosa', 'time', 'geo', 'vc', 'as', 'ldp']);
const CLASS_TYPES = ['rdfs:Class', 'owl:Class'];
const PROP_TYPES = ['rdf:Property', 'owl:ObjectProperty', 'owl:DatatypeProperty', 'owl:AnnotationProperty'];

const asArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const hasAnyType = (n, ts) => asArray(n && n['@type']).some((t) => ts.includes(t));
const idOf = (v) => (v == null ? null : typeof v === 'string' ? v : v['@id'] ?? null);
const stripSlash = (s) => (s || '').replace(/\/+$/, '');
const baseOf = (doc) => { for (const c of asArray(doc['@context'])) if (c && typeof c === 'object' && c['@base']) return stripSlash(c['@base']); return null; };

async function walk(dir) {
  const out = [];
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) { if (!SKIP.has(ent.name)) out.push(...await walk(path.join(dir, ent.name))); }
    else if (/\.(json|jsonld)$/.test(ent.name)) out.push(path.join(dir, ent.name));
  }
  return out;
}

// classify a reference target → { kind, iri?, prefix? }
function classify(target, fileBase) {
  if (!target) return { kind: 'empty' };
  if (/^https?:\/\//.test(target)) return target.startsWith(IXO_ROOT) ? { kind: 'ixo', iri: stripSlash(target) } : { kind: 'external' };
  if (target.startsWith('#')) return { kind: 'ixo', iri: stripSlash(fileBase || '') + target };
  const i = target.indexOf(':');
  if (i < 0) return { kind: 'unknown-prefix', prefix: '(none)' };
  const p = target.slice(0, i), local = target.slice(i + 1);
  if (p === 'ixo') return { kind: 'ixo', iri: IXO_VOCAB + local };
  if (KNOWN_PREFIXES.has(p)) return { kind: 'external' };
  return { kind: 'unknown-prefix', prefix: p };
}

async function main() {
  const files = (await walk(ROOT)).sort();
  const errors = [], warns = [];

  // ---- build the set of every defined ixo: IRI (vocab terms, schemes, concepts) ----
  const definedIri = new Set();
  const termKind = new Map(); // iri -> 'class' | 'property'
  const schemeFiles = [];
  let vocabDoc = null, vocabRel = null;

  for (const abs of files) {
    let doc; try { doc = JSON.parse(await readFile(abs, 'utf8')); } catch { continue; }
    const rel = toPosix(path.relative(ROOT, abs));
    const graph = Array.isArray(doc['@graph']) ? doc['@graph'] : null;
    if (!graph) continue;

    if (graph.some((n) => hasAnyType(n, ['owl:Ontology']))) { vocabDoc = doc; vocabRel = rel; }
    const base = baseOf(doc);
    for (const n of graph) {
      const id = n['@id']; if (!id) continue;
      const c = classify(id, base);
      if (c.kind !== 'ixo') continue;
      definedIri.add(c.iri);
      if (hasAnyType(n, CLASS_TYPES)) termKind.set(c.iri, 'class');
      else if (hasAnyType(n, PROP_TYPES)) termKind.set(c.iri, 'property');
    }
    if (graph.some((n) => asArray(n['@type']).includes('skos:ConceptScheme'))) schemeFiles.push({ rel, doc, base });
  }

  const resolve = (target, fileBase, where, hard) => {
    const c = classify(target, fileBase);
    if (c.kind === 'ixo') { if (!definedIri.has(c.iri)) (hard ? errors : warns).push(`${where}: unresolved ixo reference → ${target}`); return c; }
    if (c.kind === 'unknown-prefix') warns.push(`${where}: unknown prefix "${c.prefix}" in ${target}`);
    return c;
  };

  // ---- Part A: vocab lint ----
  if (!vocabDoc) { errors.push('vocab ontology document (owl:Ontology) not found'); }
  else {
    const seen = new Set();
    for (const n of vocabDoc['@graph']) {
      const id = n['@id']; if (!id) continue;
      if (hasAnyType(n, ['owl:Ontology'])) continue;
      if (seen.has(id)) errors.push(`${vocabRel}: duplicate term @id ${id}`); else seen.add(id);
      const isClass = hasAnyType(n, CLASS_TYPES), isProp = hasAnyType(n, PROP_TYPES);
      if (!isClass && !isProp) continue;
      if (n['rdfs:label'] === undefined) warns.push(`${vocabRel}: ${id} missing rdfs:label`);
      if (n['rdfs:comment'] === undefined) warns.push(`${vocabRel}: ${id} missing rdfs:comment`);
      for (const sc of asArray(n['rdfs:subClassOf'])) { const c = resolve(idOf(sc), null, `${vocabRel} ${id} subClassOf`, true); if (c.kind === 'ixo' && termKind.get(c.iri) === 'property') warns.push(`${vocabRel}: ${id} rdfs:subClassOf points at a property (${idOf(sc)})`); }
      for (const sp of asArray(n['rdfs:subPropertyOf'])) { const c = resolve(idOf(sp), null, `${vocabRel} ${id} subPropertyOf`, true); if (c.kind === 'ixo' && termKind.get(c.iri) === 'class') warns.push(`${vocabRel}: ${id} rdfs:subPropertyOf points at a class (${idOf(sp)})`); }
      for (const p of REF_PREDS) if (p !== 'rdfs:subClassOf' && p !== 'rdfs:subPropertyOf') for (const t of asArray(n[p])) resolve(idOf(t), null, `${vocabRel} ${id} ${p}`, true);
    }
  }

  // ---- Part B: no dangling ixo reference across schemes ----
  for (const { rel, doc, base } of schemeFiles)
    for (const n of doc['@graph']) {
      const id = n['@id'] || '?';
      for (const p of REF_PREDS) for (const t of asArray(n[p])) resolve(idOf(t), base, `${rel} ${id} ${p}`, true);
    }

  console.log(`\nOntology / term consistency\n`);
  console.log(`  defined ixo terms: ${definedIri.size}  (vocab + ${schemeFiles.length} schemes)`);
  for (const e of errors) console.log(`  ✗ ${e}`);
  for (const w of warns) console.log(`  ⚠ ${w}`);
  console.log(`\nSummary: ${errors.length} error(s), ${warns.length} warning(s).`);
  if (errors.length) { console.log('\n✗ Ontology consistency failed.'); process.exit(1); }
  console.log('\n✓ Ontology consistency passed.');
}

main().catch((e) => { console.error('FATAL:', e); process.exit(2); });
