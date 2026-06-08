#!/usr/bin/env node
/**
 * Phase 3 — generator for the IXO SKOS concept schemes.
 * See PLAN.md sections 1, 2, and 4.3.
 *
 * Emits vocab/<scheme>/v1/index.jsonld for every closed enum / taxonomy, from a
 * single source of truth (the SCHEMES table below + scripts/countries.data.json).
 * Each emitted file is a standalone JSON-LD skos:ConceptScheme; consumers and
 * the validator use the .jsonld outputs, not this script. Re-run after editing
 * the data here:  node scripts/build-schemes.mjs
 *
 * Concept shape: @id (#slug), skos:inScheme, skos:prefLabel@en,
 * skos:definition@en, skos:notation (the on-chain string), skos:broader
 * (slash-notation hierarchy) or skos:topConceptOf.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const WEBCLIENT = 'https://github.com/ixofoundation/ixo-webclient/blob/main/src/types/entities.ts';

// c(id, label, def, notation?, broader?, inv?)  — inv = inverse slug (relationships only)
const c = (id, label, def, notation, broader, inv) => ({ id, label, def, notation, broader, inv });

// Salvaged-enum helpers (review item P4): turn a legacy nested {key:{description,
// types:{…}}} catalogue into concepts. Children link via skos:broader; notation is
// slash-pathed like the on-chain values, mirroring the entity-types convention.
const kebab = (k) => k.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const humanize = (k) => { const s = k.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[._/-]+/g, ' ').replace(/\s+/g, ' ').trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : k; };
function enumToConcepts(node, parentId, parentNotation, out = []) {
  for (const [key, val] of Object.entries(node || {})) {
    const id = parentId ? `${parentId}-${kebab(key)}` : kebab(key);
    const notation = parentNotation ? `${parentNotation}/${key}` : key;
    const desc = val && typeof val.description === 'string' ? val.description.trim() : '';
    out.push(c(id, humanize(key), desc || humanize(key), notation, parentId || undefined));
    if (val && val.types && typeof val.types === 'object') enumToConcepts(val.types, id, notation, out);
  }
  return out;
}
// Disambiguate duplicate prefLabels within a salvaged scheme by qualifying the
// child with its parent's label (e.g. two "Governance" leaves under flow / proposal
// → "Governance (Flow)" / "Governance (Proposal)"). SKOS prefLabels needn't be
// unique per scheme, but distinct labels keep pick-lists unambiguous.
function disambiguateLabels(concepts) {
  const count = new Map();
  for (const x of concepts) count.set(x.label, (count.get(x.label) || 0) + 1);
  const byId = new Map(concepts.map((x) => [x.id, x]));
  for (const x of concepts) {
    if (count.get(x.label) > 1 && x.broader && byId.has(x.broader)) {
      const p = byId.get(x.broader);
      const q = humanize(String(p.notation || '').split('/').pop() || '') || p.label;
      x.label = `${x.label} (${q})`;
    }
  }
  return concepts;
}

const SCHEMES = {
  'entity-types': {
    title: 'IXO Entity Types',
    description: 'Kinds of entity domain on the IXO Spatial Web. Top concepts are the primary entity classes; slash-notation sub-types record specific kinds observed on-chain. A few malformed on-chain variants (protocol/protocol, protocol/protocol_deed, deed/deed, deed/deed_request) are normalised to their base concept; Phase 4 reconciles coverage exhaustively. Sub-type taxonomies for asset, dao, deed, oracle, group, pod and project (from the legacy tags catalogue) are folded in as skos:broader children, so this is the single scheme for entity kinds and their sub-types.',
    source: `${WEBCLIENT} (EntityType) + on-chain entity.type values (ixo-mainnet, May 2026)`,
    concepts: [
      c('project', 'Project', 'A planned undertaking coordinating resources and activities toward defined goals and measurable outcomes.', 'project'),
      c('dao', 'DAO', 'A Decentralised Autonomous Organisation coordinating members and sub-groups through on-chain governance.', 'dao'),
      c('oracle', 'Oracle', 'An agentic service that evaluates claims and supplies verified results to the network.', 'oracle'),
      c('asset', 'Asset', 'An item or resource of value owned or controlled by an entity.', 'asset'),
      c('protocol', 'Protocol', 'A reusable definition used to create and govern entities, claims or credentials of a given kind.', 'protocol'),
      c('deed', 'Deed', 'A recorded act or agreement expressing intent or commitment between entities.', 'deed'),
      c('investment', 'Investment', 'An allocation of capital or resources made in expectation of a future return.', 'investment'),
      c('group', 'Group', 'An organisational unit grouping members or entities under shared coordination.', 'group'),
      c('pod', 'POD', 'A small autonomous sub-group that can act independently while remaining accountable to a parent organisation.', 'pod'),
      c('user', 'User', 'An individual user account represented as an entity.', 'user'),
      c('agent', 'Agent', 'A human or autonomous agent that acts within the network.', 'agent'),
      c('document', 'Document', 'A document resource registered as an entity.', 'document'),
      c('image', 'Image', 'An image resource registered as an entity.', 'image'),
      c('text', 'Text', 'A text resource registered as an entity.', 'text'),
      c('request', 'Request', 'A standalone request entity.', 'request'),
      // asset sub-types
      c('asset-device', 'Device', 'A physical or virtual device represented as an asset, such as a metered cookstove or sensor.', 'asset/device', 'asset'),
      c('asset-collection', 'Asset Collection', 'A curated group of related assets managed together.', 'asset/collection', 'asset'),
      c('asset-voucher', 'Voucher', 'An asset redeemable for goods or services.', 'asset/voucher', 'asset'),
      c('asset-impactcredit', 'Impact Credit', 'A unit representing verified environmental or social impact.', 'asset/impactcredit', 'asset'),
      c('asset-coin', 'Coin', 'A digital or physical currency used as a medium of exchange.', 'asset/coin', 'asset'),
      c('asset-data', 'Data Asset', 'A data asset that can be stored, shared or traded.', 'asset/data', 'asset'),
      c('asset-learnership', 'Learnership', 'An asset representing a structured learning programme.', 'asset/learnership', 'asset'),
      c('asset-membership', 'Membership Asset', 'An asset signifying membership rights or privileges.', 'asset/membershipAsset', 'asset'),
      // dao sub-types
      c('dao-pod', 'POD (in a DAO)', 'A POD operating within a parent DAO.', 'dao/pod', 'dao'),
      c('dao-group', 'Group (in a DAO)', 'A functional group within a DAO.', 'dao/group', 'dao'),
      // deed sub-types
      c('deed-request', 'Request (Deed)', 'A deed appealing or demanding that something be provided or done.', 'deed/request', 'deed'),
      c('deed-offer', 'Offer', 'A deed expressing a willingness to provide or do something.', 'deed/offer', 'deed'),
      c('deed-subscription', 'Subscription', 'A deed establishing an agreement to receive or support something regularly.', 'deed/subscription', 'deed'),
      c('deed-proposal', 'Proposal', 'A deed outlining a suggested plan or action for consideration.', 'deed/proposal', 'deed'),
      c('deed-flow', 'Flow', 'An intent-driven workflow coordinating a process from start to finish.', 'deed/flow', 'deed'),
      // oracle sub-types
      c('oracle-evaluation', 'Evaluation Oracle', 'An oracle specialised in evaluating claims to produce verified results.', 'oracle/evaluation', 'oracle'),
      // protocol sub-types
      c('protocol-claim', 'Claim Protocol', 'A protocol defining the content and structure of a class of claims.', 'protocol/claim', 'protocol'),
      c('protocol-deed', 'Deed Protocol', 'A protocol defining the content and structure of a class of deeds.', 'protocol/deed', 'protocol'),
      c('protocol-dao', 'DAO Protocol', 'A protocol defining the governance and operation of a class of DAOs.', 'protocol/dao', 'protocol'),
      c('protocol-system', 'System Protocol', 'A protocol defining a cognitive digital twin system.', 'protocol/system', 'protocol'),
      c('protocol-asset', 'Asset Protocol', 'A protocol defining the properties of a class of assets.', 'protocol/asset', 'protocol'),
      c('protocol-project', 'Project Protocol', 'A protocol defining a class of project domains.', 'protocol/project', 'protocol'),
      c('protocol-oracle', 'Oracle Protocol', 'A protocol defining the properties of a class of oracles.', 'protocol/oracle', 'protocol'),
      c('protocol-investment', 'Investment Protocol', 'A protocol governing a class of investment processes.', 'protocol/investment', 'protocol'),
      c('protocol-group', 'Group Protocol', 'A protocol defining the formation and governance of a class of groups.', 'protocol/group', 'protocol'),
      c('protocol-request', 'Request Protocol', 'A protocol defining a class of requests.', 'protocol/request', 'protocol'),
      c('protocol-verifiableclaim', 'Verifiable Claim Protocol', 'A protocol for creating verifiable claims and defining their content and structure.', 'protocol/verifiableClaim', 'protocol'),
      c('protocol-verifiablecredential', 'Verifiable Credential Protocol', 'A protocol for creating verifiable credentials and defining their content and structure.', 'protocol/verifiableCredential', 'protocol'),
      c('protocol-impact', 'Impact Protocol', 'A protocol defining how impact is claimed and verified.', 'protocol/impact', 'protocol'),
      c('protocol-flow', 'Flow Protocol', 'A protocol defining an intent-driven workflow.', 'protocol/flow', 'protocol'),
    ],
  },

  'claim-types': {
    title: 'IXO Claim Types',
    description: 'Kinds of verifiable claim made by or about entities. Top concepts are claim families; sub-types specialise a family for a particular domain.',
    source: 'ixofoundation/ns protocol/claims/v1 + #ixo-data design discussions',
    concepts: [
      c('accreditation', 'Accreditation', 'A claim verifying the official recognition, authorization, or certification status of a domain or process.', 'accreditation'),
      c('compliance', 'Compliance', 'A claim attesting to adherence to specific regulatory, legal, or protocol requirements.', 'compliance'),
      c('contribution', 'Contribution', 'A claim documenting verified contributions to projects, initiatives, or common objectives.', 'contribution'),
      c('credential', 'Credential', 'A claim establishing the authenticity and validity of qualifications, permissions, or rights.', 'credential'),
      c('credentialAudit', 'Credential Audit', 'A claim documenting the systematic examination and verification of credential issuance and management.', 'credentialAudit'),
      c('dispute', 'Dispute', 'A claim documenting formal disagreements and their resolution processes.', 'dispute'),
      c('identity', 'Identity', 'A claim verifying the authentic identity attributes of an individual, organization, or domain.', 'identity'),
      c('impact', 'Impact', 'A claim measuring and validating the social or environmental effects of specific actions.', 'impact'),
      c('investment', 'Investment', 'A claim documenting investment activities, commitments, or outcomes in impact projects.', 'investment'),
      c('invoice', 'Invoice', 'A claim validating the authenticity and details of financial transactions or service provisions.', 'invoice'),
      c('offset', 'Offset', 'A claim validating the compensation or neutralization of environmental impacts through verified actions.', 'offset'),
      c('outcome', 'Outcome', 'A claim documenting measured results or impacts of specific actions or initiatives.', 'outcome'),
      c('ownership', 'Ownership', 'A claim validating the rightful possession or control of assets, resources, or rights.', 'ownership'),
      c('procurement', 'Procurement', 'A claim documenting the acquisition process and compliance with procurement standards.', 'procurement'),
      c('provenance', 'Provenance', 'A claim establishing the origin, history, and chain of custody of assets or resources.', 'provenance'),
      c('service', 'Service', 'A claim validating the delivery, quality, or completion of specific services.', 'service'),
      c('subscription', 'Subscription', 'A claim validating the active subscription status and associated rights of a participant.', 'subscription'),
      c('useOfFunds', 'Use of Funds', 'A claim documenting the allocation and utilization of financial resources in accordance with specified purposes.', 'useOfFunds'),
      c('payment', 'Payment', 'A claim documenting a payment made or received.', 'payment'),
      // impact sub-types
      c('verifiedCleanCooking', 'Verified Clean Cooking', 'A claim validating the implementation and impact of verified clean cooking solutions.', 'verifiedCleanCooking', 'impact'),
      c('verifiedEmissionsReduction', 'Verified Emissions Reduction', 'A claim certifying the verified reduction of greenhouse gas emissions through specific projects.', 'verifiedEmissionsReduction', 'impact'),
      // outcome sub-types
      c('carbonEmissionReduction', 'Carbon Emission Reduction', 'A claim documenting verified reductions in carbon emissions through specific interventions.', 'carbonEmissionReduction', 'outcome'),
      c('cleanCookingClaim', 'Clean Cooking Claim', 'A claim verifying the implementation and impact of clean cooking solutions.', 'cleanCookingClaim', 'outcome'),
      // procurement sub-types
      c('fuelPurchase', 'Fuel Purchase', 'A claim verifying the purchase and sourcing of fuel products according to specified standards.', 'fuelPurchase', 'procurement'),
    ],
  },

  'credential-types': {
    title: 'IXO Credential Types',
    description: 'Kinds of verifiable credential issued about a subject. All specialise the verifiableCredential family.',
    source: 'ixofoundation/ns protocol/credentials/v1 + ixo-webclient',
    concepts: [
      c('verifiableCredential', 'Verifiable Credential', 'A digital credential that can be cryptographically verified and contains claims about a subject.', 'verifiableCredential'),
      c('academic', 'Academic', 'A credential validating academic qualifications, degrees, or educational achievements.', 'academic', 'verifiableCredential'),
      c('attendance', 'Attendance', 'A credential confirming participation or presence at an event, meeting, or gathering.', 'attendance', 'verifiableCredential'),
      c('certification', 'Certification', 'A credential validating professional certifications or specialized training completions.', 'certification', 'verifiableCredential'),
      c('investorCredential', 'Investor Credential', 'A credential validating an entity’s status as an accredited or qualified investor.', 'investorCredential', 'verifiableCredential'),
      c('kycamlAttestation', 'KYC/AML Attestation', 'A credential confirming completion of Know Your Customer and Anti-Money Laundering verification.', 'kycamlAttestation', 'verifiableCredential'),
      c('kycamlLevel1', 'KYC/AML Level 1', 'An identity-verification credential issued after KYC/AML Level 1 checks — document verification, liveness detection, and standard AML screening. Defined by protocol/credentials/v1/KYCAMLLevel1.json.', 'KYCAMLLevel1', 'kycamlAttestation'),
      c('license', 'License', 'A credential validating official permissions to perform specific activities or services.', 'license', 'verifiableCredential'),
      c('membership', 'Membership', 'A credential validating affiliation with organizations, communities, or professional bodies.', 'membership', 'verifiableCredential'),
      c('professional', 'Professional', 'A credential validating professional qualifications, experience, or expertise in specific domains.', 'professional', 'verifiableCredential'),
      c('verifiedCleanCooking', 'Verified Clean Cooking', 'A credential validating the implementation and impact of verified clean cooking solutions.', 'verifiedCleanCooking', 'verifiableCredential'),
      c('verifiedEmissionsReduction', 'Verified Emissions Reduction', 'A credential certifying the verified reduction of greenhouse gas emissions through specific projects.', 'verifiedEmissionsReduction', 'verifiableCredential'),
      c('administrator', 'Administrator', 'A credential designating an administrator of an entity.', 'AdministratorCredential', 'verifiableCredential'),
      c('creator', 'Creator', 'A credential designating the creator of an entity.', 'CreatorCredential', 'verifiableCredential'),
    ],
  },

  'oracle-capabilities': {
    title: 'IXO Oracle Capabilities (P-Functions)',
    description: 'The capability classes (P-Functions) that an agentic oracle or cognitive digital twin can perform.',
    source: 'ixofoundation docs — articles/cdt-systems.md (P-Functions)',
    concepts: [
      c('prediction-and-perception', 'Prediction and Perception', 'Sensing, monitoring and forecasting the state of a system or environment.', 'prediction-and-perception'),
      c('prescription-and-planning', 'Prescription and Planning', 'Recommending and planning actions to achieve goals.', 'prescription-and-planning'),
      c('proving-and-protocol-conformance', 'Proving and Protocol Conformance', 'Verifying that claims, processes and outputs conform to defined protocols.', 'proving-and-protocol-conformance'),
      c('protection-and-risk', 'Protection and Risk', 'Identifying, assessing and mitigating risks and threats.', 'protection-and-risk'),
      c('participation', 'Participation', 'Enabling, coordinating and rewarding the participation of agents.', 'participation'),
      c('payments-and-portfolio', 'Payments and Portfolio', 'Managing payments, assets and portfolios.', 'payments-and-portfolio'),
      c('policy-and-compliance', 'Policy and Compliance', 'Applying policies and ensuring regulatory and protocol compliance.', 'policy-and-compliance'),
      c('problem-identification-and-resolution', 'Problem Identification and Resolution', 'Detecting problems and coordinating their resolution.', 'problem-identification-and-resolution'),
    ],
  },

  'entity-status': {
    title: 'IXO Entity Status',
    description: 'Operational status codes for an entity on the IXO Spatial Web.',
    source: `${WEBCLIENT} (EntityStatus)`,
    concepts: [
      c('pending', 'Pending', 'The entity has been created but is not yet active.', 'Pending'),
      c('live', 'Live', 'The entity is active and operational.', 'Live'),
      c('stopped', 'Stopped', 'The entity’s operation has been halted.', 'Stopped'),
      c('sealed', 'Sealed', 'The entity has been finalised and locked against further change.', 'Sealed'),
      c('deleted', 'Deleted', 'The entity has been removed from active use.', 'Deleted'),
      c('recruiting', 'Recruiting', 'The entity is open and seeking participants or members.', 'Recruiting'),
    ],
  },

  'entity-stage': {
    title: 'IXO Entity Stage',
    description: 'Lifecycle stages of an entity, from proposal to archival.',
    source: `${WEBCLIENT} (EntityStage)`,
    concepts: [
      c('proposal', 'Proposal', 'The entity is at the proposal stage, before work begins.', 'Proposal'),
      c('planning', 'Planning', 'The entity is being planned and prepared.', 'Planning'),
      c('delivery', 'Delivery', 'The entity is actively delivering its work.', 'Delivery'),
      c('paused', 'Paused', 'Delivery is temporarily suspended.', 'Paused'),
      c('closing', 'Closing', 'The entity is winding down its activities.', 'Closing'),
      c('ended', 'Ended', 'The entity’s lifecycle has ended.', 'Ended'),
      c('archived', 'Archived', 'The entity is archived for record-keeping.', 'Archived'),
    ],
  },

  'entity-view': {
    title: 'IXO Entity View',
    description: 'Visibility modes for an entity’s data.',
    source: `${WEBCLIENT} (EntityView)`,
    concepts: [
      c('visible', 'Visible', 'Entity data is publicly visible.', 'Visible'),
      c('encrypted', 'Encrypted', 'Entity data is encrypted and access-controlled.', 'Encrypted'),
    ],
  },

  'page-view': {
    title: 'IXO Page View',
    description: 'Visibility modes for an entity’s page content.',
    source: `${WEBCLIENT} (PageView)`,
    concepts: [
      c('public', 'Public', 'The page is visible to everyone.', 'Public'),
      c('private', 'Private', 'The page is visible only to authorised members.', 'Private'),
      c('secret', 'Secret', 'The page is hidden and shared only with explicitly granted parties.', 'Secret'),
    ],
  },

  'payment-types': {
    title: 'IXO Payment Types',
    description: 'Kinds of payment that can be configured on the IXO Spatial Web.',
    source: `${WEBCLIENT} (PaymentType)`,
    concepts: [
      c('fee-for-service', 'Fee for Service', 'A payment made in exchange for a specific service rendered.', 'FeeForService'),
      c('oracle-fee', 'Oracle Fee', 'A fee paid to an oracle for evaluation or data services.', 'OracleFee'),
      c('subscription', 'Subscription', 'A recurring payment for ongoing access or membership.', 'Subscription'),
      c('rental-fee', 'Rental Fee', 'A payment for the temporary use of an asset.', 'RentalFee'),
      c('outcome-payment', 'Outcome Payment', 'A payment contingent on the achievement of a verified outcome.', 'OutcomePayment'),
      c('interest-repayment', 'Interest Repayment', 'A payment of interest on a loan.', 'InterestRepayment'),
      c('loan-repayment', 'Loan Repayment', 'A repayment of loan principal.', 'LoanRepayment'),
      c('income-distribution', 'Income Distribution', 'A distribution of income to stakeholders.', 'IncomeDistribution'),
      c('dispute-settlement', 'Dispute Settlement', 'A payment settling a dispute.', 'DisputeSettlement'),
    ],
  },

  'payment-denominations': {
    title: 'IXO Payment Denominations',
    description: 'Currencies and tokens in which payments can be denominated.',
    source: `${WEBCLIENT} (PaymentDenomination)`,
    concepts: [
      c('ixo', 'IXO', 'The native IXO token.', 'IXO'),
      c('eeur', 'eEUR', 'A Euro-denominated stable token.', 'eEUR'),
      c('echf', 'eCHF', 'A Swiss-Franc-denominated stable token.', 'eCHF'),
      c('eusd', 'eUSD', 'A US-Dollar-denominated stable token.', 'eUSD'),
    ],
  },

  'stake-types': {
    title: 'IXO Stake Types',
    description: 'Kinds of stake or deposit that back an obligation on the network.',
    source: `${WEBCLIENT} (StakeType)`,
    concepts: [
      c('security-guarantee', 'Security Guarantee', 'A stake guaranteeing the security of a service or network.', 'SecurityGuarantee'),
      c('performance-guarantee', 'Performance Guarantee', 'A stake guaranteeing performance of an obligation.', 'PerformanceGuarantee'),
      c('loan-guarantee', 'Loan Guarantee', 'A stake guaranteeing repayment of a loan.', 'LoanGuarantee'),
      c('claim-guarantee', 'Claim Guarantee', 'A stake guaranteeing the validity of a claim.', 'ClaimGuarantee'),
      c('dispute-guarantee', 'Dispute Guarantee', 'A stake backing a party in a dispute.', 'DisputeGuarantee'),
      c('voting-proposal-deposit', 'Voting Proposal Deposit', 'A deposit required to submit a governance proposal.', 'VotingProposalDeposit'),
      c('membership-deposit', 'Membership Deposit', 'A deposit required to join a group or organisation.', 'MembershipDeposit'),
      c('services-deposit', 'Services Deposit', 'A deposit securing the provision of services.', 'ServicesDeposit'),
      c('insurance-guarantee', 'Insurance Guarantee', 'A stake backing an insurance commitment.', 'InsuranceGuarantee'),
    ],
  },

  'slashing-conditions': {
    title: 'IXO Slashing Conditions',
    description: 'Conditions under which a stake is slashed.',
    source: `${WEBCLIENT} (SlashingCondition)`,
    concepts: [
      c('failed-service', 'Failed Service', 'Slashing triggered by failure to deliver a service.', 'FailedService'),
      c('failed-security', 'Failed Security', 'Slashing triggered by a security failure.', 'FailedSecurity'),
      c('loan-default', 'Loan Default', 'Slashing triggered by default on a loan.', 'LoanDefault'),
      c('failed-proposal', 'Failed Proposal', 'Slashing triggered by a failed governance proposal.', 'FailedProposal'),
      c('failed-dispute', 'Failed Dispute', 'Slashing triggered by losing a dispute.', 'FailedDispute'),
      c('insured-event', 'Insured Event', 'Slashing triggered by an insured event occurring.', 'InsuredEvent'),
      c('failed-membership', 'Failed Membership', 'Slashing triggered by breach of membership obligations.', 'FailedMembership'),
    ],
  },

  'node-types': {
    title: 'IXO Node Types',
    description: 'Kinds of service node referenced from an entity’s service endpoints.',
    source: `${WEBCLIENT} (NodeType)`,
    concepts: [
      c('cell-node', 'Cell Node', 'A data node that stores and serves entity data.', 'CellNode'),
      c('cell-node-encrypted', 'Encrypted Cell Node', 'An encrypted data node.', 'CellNodeEncrypted'),
      c('blockchain', 'Blockchain', 'A blockchain node.', 'Blockchain'),
      c('web-service', 'Web Service', 'A general web service endpoint.', 'WebService'),
      c('bot-service', 'Bot Service', 'An automated bot service.', 'BotService'),
      c('authentication-service', 'Authentication Service', 'A service providing authentication.', 'AuthenticationService'),
      c('cloud-worker', 'Cloud Worker', 'A cloud compute worker.', 'CloudWorker'),
      c('ipfs', 'IPFS', 'An InterPlanetary File System node.', 'Ipfs'),
      c('credential-registry', 'Credential Registry', 'A registry of credentials.', 'CredentialRegistry'),
      c('matrix-home-server', 'Matrix Home Server', 'A Matrix homeserver hosting encrypted entity communications and data.', 'MatrixHomeServer'),
      c('matrix', 'Matrix', 'A Matrix service node.', 'Matrix'),
      c('oracle-service', 'Oracle Service', 'An oracle service endpoint.', 'oracleService'),
      c('websocket-service', 'WebSocket Service', 'A WebSocket service endpoint.', 'wsService'),
      c('chain-service', 'Chain Service', 'A blockchain RPC / chain service endpoint.', 'chainService'),
      c('linked-domains', 'Linked Domains', 'A linked-domains service asserting domains controlled by the entity.', 'linkedDomains'),
    ],
  },

  'liquidity-sources': {
    title: 'IXO Liquidity Sources',
    description: 'Sources from which liquidity or funds can be drawn.',
    source: `${WEBCLIENT} (LiquiditySource)`,
    concepts: [
      c('alphabond', 'Alphabond', 'Liquidity sourced from an Alphabond bonding curve.', 'Alphabond'),
      c('wallet-address', 'Wallet Address', 'Liquidity sourced from a wallet address.', 'WalletAddress'),
      c('bank-account', 'Bank Account', 'Liquidity sourced from a bank account.', 'BankAccount'),
      c('payment-contract', 'Payment Contract', 'Liquidity sourced from a payment contract.', 'PaymentContract'),
      c('nft-asset', 'NFT Asset', 'Liquidity sourced from a non-fungible token asset.', 'NFTAsset'),
      c('liquidity-pool', 'Liquidity Pool', 'Liquidity sourced from a liquidity pool.', 'LiquidityPool'),
    ],
  },

  'agent-roles': {
    title: 'IXO Agent Roles',
    description: 'Roles an agent can hold in relation to an entity. Notation is the two-letter on-chain code.',
    source: 'ixo-webclient AgentRole (src/redux/account/account.types.ts)',
    concepts: [
      c('owner', 'Owner', 'The owner of an entity (project owner).', 'PO'),
      c('evaluator', 'Evaluator', 'An agent that evaluates claims (evaluation agent).', 'EA'),
      c('service-provider', 'Service Provider', 'An agent that provides services (service agent).', 'SA'),
      c('investor', 'Investor', 'An agent that invests in an entity (investor agent).', 'IA'),
    ],
  },

  'evaluation-codes': {
    title: 'IXO Evaluation Codes',
    description: 'Grades A–F used to score the result of an evaluation.',
    source: 'emerging-eco/ns codes/index.jsonld',
    concepts: [
      c('a', 'Grade A', 'Excellent — meets all criteria at the highest standard.', 'A'),
      c('b', 'Grade B', 'Good — meets criteria above the required standard.', 'B'),
      c('c', 'Grade C', 'Satisfactory — meets the required standard.', 'C'),
      c('d', 'Grade D', 'Marginal — partially meets the required standard.', 'D'),
      c('e', 'Grade E', 'Poor — falls short of the required standard.', 'E'),
      c('f', 'Grade F', 'Fail — does not meet the required standard.', 'F'),
    ],
  },

  'linked-resource-types': {
    title: 'IXO Linked Resource Types',
    description: 'Kinds of resource linked from an entity document via the linkedResource property. Notation is the on-chain type string. (A long tail of low-frequency / display: prefixed variants is normalised; see docs/term-coverage.md.)',
    source: 'on-chain linkedResource.type values (ixo-mainnet, 9270 IID docs)',
    concepts: [
      c('settings', 'Settings', 'Entity settings and profile configuration linked from the entity.', 'Settings'),
      c('verifiable-credential', 'Verifiable Credential', 'A verifiable credential linked from the entity.', 'VerifiableCredential'),
      c('web-dashboard', 'Web Dashboard', 'A web dashboard presenting the entity’s data.', 'WebDashboard'),
      c('token-metadata', 'Token Metadata', 'Metadata describing the entity’s impact token.', 'TokenMetadata'),
      c('domain-card', 'Domain Card', 'The entity’s domain card credential.', 'domainCard'),
      c('survey-template', 'Survey Template', 'A survey / form template used to collect claims.', 'surveyTemplate'),
      c('claim-schema', 'Claim Schema', 'A schema defining the structure of a claim.', 'ClaimSchema'),
      c('credential-schema', 'Credential Schema', 'A schema defining the structure of a credential.', 'credentialSchema'),
      c('evaluation-template', 'Evaluation Template', 'A template for evaluating claims.', 'evaluationTemplate'),
      c('legal-contract', 'Legal Contract', 'A legal contract document linked from the entity.', 'LegalContract'),
      c('page', 'Page', 'A presentational page linked from the entity.', 'Page'),
      c('pricing-list', 'Pricing List', 'A list of prices for the entity’s offerings.', 'pricingList'),
      c('oracle-authz-config', 'Oracle AuthZ Config', 'Authorization configuration for an oracle.', 'oracleAuthZConfig'),
      c('bid-contributor', 'Bid (Contributor)', 'A contributor bid template.', 'bidContributor'),
      c('bid-evaluator', 'Bid (Evaluator)', 'An evaluator bid template.', 'bidEvaluator'),
      c('verification-methods', 'Verification Methods', 'A linked resource listing verification methods.', 'VerificationMethods'),
      c('image-profile', 'Profile Image', 'The entity’s profile image.', 'imageProfile'),
      c('image-logo', 'Logo Image', 'The entity’s logo image.', 'imageLogo'),
      c('image-header', 'Header Image', 'The entity’s header image.', 'imageHeader'),
      c('image-icon', 'Icon Image', 'The entity’s icon image.', 'imageIcon'),
      c('image', 'Image', 'An image resource.', 'image'),
      c('document', 'Document', 'A document resource.', 'document'),
      c('text-document', 'Text Document', 'A text document resource.', 'textDocument'),
      c('text', 'Text', 'A text resource.', 'text'),
      c('lottie', 'Lottie Animation', 'A Lottie animation asset.', 'Lottie'),
      c('template', 'Template', 'A generic template resource.', 'Template'),
      c('project-credential', 'Project Credential', 'A credential about a project.', 'ProjectCredential'),
    ],
  },

  'accorded-right-types': {
    title: 'IXO Accorded Right Types',
    description: 'Kinds of right or capability granted in relation to an entity via the accordedRight property.',
    source: 'on-chain accordedRight.type values (ixo-mainnet)',
    concepts: [
      c('capability', 'Capability', 'An authority capability granted in relation to an entity.', 'capability'),
      c('capability-mint-token', 'Mint Token', 'Capability to mint tokens.', 'capability/mintToken', 'capability'),
      c('capability-create-entity', 'Create Entity', 'Capability to create entities.', 'capability/createEntity', 'capability'),
      c('capability-attest', 'Attest', 'Capability to attest claims.', 'capability/attest', 'capability'),
      c('capability-access', 'Access', 'Capability to access a resource.', 'capability/access', 'capability'),
      c('capability-swap-token', 'Swap Token', 'Capability to swap tokens.', 'capability/swapToken', 'capability'),
      c('capability-transfer-token', 'Transfer Token', 'Capability to transfer tokens.', 'capability/transferToken', 'capability'),
      c('capability-retire-token', 'Retire Token', 'Capability to retire tokens.', 'capability/retireToken', 'capability'),
      c('capability-cancel-token', 'Cancel Token', 'Capability to cancel tokens.', 'capability/cancelToken', 'capability'),
      c('legal', 'Legal Right', 'A legal right governing the entity or resource.', 'legal'),
      c('access-token', 'Access Token', 'An access-token-based right.', 'AccessToken'),
    ],
  },

  'relationships': {
    title: 'IXO Relationship Types',
    description: 'Typed relationships asserted between two entities via ixo:linkedEntity / ixo:relationship. A starter set; to be reconciled with the fuller Relationship Type Ontology outline.',
    source: 'PLAN.md Phase 8 (Relationship Type Ontology); IID linkedEntity relationships',
    concepts: [
      c('member-of', 'Member Of', 'The subject entity is a member of the object entity (inverse of has-member).', 'memberOf', null, 'has-member'),
      c('has-member', 'Has Member', 'The subject entity has the object entity as a member (inverse of member-of).', 'hasMember', null, 'member-of'),
      c('part-of', 'Part Of', 'The subject entity is a constituent part of the object entity (inverse of has-part).', 'partOf', null, 'has-part'),
      c('has-part', 'Has Part', 'The subject entity has the object entity as a constituent part (inverse of part-of).', 'hasPart', null, 'part-of'),
      c('controls', 'Controls', 'The subject entity controls the object entity (inverse of controlled-by).', 'controls', null, 'controlled-by'),
      c('controlled-by', 'Controlled By', 'The subject entity is controlled by the object entity (inverse of controls).', 'controlledBy', null, 'controls'),
      c('delegates-to', 'Delegates To', 'The subject entity delegates authority to the object entity (inverse of delegated-by).', 'delegatesTo', null, 'delegated-by'),
      c('delegated-by', 'Delegated By', 'The subject entity holds authority delegated by the object entity (inverse of delegates-to).', 'delegatedBy', null, 'delegates-to'),
      c('issued-by', 'Issued By', 'The subject was issued by the object entity (inverse of issuer-of).', 'issuedBy', null, 'issuer-of'),
      c('issuer-of', 'Issuer Of', 'The subject entity is the issuer of the object (inverse of issued-by).', 'issuerOf', null, 'issued-by'),
      c('evaluates', 'Evaluates', 'The subject entity evaluates the object (inverse of evaluated-by).', 'evaluates', null, 'evaluated-by'),
      c('evaluated-by', 'Evaluated By', 'The subject is evaluated by the object entity (inverse of evaluates).', 'evaluatedBy', null, 'evaluates'),
      c('owns', 'Owns', 'The subject entity owns the object (inverse of owned-by).', 'owns', null, 'owned-by'),
      c('owned-by', 'Owned By', 'The subject is owned by the object entity (inverse of owns).', 'ownedBy', null, 'owns'),
      c('funds', 'Funds', 'The subject entity funds the object (inverse of funded-by).', 'funds', null, 'funded-by'),
      c('funded-by', 'Funded By', 'The subject is funded by the object entity (inverse of funds).', 'fundedBy', null, 'funds'),
      c('parent-of', 'Parent Of', 'The subject entity is the parent of the object (inverse of child-of).', 'parentOf', null, 'child-of'),
      c('child-of', 'Child Of', 'The subject entity is a child of the object (inverse of parent-of).', 'childOf', null, 'parent-of'),
      c('verifies', 'Verifies', 'The subject entity verifies the object (inverse of verified-by).', 'verifies', null, 'verified-by'),
      c('verified-by', 'Verified By', 'The subject is verified by the object entity (inverse of verifies).', 'verifiedBy', null, 'verifies'),
      c('collaborates-with', 'Collaborates With', 'The subject and object entities collaborate (symmetric).', 'collaboratesWith'),
      c('derived-from', 'Derived From', 'The subject entity was derived from the object entity.', 'derivedFrom'),
    ],
  },
};

function buildScheme(slug, s, concepts, base) {
  const schemeNode = {
    '@id': base,
    '@type': 'skos:ConceptScheme',
    'dcterms:title': s.title,
    'dcterms:description': s.description,
    'dcterms:created': '2026-06-04',
    'dcterms:source': s.source,
    ...(s.conformsTo ? { 'dcterms:conformsTo': { '@id': s.conformsTo } } : {}),
    'skos:hasTopConcept': concepts.filter((x) => !x.broader).map((x) => ({ '@id': `#${x.id}` })),
  };
  const isRel = slug === 'relationships';
  const conceptNodes = concepts.map((x) => {
    const node = {
      '@id': `#${x.id}`,
      // relationship types are punned: SKOS concept (controlled vocabulary) AND
      // owl:ObjectProperty (usable as a predicate, with inverses) — OWL 2 punning.
      '@type': isRel ? ['skos:Concept', 'owl:ObjectProperty'] : 'skos:Concept',
      'skos:inScheme': { '@id': base },
      'skos:prefLabel': { '@value': x.label, '@language': 'en' },
      'skos:definition': { '@value': x.def, '@language': 'en' },
    };
    if (x.notation !== undefined && x.notation !== null) node['skos:notation'] = x.notation;
    if (x.broader) node['skos:broader'] = { '@id': `#${x.broader}` };
    else node['skos:topConceptOf'] = { '@id': base };
    if (x.match) node['skos:closeMatch'] = { '@id': x.match };
    if (x.exact) node['skos:exactMatch'] = { '@id': x.exact };
    if (isRel) {
      node['rdfs:subPropertyOf'] = { '@id': 'ixo:linkedEntity' };
      if (x.inv) node['owl:inverseOf'] = { '@id': `#${x.inv}` };
    }
    return node;
  });
  return { '@context': ['https://w3id.org/ixo/context/v1', { '@base': base }], '@graph': [schemeNode, ...conceptNodes] };
}

async function countryConcepts() {
  const dataFile = path.join(HERE, 'countries.data.json');
  const map = JSON.parse(await readFile(dataFile, 'utf8'));
  return Object.entries(map).map(([name, code]) => {
    const slug = String(code).toLowerCase();
    const isGlobal = code === 'AA';
    const def = isGlobal
      ? 'Global — a non-standard pseudo-code denoting worldwide / no specific country.'
      : `${name} — ISO 3166-1 alpha-2 code ${code}.`;
    const concept = c(slug, name, def, code);
    // Outbound link to an external authority (name-derived DBpedia resource; closeMatch
    // because the alignment is by label, not individually verified — the ISO code is authoritative).
    if (!isGlobal) concept.match = 'http://dbpedia.org/resource/' + name.replace(/ /g, '_');
    return concept;
  });
}

// Legacy-structure targets: SKOS schemes live at protocol/<thing>/v1/index.json
// (the established concept-list location); countries at the legacy vocab/v1/countries.json.
const LEGACY = {
  'entity-types': 'protocol/entities/v1/index.json',
  'claim-types': 'protocol/claims/v1/index.json',
  'credential-types': 'protocol/credentials/v1/index.json',
  'accorded-right-types': 'protocol/accorded-rights/v1/index.json',
  'linked-resource-types': 'protocol/linked-resources/v1/index.json',
  'node-types': 'protocol/node-types/v1/index.json',
  'agent-roles': 'protocol/agent-roles/v1/index.json',
  'entity-status': 'protocol/entity-status/v1/index.json',
  'entity-stage': 'protocol/entity-stage/v1/index.json',
  'entity-view': 'protocol/entity-view/v1/index.json',
  'page-view': 'protocol/page-view/v1/index.json',
  'payment-types': 'protocol/payments/v1/index.json',
  'payment-denominations': 'protocol/payment-denominations/v1/index.json',
  'stake-types': 'protocol/stake-types/v1/index.json',
  'slashing-conditions': 'protocol/slashing-conditions/v1/index.json',
  'liquidity-sources': 'protocol/liquidity-sources/v1/index.json',
  'oracle-capabilities': 'protocol/oracle-capabilities/v1/index.json',
  'evaluation-codes': 'protocol/evaluation-codes/v1/index.json',
  'relationships': 'protocol/relationships/v1/index.json',
  'countries': 'vocab/v1/countries.json',
};
const baseFor = (rel) => 'https://w3id.org/ixo/' + rel.replace(/\.(json|jsonld)$/, '').replace(/\/index$/, '');

// Salvaged legacy enums (review item P4): broken, 0-triple legacy catalogues rebuilt
// as proper SKOS schemes. Source data in scripts/salvaged.data.json (keys match).
// NB: the legacy data files (protocol/blockchain-account/v1, …/linked-resources/v1/format.json,
// protocol/metric/v1, protocol/tags/v1) are dereferenced by the studio survey-choices API via
// ?path=<key>, so they STAY in place as plain JSON. These SKOS schemes are their semantic
// companions. (The entity sub-type groupings from tags are NOT here — they fold into the
// entity-types scheme instead; see ENTITY_SUBTYPE_SCHEMES / foldSubtypes below.)
const SALVAGED = {
  'blockchain-account-types': { legacy: 'protocol/blockchain-account-types/v1/index.json', title: 'IXO Blockchain Account Types', description: 'Kinds of external blockchain account that can be linked to an IXO entity (the blockchainAccount linked resource). Notation is the on-chain account-type string. Semantic companion to the protocol/blockchain-account/v1 survey-data file.', source: 'legacy ixofoundation/ns protocol/blockchain-account/v1 (rebuilt as SKOS)' },
  'media-formats': { legacy: 'protocol/media-formats/v1/index.json', title: 'IXO Linked-Resource Media Formats', description: 'IANA media types used for the format / encoding of a linked resource. Notation is the media type. Semantic companion to the protocol/linked-resources/v1/format.json survey-data file.', source: 'legacy ixofoundation/ns protocol/linked-resources/v1/format.json (rebuilt as SKOS)' },
  'metric-types': { legacy: 'protocol/metric-types/v1/index.json', title: 'IXO Metric Types', description: 'Kinds of quantitative metric tracked for an entity, such as units issued. Semantic companion to the protocol/metric/v1 survey-data file.', source: 'legacy ixofoundation/ns protocol/metric/v1 (rebuilt as SKOS)' },
};

// Entity sub-type taxonomies (from the legacy protocol/tags groupings) fold directly
// into the entity-types scheme as skos:broader children of their kind, so entities/v1
// is the single source of truth for "what kinds of entity exist and their sub-types".
// Keys → salvaged.data.json.
const ENTITY_SUBTYPE_SCHEMES = {
  asset: 'asset-types', dao: 'dao-types', deed: 'deed-types', oracle: 'oracle-types',
  group: 'group-types', pod: 'pod-types', project: 'project-types',
};

// Merge salvaged sub-type trees under their entity kind, de-duplicating against the
// curated sub-types already in the entity-types scheme by case/separator-insensitive
// id (e.g. salvaged "impactCredit" ≡ curated "asset/impactcredit"), remapping a
// skipped parent's children onto the kept concept.
function foldSubtypes(base, salvaged) {
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  const canonId = new Map(base.map((x) => [norm(x.id), x.id]));
  const canonNota = new Map(base.filter((x) => x.notation != null).map((x) => [norm(x.notation), x.id]));
  const out = [...base];
  for (const [kind, key] of Object.entries(ENTITY_SUBTYPE_SCHEMES)) {
    if (!salvaged[key]) continue;
    const remap = new Map();
    for (const x of enumToConcepts(salvaged[key], kind, kind, [])) {
      const nId = norm(x.id), nNota = norm(x.notation);
      const dup = canonId.get(nId) ?? canonNota.get(nNota); // same concept by id OR by notation
      if (dup) { remap.set(x.id, dup); continue; }
      if (x.broader && remap.has(x.broader)) x.broader = remap.get(x.broader);
      out.push(x);
      canonId.set(nId, x.id);
      canonNota.set(nNota, x.id);
      remap.set(x.id, x.id);
    }
  }
  return out;
}

async function main() {
  let total = 0;
  const salvaged = JSON.parse(await readFile(path.join(HERE, 'salvaged.data.json'), 'utf8'));
  const order = [...Object.keys(SCHEMES), 'countries'];
  for (const slug of order) {
    const concepts = slug === 'countries' ? await countryConcepts()
      : slug === 'entity-types' ? disambiguateLabels(foldSubtypes(SCHEMES[slug].concepts, salvaged))
      : SCHEMES[slug].concepts;
    if (slug !== 'countries') { const ids = concepts.map((x) => x.id); if (new Set(ids).size !== ids.length) throw new Error(`duplicate concept id in ${slug}`); }
    const meta = slug === 'countries'
      ? { title: 'IXO Country Codes', description: 'Countries and regions, keyed by ISO 3166-1 alpha-2 code. Includes the non-standard AA "Global" pseudo-code used on the IXO Spatial Web. Each concept skos:closeMatch-es a name-derived DBpedia resource.', source: 'ISO 3166-1 alpha-2; refactored from the legacy vocab/v1/countries.json', conformsTo: 'https://www.iso.org/iso-3166-country-codes.html' }
      : SCHEMES[slug];
    const rel = LEGACY[slug];
    const doc = buildScheme(slug, meta, concepts, baseFor(rel));
    const abs = path.join(ROOT, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, JSON.stringify(doc, null, 2) + '\n', 'utf8');
    console.log(`  wrote ${rel}  (${concepts.length} concepts)`);
    total += concepts.length;
  }

  // Salvaged legacy enums → SKOS (review item P4).
  for (const [slug, meta] of Object.entries(SALVAGED)) {
    const concepts = disambiguateLabels(enumToConcepts(salvaged[slug]));
    const ids = concepts.map((x) => x.id);
    if (new Set(ids).size !== ids.length) throw new Error(`duplicate concept id in salvaged scheme ${slug}`);
    const doc = buildScheme(slug, meta, concepts, baseFor(meta.legacy));
    const abs = path.join(ROOT, meta.legacy);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, JSON.stringify(doc, null, 2) + '\n', 'utf8');
    console.log(`  wrote ${meta.legacy}  (${concepts.length} concepts)`);
    total += concepts.length;
  }

  const schemeCount = order.length + Object.keys(SALVAGED).length;
  console.log(`\n${schemeCount} schemes, ${total} concepts total (legacy structure).`);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(2); });
