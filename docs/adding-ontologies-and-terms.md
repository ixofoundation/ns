# Adding ontologies and terms to the IXO namespace

Rules and guidelines for extending the IXO Spatial Web namespace (`https://w3id.org/ixo/…`)
— new vocabulary terms, new controlled-value concepts, and whole new schemes/ontologies.

> **Read first:** every `protocol/<scheme>/v1/index.json` is **generated** by
> `scripts/build-schemes.mjs`. Hand-editing those files is not durable — a rebuild
> overwrites it. Make changes in the **source** (the generator, `vocab/v1/index.json`,
> `context/v1/index.jsonld`, or `schema/…`) and regenerate. See §11.

---

## 0. Golden rules (non-negotiable)

1. **Notation is a contract.** `skos:notation` is the literal on-chain key (an
   `entity.type`, claim type, status string, …). Once published, a notation is
   **never renamed or repurposed** — doing so breaks resolution of existing on-chain
   data. Add new notations; deprecate old ones (§9).
2. **Edit the source, never the build artifact.** SKOS schemes come from
   `build-schemes.mjs` (+ `salvaged.data.json`). The vocab, context and shapes are
   hand-authored. Know which layer you're in (§1) before you touch anything.
3. **Reuse before you invent.** Prefer an existing IXO term or a standard external
   vocabulary (`schema:`, `prov:`, `foaf:`, `dcterms:`, `skos:`, `did:`, `cred:`,
   `sec:`, `dpv:`) over minting a new `ixo:` term. Align with `skos:closeMatch` /
   `owl:equivalentClass` where appropriate (§10).
4. **Every term must resolve.** No dangling `ixo:` references; every `subClassOf` /
   `subPropertyOf` / `broader` / mapping target must point at something defined. The
   gates enforce this (§11).
5. **Define it in human language.** Classes/properties need `rdfs:label` +
   `rdfs:comment`; concepts need `skos:prefLabel` + `skos:definition`, all `@en`.
6. **Validate green, then regenerate docs.** `npm run validate` must report **0
   errors** before anything is considered done (§11).
7. **Keep the three trees in sync.** Changes land identically in
   `ns-v2/ns-GraemeLeightonIXO-patch-4`, `_pushv2`, and `_pushcc`.

---

## 1. How the namespace is layered

Know which layer your addition belongs to — this is the single most common mistake.

| Layer | Location | What lives here | Authoring |
|---|---|---|---|
| **Vocabulary (interpretation)** | `vocab/v1/index.json` | RDFS/OWL **classes** (`ixo:Entity`) and **properties** (`ixo:controller`). The meaning layer. | Hand-authored |
| **Controlled values (taxonomies)** | `protocol/<scheme>/v1/index.json` | SKOS `ConceptScheme`s — the allowed **values** for a field (entity types, claim types, statuses, roles, …). | **Generated** by `build-schemes.mjs` |
| **Context (wiring)** | `context/v1/index.jsonld` | JSON-LD 1.1 prefixes + term aliases that make compact JSON expand to the IRIs above. | Hand-authored |
| **Document validation** | `schema/v1/*.json` (JSON Schema), `schema/shapes/v1/*.jsonld` (SHACL) | Structural rules for document bodies (Entity, Claim, Profile, …). | Hand-authored |

Rule of thumb:
- A new **kind of thing's meaning** → a **class** in the vocab.
- A new **property/relationship** → a **property** in the vocab (or the relationships scheme, §7).
- A new **allowed value** for an existing field → a **concept** in the relevant SKOS scheme (§5).
- A whole new **set of allowed values / a new ontology** → a **new scheme** (§6).

---

## 2. Decision guide — "what am I adding?"

```
Is it a new MEANING (a class) or a new PREDICATE (a property)?
  └─ yes → vocab/v1/index.json  ............................. §4
Is it a new VALUE in an existing controlled list?
  └─ yes → add a c(...) concept to that scheme in build-schemes.mjs   §5
Is it a whole new controlled list / taxonomy / external ontology?
  └─ yes → register a new scheme (SCHEMES or SALVAGED) + LEGACY + context  §6
Is it a typed relationship usable as a predicate (with an inverse)?
  └─ yes → the relationships scheme (punned SKOS + owl:ObjectProperty)  §7
Is it a new constraint on a document's shape?
  └─ yes → schema/v1 (JSON Schema) and/or schema/shapes/v1 (SHACL)  §8
```

---

## 3. Naming, IRI and versioning conventions

**Base IRIs**
- Vocabulary: `https://w3id.org/ixo/vocab/v1#<Term>`
- Scheme: `https://w3id.org/ixo/protocol/<scheme-name>/v1` with concepts as fragments
  (`#<id>`). The `@base` is set per file via the context; concepts are written as
  `#<id>` and resolve against it.

