# IXO Constitutional Ontology v1

This module defines a jurisdiction-neutral and legal-form-independent semantic vocabulary for constitutional
subjects, constitutions, instruments, norms, subject profiles, reusable governance archetypes, bounded
agentic twins, executable governance, and constitutional-AI mechanisms.

Core namespace: `https://w3id.org/ixo/vocab/v1/constitution#`

Subject taxonomy: `https://w3id.org/ixo/vocab/v1/constitution/subjects`

## Model boundary

The ontology keeps five things distinct:

1. A **constitutional subject** is any thing explicitly modeled as possessing identity and a governing
   normative system. It need not be a legal person, organisation, or even an enduring entity.
2. A **constitution** is the relatively fundamental normative system that constitutes, governs, constrains,
   and enables that subject.
3. A **constitutional instrument** is a document or artifact that creates, expresses, amends, interprets,
   or evidences part of the constitution.
4. A **constitutional mechanism** is a human, institutional, technical, or hybrid procedure that evaluates,
   applies, enforces, records, or escalates constitutional norms.
5. A **constitutional subject profile** classifies the subject and references its identity, purposes,
   interests, values, rights, obligations, capabilities, claims, wallets, authority, memory, policies,
   responsible parties, or agentic twins without duplicating their canonical sources.

A deed is not a trust. Articles are not a company. A smart contract is not a DAO. A model prompt is not the
authority it describes. A digital twin is not the asset it serves.

## Legal-form-independent subject taxonomy

`con:ConstitutionalSubject` is orthogonal to legal form. It is a subclass of `con:Thing`, alongside a small
upper ontology:

```text
Thing
├── Entity
├── Event
├── Process
├── Relationship
├── InformationObject
│   └── NormativeObject
└── Capability
```

The subject taxonomy defines these non-exclusive branches:

| Branch | Representative subject types |
| --- | --- |
| Persons | natural, artificial, digital, collective |
| Organisations | company, partnership, cooperative, association, foundation, trust, DAO, government, international organisation |
| Assets | physical, digital, financial, natural, infrastructure, knowledge, intangible |
| Commodities | energy, agriculture, mineral, digital compute, water |
| Financial instruments | investment, bond, equity, loan, insurance policy, option, future, environmental credit, digital currency |
| Property rights | title, lease, licence, permit, concession, resource right, intellectual-property right |
| Agreements and deeds | contract, service/employment/purchase/supply agreement, trust/property/conservation/mortgage deed |
| Projects and work | programme, mission, campaign, task, workflow, IXO Deed, milestone, deliverable |
| Protocols and services | blockchain, communication, governance, evaluation, settlement, medical, security; professional, oracle, verification, payment, hosting services |
| Oracles | human, AI, sensor, institutional, composite, market, scientific |
| Claims, credentials, evidence, and decisions | fact and impact claims, licences and verifiable credentials, observations and reports, approvals and diagnoses |
| Outcomes, places, and biological subjects | employment and climate outcomes, jurisdictions and protected areas, patients, populations, species, pathogens, ecosystems, outbreaks |
| Networks | supply chains, energy grids, transport, validator, social, and healthcare networks |

