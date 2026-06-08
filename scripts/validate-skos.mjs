#!/usr/bin/env node
/**
 * SKOS integrity gate for the IXO namespace.
 *
 * Discovers every skos:ConceptScheme document in the repo and checks the SKOS
 * integrity conditions that matter for this data (a lightweight, dependency-free
 * stand-in for a full SKOS reasoner). See the SKOS Reference, section "Integrity".
 *
 * ERRORS (exit 1) — break SKOS semantics or on-chain membership:
 *   - a concept missing skos:inScheme, or pointing at the wrong scheme
 *   - a concept missing skos:prefLabel
 *   - duplicate skos:notation within a scheme (notations are the on-chain keys)
 *   - skos:hasTopConcept / skos:topConceptOf not mutual inverses (drift)
 *   - skos:broader / hasTopConcept / topConceptOf referencing a missing concept
 *   - a concept that is both a top concept and has skos:broader
 *
 * WARNINGS (reported, exit 0) — quality issues, not corruption:
 *   - scheme missing dcterms:title / dcterms:description
 *   - duplicate skos:prefLabel within a scheme; prefLabel without @language
 *   - missing skos:notation; orphan concept (neither top nor broader)
 *   - skos:broader cycle; mapping property whose value is not an IRI
 *
 * Exit code: 0 if no errors, 1 otherwise.
 */

import { readFile, readdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const toPosix = (p) => p.split(path.sep).join('/');
const SKIP = new Set(['node_modules', '.git', 'fixtures', 'schema', 'templates', 'context', 'docs', 'scripts', '.github']);
const MAPPING = ['skos:exactMatch', 'skos:closeMatch', 'skos:broadMatch', 'skos:narrowMatch', 'skos:relatedMatch'];

const asArray = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);
const hasType = (node, t) => asArray(node && node['@type']).includes(t);
const idOf = (v) => (v == null ? null : typeof v === 'string' ? v : v['@id'] ?? null);
const labelVal = (v) => (v == null ? null : typeof v === 'string' ? v : v['@value'] ?? null);
const stripSlash = (s) => (s || '').replace(/\/+$/, '');
const sameIri = (a, b) => stripSlash(a) === stripSlash(b);
// fragment-normalise a reference so "#af" and ".../countries#af" compare equal
const norm = (s) => (!s ? s : s.includes('#') ? '#' + s.split('#').pop() : stripSlash(s));

async function walk(dir) {
  const out = [];
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (!SKIP.has(ent.name)) out.push(...await walk(path.join(dir, ent.name)));
    } else if (/\.(json|jsonld)$/.test(ent.name)) out.push(path.join(dir, ent.name));
  }
  return out;
}