**Casing**
- **Classes** — `PascalCase`: `ixo:Entity`, `ixo:DAO`, `ixo:OracleCapability`.
- **Properties** — `camelCase`: `ixo:controller`, `ixo:linkedResource`.
- **SKOS concept `@id`** — `kebab-case`: `#oracle-agent`, `#asset-de-pin`. In the
  generator the `id` arg is kebab; nested ids are `parent-child`.
- **`skos:notation`** — the on-chain string, `camelCase` with `/` for hierarchy:
  `asset`, `asset/dePIN`, `asset/dePIN/batteryElectricVehicle`. **Notation, not `@id`,
  is the contract** — `@id` is a local slug, notation is what appears on-chain.

**Versioning**
- Everything is under `…/v1`. `v1` is **append-only and backwards-compatible**:
  adding concepts/terms is fine; renaming/removing published ones is not.
- A breaking change (renamed term, changed meaning, restructured hierarchy that
  alters notations) requires a **new version directory** (`…/v2`), not an in-place edit.
- The vocab ontology header carries `owl:versionInfo` + `owl:versionIRI`; bump these
  when you make a substantive vocab change.

---

## 4. Adding a vocabulary term (class or property) — `vocab/v1/index.json`

Add a node to the `@graph`. Enforced by `validate-vocab.mjs` (Part A).

**A class:**
```json
{
  "@id": "ixo:Oracle",
  "@type": ["rdfs:Class", "owl:Class"],
  "rdfs:subClassOf": { "@id": "ixo:Entity" },
  "rdfs:label":   { "@value": "Oracle", "@language": "en" },
  "rdfs:comment": { "@value": "An agentic service that evaluates claims and supplies verified results to the network.", "@language": "en" }
}
```

**A property:**
```json
{
  "@id": "ixo:relayerNode",
  "@type": ["rdf:Property", "owl:ObjectProperty"],
  "rdfs:domain": { "@id": "ixo:Entity" },
  "rdfs:range":  { "@id": "ixo:Entity" },
  "rdfs:label":   { "@value": "relayer node", "@language": "en" },
  "rdfs:comment": { "@value": "The relayer node that registered the entity.", "@language": "en" }
}
```

**Rules**
- `rdfs:label` **and** `rdfs:comment` are **required** (gate fails otherwise).
- `@id` must be unique. Class → `PascalCase`; property → `camelCase`.
- `rdfs:subClassOf` must target a class; `rdfs:subPropertyOf` must target a property;
  every `ixo:` target must be defined somewhere (vocab term, scheme, or concept).
  External targets (`schema:`, `prov:`, …) are assumed valid; unknown prefixes warn.
- Datatype properties: `owl:DatatypeProperty` with an `xsd:` range.
- Reuse: if a standard vocab already models it, subclass it or assert
  `owl:equivalentClass` / `owl:equivalentProperty` rather than redefining (§10).
- If the term will appear in document JSON, also alias it in the context (§6 step 4).

---

## 5. Adding a concept (a value) to an existing scheme

Concepts are **generated** — add a `c(...)` entry to the scheme's `concepts` array in
`scripts/build-schemes.mjs`, then rebuild. Do **not** edit `protocol/<scheme>/v1/index.json`.

```js
// c(id, label, def, notation?, broader?, inv?)
c('oracle-evaluation', 'Evaluation Oracle',
  'An oracle specialised in evaluating claims to produce verified results.',
  'oracle/evaluation', 'oracle'),
```

- `id` → `@id` becomes `#oracle-evaluation` (kebab).
- `label` → `skos:prefLabel@en` (**required**, ideally unique within the scheme).
- `def` → `skos:definition@en` (**required** — write a real definition, not a restated label).
- `notation` → `skos:notation`, the on-chain key (**required for entity/claim/etc.
  schemes**; must be **unique within the scheme**).
- `broader` → makes it a **sub-type**: emits `skos:broader #<broader>` and the notation
  should be the parent's path plus one segment (`oracle/evaluation`). Omit `broader`
  to make it a **top concept** (emits `skos:topConceptOf`).
- The generator sets `skos:inScheme`, `@type`, and top/broader automatically — you only
  supply the five args. A concept may **not** be both a top concept and have `broader`.

**Sub-type hierarchies** mirror notation depth: `asset` → `asset/dePIN` →
`asset/dePIN/batteryElectricVehicle`, each `broader` pointing one level up.

---

## 6. Adding a new scheme / controlled ontology

A new closed list of values (e.g. a new "incentive-types" taxonomy) becomes its own
SKOS `ConceptScheme`. Five steps in `build-schemes.mjs` + context:

