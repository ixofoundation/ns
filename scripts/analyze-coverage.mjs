#!/usr/bin/env node
/**
 * Phase 4 — on-chain term-coverage analysis.
 * See PLAN.md section 4.4.
 *
 * Expands the mainnet corpus (ixo-mainnet-linked-resources) against the new
 * context/vocab and reports:
 *   - per-category triple production (iid / resource-schema),
 *   - every distinct JSON key, classified as covered-by-ixo, covered-by-VC,
 *     a JSON-LD keyword, or UNDEFINED (a silent drop — a gap to fill),
 *   - every distinct `type` / `@type` value (candidates for SKOS concepts).
 *
 * Writes scripts/coverage-report.json and prints a summary.
 * Usage:  node scripts/analyze-coverage.mjs [path-to-corpus]
 */

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jsonld from 'jsonld';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const CORPUS = path.resolve(ROOT, process.argv[2] || '../../ixo-mainnet-linked-resources');
const IXOCTX = 'https://w3id.org/ixo/context/v1';
const VC1 = 'https://www.w3.org/2018/credentials/v1';
const VC2 = 'https://www.w3.org/ns/credentials/v2';

const cache = new Map();
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
async function documentLoader(url) {
  if (cache.has(url)) return cache.get(url);
  const local = ixoToLocal(url);
  let res;
  if (local) res = { contextUrl: null, document: JSON.parse(await readFile(local, 'utf8')), documentUrl: url };
  else {
    const r = await fetch(url, { headers: { Accept: 'application/ld+json, application/json' }, redirect: 'follow' });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
    res = { contextUrl: null, document: await r.json(), documentUrl: r.url || url };
  }
  cache.set(url, res);
  return res;
}

const KEYWORDS = new Set(['@context', '@id', '@type', '@graph', '@value', '@language', '@list', '@set', '@base', '@vocab', '@version', '@protected', '@container', '@reverse', '@nest', '@none', '@index']);
const IXO_TERMS = new Set(['id', 'type', 'controller', 'verificationMethod', 'authentication', 'assertionMethod', 'keyAgreement', 'capabilityInvocation', 'capabilityDelegation', 'service', 'linkedResource', 'linkedClaim', 'linkedEntity', 'accordedRight', 'account', 'settings', 'name', 'description', 'image']);

const keyInfo = new Map();   // key -> { count, sampleValueType, exampleFile }
const typeVals = new Map();  // type value -> { count, exampleFile }
const fileStats = [];        // { rel, category, hasContext, triples, error }

function note(map, k, file) {
  const e = map.get(k) || { count: 0, exampleFile: file };
  e.count++;
  map.set(k, e);
}
function valueType(v) {
  if (Array.isArray(v)) return 'array';
  if (v === null) return 'null';
  return typeof v;
}
function collect(obj, file) {
  if (Array.isArray(obj)) { for (const v of obj) collect(v, file); return; }
  if (!obj || typeof obj !== 'object') return;
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'type' || k === '@type') {
      for (const tv of [].concat(v)) if (typeof tv === 'string') note(typeVals, tv, file);
    }
    if (!KEYWORDS.has(k)) {
      const e = keyInfo.get(k) || { count: 0, sampleValueType: valueType(v), exampleFile: file };
      e.count++;
      keyInfo.set(k, e);
    }
    collect(v, file);
  }
}

async function walkDir(dir, re, limit) {
  if (!existsSync(dir)) return [];
  const all = (await readdir(dir)).filter((f) => re.test(f)).sort();
  const picked = limit ? all.slice(0, limit) : all;
  return picked.map((f) => path.join(dir, f));
}

async function tripleCount(doc) {
  try {
    const nq = await jsonld.toRDF(doc, { format: 'application/n-quads', documentLoader, base: 'https://w3id.org/ixo/_probe/' });
    return { triples: nq.split('\n').filter((l) => l.trim()).length, error: null };
  } catch (e) { return { triples: 0, error: (e.message || String(e)).split('\n')[0] }; }
}

