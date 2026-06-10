# did:ixo method context — `interchain-identifiers/v1`

JSON-LD context that defines the **method-specific terms** emitted by `did:ixo`
(Interchain Identifier / IID) documents. These terms are **not** defined by the
base W3C context `https://www.w3.org/ns/did/v1`, so without this context a
JSON-LD-aware consumer silently drops them (W3C DID Core
[§6.3.1 Production](https://www.w3.org/TR/did-core/#production-0): a consumer
"SHOULD drop all terms … not defined via the `@context`").

| | |
| --- | --- |
| **Canonical IRI** | `https://w3id.org/ixo/ns/interchain-identifiers/v1` |
| **Served document** | `https://ixofoundation.github.io/ns/interchain-identifiers/v1/index.jsonld` |
| **Media type** | `application/ld+json` |

## Terms defined

- `linkedResource`, `linkedClaim`, `linkedEntity`, `accordedRight` — set-valued
  IID extension properties, each with a property-scoped `@context` so their
  nested members (`mediaType`, `serviceEndpoint`, `proof`, `encrypted`, `right`,
  `description`, …) are also defined and therefore not dropped.
- `blockchainAccountID` — verification-method account property (CAIP-10 style;
  note the capital-`ID` casing the method actually emits).
- `CosmosAccountAddress` — the IID verification-method `type`.
- `metadata` — document metadata (`versionId`, `created`, `updated`,
  `deactivated`).

Term IRIs are anchored to the existing IXO protocol/vocab namespaces using the
repo's per-concept `#fragment` convention.

## How it is used

1. **Resolver** — append the canonical IRI to the `@context` array of every
   resolved `did:ixo` document, after the base context:

   ```json
   "@context": [
     "https://www.w3.org/ns/did/v1",
     "https://w3id.org/ixo/ns/interchain-identifiers/v1"
   ]
   ```

   Documents are served as `application/did+ld+json`, which asserts the body is
   JSON-LD — so this array is required for the body to be *conformant* JSON-LD.

2. **DID Specification Registries** — register this context per DID Core §6.3.1
   ("all JSON-LD Contexts and their terms SHOULD be registered in the DID
   Specification Registries") via a PR to
   [`w3c/did-spec-registries`](https://github.com/w3c/did-spec-registries).

## Hosting

The `w3id.org/ixo/.htaccess` rule-0 issues a `303` from the canonical IRI to the
served document. It is placed **before** the `ns/`-collapse rule so the `ns/`
segment resolves directly instead of being rewritten to the bare form. Deploy by
PR to the [w3id.org community repo](https://github.com/perma-id/w3id.org).
