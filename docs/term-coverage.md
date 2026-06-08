# On-chain term coverage (Phase 4)

> **Note (2026-06-07):** Paths below predate the legacy-structure consolidation. SKOS schemes now live at `protocol/<thing>/v1/` (not `vocab/<scheme>/v1/`), JSON Schemas at `schema/v1/`, SHACL shapes at `schema/shapes/v1/`. See PLAN.md §2.

How the IXO namespace (context + vocabulary + SKOS schemes) covers the data
actually published on Impact Hub mainnet. Generated and verified with
`scripts/analyze-coverage.mjs` against the corpus in
[`GraemeLeightonIXO/ixo-mainnet-linked-resources`](https://github.com/GraemeLeightonIXO/ixo-mainnet-linked-resources)
(scanned 2026-05-15: 9,270 IID documents, 585 resource payloads, 254
structurally-deduplicated resource schemas).

## Method

Each file is expanded with its own `@context` (resolving `https://w3id.org/ixo/*`
— including the legacy `ns/` form — against this working copy, and W3C VC
contexts over the network) and serialised to RDF. Every distinct JSON key is
classified as **covered-by-ixo**, **covered-by-VC**, a JSON-LD keyword, or
**UNDEFINED** (a silent drop). Every distinct `type` / `@type` value is
collected as a candidate concept. Sample analysed: 200 IID docs + all 254
deduped resource schemas + all 585 resource payloads.

## Headline result

| Category | Files | Produce triples | Triples (before → after Phase 4) |
|---|---|---|---|
| IID documents | 200 sampled | 200 / 200 | 5,813 → **10,301** (+77%) |
| Resource payloads | 585 | 96 (+180 schema-only) | 218 → **719** |
| Deduped resource schemas | 254 | 88 (+73 schema-only) | 31 → **89** |

Distinct JSON keys: **601** — ixo-covered **64** (was 37), VC-covered 6, the
remaining ~531 are third-party document formats (see *Out of scope*).

Every IID document now expands to a rich graph: identity (`controller`,
`verificationMethod`, `authentication`, …), accounts (`blockchainAccountID`,
`publicKeyBase58`), services (`service`, `serviceEndpoint`), linked resources
(`linkedResource` with `mediaType`, `encrypted`, `right`), `linkedClaim`,
`accordedRight`, `alsoKnownAs`, `relayerNode` and `metadata`.

## Terms added in Phase 4

Driven by the on-chain data, classified per PLAN.md §4.4.

### Classes → `vocab/v1` (used as `@type` in resources)

`ixo:Attribute`, `ixo:DomainCard`, `ixo:Profile`, `ixo:ResearchProfile`,
`ixo:Embedding`, `ixo:AgentCard`, `ixo:Tags`, `ixo:Page`.

### Properties → `vocab/v1` + surfaced in `context/v1`

| Property | Maps to | Seen as |
|---|---|---|
| `serviceEndpoint` | `ixo:serviceEndpoint` ≡ `did:serviceEndpoint` | 886× (service / linkedResource) |
| `blockchainAccountID` | `ixo:blockchainAccountID` | 261× (verificationMethod) |
| `publicKeyBase58` / `publicKeyMultibase` | `sec:*` | 266× |
| `alsoKnownAs` | `ixo:alsoKnownAs` ≡ `did:alsoKnownAs` | 262× |
| `relayerNode` | `ixo:relayerNode` | 264× |
| `metadata`, `versionId`, `deactivated` | `ixo:*` | IID metadata block |
| `mediaType` | `dcterms:format` | linkedResource |
| `encrypted`, `right` | `ixo:encrypted`, `ixo:right` | 870× each |
| `title`, `value`, `url`, `logo`, `brand`, `location`, `label`, `orgName` | `dcterms:` / `schema:` / `rdfs:` | profiles, attributes, pages |
| `metrics`, `attributes`, `tokenName`, `tags`, `entityTags`, `page`, `pages` | `ixo:*` | profiles, tags, pages, tokens |

### SKOS — new schemes and concepts

| Scheme | Action | Source (on-chain `type`) |
|---|---|---|
| `linked-resource-types` (27) | **new** | `linkedResource.type` — Settings, VerifiableCredential, WebDashboard, TokenMetadata, domainCard, surveyTemplate, … |
| `accorded-right-types` (11) | **new** | `accordedRight.type` — `capability/mintToken`, `capability/attest`, `legal`, `AccessToken`, … |
| `node-types` (+6) | extended | `service.type` — MatrixHomeServer, Matrix, oracleService, wsService, chainService, linkedDomains |
| `credential-types` (+2) | extended | AdministratorCredential, CreatorCredential |
| `claim-types` (+1) | extended | `linkedClaim.type` Payment |

`service.type` and `linkedClaim.type` otherwise already mapped to `node-types`
and `claim-types`; `entity.type` (incl. all 36 slash-notation values) was
already covered by `entity-types` in Phase 3. The two new scheme paths resolve
through the Phase 2 generic `vocab/<scheme>/v1` redirect rule — no `.htaccess`
change required. Two prefixes (`resourceType:`, `rightType:`) were added to the
umbrella context.

## Out of scope (intentionally not modelled)

The bulk of the ~531 undefined keys belong to **third-party document formats**
embedded as linked-resource bodies. These are validated by their own tooling,
not by the IXO vocabulary, and are deliberately left unmodelled:

| Format | Example keys | Resource type |
|---|---|---|
| SurveyJS form templates | `elements`, `visibleIf`, `choicesByUrl`, `templateElements`, `panelCount`, `inputType`, `isRequired` | `surveyTemplate` |
| Lottie animations | `ix`, `nm`, `ty`, `bm`, `hd`, `mn`, `ks`, `ao` | `Lottie` |
| BlockNote / ProseMirror rich text | `styles`, `content`, `props`, `textColor`, `backgroundColor`, `children` | `Page` |
| Cosmos protobuf timestamps | `seconds`, `nanos`, `low`, `high`, `unsigned` | IID `metadata.created/updated` |

**Plain JSON** resources (180 files: impact tokens, settings, some page configs)
carry **no `@context`** and are not JSON-LD. They are validated by JSON Schema,
not expanded to RDF — these become `schemas/v1/*` documents in Phase 5
(`token`, `profile`, `tags`, `page`). Their absence of triples is by design,
not a silent drop.

## Follow-ups / gaps flagged for later phases

1. **`AdministratorCredential` / `CreatorCredential` context (404).** 56 docs
   import `https://w3id.org/ixo/protocol/entity#administrator|creator`, which has
   no published document. The credential is now interpretable via its
   `credential-types` concept and the standard VC terms, but a small context (or
   `schemas/v1/administratorCredential`) should be published in Phase 5/6 so the
   `credentialSubject` fields expand. The Phase 2 `ns/`→canonical 301 already
   removes the `ns/` ambiguity in these IRIs.
2. **Protobuf timestamps.** `metadata.created/updated` are nested
   `{seconds,nanos}` objects. A consumer wanting `xsd:dateTime` must transform
   them; the namespace does not model the wire encoding.
3. **Impact-token fields** (`decimals`, `denom`, `maxSupply`, `properties`) are
   plain-JSON token metadata → a Phase 5 JSON Schema, not vocabulary.
4. **`proof` on a linked resource** is a content CID (not a Data-Integrity
   proof); left uncaptured to avoid clashing with `sec:proof` in co-imported VC
   contexts.

## Reconciliation with the acceptance criteria

- *Every JSON-LD file produces non-zero triples* — true for all 200 sampled IID
  docs and every resource that imports the IXO/VC context and carries IXO terms.
  Plain JSON (no `@context`) and pure third-party formats are catalogued above
  as schema-only / out-of-scope rather than treated as failures (consistent with
  the Phase 0 validator design).
- *No silent term drops* — every undefined key is classified here (added,
  covered-by-standard, or explicitly out-of-scope). Machine-readable backing
  data: `scripts/coverage-report.json` (regenerate with
  `node scripts/analyze-coverage.mjs`).
- *New namespace paths have redirect rules* — the two new SKOS schemes resolve
  through the existing generic `vocab/<scheme>/v1` rule.
