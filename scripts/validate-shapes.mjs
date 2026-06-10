#!/usr/bin/env node
/**
 * SHACL validation harness for the IXO namespace.
 * See PLAN.md sections 4.0 and 4.5.
 *
 * Validates every conformant example in fixtures/examples/<family>.jsonld
 * against schema/shapes/v1/<Family>Shape.jsonld. Each example is expanded to RDF and
 * merged with the vocabulary (vocab/v1) so that sh:targetClass resolves through
 * the rdfs:subClassOf hierarchy (e.g. an ixo:Project node is an ixo:Entity).
 *
 * shapes/ does not exist before Phase 5 — then this is a clean no-op.
 * Exit code: 0 if every example conforms to its shape, 1 otherwise.
 */

import { readFile, readdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SHAPES_DIR = path.join(ROOT, 'schema', 'shapes');
const EXAMPLES_DIR = path.join(ROOT, 'fixtures', 'examples');
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const toPosix = (p) => p.split(path.sep).join('/');

function ixoToLocal(url) {
  const clean = url.split('#')[0].split('?')[0];
  const p = 'https://w3id.org/ixo/';
  if (!clean.startsWith(p)) return null;
  const rel = clean.slice(p.length).replace(/\/+$/, '').replace(/^ns\//, '');
  for (const c of [rel, `${rel}/index.jsonld`, `${rel}/index.json`, `${rel}.jsonld`, `${rel}.json`]) {
    const abs = path.join(ROOT, c);
    if (existsSync(abs) && statSync(abs).isFile()) return abs;
  }
  return null;
}

async function walk(dir, re) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...await walk(full, re));
    else if (re.test(ent.name)) out.push(full);
  }
  return out;
}

async function main() {
  if (!existsSync(SHAPES_DIR)) {
    console.log('SHACL validation — no shapes/ directory yet (added in Phase 5). Skipping.');
    return;
  }
  const shapeFiles = (await walk(SHAPES_DIR, /\.jsonld$/)).sort();
  const exampleFiles = (await walk(EXAMPLES_DIR, /\.jsonld$/)).sort();
  const templateFiles = (await walk(TEMPLATES_DIR, /\.jsonld$/)).sort();
  if (!shapeFiles.length || (!exampleFiles.length && !templateFiles.length)) {
    console.log(`SHACL validation — ${shapeFiles.length} shape(s), ${exampleFiles.length} example(s), ${templateFiles.length} template(s). Nothing to validate.`);
    return;
  }

  const jsonld = (await import('jsonld')).default;
  const { default: SHACLValidator } = await import('rdf-validate-shacl');
  const rdf = (await import('rdf-ext')).default; // used only to build DatasetCore inputs
  const { Parser: N3Parser } = await import('n3');

  const cache = new Map();
  async function documentLoader(url) {
    if (cache.has(url)) return cache.get(url);
    const local = ixoToLocal(url);
    let res;
    if (local) res = { contextUrl: null, document: JSON.parse(await readFile(local, 'utf8')), documentUrl: url };
    else { const r = await fetch(url); if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`); res = { contextUrl: null, document: await r.json(), documentUrl: r.url || url }; }
    cache.set(url, res);
    return res;
  }
  const parse = (nq) => new N3Parser({ format: 'application/n-quads' }).parse(nq);
  async function toQuads(doc, base) {
    const nq = await jsonld.toRDF(doc, { format: 'application/n-quads', documentLoader, base });
    return parse(nq);
  }

  // vocab triples (class hierarchy) merged into every data graph for targetClass reasoning
  const vocabDoc = JSON.parse(await readFile(path.join(ROOT, 'vocab/v1/index.jsonld'), 'utf8'));
  const vocabQuads = await toQuads(vocabDoc, 'https://w3id.org/ixo/vocab/v1');
  // Concept schemes referenced by shapes (e.g. ClaimShape checks skos:inScheme membership).
  const claimTypesDoc = JSON.parse(await readFile(path.join(ROOT, 'protocol/claims/v1/index.jsonld'), 'utf8'));
  const refQuads = [...vocabQuads, ...await toQuads(claimTypesDoc, 'https://w3id.org/ixo/protocol/claims/v1')];

  const shapeByName = new Map();
  for (const abs of shapeFiles) shapeByName.set(path.basename(abs, '.jsonld'), abs);

  const failures = [];
  const exercised = new Set();

  function shapeForType(typeField) {
    const t = [].concat(typeField || []).filter((x) => typeof x === 'string');
    if (t.includes('ixo:DomainCard')) return 'DomainCardShape';
    if (t.includes('ixo:Credential')) return 'CredentialShape';
    if (t.includes('ixo:Claim')) return 'ClaimShape';
    if (t.includes('ixo:Profile')) return 'ProfileShape';
    if (t.includes('ixo:Tags')) return 'TagsShape';
    if (t.includes('ixo:Page')) return 'PageShape';
    if (t.some((x) => x.startsWith('ixo:'))) return 'EntityShape';
    return null;
  }

  async function validateOne(targetAbs, shapeName, label) {
    if (!shapeName) { console.log(`  skip  ${label}  (no ixo: type → no shape)`); return; }
    const shapeAbs = shapeByName.get(shapeName);
    if (!shapeAbs) { console.log(`  skip  ${label}  (no schema/shapes/v1/${shapeName}.jsonld)`); return; }
    exercised.add(shapeName);
    try {
      const shapesDS = rdf.dataset(parse(await jsonld.toRDF(JSON.parse(await readFile(shapeAbs, 'utf8')), { format: 'application/n-quads', documentLoader })));
      const dataQuads = await toQuads(JSON.parse(await readFile(targetAbs, 'utf8')), 'https://w3id.org/ixo/_example/');
      const dataDS = rdf.dataset([...dataQuads, ...vocabQuads, ...refQuads.slice(vocabQuads.length)]);
      const report = await new SHACLValidator(shapesDS).validate(dataDS);
      if (report.conforms) console.log(`  PASS  ${label}  vs ${shapeName}`);
      else {
        console.log(`  FAIL  ${label}  vs ${shapeName}  (${report.results.length} violation(s))`);
        for (const r of report.results) console.log(`          └─ ${r.path ? r.path.value + ': ' : ''}${(r.message[0] && r.message[0].value) || r.constraintComponent.value}`);
        failures.push(label);
      }
    } catch (e) { console.log(`  FAIL  ${label}\n          └─ ${(e.message || String(e)).split('\n')[0]}`); failures.push(label); }
  }

  console.log(`\nSHACL validation — ${exampleFiles.length} example(s) + ${templateFiles.length} template(s) vs ${shapeFiles.length} shape(s)\n`);
  for (const abs of exampleFiles) {
    const stem = path.basename(abs, '.jsonld');
    await validateOne(abs, stem.charAt(0).toUpperCase() + stem.slice(1) + 'Shape', toPosix(path.relative(ROOT, abs)));
  }
  for (const abs of templateFiles) {
    const doc = JSON.parse(await readFile(abs, 'utf8'));
    await validateOne(abs, shapeForType(doc.type), toPosix(path.relative(ROOT, abs)));
  }

  for (const name of shapeByName.keys()) if (!exercised.has(name)) console.log(`  ⚠ no example/template exercises ${name}`);

  console.log(`\nSummary: ${failures.length} non-conforming example(s).`);
  if (failures.length) process.exit(1);
  console.log('\n✓ SHACL validation passed.');
}

main().catch((e) => { console.error('FATAL:', e); process.exit(2); });
