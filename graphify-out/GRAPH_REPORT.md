# Graph Report - rational-gate  (2026-08-21)

## Corpus Check
- 88 files · ~53,693 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 765 nodes · 1207 edges · 50 communities (45 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Persistent Evidence Store
- GitHub App Integration
- Shared Runtime Models
- Workspace Package Tooling
- TypeScript Project Configuration
- Authorization Contracts
- API and Core Packages
- Evidence Decision Routes
- Core Evidence Cryptography
- Controlled Execution Runtime
- Web Product Experience
- Web Runtime Dependencies
- Midnight Network State
- Midnight Contract Deployment
- Service Access Control
- GitHub Route Tests
- Midnight Contract CLI
- CI and Delivery Controls
- Preprod Operations Guide
- Shared Package Tooling
- Base TypeScript Configuration
- Service Auth Provisioning
- Approval Route Tests
- Midnight Setup Orchestration
- Midnight Balance Sync
- Service Authentication Tests
- Principal Authentication
- Threat Model and Controls
- Midnight Registrar Secrets
- API Authentication Middleware
- Proofrail Product Model
- Architecture and Midnight
- Delivery Evolution Plan
- Verifiable Authorization Flow
- Midnight E2E Validation
- Vite API Proxy
- Product Pitch and Validation
- Windows Prerequisite Checks
- Ordered Development Runtime
- API Log Formatting
- WSL Node Toolchain
- Product Demonstration Receipt

## God Nodes (most connected - your core abstractions)
1. `Database` - 19 edges
2. `sha256Hex()` - 17 edges
3. `App()` - 15 edges
4. `ProposedAction` - 14 edges
5. `registerRoutes()` - 14 edges
6. `canonicalStringify()` - 13 edges
7. `JsonStore` - 12 edges
8. `loadState()` - 11 edges
9. `signCanonical()` - 11 edges
10. `compilerOptions` - 11 edges

## Surprising Connections (you probably didn't know these)
- `GitLab Verify Pipeline` --semantically_similar_to--> `Proofrail CI Workflow`  [INFERRED] [semantically similar]
  .gitlab-ci.yml → .github/workflows/ci.yml
- `Proofrail CI Workflow` --implements--> `Proofrail Web Entrypoint`  [INFERRED]
  .github/workflows/ci.yml → apps/web/index.html
- `LegacyExecutedAction` --references--> `ProposedAction`  [EXTRACTED]
  apps/api/src/store.ts → packages/shared/src/index.ts
- `Database` --references--> `EvidenceReceipt`  [EXTRACTED]
  apps/api/src/types.ts → packages/shared/src/index.ts
- `FastifyRequest` --references--> `ServicePrincipal`  [EXTRACTED]
  apps/api/src/service-auth.ts → packages/shared/src/day03.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Proofrail Evidence Authorization Flow** — readme_evidence_firewall, readme_verifiable_authorization_flow, docs_migracao_midnight_authorized_compact_contract, readme_one_time_permit, readme_controlled_executor [INFERRED 0.95]
- **Proofrail Public Network Operations** — docs_setup_windows_public_wallet_funding, docs_etapa_04_preprod_operacao_wallet_checkpoint_recovery, docs_etapa_04_preprod_operacao_public_network_matrix, docs_migracao_midnight_public_network_validation [INFERRED 0.85]
- **Controlled CI to Staging Delivery Chain** — github_workflows_ci_proofrail_ci, docs_github_app_ci_evidence_verification, docs_etapa_03_contratos_idempotent_execution, github_workflows_staging_deploy_controlled_staging_deployment [INFERRED 0.85]
- **Evidence Authorization Pipeline** — readme_evidence_firewall, docs_architecture_evidence_decision_permit_flow, docs_guia_do_projeto_agent_deploy, midnight_readme_onchain_decision_registry [INFERRED 0.85]

## Communities (50 total, 5 thin omitted)

### Community 0 - "Persistent Evidence Store"
Cohesion: 0.07
Nodes (43): GitHubWorkflowDelivery, actionForScenario(), auditEvent(), createOrigin(), DatabaseV4, DatabaseV5, isSigningSecrets(), JsonStore (+35 more)

### Community 1 - "GitHub App Integration"
Cohesion: 0.06
Nodes (47): agentActionSigningPayload(), AgentKeyRegistrySchema, ArtifactSchema, ArtifactsSchema, base64Url(), createGitHubAppJwt(), getAgentPublicKeyRegistry(), getGitHubIntegrationStatus() (+39 more)

### Community 2 - "Shared Runtime Models"
Cohesion: 0.05
Nodes (40): agentDir, moduleDir, privateKeyPath, publicKeyPath, AuthSecretsSchema, moduleDir, server, transport (+32 more)

### Community 3 - "Workspace Package Tooling"
Cohesion: 0.04
Nodes (44): dependencies, @modelcontextprotocol/sdk, @rational/shared, zod, zod, name, private, scripts (+36 more)

### Community 4 - "TypeScript Project Configuration"
Cohesion: 0.04
Nodes (40): compilerOptions, noEmit, types, extends, include, node, src, compilerOptions (+32 more)

### Community 5 - "Authorization Contracts"
Cohesion: 0.05
Nodes (40): anchor, approval, approvedAt, decision, expiresAt, moduleDir, result, secrets (+32 more)

### Community 6 - "API and Core Packages"
Cohesion: 0.05
Nodes (40): dependencies, fastify, @fastify/cors, @rational/core, @rational/shared, zod, @rational/shared, zod (+32 more)

### Community 7 - "Evidence Decision Routes"
Cohesion: 0.10
Nodes (27): AnchorAdapter, chainDirectory(), createAnchorAdapter(), execFileAsync, getNetworkStatus(), LocalAnchorAdapter, MidnightAnchorError, MidnightCliAnchorAdapter (+19 more)

### Community 8 - "Core Evidence Cryptography"
Cohesion: 0.15
Nodes (28): createApprovalEvidence(), createGitHubCiEvidence(), createSelfDeclaredEvidence(), createSignedEvidence(), DeclaredDocument, EvidenceVariant, persistEncryptedRaw(), canonicalize() (+20 more)

### Community 9 - "Controlled Execution Runtime"
Cohesion: 0.08
Nodes (22): defaultConfigPath, DisabledStagingExecutor, ExecutionNotAllowedError, ExecutorConfig, ExecutorConfigSchema, ExternalExecutionError, GitHubWorkflowExecutor, loadStagingExecutor() (+14 more)

### Community 10 - "Web Product Experience"
Cohesion: 0.10
Nodes (24): api, DeclaredDocument, request(), requestTimeoutMessage(), sleep(), App(), chooseNetwork(), readDocument() (+16 more)

### Community 11 - "Web Runtime Dependencies"
Cohesion: 0.07
Nodes (28): dependencies, gsap, @gsap/react, lucide-react, react, react-dom, devDependencies, @types/react (+20 more)

### Community 12 - "Midnight Network State"
Cohesion: 0.10
Nodes (18): applyEnvOverrides(), DeploymentRecord, ENV_OVERRIDES, FsOptions, GENESIS_SEED, NETWORK_CONFIGS, NETWORK_IDS, NetworkConfig (+10 more)

### Community 13 - "Midnight Contract Deployment"
Cohesion: 0.15
Nodes (16): compiledContract, contractPath, createProviders(), __dirname, isTransientSubmissionError(), main(), { network, config: networkConfig }, rawWalletSyncTimeout (+8 more)

### Community 14 - "Service Access Control"
Cohesion: 0.16
Nodes (13): ROUTE_ACCESS_RULES, RouteAccessRule, RouteAuthentication, ApproverKeyConfig, ApproverKeyConfigSchema, fastify, IdentifierSchema, moduleDir (+5 more)

### Community 15 - "GitHub Route Tests"
Cohesion: 0.14
Nodes (11): agentIdentity, app, appPrivateKeyPem, executorToken, observedAt, operatorToken, rsa, serviceAuthenticator (+3 more)

### Community 16 - "Midnight Contract CLI"
Cohesion: 0.22
Nodes (12): bytes32FromHex(), compiledContractFor(), contractPath, createProviders(), decisionValue(), __dirname, hexFromBytes(), main() (+4 more)

### Community 17 - "CI and Delivery Controls"
Cohesion: 0.21
Nodes (12): Idempotent Permit Execution, Separation of Duties, Stage 03 Contracts, GitHub CI Evidence Verification, GitHub App CI Connector, GitLab Primary and GitHub Mirror, Private Repository Strategy, Proofrail CI Workflow (+4 more)

### Community 18 - "Preprod Operations Guide"
Cohesion: 0.18
Nodes (12): Authorized Compact Registrar, Preprod Contract Operations, Preview and Preprod Validation Matrix, Stage 04 Preprod Operations, Wallet Checkpoint Recovery, Proofrail Product Guide, Proofrail Documentation Index, Midnight Environment Setup (+4 more)

### Community 19 - "Shared Package Tooling"
Cohesion: 0.17
Nodes (11): dependencies, zod, exports, zod, name, private, scripts, typecheck (+3 more)

### Community 20 - "Base TypeScript Configuration"
Cohesion: 0.17
Nodes (11): compilerOptions, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, noUncheckedIndexedAccess, resolveJsonModule (+3 more)

### Community 21 - "Service Auth Provisioning"
Cohesion: 0.18
Nodes (8): approverPair, approverPrivateKeyPem, approverPublicKeyPem, config, moduleDir, privateDir, secrets, tokens

### Community 22 - "Approval Route Tests"
Cohesion: 0.20
Nodes (8): agentIdentity, app, approverIdentity, approverToken, authenticator, operatorToken, orchestratorToken, ApprovalPayload

### Community 23 - "Midnight Setup Orchestration"
Cohesion: 0.44
Nodes (9): cliMain(), getDeployment(), isNetworkId(), loadState(), parseNetworkFlag(), resolveNetwork(), setActiveNetwork(), main() (+1 more)

### Community 24 - "Midnight Balance Sync"
Cohesion: 0.33
Nodes (8): main(), MAX_SYNC_ATTEMPTS, { network, config: networkConfig }, SEED, stopWallet(), SYNC_TIMEOUT_MS, syncWalletWithRetry(), withTimeout()

### Community 25 - "Service Authentication Tests"
Cohesion: 0.25
Nodes (7): app, approverIdentity, approverPublicKeyPem, auth, config, tokens, ServiceAuthFileSchema

### Community 26 - "Principal Authentication"
Cohesion: 0.33
Nodes (4): FastifyRequest, hashServiceToken(), ServiceAuthenticator, ServicePrincipal

### Community 27 - "Threat Model and Controls"
Cohesion: 0.29
Nodes (7): Fail-Closed Executor, Negative Security Test Matrix, Registrar Rotation, Revocation, and Recovery, Separation of Duties, Proofrail Threat Model, Proofrail Security Policy, Controlled Executor

### Community 28 - "Midnight Registrar Secrets"
Cohesion: 0.38
Nodes (7): assertSecret(), getOrCreateRegistrarSecret(), getOrCreateSeed(), recordRegistrarRotation(), registrarEnvName(), saveState(), statePath()

### Community 29 - "API Authentication Middleware"
Cohesion: 0.47
Nodes (5): correlationRequestId(), firstHeader(), registerServiceAuthentication(), routeRule(), sendApiError()

### Community 30 - "Proofrail Product Model"
Cohesion: 0.33
Nodes (6): Proofrail Web Entrypoint, AI Agent Deployment Gate, Independent Evidence Sources, Evidence Firewall, Local Proofrail Runtime, Proofrail

### Community 31 - "Architecture and Midnight"
Cohesion: 0.33
Nodes (6): Evidence Decision Permit Flow, Proofrail Architecture, Proofrail Trust Boundaries, Midnight Integration, Proofrail Midnight Integration, On-chain Decision Registry

### Community 32 - "Delivery Evolution Plan"
Cohesion: 0.40
Nodes (5): Stage 03 Handoff, Compact Hardening and Preprod Operations, Controlled Execution and Authentication, Local Preview Preprod Gate Sequence, Four-Day Evolution Plan

### Community 33 - "Verifiable Authorization Flow"
Cohesion: 0.40
Nodes (5): Authorized Compact Decision Contract, Private Proof Boundary, Public Midnight Network Validation, One-Time Action-Bound Permit, Verifiable Authorization Flow

### Community 34 - "Midnight E2E Validation"
Cohesion: 0.60
Nodes (4): fail(), isHexAddress(), main(), { network, config: networkConfig }

### Community 35 - "Vite API Proxy"
Cohesion: 0.67
Nodes (3): configure(), moduleDir, tokenForRoute()

### Community 36 - "Product Pitch and Validation"
Cohesion: 0.50
Nodes (4): Enterprise Product Boundary, Evidence Before Execution, Local Validation Path, Proofrail Pitch and Local Test

## Knowledge Gaps
- **337 isolated node(s):** `LabDocument`, `MotionMode`, `Surface`, `ActionPermit`, `AgentDeploymentContext` (+332 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@rational/shared` connect `API and Core Packages` to `Workspace Package Tooling`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `ProposedAction` connect `Persistent Evidence Store` to `GitHub App Integration`, `Shared Runtime Models`, `Evidence Decision Routes`, `Core Evidence Cryptography`, `Web Product Experience`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **What connects `LabDocument`, `MotionMode`, `Surface` to the rest of the system?**
  _337 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Persistent Evidence Store` be split into smaller, more focused modules?**
  _Cohesion score 0.07138535995160314 - nodes in this community are weakly interconnected._
- **Should `GitHub App Integration` be split into smaller, more focused modules?**
  _Cohesion score 0.059506531204644414 - nodes in this community are weakly interconnected._
- **Should `Shared Runtime Models` be split into smaller, more focused modules?**
  _Cohesion score 0.04830917874396135 - nodes in this community are weakly interconnected._
- **Should `Workspace Package Tooling` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._