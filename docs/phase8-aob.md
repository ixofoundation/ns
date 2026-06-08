# Phase 8 — AOB (any other business): status & decisions

> **Note (2026-06-07):** Paths below predate the legacy-structure consolidation. `vocab/relationships/v1` is now `protocol/relationships/v1`; SKOS schemes live under `protocol/<thing>/v1/`. See PLAN.md §2.

Phase 8 is a backlog of candidates, prioritised once Phase 7 shipped (PLAN.md
§4.8). Each is recorded below as **Done**, **Planned** (specified here, awaiting
an external input), or **Deferred** (decision recorded). Everything marked Done
is in the working tree and passes `npm run validate`.

---

## 1. PROV-O integration sweep — ✅ Done

Provenance terms are surfaced in the umbrella context and resolve to PROV-O:

| Term | Maps to |
|---|---|
| `wasGeneratedBy` | `prov:wasGeneratedBy` (`@type: @id`) |
| `wasDerivedFrom` | `prov:wasDerivedFrom` (`@type: @id`) |
| `wasAttributedTo` | `prov:wasAttributedTo` (`@type: @id`) |
| `wasAssociatedWith` | `prov:wasAssociatedWith` (`@type: @id`) |
| `generatedAtTime` | `prov:generatedAtTime` (`xsd:dateTime`) |

These compose with the class-level bridges already in `vocab/v1`
(`ixo:Evaluation ⊆ prov:Activity`, `ixo:Evidence ⊆ prov:Entity`,
`ixo:Oracle ⊆ prov:Agent`). A claim can now state `wasGeneratedBy` an
evaluation activity, `wasDerivedFrom` a prior claim, etc., with no further
vocabulary work. SHACL shapes leave these **optional** (provenance is additive,
not required).

## 2. Relationship Type Ontology — ✅ Done (starter)

`vocab/relationships/v1/` — a SKOS scheme of **22 typed relationships** between
entities (`memberOf`/`hasMember`, `partOf`/`hasPart`, `controls`/`controlledBy`,
`delegatesTo`/`delegatedBy`, `issuedBy`/`issuerOf`, `evaluates`/`evaluatedBy`,
`owns`/`ownedBy`, `funds`/`fundedBy`, `parentOf`/`childOf`,
`verifies`/`verifiedBy`, `collaboratesWith`, `derivedFrom`). Used via the new
`ixo:relationship` property (`rdfs:subPropertyOf ixo:linkedEntity`), and resolves
through the Phase 2 generic `vocab/<scheme>/v1` redirect.

> **Awaiting:** Graeme's fuller Relationship Type Ontology outline (Notion) to
> reconcile naming and add any missing relationship classes / inverse axioms
> (`owl:inverseOf`). Regenerate with `node scripts/build-schemes.mjs`.

## 3. CER/VER → CCC/VCC migration — 📝 Planned (mechanism specified)

Legacy carbon terms (`CER` Carbon Emission Reduction, `VER` Verified Emission
Reduction — defined in `emerging-eco/ns vocab/v1`) migrate to the current
naming (`CCC` Carbon Credit Claim, `VCC` Verified Carbon Credit). Mechanism:

1. **Keep, don't delete** the old terms. On each, add:
   - `owl:deprecated true`
   - `dcterms:isReplacedBy` → the new term IRI
2. **Add** `emerging:CarbonCreditClaim` (CCC) and `emerging:VerifiedCarbonCredit`
   (VCC), each `dcterms:replaces` the old term and carrying the prior
   `rdfs:subClassOf` IXO bridge (`CCC ⊆ ixo:Claim`, `VCC ⊆ ixo:Credential`).
3. **Snapshot** the pre-migration vocabulary to `vocab/v0/index.jsonld` (frozen)
   so already-issued credentials that reference `…/vocab/v1#VER` keep resolving;
   `v1` continues to evolve.
4. Add `owl:deprecated`/`isReplacedBy` to the matching `claim-types` /
   `credential-types` concepts in `ixofoundation/ns` (`carbonEmissionReduction`).