function checkScheme(scheme, concepts, errors, warns) {
  const schemeId = scheme['@id'];
  const conceptIds = new Set(concepts.map((c) => norm(c['@id'])));
  const byId = new Map(concepts.map((c) => [norm(c['@id']), c]));
  const hasTop = new Set(asArray(scheme['skos:hasTopConcept']).map((x) => norm(idOf(x))));

  if (!scheme['dcterms:title']) warns.push('scheme missing dcterms:title');
  if (!scheme['dcterms:description']) warns.push('scheme missing dcterms:description');

  // hasTopConcept → concept exists and declares topConceptOf back (inverse closure)
  for (const htc of hasTop) {
    if (!conceptIds.has(htc)) { errors.push(`hasTopConcept references missing concept ${htc}`); continue; }
    const c = byId.get(htc);
    if (!sameIri(idOf(c['skos:topConceptOf']) || '', schemeId)) errors.push(`${htc} listed in hasTopConcept but missing matching skos:topConceptOf`);
  }

  const notationSeen = new Map();
  const labelSeen = new Map();
  const broaderGraph = new Map();

  for (const c of concepts) {
    const cid = norm(c['@id']);

    const inScheme = idOf(c['skos:inScheme']);
    if (!inScheme) errors.push(`${cid} missing skos:inScheme`);
    else if (!sameIri(inScheme, schemeId)) errors.push(`${cid} skos:inScheme ${inScheme} != scheme ${schemeId}`);

    const pl = c['skos:prefLabel'];
    if (pl === undefined) errors.push(`${cid} missing skos:prefLabel`);
    else {
      const label = labelVal(pl);
      if (typeof pl === 'object' && !Array.isArray(pl) && !pl['@language']) warns.push(`${cid} skos:prefLabel has no @language`);
      if (label != null) {
        if (labelSeen.has(label)) warns.push(`duplicate skos:prefLabel "${label}" (${labelSeen.get(label)} and ${cid})`);
        else labelSeen.set(label, cid);
      }
    }

    const nt = c['skos:notation'];
    if (nt === undefined) warns.push(`${cid} missing skos:notation`);
    else if (notationSeen.has(nt)) errors.push(`duplicate skos:notation "${nt}" (${notationSeen.get(nt)} and ${cid})`);
    else notationSeen.set(nt, cid);

    const broaders = asArray(c['skos:broader']).map((b) => norm(idOf(b)));
    const isTopOf = c['skos:topConceptOf'] !== undefined;
    broaderGraph.set(cid, broaders);

    if (isTopOf) {
      const tco = idOf(c['skos:topConceptOf']);
      if (!sameIri(tco, schemeId)) errors.push(`${cid} skos:topConceptOf ${tco} != scheme ${schemeId}`);
      if (!hasTop.has(cid)) errors.push(`${cid} is skos:topConceptOf but not listed in scheme skos:hasTopConcept`);
    }
    for (const b of broaders) {
      if (!conceptIds.has(b)) errors.push(`${cid} skos:broader references missing concept ${b}`);
      if (hasTop.has(cid)) errors.push(`${cid} has skos:broader but is listed as a top concept`);
    }
    if (isTopOf && broaders.length) warns.push(`${cid} has both skos:topConceptOf and skos:broader`);
    if (!isTopOf && !broaders.length && !hasTop.has(cid)) warns.push(`${cid} is an orphan (neither top concept nor skos:broader)`);

    for (const m of MAPPING) for (const v of asArray(c[m])) if (!idOf(v)) warns.push(`${cid} ${m} value is not an IRI`);
  }

  // broader cycle detection (DFS)
  const colour = new Map();
  const dfs = (n) => {
    colour.set(n, 1);
    for (const m of broaderGraph.get(n) || []) {
      if (colour.get(m) === 1) { warns.push(`skos:broader cycle through ${n} → ${m}`); return; }
      if (!colour.get(m) && broaderGraph.has(m)) dfs(m);
    }
    colour.set(n, 2);
  };
  for (const n of broaderGraph.keys()) if (!colour.get(n)) dfs(n);

  return concepts.length;
}

async function main() {
  const files = (await walk(ROOT)).sort();
  let totalSchemes = 0, totalConcepts = 0, totalErrors = 0, totalWarns = 0;
  console.log('\nSKOS integrity — scanning for skos:ConceptScheme documents\n');

  for (const abs of files) {
    let doc;
    try { doc = JSON.parse(await readFile(abs, 'utf8')); } catch { continue; }
    const graph = Array.isArray(doc['@graph']) ? doc['@graph'] : null;
    if (!graph) continue;
    const schemes = graph.filter((n) => hasType(n, 'skos:ConceptScheme'));
    if (!schemes.length) continue;
    const allConcepts = graph.filter((n) => hasType(n, 'skos:Concept'));
    const rel = toPosix(path.relative(ROOT, abs));

    for (const scheme of schemes) {
      // when a file holds >1 scheme, partition concepts by skos:inScheme
      const concepts = schemes.length === 1
        ? allConcepts
        : allConcepts.filter((c) => sameIri(idOf(c['skos:inScheme']) || '', scheme['@id']));
      const errors = [], warns = [];
      const n = checkScheme(scheme, concepts, errors, warns);
      totalSchemes++; totalConcepts += n; totalErrors += errors.length; totalWarns += warns.length;
      const tag = errors.length ? 'FAIL' : 'ok  ';
      console.log(`  ${tag}  ${rel}  ::  ${scheme['@id']}  (${n} concepts)`);
      for (const e of errors) console.log(`        ✗ ${e}`);
      for (const w of warns) console.log(`        ⚠ ${w}`);
    }
  }

  console.log(`\nSummary: ${totalSchemes} scheme(s), ${totalConcepts} concept(s), ${totalErrors} error(s), ${totalWarns} warning(s).`);
  if (totalErrors) { console.log('\n✗ SKOS integrity failed.'); process.exit(1); }
  console.log('\n✓ SKOS integrity passed.');
}

main().catch((e) => { console.error('FATAL:', e); process.exit(2); });
