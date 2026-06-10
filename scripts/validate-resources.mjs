#!/usr/bin/env node
/**
 * Resource-context resolution linter (forward guard).
 *
 * Catches the anti-patterns found in the 2026-06-09 mainnet audit so they can
 * never ship in a newly-minted linked resource / claim / credential body:
 *
 *   E1 non-terminated namespace  — a prefix used in a CURIE resolves to an IRI
 *      that does not end in '#' or '/', so `ixo:Tags` concatenates to
 *      `…/vocab/v1Tags` instead of `…/vocab/v1#Tags`.            (audit Q1)
 *   E2 core-prefix redefined     — an inline @context redefines a canonical
 *      prefix (ixo, schema, …) to a base that differs from context/v1.  (Q1/Q5)
 *   E3 ixo aliased to a context  — `ixo` pointed at a …/context/… URL instead
 *      of the vocab namespace.                                          (Q4)
 *   E4 @id aliased to @type      — inline @context maps `@id`/`id` to `@type`,
 *      so the resource body cannot carry a node identifier.             (Q8)
 *   W1 unknown prefix            — a CURIE prefix that no in-scope context defines.
 *
 * Canonical prefixes are read from context/v1/index.jsonld. A resource that
 * only *references* https://w3id.org/ixo/context/v1 (no inline override) is
 * clean by construction — that is the shape the v2 templates use.
 *
 * Usage:  node scripts/validate-resources.mjs [dir]   (default: templates/v1)
 * Exit 0 if no errors, 1 otherwise.
 */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const TARGET = path.resolve(ROOT, process.argv[2] ?? 'templates/v1');

const CANONICAL_CTX_URL = 'https://w3id.org/ixo/context/v1';
// URI schemes / JSON-LD keywords that are not vocab CURIE prefixes.
const SKIP_PREFIXES = new Set(['did', 'http', 'https', 'ipfs', 'urn', 'mailto', 'tel',
  'data', 'file', 'web3', 'cellnode', '_', 'protocol']);

const asArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const toPosix = (p) => p.split(path.sep).join('/');
const terminated = (iri) => /[#/]$/.test(iri);

/** Read the canonical prefix→IRI map (string-valued namespace decls) from context/v1. */
async function loadCanonical() {
  const doc = JSON.parse(await readFile(path.resolve(ROOT, 'context/v1/index.jsonld'), 'utf8'));
  const ctx = doc['@context'] || {};
  const map = {};
  for (const [k, v] of Object.entries(ctx))
    if (typeof v === 'string' && /^https?:\/\//.test(v) && terminated(v)) map[k] = v;
  return map;
}

/** Prefixes that are legitimately defined by a claim-time context (not context/v1),
 *  so they shouldn't be warned about as "unknown" — e.g. ecs/emerging in claimcontext. */
async function loadKnownPrefixes(canonical) {
  const known = new Set(Object.keys(canonical));
  try {
    const cc = JSON.parse(await readFile(path.resolve(ROOT, 'claimcontext/v1/index.jsonld'), 'utf8'))['@context'] || {};
    for (const [k, v] of Object.entries(cc)) if (typeof v === 'string' && /^https?:\/\//.test(v)) known.add(k);
  } catch { /* claimcontext optional */ }
  return known;
}

/** Collect inline string-valued prefix declarations from a doc's @context. */
function inlinePrefixes(ctx) {
  const map = {};
  for (const c of asArray(ctx))
    if (c && typeof c === 'object')
      for (const [k, v] of Object.entries(c))
        if (typeof v === 'string' && /^https?:\/\//.test(v)) map[k] = v;
  return map;
}
const refsCanonical = (ctx) => asArray(ctx).some((c) => c === CANONICAL_CTX_URL);

/** Find every prefix used as a CURIE (`prefix:local`) anywhere in the doc. */
function usedPrefixes(node, out = new Set()) {
  const scan = (s) => {
    if (typeof s !== 'string') return;
    const m = /^([A-Za-z][\w-]*):[A-Za-z]/.exec(s);
    if (m) out.add(m[1]);
  };
  if (Array.isArray(node)) node.forEach((n) => usedPrefixes(n, out));
  else if (node && typeof node === 'object')
    for (const [k, v] of Object.entries(node)) {
      if (k !== '@context') { scan(k); usedPrefixes(v, out); }
    }
  else scan(node);
  return out;
}

async function walk(dir) {
  const out = [];
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) { if (!['node_modules', '.git'].includes(ent.name)) out.push(...await walk(path.join(dir, ent.name))); }
    else if (/\.(json|jsonld)$/.test(ent.name)) out.push(path.join(dir, ent.name));
  }
  return out;
}

async function main() {
  const canonical = await loadCanonical();
  const known = await loadKnownPrefixes(canonical);
  const files = (await walk(TARGET)).sort();
  let errs = 0, warns = 0, scanned = 0, clean = 0;

  for (const abs of files) {
    let doc; try { doc = JSON.parse(await readFile(abs, 'utf8')); } catch { continue; }
    if (doc['@context'] === undefined) continue;
    scanned++;
    const rel = toPosix(path.relative(ROOT, abs));
    const inline = inlinePrefixes(doc['@context']);
    const hasCanon = refsCanonical(doc['@context']);
    const used = usedPrefixes(doc);
    const fileMsgs = [];

    // E3 — ixo aliased to a context document
    if (inline.ixo && /\/context\//.test(inline.ixo))
      fileMsgs.push(`✗ E3 ixo aliased to a context URL (${inline.ixo}) — should be the vocab namespace`);

    // E4 — @id / id aliased to @type (resource cannot carry a node identifier)
    for (const c of asArray(doc['@context']))
      if (c && typeof c === 'object')
        for (const kw of ['@id', 'id'])
          if (c[kw] === '@type') fileMsgs.push(`✗ E4 "${kw}" aliased to "@type" — the resource cannot carry a node identifier`);

    for (const p of used) {
      if (SKIP_PREFIXES.has(p)) continue;
      const def = inline[p] ?? (hasCanon ? canonical[p] : undefined);
      if (!def) {
        if (!known.has(p)) { fileMsgs.push(`⚠ W1 prefix "${p}:" used but not defined by any in-scope context`); warns++; }
        continue;
      }
      if (!terminated(def)) fileMsgs.push(`✗ E1 prefix "${p}:" → ${def} is not '#'/'/'-terminated (CURIEs will mis-concatenate)`);
      else if (canonical[p] && def !== canonical[p])
        fileMsgs.push(`✗ E2 prefix "${p}:" redefined to ${def} (canonical: ${canonical[p]})`);
    }

    const fileErrs = fileMsgs.filter((m) => m.startsWith('✗')).length;
    errs += fileErrs;
    if (fileMsgs.length) { console.log(`\n  ${rel}`); fileMsgs.forEach((m) => console.log(`    ${m}`)); }
    else clean++;
  }

  console.log(`\nResource context resolution — target: ${toPosix(path.relative(ROOT, TARGET))}`);
  console.log(`  scanned ${scanned} JSON-LD resource(s): ${clean} clean, ${errs} error(s), ${warns} warning(s).`);
  if (errs) { console.log('\n✗ Resource context lint failed.'); process.exit(1); }
  console.log('\n✓ Resource context lint passed.');
}

main().catch((e) => { console.error('FATAL:', e); process.exit(2); });
