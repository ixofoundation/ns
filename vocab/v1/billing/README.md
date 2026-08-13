# IXO Usage Billing Ontology v1

This module defines the vocabulary for the two claim credentials in the platform usage-billing
flow: the metered **usage claim** an oracle issues for a user's service consumption, and the
**usage-billing settlement** the billing engine issues when accrued charges are rated, posted to
the billing ledger, and claimed from a deed's claims collection.

Core namespace: `https://w3id.org/ixo/vocab/v1/billing#`

## Credential envelope

Both claim types are carried as the `credentialSubject` of a W3C Verifiable Credential secured
with Data Integrity and the `eddsa-jcs-2022` cryptosuite (JCS/RFC 8785 canonicalization +
Ed25519). This replaces the earlier `Ed25519Signature2018` JSON-LD suite: the signature covers
every byte of the credential, so no context resolution happens at signing or verification time.

```jsonld
"@context": [
  "https://www.w3.org/2018/credentials/v1",
  "https://w3id.org/security/data-integrity/v2",
  "https://w3id.org/ixo/context/v1"
]
```

The proof block is:

```jsonld
"proof": {
  "@context": [ ...same as the credential... ],
  "type": "DataIntegrityProof",
  "cryptosuite": "eddsa-jcs-2022",
  "created": "...",
  "verificationMethod": "<issuer DID>#<base58 pubkey>",
  "proofPurpose": "assertionMethod",
  "proofValue": "z..."
}
```

`verificationMethod` is the DID-URL of the Ed25519 key registered on-chain
(`Ed25519VerificationKey2018` / `publicKeyBase58`, id = `did#base58(pubkey)`) under the
`assertionMethod` relationship. `proofValue` is the multibase base58-btc encoding (`z` prefix)
of the 64-byte Ed25519 signature.

## Type-scoped terms

The umbrella context (`https://w3id.org/ixo/context/v1`) maps the credential-subject fields
through **type-scoped contexts** on `UsageClaim` and `UsageBillingSettlement`. Typing the
credential subject activates the mappings:

```jsonld
"credentialSubject": {
  "type": "UsageClaim",
  ...
}
```

| Term | IRI | Claim type |
| --- | --- | --- |
| `amount` | `bil:amount` | both — a credit number on usage claims, a set of Coin on settlements |
| `oracleDid` | `bil:oracleDid` | usage claim |
| `oracleEntityDid` | `bil:oracleEntityDid` | usage claim |
| `oracleName` | `bil:oracleName` | usage claim |
| `userDid` | `bil:userDid` | usage claim |
| `settlementId` | `bil:settlementId` | settlement |
| `customerDid` | `bil:customerDid` | settlement |
| `deedDid` | `bil:deedDid` | settlement |
| `collectionId` | `bil:collectionId` | both |
| `resultStatus` | `bil:resultStatus` | settlement |
| `request` | `bil:request` | settlement |
| `workSummary` | `bil:workSummary` | settlement |
| `proofs` | `bil:verificationTrail` | settlement |
| `amount` / `denom` (inside Coin values) | `bil:coinValue` / `bil:coinDenom` | settlement |

## The `service` field

Both claim bodies carry a `service` string. The umbrella context imports the W3C DID v1
context, which defines `service` as a protected term, and type-scoped contexts may not
override protected terms. The mapping is therefore deliberately omitted; the ontology still
publishes `bil:service` to document the field. Signed coverage is unaffected — under
`eddsa-jcs-2022` the signature covers the exact bytes of the JSON regardless of term
resolution.

## Model boundary

1. A **usage claim** is the oracle's assertion of metered consumption. It is priced in
   credits and submitted with intent against the user's oracle claims collection.
2. A **usage-billing settlement** is the billing engine's assertion that rated charges were
   posted and the owed balance claimed. It references the ledger settlement record, and its
   `proofs` trail points at re-verifiable evidence (charges, usage events, archived
   customer-signed authorizations) — it does not duplicate that evidence.
3. The **credential proof** secures the assertion; it is not itself the billing evidence.

## Source basis

- [W3C Verifiable Credentials Data Model 1.1](https://www.w3.org/TR/vc-data-model/)
- [W3C Data Integrity EdDSA Cryptosuites v1.0](https://www.w3.org/TR/vc-di-eddsa/)
- [RFC 8785 JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785)
- [Cosmos SDK Coin](https://docs.cosmos.network/main/build/architecture/adr-024-coin-metadata)
