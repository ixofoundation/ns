# Claim collection IID mapping v1

This namespace fixes the semantic contract used when a controlled entity is linked to a claim collection.

The on-chain IID records retain the exact string fields defined by `x/iid`:

- `LinkedClaim.serviceEndpoint` points to an immutable `EntityClaimCollectionLinkV1` document. That document contains the target entity, pinned protocol release, network and resulting collection.
- `LinkedClaim.proof` is the `sha256:` digest of the pinned `ClaimProtocolReleaseV1`.
- `LinkedClaim.right` is the stable `ixo:claim-collection:operate:v1` right ID.
- The corresponding `AccordedRight.message` points to the immutable `ClaimCollectionCapabilityDocumentV1`.
- `AccordedRight.service` points to the Topic-owned Flow or governed runtime service.

The `AccordedRight` is a pointer, not authority by itself. The capability document and its referenced UCAN delegation define the controller, bounded actions and resources, economics, expiry, revocation and provenance.

New claim protocol releases use `protocol/claim`. `protocol/deed` and `protocol/verifiableClaim` remain discovery aliases only.