Deferred to execution because it spans `emerging-eco/ns` and needs sign-off on
the CCC/VCC naming. No data is lost: deprecation is additive and `v0` is frozen.

## 4. Article 6 / ITMO namespace — ✅ Partly done / decision recorded

- **Credential shape**: `templates/v1/itmoCredential.jsonld` (Phase 6) already
  provides the ITMO credential (host/acquiring party, mitigation outcome in
  tCO2e, corresponding adjustment, authorization reference), validating against
  `CredentialShape`.
- **The 404**: `https://w3id.org/article6/itmo-context.jsonld` referenced in the
  canonical ITMO docs does not exist. **Decision:** do **not** stand up a
  separate `article6` top-level namespace; instead publish the ITMO context
  under IXO (`schemas/v1/itmoCredential.json` + the existing template) and
  **update the docs reference** to the IXO URL. Claiming `w3id.org/article6`
  is only warranted if a cross-org (non-IXO) governance body owns it.

## 5. dMRV namespace — ✅ Effectively done / decision recorded

`https://w3id.org/dmrv/v1` (referenced in `digital-mrv.md`) never existed. The
**clean-cooking dMRV implementation is `emerging-eco/ns`** (Phase 7): device
credential → fuel-purchase/clean-cooking claim → CER/VER credential, bridged to
IXO. **Decision:** treat `emerging-eco/ns` as the reference dMRV namespace and
update the doc reference; a generic `dmrv/v1` is unnecessary unless a
methodology-neutral layer is later required.

## 6. Vector Protocol context (`vector/v1`) — 📝 Planned (awaiting IVP spec)

A `vocab/vector/v1` SKOS scheme + context for the IXO Vector Protocol — Verifiable
Claim (VC), Verifiable Claim Credential (VCC), and Reference Vector (RV) terms.
Recommended shape: a SKOS scheme of vector term types plus `vocab/v1` classes
`ixo:VectorClaim`, `ixo:VectorClaimCredential` (⊆ `ixo:Credential`),
`ixo:ReferenceVector`, and a `schemas/v1/vectorClaimCredential.json` +
`shapes/v1/VectorClaimCredentialShape.jsonld` mirroring the Phase 5 pattern.
**Awaiting:** the IVP specification (term list + cardinalities) before authoring,
to avoid guessing the vector encoding.

## 7. FIBO selective integration — ⏸ Deferred (plan recorded)

Bridge specific IXO classes to FIBO modules for the regulated-finance use case:

| IXO class | Candidate FIBO bridge |
|---|---|
| `ixo:Organisation` | `fibo-fnd-org-fm:FormalOrganization` |
| `ixo:Investment` | `fibo-fbc-pas-fpas:…` (financial product/instrument) |
| `ixo:Asset` | `fibo-fnd-acc-aeq:Asset` (FND/Accounting) |
| `ixo:account` | `fibo-fbc-dae-dbt:Account` |

Done as **selective `rdfs:seeAlso` / `owl:equivalentClass`** bridges (not a FIBO
import — FIBO is large). **Deferred:** needs the specific FIBO module IRIs
pinned and a regulated-finance use case to validate against; recorded here so it
isn't lost.

---

## Summary

| Item | State |
|---|---|
| PROV-O integration | ✅ Done |
| Relationship Type Ontology | ✅ Done (starter; awaiting Notion outline) |
| CER/VER → CCC/VCC migration | 📝 Planned (mechanism specified) |
| Article 6 / ITMO | ✅ Template done; namespace decision recorded |
| dMRV | ✅ emerging-eco/ns is the implementation; decision recorded |
| Vector Protocol context | 📝 Planned (awaiting IVP spec) |
| FIBO integration | ⏸ Deferred (bridge plan recorded) |

The rebuild's foundation (Phases 0–7) is complete and validating; Phase 8's
remaining items are scoped, specified, and unblocked except where they need an
external artefact (Notion outline, IVP spec, FIBO module selection).
