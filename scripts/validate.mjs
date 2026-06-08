#!/usr/bin/env node
/**
 * Phase 0 — JSON-LD validation harness for the IXO namespace.
 * See PLAN.md sections 1, 2, and 4.0.
 *
 * Walks every .json / .jsonld file that has a top-level "@context", processes
 * it with jsonld.expand() + jsonld.toRDF(), and classifies each as:
 *
 *   - context  : sole top-level key is "@context" (a context *definition*).
 *                Must process without error. 0 triples is expected and OK.
 *   - data     : "@context" plus content. Must expand without error AND
 *                produce >= 1 RDF triple.
 *   - plain    : no "@context" (impact tokens, JSON Schema docs, raw data).
 *                Skipped here — these belong to validate-schemas.mjs.
 *
 * A document loader resolves https://w3id.org/ixo/* (and the GitHub Pages
 * mirror) against the local working copy so the repo validates offline.
 *
 * Files listed in scripts/.expect-error.json are reported but never gate CI,
 * so the known-broken legacy tree doesn't block the rest of the rebuild.
 *
 * Exit code: 0 if every non-allowlisted file passes, 1 otherwise.
 */

import { readFile, readdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jsonld from 'jsonld';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const IGNORE_DIRS = new Set(['node_modules', '.git', '.github', 'scripts', 'fixtures']);

const IXO_PREFIXES = [
  'https://w3id.org/ixo/',
  'http://w3id.org/ixo/',
  'https://ixofoundation.github.io/ns/',
];

const toPosix = (p) => p.split(path.sep).join('/');
const relOf = (abs) => toPosix(path.relative(ROOT, abs));

/** Canonical w3id base IRI for a repo-relative file, so #fragment ids expand
 *  to absolute IRIs (e.g. vocab/v1/index.json -> https://w3id.org/ixo/vocab/v1). */
function canonicalBase(rel) {
  let p = rel.replace(/\.(jsonld|json)$/i, '').replace(/\/index$/i, '');
  return 'https://w3id.org/ixo/' + p;
}

/** Map an ixo namespace URL to a local file, trying common index conventions. */
function ixoToLocal(url) {
  const clean = url.split('#')[0].split('?')[0];
  let rel = null;
  for (const prefix of IXO_PREFIXES) {
    if (clean.startsWith(prefix)) { rel = clean.slice(prefix.length); break; }
  }
  if (rel === null) return null;
  rel = rel.replace(/\/+$/, '').replace(/^ns\//, ''); // canonical form: ns/<path> === <path>
  const candidates = [rel, `${rel}/index.jsonld`, `${rel}/index.json`, `${rel}.jsonld`, `${rel}.json`];
  for (const c of candidates) {
    if (!c) continue;
    const abs = path.join(ROOT, c);
    if (existsSync(abs) && statSync(abs).isFile()) return abs;
  }
  return null;
}

async function documentLoader(url) {
  const local = ixoToLocal(url);
  if (local) {
    const document = JSON.parse(await readFile(local, 'utf8'));
    return { contextUrl: null, document, documentUrl: url };
  }
  // Remote contexts (e.g. W3C VC / credentials). Requires network in CI.
  const res = await fetch(url, {
    headers: { Accept: 'application/ld+json, application/json;q=0.9, */*;q=0.1' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`remote document load failed: HTTP ${res.status} for ${url}`);
  return { contextUrl: null, document: await res.json(), documentUrl: res.url || url };
}

async function walk(dir) {
  const out = [];
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (IGNORE_DIRS.has(ent.name) || ent.name.startsWith('.')) continue;
      out.push(...await walk(full));
    } else if (/\.(jsonld|json)$/i.test(ent.name)) {
      out.push(full);
    }
  }
  return out;
}

async function loadAllowlist() {
  const file = path.join(HERE, '.expect-error.json');
  if (!existsSync(file)) return {};
  try {
    const raw = JSON.parse(await readFile(file, 'utf8'));
    if (Array.isArray(raw)) return Object.fromEntries(raw.map((k) => [k, '']));
    const obj = raw && typeof raw === 'object' && raw.files ? raw.files : raw;
    return obj && typeof obj === 'object' ? obj : {};
  } catch (e) {
    console.error(`FATAL: could not parse scripts/.expect-error.json — ${e.message}`);
    process.exit(2);
  }
}

function countTriples(nquads) {
  if (!nquads) return 0;
  return nquads.split('\n').filter((l) => l.trim().length > 0).length;
}

async function main() {
  const allow = await loadAllowlist();
  const isAllowed = (rel) => Object.prototype.hasOwnProperty.call(allow, rel);

  const files = (await walk(ROOT)).map(relOf).sort();
  const rows = [];
  const failures = [];
  const allowlistedButPassing = [];
  let pass = 0, expected = 0, skipped = 0;

  // Project rule: @id / @type keyword overrides in a @context are ALLOWED.
  // Standard JSON-LD 1.1 rejects them ("keywords cannot be overridden"), so to
  // validate the rest of the document we strip ONLY those keyword redefinitions
  // from @context objects and retry expansion.
  const stripKeywordOverrides = (value) => {
    const cleanCtx = (ctx) => Array.isArray(ctx) ? ctx.map(cleanCtx)
      : (ctx && typeof ctx === 'object')
        ? Object.fromEntries(Object.entries(ctx).filter(([k]) => k !== '@id' && k !== '@type'))
        : ctx;
    const walk = (n) => Array.isArray(n) ? n.map(walk)
      : (n && typeof n === 'object')
        ? Object.fromEntries(Object.entries(n).map(([k, v]) => [k, k === '@context' ? cleanCtx(v) : walk(v)]))
        : n;
    return walk(value);
  };

  for (const rel of files) {
    const abs = path.join(ROOT, rel);
    let doc;
    try {
      doc = JSON.parse(await readFile(abs, 'utf8'));
    } catch (e) {
      const row = { rel, kind: 'ERROR', detail: `invalid JSON: ${e.message}` };
      if (isAllowed(rel)) { expected++; row.kind = 'xfail'; } else failures.push(row);
      rows.push(row);
      continue;
    }

    if (!doc || typeof doc !== 'object' || Array.isArray(doc) || !('@context' in doc)) {
      skipped++;
      rows.push({ rel, kind: 'skip', detail: 'no top-level @context (schema/data — see validate-schemas.mjs)' });
      continue;
    }

    const contextOnly = Object.keys(doc).length === 1; // only "@context"
    const base = canonicalBase(rel);
    let expanded, nquads, tolerated = false, hardErr = null;
    try {
      expanded = await jsonld.expand(doc, { documentLoader, base });
      nquads = await jsonld.toRDF(doc, { format: 'application/n-quads', documentLoader, base });
    } catch (e1) {
      try { // project rule: tolerate @id/@type keyword overrides — strip & retry
        const sdoc = stripKeywordOverrides(doc);
        expanded = await jsonld.expand(sdoc, { documentLoader, base });
        nquads = await jsonld.toRDF(sdoc, { format: 'application/n-quads', documentLoader, base });
        tolerated = true;
      } catch { hardErr = e1; }
    }
    if (hardErr) {
      const row = { rel, kind: 'ERROR', detail: (hardErr.message || String(hardErr)).split('\n')[0] };
      if (isAllowed(rel)) { expected++; row.kind = 'xfail'; } else failures.push(row);
      rows.push(row);
    } else {
      const triples = countTriples(nquads);
      const nodes = Array.isArray(expanded) ? expanded.length : 0;
      if (!contextOnly && triples === 0) {
        const row = { rel, kind: 'ERROR', detail: 'data document expanded to 0 triples (undefined terms)', nodes, triples, tolerated };
        if (isAllowed(rel)) { expected++; row.kind = 'xfail'; } else failures.push(row);
        rows.push(row);
      } else {
        const row = { rel, kind: contextOnly ? 'context' : 'data', nodes, triples };
        if (tolerated) row.note = 'keyword-override tolerated (non-conformant JSON-LD)';
        if (isAllowed(rel)) { allowlistedButPassing.push(rel); row.note = (row.note ? row.note + '; ' : '') + 'allowlisted but PASSES — remove from .expect-error.json'; }
        pass++;
        rows.push(row);
      }
    }
  }

  // Report
  const pad = (s, n) => String(s).padEnd(n);
  console.log(`\nJSON-LD validation — ${files.length} file(s) under ${toPosix(path.relative(process.cwd(), ROOT)) || '.'}\n`);
  for (const r of rows) {
    if (r.kind === 'skip') {
      console.log(`  skip     ${pad('', 22)} ${r.rel}`);
    } else if (r.kind === 'context') {
      console.log(`  PASS     ${pad('context', 22)} ${r.rel}`);
    } else if (r.kind === 'data') {
      console.log(`  PASS     ${pad(`nodes=${r.nodes} triples=${r.triples}`, 22)} ${r.rel}${r.note ? `   ⚠ ${r.note}` : ''}`);
    } else if (r.kind === 'xfail') {
      console.log(`  xfail    ${pad('allowlisted', 22)} ${r.rel}   (${r.detail})`);
    } else {
      console.log(`  FAIL     ${pad('', 22)} ${r.rel}\n             └─ ${r.detail}`);
    }
  }

  console.log(
    `\nSummary: ${pass} passed, ${expected} expected-error (allowlisted), ` +
    `${skipped} skipped (no @context), ${failures.length} failed.`,
  );
  if (allowlistedButPassing.length) {
    console.log(`\n⚠ ${allowlistedButPassing.length} allowlisted file(s) now PASS — prune scripts/.expect-error.json:`);
    for (const r of allowlistedButPassing) console.log(`    - ${r}`);
  }
  if (failures.length) {
    console.log(`\n✗ ${failures.length} unexpected failure(s):`);
    for (const f of failures) console.log(`    - ${f.rel}`);
    process.exit(1);
  }
  console.log('\n✓ JSON-LD validation passed.');
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});
