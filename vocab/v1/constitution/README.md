# IXO Constitutional Ontology v1

This module defines a jurisdiction-neutral semantic vocabulary for constitutions, constitutional
instruments, norms, authorities, executable governance, and constitutional-AI mechanisms.

Namespace: `https://w3id.org/ixo/vocab/v1/constitution#`

## Model boundary

The ontology keeps four things distinct:

1. A **constitutional subject** is the entity, institutional arrangement, protocol, collective, or agentic
   system being governed.
2. A **constitution** is the relatively fundamental normative system that constitutes, governs, constrains,
   and enables that subject.
3. A **constitutional instrument** is a document or artifact that creates, expresses, amends, interprets,
   or evidences part of the constitution.
4. A **constitutional mechanism** is a human, institutional, technical, or hybrid procedure that evaluates,
   applies, enforces, records, or escalates constitutional norms.

A deed is not a trust. Articles are not a company. A smart contract is not a DAO. A model prompt is not the
authority it describes.

## Catalogue use

The constitutional types and `commonInstrument` relationships are semantic normalizations for discovery and
authoring. They do not assert that a label has the same legal meaning in every jurisdiction. In particular:

- a trust may be created or evidenced by a trust deed, declaration, will, or another written instrument;
- a cooperative deed of formation is jurisdiction-specific rather than a universal canonical title;
- a de-novo agentic constitution has operational effect only unless legal authority is separately verified;
- instrument titles never establish authority, validity, currency, or legal effect without external evidence.

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
