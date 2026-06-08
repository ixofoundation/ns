<!--
Thank you for contributing to the IXO namespace.

Please fill out the sections below. Delete any that aren't relevant for
documentation-only or trivial PRs, but keep the validation checklist.

For phase PRs in the v2 rebuild, name the PR "Phase N: <description>" and
link to the corresponding section of PLAN.md.
-->

## Summary

<!-- One or two sentences describing what this PR changes and why. -->



## Phase reference (if part of the v2 rebuild)

- Phase: <!-- 0–8, see PLAN.md section 4 -->
- PLAN.md section: <!-- e.g. 4.1 -->
- Related PR in `ixofoundation/w3id.org`: <!-- link or N/A -->

## What changed

<!-- Specific files added, modified, deleted. Use bullet points. -->

- 

## What did NOT change

<!-- Optional. Useful when the PR scope is narrow and reviewers might
otherwise expect adjacent changes. -->



## Architectural-principle compliance

Check the principles from PLAN.md section 1 that apply to this PR:

- [ ] **1.1 Separation of concerns** — this PR adds vocabulary, schemas, or shapes, not on-chain instance data.
- [ ] **1.2 Serialization** — JSON-LD only; no Turtle.
- [ ] **1.3 Canonical URI form** — uses `https://w3id.org/ixo/<path>`, not the `ns/`-prefixed variant.
- [ ] **1.4 `@protected` policy** — selective (W3C-keyword aliases and security-critical terms only); no blanket protection.
- [ ] **1.5 Schemas vs shapes** — constraints are placed in JSON Schema (document shape) or SHACL (graph shape), not duplicated.
- [ ] **1.6 Versioning** — new content under `v1/`; breaking changes (if any) include `owl:deprecated` and `dcterms:isReplacedBy` on superseded terms.

## Validation

- [ ] `npm run validate` passes locally.
- [ ] No new files added to `scripts/.expect-error.json`.
- [ ] Any files removed from `scripts/.expect-error.json` now pass cleanly.
- [ ] If new namespace paths were added: corresponding `.htaccess` rule drafted in `ixofoundation/w3id.org` on the `ns-v2-redirects` branch (link in "Related PR" above).
- [ ] If a new SKOS scheme was added: every concept has `@id`, `skos:prefLabel@en`, and `skos:definition@en`.
- [ ] If new classes were added to `vocab/v1`: each has `rdfs:label@en`, `rdfs:comment@en`, and `rdfs:subClassOf` (where applicable).
- [ ] If new properties were added to `vocab/v1`: each has `rdfs:domain`, `rdfs:range`, `rdfs:label@en`, `rdfs:comment@en`.
- [ ] If JSON Schemas were added: each has a real `$id` matching its canonical w3id URL (no `http://example.com/example.json` placeholders).
- [ ] If SHACL shapes were added: each targets a class with `sh:targetClass` and uses real prefixes from `vocab/v1`.

## Term-coverage impact (for Phase 4+)

- [ ] N/A — this PR doesn't touch on-chain term coverage.
- [ ] `docs/term-coverage.md` updated to reflect new terms added or schemas now covered.

## Review focus

<!-- Optional. Tell reviewers what to look at most carefully. Examples:

- The `rdfs:range` choice for `ixo:hasEvidence` — is `prov:Entity` or
  `schema:Thing` the better range?
- The decision to place X constraint in JSON Schema rather than SHACL.
- The bridging axiom `ixo:Organisation owl:equivalentClass schema:Organization`
  is potentially controversial — is `rdfs:subClassOf` the safer choice? -->



## Open questions

<!-- Anything you'd like a second opinion on before merge. -->



## Notes for downstream consumers

<!-- Optional. If this PR changes anything that consumers of the namespace
might need to adapt to. -->


