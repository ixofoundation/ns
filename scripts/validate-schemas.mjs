#!/usr/bin/env node
/**
 * JSON Schema validation harness for the IXO namespace.
 * See PLAN.md sections 4.0 and 4.5.
 *
 *   (a) Every schema/v1/*.json compiles as a valid JSON Schema (draft 2020-12).
 *   (b) Every conformant example in fixtures/examples/<family>.{json,jsonld}
 *       validates against schema/v1/<family>.json (document-shape).
 *
 * schemas/ does not exist before Phase 5 — then this is a clean no-op.
 * Exit code: 0 if all schemas compile and all examples validate, 1 otherwise.
 */

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import _Ajv2020 from 'ajv/dist/2020.js';
import _addFormats from 'ajv-formats';

const Ajv2020 = _Ajv2020.default || _Ajv2020;
const addFormats = _addFormats.default || _addFormats;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SCHEMA_DIR = path.join(ROOT, 'schema', 'v1');
const EXAMPLES_DIR = path.join(ROOT, 'fixtures', 'examples');
const toPosix = (p) => p.split(path.sep).join('/');

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
  if (!existsSync(SCHEMA_DIR)) {
    console.log('JSON Schema validation — no schemas/ directory yet (added in Phase 5). Skipping.');
    return;
  }
  const ajv = new Ajv2020({ strict: false, allErrors: true, allowUnionTypes: true, validateFormats: true });
  addFormats(ajv);

  const schemaFiles = (await walk(SCHEMA_DIR, /\.json$/)).sort();
  const validators = new Map(); // family stem -> compiled validate
  const failures = [];

  console.log(`\nJSON Schema validation — ${schemaFiles.length} schema(s)\n`);
  for (const abs of schemaFiles) {
    const rel = toPosix(path.relative(ROOT, abs));
    const stem = path.basename(abs, '.json');
    let schema;
    try { schema = JSON.parse(await readFile(abs, 'utf8')); }
    catch (e) { console.log(`  FAIL  ${rel}  (invalid JSON: ${e.message})`); failures.push(rel); continue; }
    try {
      const validate = ajv.compile(schema);
      validators.set(stem, validate);
      console.log(`  ok    ${rel}${schema.$id ? '' : '   ⚠ no $id'}`);
    } catch (e) { console.log(`  FAIL  ${rel}\n          └─ ${(e.message || String(e)).split('\n')[0]}`); failures.push(rel); }
  }

  // (b) validate conformant examples against their schema
  const exampleFiles = (await walk(EXAMPLES_DIR, /\.(json|jsonld)$/)).sort();
  if (exampleFiles.length) {
    console.log(`\nExamples vs schemas — ${exampleFiles.length} example(s)\n`);
    for (const abs of exampleFiles) {
      const rel = toPosix(path.relative(ROOT, abs));
      const stem = path.basename(abs).replace(/\.(json|jsonld)$/, '');
      const validate = validators.get(stem);
      if (!validate) { console.log(`  skip  ${rel}  (no schema/v1/${stem}.json — shape-only)`); continue; }
      const doc = JSON.parse(await readFile(abs, 'utf8'));
      if (validate(doc)) console.log(`  PASS  ${rel}  vs schema/v1/${stem}.json`);
      else { console.log(`  FAIL  ${rel}  vs schema/v1/${stem}.json\n          └─ ${ajv.errorsText(validate.errors, { separator: '\n          └─ ' })}`); failures.push(rel); }
    }
  }

  console.log(`\nSummary: ${failures.length} failure(s).`);
  if (failures.length) process.exit(1);
  console.log('\n✓ JSON Schema validation passed.');
}

main().catch((e) => { console.error('FATAL:', e); process.exit(2); });
