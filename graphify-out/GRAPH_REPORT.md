# Graph Report - rational-gate  (2026-09-02)

## Corpus Check
- 86 files · ~47,645 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 846 nodes · 1325 edges · 58 communities (52 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7dc1a1a5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- store.ts
- database/package.json
- shared/src/index.ts
- scripts
- compilerOptions
- day03.ts
- scripts
- routes.ts
- origins.ts
- executor.ts
- App.tsx
- web/package.json
- network.ts
- deploy.ts
- service-auth.ts
- github-routes.self-test.ts
- cli.ts
- Proofrail Threat Model
- Midnight Environment Setup
- shared/package.json
- compilerOptions
- service-auth-init.ts
- approval-routes.self-test.ts
- loadState
- check-balance.ts
- service-auth.self-test.ts
- ServiceAuthenticator
- Proofrail: autorizacao verificavel para acoes de alto risco
- getOrCreateRegistrarSecret
- .authenticate
- Onboarding de Desenvolvimento
- github.self-test.ts
- core/package.json
- mcp/package.json
- e2e-check.ts
- vite.config.ts
- agent-cli.ts
- 00-check-prerequisites.ps1
- run-dev-ordered.sh
- format-api-log.mjs
- wsl-install-toolchain.sh
- api/tsconfig.json
- mcp/tsconfig.json
- core/tsconfig.json
- github.ts
- shared/tsconfig.json
- vercel.json
- deploy-preflight.mjs
- Bounded Midnight Docker Logs
- GitHubAppClient

## God Nodes (most connected - your core abstractions)
1. `registerRoutes()` - 38 edges
2. `sha256Hex()` - 20 edges
3. `Database` - 19 edges
4. `App()` - 15 edges
5. `ProposedAction` - 14 edges
6. `canonicalStringify()` - 13 edges
7. `signCanonical()` - 13 edges
8. `JsonStore` - 12 edges
9. `scripts` - 12 edges
10. `loadState()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `GitLab Verify Pipeline` --semantically_similar_to--> `Proofrail CI Workflow`  [INFERRED] [semantically similar]
  .gitlab-ci.yml → .github/workflows/ci.yml
- `Proofrail CI Workflow` --implements--> `Proofrail Web Entrypoint`  [INFERRED]
  .github/workflows/ci.yml → apps/web/index.html
- `executionDispatch()` --calls--> `sha256Hex()`  [EXTRACTED]
  apps/api/src/routes.ts → packages/core/src/crypto.ts
- `registerRoutes()` --calls--> `sha256Hex()`  [EXTRACTED]
  apps/api/src/routes.ts → packages/core/src/crypto.ts
- `registerRoutes()` --calls--> `scenarioById()`  [EXTRACTED]
  apps/api/src/routes.ts → packages/shared/src/scenarios.ts

## Import Cycles
- None detected.

## Communities (58 total, 6 thin omitted)

### Community 0 - "store.ts"
Cohesion: 0.11
Nodes (24): GitHubWorkflowDelivery, DatabaseV4, DatabaseV5, isSigningSecrets(), JsonStore, LegacyExecutedAction, serialized, store (+16 more)

### Community 1 - "database/package.json"
Cohesion: 0.13
Nodes (14): dependencies, @prisma/client, devDependencies, prisma, name, private, scripts, generate (+6 more)

### Community 2 - "shared/src/index.ts"
Cohesion: 0.05
Nodes (41): AuthSecretsSchema, moduleDir, server, transport, ActionPermit, ActionPermitSchema, ActionType, ActionTypeSchema (+33 more)

### Community 3 - "scripts"
Cohesion: 0.06
Nodes (35): concurrently, dependencies, @modelcontextprotocol/sdk, devDependencies, concurrently, tsx, @types/node, typescript (+27 more)

### Community 4 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, jsx, lib, noEmit, types, extends, include, src (+6 more)

### Community 5 - "day03.ts"
Cohesion: 0.05
Nodes (42): anchor, approval, approvedAt, decision, expiresAt, moduleDir, result, secrets (+34 more)

### Community 6 - "scripts"
Cohesion: 0.08
Nodes (25): dependencies, fastify, @fastify/cors, @rational/core, @rational/shared, zod, @rational/shared, zod (+17 more)

### Community 7 - "routes.ts"
Cohesion: 0.13
Nodes (30): isGitHubObservationFresh(), isSameGitHubWorkflowDelivery(), parseGitHubWorkflowDelivery(), verifyAgentActionSignature(), verifyGitHubWebhookSignature(), createAnchorAdapter(), ApprovalRouteError, CollectEvidenceSchema (+22 more)

### Community 8 - "origins.ts"
Cohesion: 0.14
Nodes (29): createApprovalEvidence(), createGitHubCiEvidence(), createSelfDeclaredEvidence(), createSignedEvidence(), DeclaredDocument, EvidenceVariant, persistEncryptedRaw(), migrateV5() (+21 more)

### Community 9 - "executor.ts"
Cohesion: 0.07
Nodes (25): defaultConfigPath, DisabledStagingExecutor, ExecutionNotAllowedError, ExecutorConfig, ExecutorConfigSchema, ExternalExecutionError, GitHubWorkflowExecutor, loadStagingExecutor() (+17 more)

### Community 10 - "App.tsx"
Cohesion: 0.07
Nodes (35): AnchorAdapter, chainDirectory(), execFileAsync, getNetworkStatus(), LocalAnchorAdapter, MidnightAnchorError, MidnightCliAnchorAdapter, npmInvocation() (+27 more)

### Community 11 - "web/package.json"
Cohesion: 0.06
Nodes (30): dependencies, gsap, @gsap/react, lucide-react, @rational/shared, react, react-dom, devDependencies (+22 more)

### Community 12 - "network.ts"
Cohesion: 0.10
Nodes (18): applyEnvOverrides(), DeploymentRecord, ENV_OVERRIDES, FsOptions, GENESIS_SEED, NETWORK_CONFIGS, NETWORK_IDS, NetworkConfig (+10 more)

### Community 13 - "deploy.ts"
Cohesion: 0.15
Nodes (16): compiledContract, contractPath, createProviders(), __dirname, isTransientSubmissionError(), main(), { network, config: networkConfig }, rawWalletSyncTimeout (+8 more)

### Community 14 - "service-auth.ts"
Cohesion: 0.16
Nodes (13): ROUTE_ACCESS_RULES, RouteAccessRule, RouteAuthentication, ApproverKeyConfig, ApproverKeyConfigSchema, fastify, IdentifierSchema, moduleDir (+5 more)

### Community 15 - "github-routes.self-test.ts"
Cohesion: 0.14
Nodes (11): agentIdentity, app, appPrivateKeyPem, executorToken, observedAt, operatorToken, rsa, serviceAuthenticator (+3 more)

### Community 16 - "cli.ts"
Cohesion: 0.22
Nodes (12): bytes32FromHex(), compiledContractFor(), contractPath, createProviders(), decisionValue(), __dirname, hexFromBytes(), main() (+4 more)

### Community 17 - "Proofrail Threat Model"
Cohesion: 0.08
Nodes (25): Proofrail Web Entrypoint, Evidence Decision Permit Flow, Proofrail Architecture, Proofrail Trust Boundaries, GitHub CI Evidence Verification, GitHub App CI Connector, Fail-Closed Executor, Negative Security Test Matrix (+17 more)

### Community 18 - "Midnight Environment Setup"
Cohesion: 0.40
Nodes (5): Proofrail Documentation Index, Midnight Environment Setup, Public Anchor Timeout, Public Wallet Funding, Windows and WSL Setup

### Community 19 - "shared/package.json"
Cohesion: 0.17
Nodes (11): dependencies, zod, exports, zod, name, private, scripts, typecheck (+3 more)

### Community 20 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, noUncheckedIndexedAccess, resolveJsonModule (+3 more)

### Community 21 - "service-auth-init.ts"
Cohesion: 0.18
Nodes (8): approverPair, approverPrivateKeyPem, approverPublicKeyPem, config, moduleDir, privateDir, secrets, tokens

### Community 22 - "approval-routes.self-test.ts"
Cohesion: 0.20
Nodes (8): agentIdentity, app, approverIdentity, approverToken, authenticator, operatorToken, orchestratorToken, ApprovalPayload

### Community 23 - "loadState"
Cohesion: 0.44
Nodes (9): cliMain(), getDeployment(), isNetworkId(), loadState(), parseNetworkFlag(), resolveNetwork(), setActiveNetwork(), main() (+1 more)

### Community 24 - "check-balance.ts"
Cohesion: 0.33
Nodes (8): main(), MAX_SYNC_ATTEMPTS, { network, config: networkConfig }, SEED, stopWallet(), SYNC_TIMEOUT_MS, syncWalletWithRetry(), withTimeout()

### Community 25 - "service-auth.self-test.ts"
Cohesion: 0.25
Nodes (7): app, approverIdentity, approverPublicKeyPem, auth, config, tokens, ServiceAuthFileSchema

### Community 26 - "ServiceAuthenticator"
Cohesion: 0.33
Nodes (4): FastifyRequest, hashServiceToken(), ServiceAuthenticator, ServicePrincipal

### Community 27 - "Proofrail: autorizacao verificavel para acoes de alto risco"
Cohesion: 0.05
Nodes (40): Arquitetura-alvo, Checklist de transicao, Decisoes de arquitetura, Deploy e Proximos Passos, Entrega 0: fundacao de frontend e dados, Entrega 1: migrar persistencia e contratos de dados, Entrega 2: aplicar controles de API publica, Entrega 3: worker Midnight e fila (executar por ultimo) (+32 more)

### Community 28 - "getOrCreateRegistrarSecret"
Cohesion: 0.38
Nodes (7): assertSecret(), getOrCreateRegistrarSecret(), getOrCreateSeed(), recordRegistrarRotation(), registrarEnvName(), saveState(), statePath()

### Community 29 - ".authenticate"
Cohesion: 0.67
Nodes (3): correlationRequestId(), firstHeader(), routeRule()

### Community 30 - "Onboarding de Desenvolvimento"
Cohesion: 0.09
Nodes (21): 10. Problemas comuns, 11. Antes de abrir um pull request, 1. Acessar e clonar, 2. Pedir a configuracao correta, 3. Preparar a maquina Windows com WSL, 4. Preparar uma maquina Linux, 5. Validar o codigo antes de abrir, 6. Rodar em modo Local (+13 more)

### Community 31 - "github.self-test.ts"
Cohesion: 0.12
Nodes (17): GitHubRuntimeConfig, action, agentIdentity, agentSignature, appPrivateKeyPem, config, delivery, freshnessNow (+9 more)

### Community 32 - "core/package.json"
Cohesion: 0.12
Nodes (15): dependencies, @rational/shared, devDependencies, tsx, exports, @rational/shared, tsx, name (+7 more)

### Community 33 - "mcp/package.json"
Cohesion: 0.13
Nodes (14): dependencies, @modelcontextprotocol/sdk, @rational/shared, zod, @modelcontextprotocol/sdk, @rational/shared, zod, name (+6 more)

### Community 34 - "e2e-check.ts"
Cohesion: 0.60
Nodes (4): fail(), isHexAddress(), main(), { network, config: networkConfig }

### Community 35 - "vite.config.ts"
Cohesion: 0.67
Nodes (3): configure(), moduleDir, tokenForRoute()

### Community 36 - "agent-cli.ts"
Cohesion: 0.18
Nodes (11): agentDir, moduleDir, privateKeyPath, publicKeyPath, agentActionSigningPayload(), actionForScenario(), createOrigin(), SeedBundle (+3 more)

### Community 42 - "api/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, noEmit, types, extends, include, node, src, ../../tsconfig.base.json

### Community 50 - "mcp/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, noEmit, types, extends, include, node, src, ../../tsconfig.base.json

### Community 51 - "core/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, noEmit, types, extends, include, node, src, ../../tsconfig.base.json

### Community 52 - "github.ts"
Cohesion: 0.13
Nodes (22): AgentKeyRegistrySchema, ArtifactSchema, ArtifactsSchema, base64Url(), createGitHubAppJwt(), getAgentPublicKeyRegistry(), getGitHubIntegrationStatus(), GitHubCiVerification (+14 more)

### Community 53 - "shared/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, noEmit, extends, include, src, ../../tsconfig.base.json

### Community 54 - "vercel.json"
Cohesion: 0.29
Nodes (6): buildCommand, framework, installCommand, outputDirectory, rewrites, $schema

### Community 55 - "deploy-preflight.mjs"
Cohesion: 0.40
Nodes (3): issues, targetArgument, targetIndex

## Knowledge Gaps
- **420 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+415 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ProposedAction` connect `store.ts` to `shared/src/index.ts`, `routes.ts`, `origins.ts`, `App.tsx`, `github.ts`, `GitHubAppClient`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `JsonStore` connect `store.ts` to `routes.ts`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `registerRoutes()` (e.g. with `.originPrivateKey()` and `.read()`) actually correct?**
  _`registerRoutes()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _420 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `store.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `database/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `shared/src/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04902867715078631 - nodes in this community are weakly interconnected._