The complete type dictionary and definitions are in
[`subjects.jsonld`](https://w3id.org/ixo/vocab/v1/constitution/subjects). Typing something with one of these
classes is an explicit modeling assertion that it is being treated as a constitutional subject. It does not
assert that every real-world instance of the ordinary-language category has a constitution.

## Uniform subject vocabulary

Every constitutional subject may be described through the same semantic facets:

```text
hasIdentity       hasPurpose          hasInterests
hasValues         hasConstitution     hasRights
hasObligations    hasCapabilities     hasAuthority
hasClaims         hasWallet           hasMemory
hasEvidencePolicy hasEvaluationPolicy
hasDecisionPolicy hasSettlementPolicy hasGovernance
hasCustodian      hasSteward          hasOwner
hasBeneficiary    hasOracle           hasAgenticTwin
```

These properties reference canonical records; they do not replace identity documents, rights, credentials,
protocol state, approvals, capability tokens, or other live authority.

## Constitutional archetypes

The subject taxonomy also defines seven reusable, non-exclusive archetypes:

- `con:Stewarded`
- `con:Owned`
- `con:Managed`
- `con:Governed`
- `con:Regulated`
- `con:Verified`
- `con:Settled`

They are named instances of `con:ConstitutionalArchetype`, not a rigid taxonomic hierarchy. A forest may be
Stewarded and Regulated; a GPU may be Owned and Managed; a claim may be Verified and Settled.

## Constitutions for non-legal subjects

`con:OperationalConstitution` supplies the general form for subjects whose constitution primarily has
operational rather than legal effect. Its specializations cover personal, asset, financial, work, service,
oracle, information, place, biological, network, protocol, and agentic subjects. Existing legal and
organizational constitution types remain available.

The constitutional-type and `commonInstrument` catalogue is authoring metadata, not an assertion that an
instrument is universally required. `commonInstrument` is deliberately an `owl:AnnotationProperty`; using
an object-property domain and range for class-level catalogue links would incorrectly infer that the linked
classes are constitution and instrument instances.

## Recursive agentic twins

Every constitutional subject may have an intrinsic cognitive twin, but need not have one.
`con:AgenticTwin` is itself a `con:ConstitutionalSubject`. The recursive model is:

```text
subject
├── constitution
├── claims, wallet, evidence, rights, capabilities, and memory
└── agentic twin
    ├── its own identity and constitution
    ├── claims and wallet
    ├── memory and world model
    ├── decision engine
    ├── capability tokens
    └── constitutional governor
```

The twin's constitution governs its proposals and internal behavior. It does not self-authorize external
action: current controller state, rights, capabilities, approvals, protocol state, and enforcement points
must still authorize each act.

## IXO constitutional agency cycle

The catalogue defines the conceptual cycle:

```text
Identity → Constitution → Claims → Evidence → Evaluation
→ Decision → Capability → Action → Settlement → Memory
```

The `con:precedes` links are a reasoning and authoring aid. They do not create permission or authorize a
transition.

## Catalogue use

Constitutional types, subject classes, archetypes, and common instruments are jurisdiction-neutral semantic
normalizations for discovery and authoring. In particular:

- a trust may be created or evidenced by a trust deed, declaration, will, or another written instrument;
- a cooperative deed of formation is jurisdiction-specific rather than a universal canonical title;
- a de-novo operational or agentic constitution has operational effect only unless legal authority is
  separately verified;
- instrument titles never establish authority, validity, currency, or legal effect without external
  evidence.

## Source basis

- [Financial Industry Business Ontology](https://spec.edmcouncil.org/fibo/)
- [OASIS LegalRuleML Core 1.0](https://docs.oasis-open.org/legalruleml/legalruleml-core-spec/v1.0/legalruleml-core-spec-v1.0.html)
- [W3C Organization Ontology](https://www.w3.org/TR/vocab-org/)
- [W3C ODRL Information Model 2.2](https://www.w3.org/TR/odrl-model/)
- [UK Companies Act 2006, sections 17–18](https://www.legislation.gov.uk/ukpga/2006/46/section/17)
- [HCCH Convention on the Law Applicable to Trusts](https://www.hcch.net/en/instruments/conventions/full-text/?cid=59)
- [European Cooperative Society Regulation](https://eur-lex.europa.eu/legal-content/EN/AUTO/?uri=CELEX:02003R1435-20030821)
- [Charter of the United Nations](https://www.un.org/en/about-us/un-charter)
- [Constitutional AI: Harmlessness from AI Feedback](https://arxiv.org/abs/2212.08073)

These sources ground the vocabulary but do not turn it into jurisdiction-specific legal advice.
