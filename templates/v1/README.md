# Credential & claim templates

Canonical, ready-to-fill JSON-LD templates for the credential and claim families
used on the IXO Spatial Web. Each template imports the umbrella context
(`https://w3id.org/ixo/context/v1`), declares its `ixo:` type, and validates
against the corresponding SHACL shape in [`shapes/v1/`](../../shapes/v1/):

| Template | Type | Shape |
| --- | --- | --- |
| `domainCard.jsonld` | `ixo:DomainCard` | `DomainCardShape` |
| `mitigationActivityProjectCredential.jsonld` | `ixo:Credential` | `CredentialShape` |
| `itmoCredential.jsonld` | `ixo:Credential` | `CredentialShape` |
| `voucherAssetCredential.jsonld` | `ixo:Credential` | `CredentialShape` |
| `mitigationActivityFinancingCredential.jsonld` | `ixo:Credential` | `CredentialShape` |
| `administratorCredential.jsonld` | `ixo:Credential` | `CredentialShape` |
| `creatorCredential.jsonld` | `ixo:Credential` | `CredentialShape` |
| `outcomeProtocolClaim.jsonld` | `ixo:Claim` | `ClaimShape` |
| `sdgOutcomeClaim.jsonld` | `ixo:Claim` | `ClaimShape` |
| `disputeResolutionClaim.jsonld` | `ixo:Claim` | `ClaimShape` |

These cover the October-2024 `#ixo-data` schema list (Mitigation Activity
Project, ITMO, Outcome Protocol, SDG Outcomes, Voucher Asset, Dispute
Resolution, Mitigation Activity Financing) beyond the families already fetched
in Phase 4, plus the Domain Card and the Administrator / Creator credentials.

## Placeholder convention

- **Literals** use `<<<describe the value>>>`.
- **IRI / DID positions** (an `id`, `issuer`, `credentialSubject.id`, a party)
  use a valid placeholder DID of the form `did:ixo:entity:REPLACE-…-ID`, because
  `<<<…>>>` is not a legal IRI and the SHACL shapes require these to be IRIs.
- A `hasClaimType` value is a **real** concept from the
  [`claim-types`](../../vocab/claim-types/v1/index.jsonld) scheme (e.g.
  `claimType:outcome`), since `ClaimShape` constrains it with `sh:in`.

Templates are validated by `scripts/validate-shapes.mjs` against their shape;
they are intentionally **not** run through the JSON Schemas in `schemas/v1/`,
whose strict patterns (DID/date formats) reject the placeholders by design.
