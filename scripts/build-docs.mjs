#!/usr/bin/env node
/**
 * Human-readable HTML documentation generator for the IXO namespace
 * (review item P4 — HTML docs + content negotiation).
 *
 * Reads the core vocabulary (vocab/v1/index.json) and every SKOS concept scheme,
 * and emits a single self-contained docs/index.html (no runtime deps, inline CSS).
 * The w3id .htaccess content-negotiates browsers (Accept: text/html) to this page;
 * machine clients keep getting the JSON-LD. Re-run:  node scripts/build-docs.mjs
 */

import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const toPosix = (p) => p.split(path.sep).join('/');
const SKIP = new Set(['node_modules', '.git', 'fixtures', 'schema', 'templates', 'context', 'docs', 'scripts', '.github']);
const CLASS_TYPES = ['rdfs:Class', 'owl:Class'];
const PROP_TYPES = ['rdf:Property', 'owl:ObjectProperty', 'owl:DatatypeProperty'];

const asArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const hasType = (n, ts) => asArray(n && n['@type']).some((t) => ts.includes(t));
const idOf = (v) => (v == null ? null : typeof v === 'string' ? v : v['@id'] ?? null);
const val = (v) => (v == null ? '' : typeof v === 'string' ? v : Array.isArray(v) ? val(v[0]) : v['@value'] ?? '');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const frag = (id) => (id || '').includes('#') ? '#' + id.split('#').pop() : (id || '').split('/').pop();

async function walk(dir) {
  const out = [];
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) { if (!SKIP.has(ent.name)) out.push(...await walk(path.join(dir, ent.name))); }
    else if (/\.(json|jsonld)$/.test(ent.name)) out.push(path.join(dir, ent.name));
  }
  return out;
}

function ontology(doc) {
  const classes = [], props = [];
  for (const n of doc['@graph'] || []) {
    if (hasType(n, ['owl:Ontology'])) continue;
    const row = { id: n['@id'], label: val(n['rdfs:label']) || n['@id'], comment: val(n['rdfs:comment']),
      sub: asArray(n['rdfs:subClassOf']).concat(asArray(n['rdfs:subPropertyOf'])).map(idOf).filter(Boolean),
      dom: asArray(n['schema:domainIncludes']).map(idOf).filter(Boolean),
      ran: asArray(n['schema:rangeIncludes']).map(idOf).filter(Boolean) };
    if (hasType(n, CLASS_TYPES)) classes.push(row);
    else if (hasType(n, PROP_TYPES)) props.push(row);
  }
  const by = (a, b) => a.label.localeCompare(b.label);
  return { classes: classes.sort(by), props: props.sort(by) };
}

function scheme(doc) {
  const s = (doc['@graph'] || []).find((n) => asArray(n['@type']).includes('skos:ConceptScheme'));
  if (!s) return null;
  const concepts = (doc['@graph'] || []).filter((n) => asArray(n['@type']).includes('skos:Concept')).map((n) => ({
    id: n['@id'], notation: n['skos:notation'] ?? '', label: val(n['skos:prefLabel']),
    def: val(n['skos:definition']), broader: frag(idOf(n['skos:broader'])), top: n['skos:topConceptOf'] !== undefined,
  }));
  return { id: s['@id'], title: val(s['dcterms:title']) || s['@id'], description: val(s['dcterms:description']), concepts };
}

const CSS = `:root{--fg:#1a1a2e;--mut:#5b6472;--line:#e4e7ec;--accent:#3a0ca3;--bg:#fff;--code:#f4f4f8}
*{box-sizing:border-box}body{font:15px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:var(--fg);background:var(--bg);margin:0}
.wrap{max-width:1040px;margin:0 auto;padding:2.5rem 1.25rem 5rem}
h1{font-size:2rem;margin:0 0 .25rem}h2{font-size:1.4rem;margin:2.5rem 0 .5rem;padding-top:.5rem;border-top:1px solid var(--line)}
h3{font-size:1.05rem;margin:1.75rem 0 .35rem}a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
.lead{color:var(--mut);font-size:1.05rem;max-width:70ch}.muted{color:var(--mut)}code{background:var(--code);padding:.1em .35em;border-radius:4px;font-size:.85em}
table{border-collapse:collapse;width:100%;margin:.5rem 0 1rem;font-size:.9rem}th,td{text-align:left;vertical-align:top;padding:.45rem .6rem;border-bottom:1px solid var(--line)}
th{color:var(--mut);font-weight:600;font-size:.78rem;text-transform:uppercase;letter-spacing:.03em}td code{white-space:nowrap}
.toc{columns:2;gap:1.5rem;margin:1rem 0 0;padding:0;list-style:none}.toc li{margin:.15rem 0}
.pill{display:inline-block;background:var(--code);color:var(--mut);border-radius:999px;padding:.05rem .55rem;font-size:.78rem;margin-left:.4rem}
footer{margin-top:3rem;padding-top:1rem;border-top:1px solid var(--line);color:var(--mut);font-size:.85rem}`;

