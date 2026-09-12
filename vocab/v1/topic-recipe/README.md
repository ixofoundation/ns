# Topic Recipe Domain Cards

This module gives `protocol/topic` recipe entities an opt-in JSON-LD context,
an IXO vocabulary, and a JSON Schema while retaining the Domain Card credential
envelope and ordinary discovery fields. It implements the context/profile needed
by the proposed [Companion recipe author skill](https://github.com/ixoworld/ixo-agent-skills/pull/52).
It does not create a registry entry, issue a credential, grant VFS access, or
implement x402.

## Documents and identifiers

| Document | Canonical identifier | Repository file |
| --- | --- | --- |
| Opt-in context | `https://w3id.org/ixo/context/v1/topic-recipe/index.jsonld` | [Context](../../../context/v1/topic-recipe/index.jsonld) |
| Vocabulary module | `https://w3id.org/ixo/vocab/v1/topic-recipe/index.jsonld` | [Vocabulary](index.jsonld) |
| Profile JSON Schema | `https://w3id.org/ixo/schema/v1/topic-recipe-domain-card` | [Schema](../../../schema/v1/topic-recipe-domain-card.json) |
| Public authoring example | — | [Public card](public.example.jsonld) |
| Private authoring example | — | [Private card](private.example.jsonld) |

The namespace context is v1; the card's `profileVersion` is `2.0.0` to distinguish
it from earlier `1.0.0-proposed` and `1.1.0-proposed` authoring profiles, which
used provisional GitHub vocabulary/schema identifiers. The context and schema
remain pending publication until this change is merged and GitHub Pages serves
the files. The examples are unsigned Drafts with illustrative DIDs, endpoints,
file IDs and zero digests; they are not real published recipes.

Use this context sequence for newly issued cards:

```json
{
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://w3id.org/ixo/context/v1/topic-recipe/index.jsonld"
  ],
  "type": ["VerifiableCredential", "ixo:DomainCard"],
  "credentialSchema": {
    "id": "https://w3id.org/ixo/schema/v1/topic-recipe-domain-card",
    "type": "JsonSchema"
  }
}
```

This is an envelope excerpt. Use a complete example and replace its illustrative
values before validation or issuance. The new context imports the existing IXO
context itself; callers do not need to repeat that import.

## Meaning and interoperability

The explicit `ixo` prefix expands to `https://w3id.org/ixo/vocab/v1#`. Consequently
`ixo:DomainCard`, `ixo:protocol/topic`, and `ixo:topicRecipe` have canonical IXO
IRIs. The exact chain entity type remains the string `protocol/topic`; the
credential subject DID identifies that entity. A Topic Recipe is a versioned
blueprint, separate from any instantiated Topic's state or authority.

`topicRecipe` is a protected `@json` term mapped to
`https://w3id.org/ixo/vocab/v1#topicRecipe`, with RDF range `rdf:JSON`. Its entire
structured value survives JSON-LD processing and participates in canonical RDF.
Nested keys deliberately remain JSON fields rather than separate RDF predicates.
This preserves the existing recipe extension shape, including null paywall
values, ordered arrays, and future schema-controlled metadata. RDF consumers see
one JSON literal; recipe-aware indexers can index its members. Converting this
term to an RDF node would require a new context/profile version.

Standard card fields include name, purpose, function, systemRole, keywords,
related documents, images, contacts, offers, and composition references. The
context defines their common unqualified terms and retains the shared context's
`schema:` prefix. VC v2's protected `name`, `description`, and `mediaType` mappings
remain unchanged, including their HTTPS schema.org IRIs. Existing IXO
`schema:`-prefixed values continue to use the shared HTTP schema.org namespace;
this change does not silently rewrite either namespace.

The JSON Schema permits other Domain Card properties for extensibility. This
does not define RDF semantics for every possible extra unqualified field. Use
explicit vocabulary IRIs or a separately reviewed versioned context for fields
not defined here, and check their expansion before signing. An unknown JSON key
must not be assumed to have entered the signed RDF dataset.

## Resource and access contract

The card ID is `<entity-did>#dmn`. Both `relatedDocument[].id` and
`topicRecipe.shapeResource.id` identify an entity linked resource such as
`<entity-did>#top-01`. Each changed released Shape uses a new fragment and immutable
VFS file version; the numeric suffix is not a semantic version or Kind code.

The profile carries recipe/protocol version, base Kind and Base Recipe, file-byte
SHA-256 digest, VFS provider/resource/fileId/version tuple, publication status,
listing visibility, and access declarations. It supports the nine pinned Kinds,
including `project`; `task` maps to Base Recipe `project`, `agent_task` to `flow`,
and `question` to `research`.

The corresponding ledger record uses the existing `linkedResource` contract,
including `serviceEndpoint`, `proof`, string-valued `encrypted`, and `right`.
For this profile, the Shape digest is SHA-256 over the exact plaintext JSON bytes
after HTTP content decoding; ledger `proof` carries its lowercase hex without
the `sha256:` prefix. The credential proof/signature is a separate mechanism.
Application-encrypted payloads require a separately specified decryption and
integrity profile. Managed at-rest encryption is independent of that wire flag.

Public access requires anonymous retrieval of the exact verified release bytes.
Private access requires a separately valid user-audience UCAN delegation and
unauthorised-read denial. The metadata and `right` reference are requirements,
not capability grants. A public teaser card may describe a private Shape without
publishing its body. The only declared paywall state is
`{"protocol":"x402","status":"planned"}`; this does not enable payment or
grant access. Tokens and private keys must never be embedded in a card.

JSON Schema validates field structure, access alternatives and Kind mappings.
Resolvers must additionally verify matching entity/card/resource identifiers,
unique resource bindings, exact VFS namespace/version, byte digests, issuer and
credential security, schema/Shape compatibility, delegation, and publication
evidence. JSON-LD expansion does not prove any of those live conditions.

## Migration from the proposed cards

The shared `context/v1/index.jsonld` is intentionally unchanged. Existing signed
credentials must continue to resolve their original context documents; do not
edit them or reinterpret them using this new context.

For a new issuance from an earlier unsigned Draft:

1. Replace the old context sequence and inline provisional `topicRecipe` mapping
   with the two-context sequence above. Do not append the new context to a
   protected old alias; JSON-LD correctly rejects that redefinition.
2. Use the canonical schema identifier and `profileVersion: "2.0.0"`.
3. Preserve actual recipe DID/version, immutable resource pin, access policy, and
   reviewed content. Update the renderer, validator, and source lock together.
4. Validate JSON Schema and JSON-LD expansion, review the exact final credential,
   then issue a new signature through the authorised controller route.
5. Verify full-card round trip and indexer/resolver behaviour before promoting it.

Canonical prefix and context changes alter RDF meaning, so an old signature
cannot be reused. Consumers such as the recipe-author skill must adopt and pin
this profile explicitly after the namespace release; existing proposed-profile
validators are not automatically compatible.

## Verification

```sh
python3 -m venv /tmp/ixo-ns-validation
/tmp/ixo-ns-validation/bin/python -m pip install -r tests/topic-recipe/requirements.txt
/tmp/ixo-ns-validation/bin/python -B -m unittest discover -s tests/topic-recipe
```

The tests use pinned official VC v2/DID v1 snapshots and the local IXO context;
they make no remote context requests. They cover schema validation, canonical
Domain Card/entity types, private/public JSON-literal preservation, compaction,
protected-term conflicts, resource references, and sensitivity of canonical RDF
to changed access metadata. URDNA2015 is used to test dataset behaviour, not to
claim implementation of the production signing cryptosuite. Actual signature
verification and live URL/indexer round trips remain deployment acceptance tests.

The URL forms above fit the existing redirect configuration at
[`perma-id/w3id.org` commit 76118e0](https://github.com/perma-id/w3id.org/blob/76118e0b5aabc0ca7ba649dfc344e5af692a883c/ids/ixo/.htaccess):
the context and vocabulary use explicit document paths, and the schema uses the
existing `schema/v1/<name>` rule. No new w3id rule is needed; GitHub Pages must
still serve the merged files before the identifiers are reported as live.