1. **Add a `SCHEMES` entry** keyed by a slug:
   ```js
   'incentive-types': {
     title: 'IXO Incentive Types',
     description: 'Kinds of incentive mechanism… (one paragraph; say what the notations mean).',
     source: 'where the values came from (webclient enum, on-chain values, a standard, …)',
     // conformsTo: 'https://…',   // optional: external authority this conforms to
     concepts: [
       c('reward', 'Reward', 'A positive incentive paid on a verified outcome.', 'reward'),
       c('penalty', 'Penalty', 'A negative incentive applied on a failed obligation.', 'penalty'),
     ],
   },
   ```
2. **Register the output path** in the `LEGACY` map:
   ```js
   'incentive-types': 'protocol/incentive-types/v1/index.json',
   ```
   (The IRI base is derived from this path by `baseFor`.)
3. **Add the scheme to the build order** if it isn't already iterated (the `order`
   array in `main()` covers `Object.keys(SCHEMES)` automatically — a new `SCHEMES`
   entry is built without extra wiring).
4. **Add a context prefix** in `context/v1/index.jsonld` so the values are usable as
   compact CURIEs in documents:
   ```json
   "incentiveType": "https://w3id.org/ixo/protocol/incentive-types/v1#"
   ```
5. **Build + validate + docs** (§11).

**Scheme metadata is required:** `title`, `description`, and `source`. Add
`dcterms:created` semantics via the ontology conventions; use `conformsTo` when the
list mirrors an external standard (e.g. ISO, IANA).

**Salvaged legacy enums** (a broken/0-triple legacy catalogue rebuilt as SKOS) go in
the `SALVAGED` map instead, with source data added to `scripts/salvaged.data.json`
under the matching key. Note the original plain-JSON file may still be served to the
studio survey API — leave it in place; the SKOS scheme is its semantic companion.

**Folding sub-types under an existing kind** (e.g. tag taxonomies under an entity
kind) is done via `ENTITY_SUBTYPE_SCHEMES` + `foldSubtypes`, not as a standalone
scheme — see how `asset`/`dao`/etc. sub-types are merged into `entity-types`.

---

## 7. Adding a relationship (a typed predicate)

Relationship types live in the `relationships` scheme and are **punned**: each is both
a `skos:Concept` (controlled vocabulary) and an `owl:ObjectProperty` (usable as a
predicate). The generator adds `rdfs:subPropertyOf ixo:linkedEntity` and, if you pass
the 6th `inv` arg, `owl:inverseOf`:

```js
c('parent-of', 'Parent Of', 'The subject entity is the parent of the object entity.',
  'parentOf', undefined, 'child-of'),
c('child-of',  'Child Of',  'The subject entity is the child of the object entity.',
  'childOf',  undefined, 'parent-of'),
```

- Inverses must reference each other (`inv` both ways) and both concepts must exist.
- Symmetric relationships (`collaboratesWith`) set their own id as `inv` or omit it.
- All relationship predicates specialise `ixo:linkedEntity` — keep that invariant.

---

## 8. Document shapes — JSON Schema + SHACL

When you add a field or constraint to a **document body** (not a vocabulary term):
- **JSON Schema** (`schema/v1/<thing>.json`) — structural/syntactic validation used by
  tooling. Checked by `validate-schemas.mjs`.
- **SHACL NodeShape** (`schema/shapes/v1/<Thing>Shape.jsonld`) — semantic constraints
  (cardinality, node kind, required properties). Checked by `validate-shapes.mjs`.
  Target the vocab class with `sh:targetClass` and reference `ixo:` properties on
  `sh:path`. New `sh:path` properties must be **defined in the vocab** (§4).

Keep the two consistent with each other and with the context aliases.

---

## 9. Stability and deprecation (the on-chain contract)

- **Never rename or change the meaning of a published `skos:notation`** or a vocab
  term IRI. On-chain documents and minting templates resolve against these strings.
- **Before removing a concept, check the corpus.** A value that's in on-chain use must
  not be deleted, or those entities lose type resolution. Audit first (the
  resolution-audit reports + `validate-resources.mjs` are the tools); if it's unused
  (a stale enum carryover), removal is safe.
- **Deprecate, don't delete, for in-use terms.** Mark with `owl:deprecated true`
  (vocab) and/or a `skos:note`, keep the IRI resolvable, and point to the successor
  (`dcterms:isReplacedBy` / `skos:related`).
- Structural moves that **preserve notation** (e.g. re-parenting a concept under a new
  `broader` while keeping its `skos:notation`) are non-breaking and allowed.

---

## 10. Interop and external-vocabulary reuse

