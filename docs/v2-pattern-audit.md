# v2 pattern audit — alignment with the main-branch ontology conventions

**Date:** 2026-08-13
**Scope:** the whole `v2` tree, audited against the module pattern established by the
constitutional-ontology work on `main` (PRs #9–#11, July 2026) and the subsequent
`did:ixo` canonical record, plus the usage-billing module (PR #12).

## The reference pattern

The recent `main` additions establish this shape for namespace extensions:

| # | Pattern | Reference |
|---|---|---|
| P1 | A module is a directory `vocab/v1/<module>/` holding `index.jsonld` (OWL ontology), `example.jsonld`, `README.md`, plus catalogue files when large (`subjects.jsonld`) | `vocab/v1/constitution/` |
| P2 | The ontology opens with a header node: `dcterms:title`, `dcterms:description`, `owl:versionInfo`, `dcterms:issued`, `dcterms:source` | constitution + billing `index.jsonld` |
| P3 | Every class/property carries `rdfs:label` + `skos:definition` (vocab uses `rdfs:comment`), grounded with `dcterms:source` / `rdfs:seeAlso` where external | constitution `index.jsonld` |
| P4 | The umbrella context is extended additively: a short prefix (`con:`, `bil:`) plus scoped contexts (property-scoped for wrapper terms, type-scoped for credential-subject types) | `context/v1/index.jsonld` on main |
| P5 | Modules are registered on the core vocabulary via `owl:imports` | `vocab/v1/index.jsonld` on main |
| P6 | Module README covers purpose, namespace IRI, model boundary, term tables, source basis | constitution + billing READMEs |
| P7 | JSON-LD documents use the `.jsonld` extension | repo-wide on v2 (`94212e7`) |

## Findings and resolutions

### Ported in this audit (were missing from v2)

1. **`vocab/v1/constitution/`** — Shaun's constitutional ontology (4 files, at main
   `a85b266`, version 1.2.0 including the generalized subject taxonomy) was absent from
   v2, which forked before July 2026. **Ported verbatim.**
2. **`vocab/v1/billing/`** — the usage-billing ontology (PR #12: `UsageClaim`,
   `UsageBillingSettlement`, eddsa-jcs-2022 credential examples). **Ported verbatim.**
3. **`did/v1/`** — the canonical `did:ixo` DID Method specification (`readme.md`) and
   method context (`index.jsonld`) from main (June 2026) were absent. **Ported.** v2's
   `interchain-identifiers/v1/` remains the method-term context it documents; `did/v1`
   is the canonical spec per its own conformance section.
4. **Umbrella context wiring** — `context/v1/index.jsonld` gained the `con:` and `bil:`
   prefixes, the property-scoped `constitution` block, and type-scoped contexts for
   `UsageClaim` / `UsageBillingSettlement` (P4), restated in v2's flat context style.
   Improvement over main: v2's context does not import the W3C DID v1 context, so the
   `service` term is not protected here and **is** mapped inside both billing
   type-scoped contexts (`bil:service`) — on main that mapping is impossible
   (protected-term override) and deliberately omitted.
5. **`owl:imports` registration** (P5) — v2's core-vocabulary header now imports the
   constitution and billing module IRIs.

### Fixed in this audit (v2-internal pattern drift)

6. **Stale `.json` references** (P7) — `docs/adding-ontologies-and-terms.md` (10×) and
   `README.md` (2×) still referenced `index.json` paths after the repo-wide `.jsonld`
   rename; the scheme generator itself emits `index.jsonld`. **All updated.**
7. **Stale branch name** — `README.md` pointed at branch `ns-v2`; the branch is `v2`.
   **Updated** (including the clone instructions).
8. **README layout** — did not mention ontology modules, `did/v1`, or
   `interchain-identifiers/v1`. **Updated**, with a paragraph codifying the module
   pattern (P1–P6) for future additions.

### Reviewed, deliberately left as-is

9. **Plain-JSON legacy data files** (`protocol/blockchain-account/v1/index.json`,
   `protocol/metric/v1/index.json`, `protocol/services/v1/index.json`,
   `protocol/tags/v1/index.json`, `protocol/entities/v1/relationship.json`,
   `protocol/linked-resources/v1/format.json`, `protocol/credentials/v1/KYCAMLLevel1.json`,
   `schema/v1/token.json`, `fixtures/examples/token.json`) — these are not JSON-LD
   (no `@context`; the validator skips them as such), they are live w3id resolution
   targets, and renaming them would break published redirects. P7 applies to JSON-LD
   documents only.
10. **SKOS schemes without per-folder READMEs** — v2 documents schemes centrally
    (`docs/`, `build:docs`) and generates them from `build-schemes.mjs`; per-module
    READMEs (P6) apply to hand-authored ontology modules, not generated schemes.
11. **v2 umbrella context maps DID-core term names to `ixo:` IRIs** (e.g.
    `controller` → `ixo:controller`) instead of importing the W3C DID context the way
    main does. This is a settled v2 architectural principle (PLAN.md §1) — bridging to
    external vocabularies happens in the vocabulary layer, and the DID-core terms are
    individually `@protected`. Not changed; noted because it is the one place v2 and
    main intentionally diverge on P4's "protected" mechanics.
12. **`did/v1/readme.md` lowercase filename** — matches the file as published on main
    (the canonical record); left byte-identical rather than renamed.

## Validation

`npm run validate` (JSON-LD expansion, JSON Schema, SHACL, SKOS integrity, ontology
consistency, resource-context lint) passes with **0 errors** before and after these
changes; the ported modules are picked up by the JSON-LD gate (57 documents validated).
