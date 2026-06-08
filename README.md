# IXO Namespace

> Interpretation layer for entities, claims, credentials, and related artefacts on the IXO Spatial Web. Published at `https://w3id.org/ixo/*`.

## What this is

This repository hosts the JSON-LD contexts, vocabularies, concept schemes, schemas, and SHACL shapes that let consumers interpret IXO data: entity domains on Impact Hub, claims and credentials issued by oracles and agents, and linked resources referenced from on-chain documents.

The namespace **does not duplicate the on-chain graph**. Specific entities, their relationships, and their lifecycle state all live on Impact Hub (queryable via Blocksync). This repository defines what the *fields, types, and codes* in those records mean.

## Status: v2 rebuild in progress

The current `main` branch reflects historical contents that have known correctness issues (audit findings documented in [`PLAN.md`](./PLAN.md), Appendix A).

Active work is on branch [`ns-v2`](https://github.com/ixofoundation/ns/tree/ns-v2). The rebuild covers:

- A working JSON-LD umbrella context (fixing duplicate keys, illegal keyword overrides, undefined terms).
- A proper RDFS/OWL vocabulary with class hierarchy, properties, and bridging to schema.org / PROV-O / FOAF / DPV / W3C VC / DID Core.
- SKOS concept schemes for every closed enum (entity types, claim types, credential types, P-Functions, status, stage, payment types, …).
- JSON Schemas and SHACL shapes per claim/credential family, exercised against real on-chain fixtures.
- A coordinated update to `https://w3id.org/ixo/*` redirects (branch `ns-v2-redirects` on [ixofoundation/w3id.org](https://github.com/ixofoundation/w3id.org)).

See [`PLAN.md`](./PLAN.md) for the full project plan, phase-by-phase task lists, dependency graph, and Claude Code prompts.

## Layout

```
context/v1/             JSON-LD umbrella context (entry point for consumers)
vocab/v1/               Core vocabulary — RDFS/OWL classes & properties (index.json) + countries.json
protocol/<thing>/v1/    SKOS concept schemes — closed enums & taxonomies (legacy structure)
schema/v1/              JSON Schemas — document-shape validation
schema/shapes/v1/       SHACL shapes — graph-shape validation
templates/v1/           Credential and claim templates
scripts/                Validation harness
.github/workflows/      CI
```

The repo follows the **legacy `protocol/` structure**: concept schemes live at
`protocol/<thing>/v1/index.json` (e.g. `protocol/claims/v1`), not under a
separate `vocab/<scheme>` tree. See [`PLAN.md`](./PLAN.md) section 2.

## How to use the namespace

The entry point for any consumer is the umbrella context:

```json
{
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://w3id.org/ixo/context/v1"
  ],
  "id": "did:ixo:entity:abc123",
  "type": ["VerifiableCredential", "ixo:DomainCard"],
  …
}
```

This single context import gives access to all IXO classes, properties, and prefix shortcuts (`entityType:`, `claimType:`, `oracleCap:`, `status:`, etc.). Individual concept schemes can be loaded directly if needed:

- `https://w3id.org/ixo/protocol/entities/v1` — entity type concepts (project, dao, oracle, asset, …)
- `https://w3id.org/ixo/protocol/claims/v1` — claim type concepts
- `https://w3id.org/ixo/protocol/oracle-capabilities/v1` — P-Functions
- `https://w3id.org/ixo/vocab/v1/countries` — country codes
- … (see [`PLAN.md`](./PLAN.md) Appendix B for the full list)

## Local validation

```bash
git clone https://github.com/ixofoundation/ns.git
cd ns
git checkout ns-v2
npm install
npm run validate
```

The validation suite runs three checks on every JSON-LD, JSON Schema, and SHACL shape file:

1. **JSON-LD expansion** — file parses, no keyword overrides, produces non-zero triples.
2. **JSON Schema validation** — `schemas/v1/*.json` files are themselves valid JSON Schema draft 2020-12.
3. **SHACL conformance** — fixtures in `fixtures/on-chain/` (if present) conform to their shapes.

CI runs all three on every pull request.

## Canonical URI form

`https://w3id.org/ixo/<path>` is the canonical form for every namespace IRI. The legacy `https://w3id.org/ixo/ns/<path>` variant 301-redirects to canonical and should not be used in new code.

Namespace IRIs use `303 See Other` semantics (not `302`), reflecting their nature as identifiers of abstract resources (concepts, properties, classes) that redirect to descriptive documents.

## Contributing

The active rebuild is being executed as a series of self-contained phases. See [`PLAN.md`](./PLAN.md) for the phase plan and [the PR template](.github/PULL_REQUEST_TEMPLATE.md) for review expectations.

For substantive design questions, the discussion lives in the `#ixo-data` Slack channel and surfaces back to this repo through PRs that link to specific decisions.

## License

MIT. See [`LICENSE`](./LICENSE).

## Related repositories

- [`ixofoundation/w3id.org`](https://github.com/ixofoundation/w3id.org) — redirect configuration for `w3id.org/ixo/*`.
- [`ixofoundation/ixo-protocol`](https://github.com/ixofoundation/ixo-protocol) — protocol specifications (data models, IID method, IVP spec).
- [`ixofoundation/ixo-blockchain`](https://github.com/ixofoundation/ixo-blockchain) — Impact Hub Cosmos SDK chain.
- [`ixofoundation/ixo-multiclient-sdk`](https://github.com/ixofoundation/ixo-multiclient-sdk) — TypeScript SDK that consumes this namespace.
- [`emerging-eco/ns`](https://github.com/emerging-eco/ns) — downstream namespace for the Emerging Cooking Solutions dMRV use case (rebuild scheduled as Phase 7).
- [Documentation hub](https://docs.ixo.world) — canonical IXO docs (concepts, glossary, platform guides).