- Approved external prefixes (already in the context/vocab): `schema:`, `prov:`,
  `foaf:`, `dcterms:`, `skos:`, `owl:`, `rdfs:`, `rdf:`, `xsd:`, `did:`, `cred:`,
  `sec:`, `zcap:`, `dpv:`, `vann:`. Add a new external prefix only when reusing a
  recognised standard, and declare it in both the context and (if used there) the vocab.
- **Align, don't duplicate:** when an IXO term overlaps a standard one, assert
  `rdfs:subClassOf` / `owl:equivalentClass` / `owl:equivalentProperty` (vocab) or
  `skos:exactMatch` / `skos:closeMatch` (concepts). Use `exactMatch` only for true
  1:1 equivalence; `closeMatch` for label-level / approximate alignment.
- **Mapping targets must be IRIs** (the gate warns on non-IRI mapping values).

---

## 11. Mandatory workflow and validation gates

```
1. Edit the SOURCE
   • SKOS concept/scheme  → scripts/build-schemes.mjs  (+ scripts/salvaged.data.json)
   • vocab term           → vocab/v1/index.json
   • context wiring        → context/v1/index.jsonld
   • document shape        → schema/v1/*.json  and/or  schema/shapes/v1/*.jsonld
2. Regenerate     → npm run build:schemes      (rewrites protocol/**/index.json)
3. Validate       → npm run validate           (MUST be 0 errors)
4. Rebuild docs   → npm run build:docs
5. Mirror the identical change into all three trees and re-confirm they match.
```

`npm run validate` runs the gates in sequence (each also runnable standalone, e.g.
`npm run validate:skos`):

| Gate | Script | Enforces |
|---|---|---|
| JSON-LD | `validate.mjs` | documents expand without error |
| JSON Schema | `validate-schemas.mjs` | `schema/v1` shapes |
| SHACL | `validate-shapes.mjs` | `schema/shapes/v1` node shapes |
| SKOS | `validate-skos.mjs` | concept integrity (below) |
| Vocab/OWL | `validate-vocab.mjs` | term lint + no dangling `ixo:` refs |
| Resources* | `validate-resources.mjs` | on-chain linked-resource bodies (*patch-4 chain) |

**SKOS errors (fail the build):** concept missing/wrong `skos:inScheme`; missing
`skos:prefLabel`; duplicate `skos:notation` in a scheme; `hasTopConcept`/`topConceptOf`
not mutual inverses; `broader`/`hasTopConcept`/`topConceptOf` referencing a missing
concept; a concept that is both top and has `broader`.
**SKOS warnings:** missing scheme `title`/`description`; duplicate `prefLabel`;
`prefLabel` without `@language`; missing `notation`; orphan concept; `broader` cycle;
non-IRI mapping value.

**Vocab errors/warnings:** every class/property must have `rdfs:label` + `rdfs:comment`;
no duplicate term `@id`; `subClassOf`/`subPropertyOf` target the right kind; **every
`ixo:` semantic-reference target must be defined** across the vocab and all schemes.

> **Caveat on rebuilds:** `build:schemes` regenerates *all* schemes. If a build shows
> diffs in schemes you didn't touch, that's pre-existing drift between a committed
> output and the generator — investigate before committing it, don't assume it's yours.
> The intended end state is output == generator output.

---

## 12. Checklists

**New vocab term (class/property)**
- [ ] Correct casing (`PascalCase` class / `camelCase` property), unique `@id`
- [ ] `rdfs:label` + `rdfs:comment` (`@en`)
- [ ] `subClassOf`/`subPropertyOf` resolve; reused/aligned with a standard where possible
- [ ] Context alias added if it appears in documents
- [ ] SHACL/JSON-Schema updated if it constrains a document shape
- [ ] `npm run validate` green; docs rebuilt; mirrored to 3 trees

**New concept (value) in a scheme**
- [ ] Added as `c(...)` in `build-schemes.mjs` (not hand-edited in the output)
- [ ] Unique `notation` = the real on-chain key; `prefLabel` + real `definition`
- [ ] `broader` set (with matching slash-notation) or intentionally a top concept
- [ ] `npm run build:schemes` + `validate` green; docs rebuilt; mirrored to 3 trees

**New scheme / ontology**
- [ ] `SCHEMES` (or `SALVAGED` + `salvaged.data.json`) entry with `title`/`description`/`source`
- [ ] `LEGACY` output path registered
- [ ] Context prefix added in `context/v1/index.jsonld`
- [ ] IRI base under `protocol/<name>/v1`; concepts have notations; hierarchy via `broader`
- [ ] `npm run build:schemes` + `validate` green; `build:docs`; mirrored to 3 trees

---

*Companion docs: `p2-interop.md` (interop), `p3-quality-gates.md` (the gates in
detail), `p4-publishing.md` (publishing/CI), `term-coverage.md` (coverage).*
