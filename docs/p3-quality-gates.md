# P3 — Quality gates (reasoner-lite CI)

Status of the P3 findings from the expert review (2026-06-08). P3 asked for
automated gates that catch SKOS- and OWL-level regressions instead of relying on
eyeballing. Two dependency-free gates were added and wired into `npm run validate`.

## ✅ SKOS integrity — `scripts/validate-skos.mjs`
Discovers every `skos:ConceptScheme` in the repo and enforces the SKOS integrity
conditions that matter for this data (a stand-in for a full SKOS reasoner).

**Errors (fail the build):**
- a concept missing `skos:inScheme`, or pointing at the wrong scheme
- a concept missing `skos:prefLabel`
- duplicate `skos:notation` within a scheme (notations are the on-chain keys)
- `skos:hasTopConcept` / `skos:topConceptOf` not mutual inverses (drift)
- `skos:broader` / `hasTopConcept` / `topConceptOf` referencing a missing concept
- a concept that is both a top concept and has `skos:broader`

**Warnings (reported, non-fatal):** missing `dcterms:title`/`description`;
duplicate `prefLabel`; `prefLabel` without `@language`; missing `notation`;
orphan concept; `skos:broader` cycle; mapping value that isn't an IRI.

**Result:** 20 schemes, 478 concepts, **0 errors, 0 warnings.** The gate
initially surfaced 8 real gaps — the `oracle-capabilities` P-Function families had
no `skos:notation`; fixed in `build-schemes.mjs` (notation = the kebab id) and
regenerated.

## ✅ Ontology / term consistency — `scripts/validate-vocab.mjs`
A reasoner-lite check in two parts.

- **Part A — vocab lint** (`vocab/v1/index.json`): every class/property declares
  `rdfs:label` + `rdfs:comment`; no duplicate term `@id`; `subClassOf` targets are
  classes and `subPropertyOf` targets are properties (WARN on mismatch).
- **Part B — no dangling `ixo:` reference**, across the vocab *and* every scheme.
  Resolves the target of each semantic-reference predicate (`subClassOf`,
  `subPropertyOf`, `domainIncludes`/`rangeIncludes`, `inverseOf`, `equivalent*`,
  `domain`, `range`) and confirms every `ixo:` target is actually defined — as a
  vocab term, a scheme, or a concept. External namespaces (`rdfs:`, `owl:`,
  `schema:`, `qudt:`, DBpedia, …) are assumed valid; an unknown prefix warns.

This is exactly the class of error a full OWL reasoner would catch here: a
`subPropertyOf` / `inverseOf` / `domainIncludes` pointing at a term that doesn't
exist (typo or drift) — e.g. it resolves all 22 `relationships` concepts'
`rdfs:subPropertyOf ixo:linkedEntity` and `owl:inverseOf #sibling` links.

**Result:** 569 defined ixo terms (vocab + 20 schemes), **0 errors, 0 warnings.**
Non-vacuity was verified with a negative test (a scheme with a dangling
`ixo:doesNotExist` subPropertyOf and a dangling `#alsoMissing` inverseOf both
failed the gate, exit 1), then removed.

## Wiring
`npm run validate` now runs five gates in sequence:
`validate.mjs` (JSON-LD) → `validate-schemas.mjs` (JSON Schema) →
`validate-shapes.mjs` (SHACL) → `validate-skos.mjs` → `validate-vocab.mjs`.
Each is also runnable on its own: `npm run validate:skos`, `npm run validate:vocab`.

## Deferred to P4
- **Full OWL-DL consistency** (HermiT/Pellet-style class-satisfiability and
  disjointness reasoning) needs a JVM reasoner — out of scope for an in-repo JS/CI
  gate. The Part-B reference check covers the practical failure mode.
- **GitHub Actions workflow** to run `npm run validate` on push/PR (no git changes
  are made in this workspace per the standing constraint — the npm wiring is ready
  for whoever adds the `.github/workflows` file).
- **Emerging repo** (`emerging-eco/ns`): port the ontology lint to its generator
  and add SHACL wiring.
- **Retire the 9-entry allowlist** (`scripts/.expect-error.json`) by fixing or
  reformatting the legacy on-chain JSON those entries cover.