async function mapsIn(ctx, key) {
  try {
    const exp = await jsonld.expand({ '@context': ctx, [key]: 'probe' }, { documentLoader });
    if (!exp.length) return false;
    return Object.keys(exp[0]).some((k) => k.startsWith('http') || k === '@id' || k === '@type');
  } catch { return false; }
}

async function main() {
  if (!existsSync(CORPUS)) { console.error(`Corpus not found: ${CORPUS}`); process.exit(2); }
  console.log(`Corpus: ${CORPUS}\n`);

  const iidFiles = await walkDir(path.join(CORPUS, 'iid'), /\.jsonld$/, 200);
  const schemaFiles = await walkDir(path.join(CORPUS, 'schemas'), /\.json$/, null);
  const resourceFiles = await walkDir(path.join(CORPUS, 'resources'), /\.json$/, null);
  const groups = [['iid', iidFiles], ['resource-schema', schemaFiles], ['resource', resourceFiles]];

  for (const [category, files] of groups) {
    for (const abs of files) {
      let doc;
      try { doc = JSON.parse(await readFile(abs, 'utf8')); } catch { continue; }
      collect(doc, path.basename(abs));
      const hasContext = doc && typeof doc === 'object' && '@context' in doc;
      const { triples, error } = hasContext ? await tripleCount(doc) : { triples: 0, error: null };
      fileStats.push({ rel: `${category}/${path.basename(abs)}`, category, hasContext, triples, error });
    }
  }

  // Classify distinct keys
  const undefinedKeys = [], coveredVc = [], coveredIxo = [];
  for (const [key, info] of keyInfo) {
    if (IXO_TERMS.has(key)) { coveredIxo.push({ key, ...info }); continue; }
    if (await mapsIn(IXOCTX, key)) { coveredIxo.push({ key, ...info }); continue; }
    if (await mapsIn(VC2, key) || await mapsIn(VC1, key)) { coveredVc.push({ key, ...info }); continue; }
    undefinedKeys.push({ key, ...info });
  }
  undefinedKeys.sort((a, b) => b.count - a.count);
  coveredVc.sort((a, b) => b.count - a.count);

  const typeList = [...typeVals.entries()].map(([v, i]) => ({ value: v, count: i.count, exampleFile: i.exampleFile })).sort((a, b) => b.count - a.count);

  const byCat = {};
  for (const f of fileStats) {
    const c = (byCat[f.category] = byCat[f.category] || { files: 0, withContext: 0, plain: 0, zeroTriple: 0, errors: 0, totalTriples: 0 });
    c.files++; f.hasContext ? c.withContext++ : c.plain++;
    if (f.hasContext && f.triples === 0) c.zeroTriple++;
    if (f.error) c.errors++;
    c.totalTriples += f.triples;
  }

  const report = { corpus: CORPUS, byCategory: byCat, undefinedKeys, coveredVc, coveredIxoCount: coveredIxo.length, typeValues: typeList };
  await writeFile(path.join(HERE, 'coverage-report.json'), JSON.stringify(report, null, 2));

  console.log('Files by category:', JSON.stringify(byCat, null, 2));
  console.log(`\nDistinct keys: ${keyInfo.size}  (ixo-covered ${coveredIxo.length}, VC-covered ${coveredVc.length}, UNDEFINED ${undefinedKeys.length})`);
  console.log('\nUNDEFINED keys (top 60) — silent drops to classify:');
  for (const k of undefinedKeys.slice(0, 60)) console.log(`  ${String(k.count).padStart(5)}  ${k.key.padEnd(28)} <${k.sampleValueType}>  e.g. ${k.exampleFile}`);
  console.log(`\nCovered-by-VC keys: ${coveredVc.map((k) => k.key).join(', ')}`);
  console.log(`\nDistinct type values: ${typeList.length}`);
  for (const t of typeList) console.log(`  ${String(t.count).padStart(5)}  ${t.value}`);
  console.log('\nWrote scripts/coverage-report.json');
}

main().catch((e) => { console.error('FATAL:', e); process.exit(2); });
