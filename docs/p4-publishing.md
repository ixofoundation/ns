# P4 — Publishing & CI hardening: status

Status of the P4 findings from the expert review (2026-06-08). All workspace-only
(no commits), per the standing constraint.

## ✅ CI wiring
- **IXO** `.github/workflows/validate.yml` now runs all **five** gates (was three):
  JSON-LD, JSON Schema, SHACL, SKOS integrity, ontology consistency.
- **Emerging** (`emerging-eco/ns`) gained `.github/workflows/validate.yml` running its
  three gates (JSON-LD, SKOS, ontology).

## ✅ Allowlist retired — 9 → 0
The validator allowlist (`scripts/.expect-error.json`) is now **empty**; the whole
repo validates with nothing exempted. What happened to the 9 legacy entries:

**Salvaged to SKOS (10 new schemes).** The legacy enum catalogues were rebuilt as
proper concept schemes by `build-schemes.mjs` (data extracted to
`scripts/salvaged.data.json`, the `countries.data.json` pattern):
`blockchain-account-types` (40), `media-formats` (8), `metric-types` (2),
`asset-types` (14), `dao-types` (19), `deed-types` (26), `oracle-types` (20),
`group-types` (5), `pod-types` (11), `project-types` (21). SKOS schemes: **20 → 30**,
concepts **478 → 644**.

**Kept as plain-data files (off the allowlist).** Four of the legacy files are
**dereferenced live** by the studio survey-choices API via `?...&path=<key>`
(confirmed in the on-chain corpus): `protocol/blockchain-account/v1` (`path=blockchainAccount`),
`protocol/linked-resources/v1/format.json` (`path=format`), `protocol/metric/v1`,
and `protocol/tags/v1` (`path=deedType`/`protocolType`/`groupType`/…). These **must keep
their exact structure and paths**, so they were left in place as plain JSON — only
the vestigial 0-triple `@context` was stripped, which takes them off the allowlist
(the validator skips no-`@context` JSON) without changing the data the studio reads.
Their semantics now also live in the SKOS `*-types` / `*-formats` schemes above.
> ⚠ `protocol/tags/v1`'s `protocolType` branch was **not** re-published as SKOS — it
> duplicates the existing `protocol/claims/v1` + `protocol/credentials/v1` schemes.

**Deleted (genuinely dead, not IXO content).** `protocol/attributes/v1/index.json`
(a partial copy of schema.org's own terms), `attributes/index.json` +
`attributes/tokenMetadata.json` (a stale dictionary manifest with a typo'd reference
+ one carbon-credit instance), `activity/v1/index.json` (a scrape of the EU
Sustainable-Finance taxonomy, HTML markup and all), and `measure/v1/index.json` (a
malformed empty-IRI stub). **Kept:** `protocol/attributes/v1/schema.json` — a valid,
complete schema.org JSON-LD context (not in the allowlist; out of scope).

## ✅ Quality gates ported to the emerging repo
`emerging-eco/ns` now runs `validate-skos.mjs` (copied verbatim — namespace-agnostic;
covers the `codes` A–J scheme) and `validate-vocab.mjs` (adapted: `emerging` is the
local namespace, `ixo` is a known external bridge prefix). Result: SKOS 1 scheme /
10 concepts 0/0; ontology 88 terms 0/0.

## ✅ HTML docs + content negotiation
- `scripts/build-docs.mjs` generates a single self-contained **`docs/index.html`**
  (no runtime deps, inline CSS) from the vocabulary + all 30 schemes — class &
  property tables plus a section per concept scheme. `npm run build:docs`.
- The w3id `.htaccess` now **content-negotiates**: a request with `Accept: text/html`
  (a browser) for `vocab/*`, `protocol/*`, or the namespace root is 303-redirected to
  the docs page; machine clients (`application/ld+json`, `application/json`, `*/*`) and
  explicit `.json`/`.jsonld` requests fall through to the document rules and get JSON-LD.

## Deferred
- **Full OWL-DL reasoner** (class satisfiability / disjointness) — needs a JVM tool
  (HermiT/Pellet/ROBOT); the `validate-vocab` reference check covers the practical case.
- **Emerging SHACL** — would need shape authoring + `rdf-validate-shacl`/`rdf-ext` deps
  (the emerging repo currently has only `ajv` + `jsonld`).
- **Per-resource conneg anchors** — browsers currently land on the docs page root, not
  a `#scheme-…` anchor; the page has the anchors, the `.htaccess` rule doesn't map to them.
- **Redirect simulator** (`w3id.org/ixo/tests/validate-redirects.sh`) doesn't yet
  exercise the `Accept`-header conneg rules.

## Re-generation / validation
```
npm run build:schemes   # regenerate the 30 SKOS schemes (+ salvaged)
npm run build:docs      # regenerate docs/index.html
npm run validate        # all 5 gates (ixo)   — green
# emerging: npm run validate                  — green (3 gates)
```