function rows(items, cells) { return items.map((it) => `<tr>${cells(it)}</tr>`).join('\n'); }

async function main() {
  const vocab = JSON.parse(await readFile(path.join(ROOT, 'vocab/v1/index.json'), 'utf8'));
  const onto = ontology(vocab);

  const schemes = [];
  for (const abs of (await walk(ROOT)).sort()) {
    let doc; try { doc = JSON.parse(await readFile(abs, 'utf8')); } catch { continue; }
    if (!Array.isArray(doc['@graph'])) continue;
    const s = scheme(doc);
    if (s) schemes.push({ ...s, rel: toPosix(path.relative(ROOT, abs)), anchor: 'scheme-' + frag(s.id) });
  }
  schemes.sort((a, b) => a.title.localeCompare(b.title));

  const clsRow = (r) => `<td><code id="${esc(frag(r.id))}">${esc(r.id)}</code></td><td>${esc(r.label)}</td><td>${esc(r.comment)}</td><td>${r.sub.map((s) => `<code>${esc(s)}</code>`).join(' ')}</td>`;
  const propRow = (r) => `<td><code id="${esc(frag(r.id))}">${esc(r.id)}</code></td><td>${esc(r.label)}</td><td>${esc(r.comment)}</td><td>${r.dom.map((s) => `<code>${esc(s)}</code>`).join(', ') || '<span class="muted">—</span>'} → ${r.ran.map((s) => `<code>${esc(s)}</code>`).join(', ') || '<span class="muted">—</span>'}</td>`;
  const conRow = (c) => `<td><code>${esc(c.notation)}</code></td><td>${esc(c.label)}</td><td>${esc(c.def)}</td><td>${c.broader ? `<code>${esc(c.broader)}</code>` : '<span class="muted">top</span>'}</td>`;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>IXO Namespace</title><style>${CSS}</style></head>
<body><div class="wrap">
<h1>IXO Namespace</h1>
<p class="lead">Human-readable documentation for the IXO Spatial Web namespace — the core RDFS/OWL vocabulary and the SKOS concept schemes published under <code>https://w3id.org/ixo/</code>. Machine clients receive JSON-LD from the same IRIs via content negotiation.</p>
<p class="muted">Vocabulary: <a href="https://w3id.org/ixo/vocab/v1">vocab/v1</a> · Context: <a href="https://w3id.org/ixo/context/v1">context/v1</a> · ${onto.classes.length} classes · ${onto.props.length} properties · ${schemes.length} concept schemes</p>

<h2 id="vocabulary">Core vocabulary</h2>
<h3>Classes <span class="pill">${onto.classes.length}</span></h3>
<table><thead><tr><th>Term</th><th>Label</th><th>Comment</th><th>Subclass of</th></tr></thead>
<tbody>${rows(onto.classes, clsRow)}</tbody></table>
<h3>Properties <span class="pill">${onto.props.length}</span></h3>
<table><thead><tr><th>Term</th><th>Label</th><th>Comment</th><th>Domain → Range</th></tr></thead>
<tbody>${rows(onto.props, propRow)}</tbody></table>

<h2 id="schemes">Concept schemes <span class="pill">${schemes.length}</span></h2>
<ul class="toc">${schemes.map((s) => `<li><a href="#${s.anchor}">${esc(s.title)}</a> <span class="muted">(${s.concepts.length})</span></li>`).join('')}</ul>
${schemes.map((s) => `<h3 id="${s.anchor}">${esc(s.title)} <span class="pill">${s.concepts.length}</span></h3>
<p class="muted">${esc(s.description)}<br><code>${esc(s.id)}</code></p>
<table><thead><tr><th>Notation</th><th>Label</th><th>Definition</th><th>Broader</th></tr></thead>
<tbody>${rows(s.concepts, conRow)}</tbody></table>`).join('\n')}

<footer>Generated from the namespace sources by <code>scripts/build-docs.mjs</code>. This page is regenerated from the JSON-LD; do not edit by hand.</footer>
</div></body></html>
`;

  await mkdir(path.join(ROOT, 'docs'), { recursive: true });
  await writeFile(path.join(ROOT, 'docs/index.html'), html, 'utf8');
  console.log(`  wrote docs/index.html — ${onto.classes.length} classes, ${onto.props.length} properties, ${schemes.length} schemes`);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(2); });
