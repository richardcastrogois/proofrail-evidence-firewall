# Graph Report - rational-gate  (2026-09-08)

## Corpus Check
- 102 files · ~55,843 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 977 nodes · 1548 edges · 80 communities (71 shown, 9 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c204483a`
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
- sha256Hex
- executor.ts
- App
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
- Deploy e Proximos Passos
- getOrCreateRegistrarSecret
- App.tsx
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
- Benchmark de recursos do worker Midnight
- summarize-midnight-benchmark.mjs
- midnight-adapter.ts
- origins.ts
- limited-public-api.self-test.ts
- Proofrail: ponto de partida do hackathon
- DEPLOYMENT_AND_NEXT_STEPS.md
- midnight-resource-benchmark.sh
- mcp/src/index.ts
- Integracao Midnight
- Proofrail: autorizacao verificavel para acoes de alto risco
- Como funciona
- scenarios.ts
- Estado Local, Segredos e Arquivos Nao Versionados
- access-control.ts
- prisma-with-env.mjs
- ApiErrorCode
- run-preprod-benchmark-anchor.sh
- check-neon-migration.mjs

## God Nodes (most connected - your core abstractions)
1. `registerRoutes()` - 42 edges
2. `Database` - 28 edges
3. `sha256Hex()` - 20 edges
4. `App()` - 15 edges
5. `ProposedAction` - 14 edges
6. `scripts` - 13 edges
7. `canonicalStringify()` - 13 edges
8. `signCanonical()` - 13 edges
9. `Benchmark de recursos do worker Midnight` - 13 edges
10. `ScenarioId` - 12 edges

## Surprising Connections (you probably didn't know these)
- `GitLab Verify Pipeline` --semantically_similar_to--> `Proofrail CI Workflow`  [INFERRED] [semantically similar]
  .gitlab-ci.yml → .github/workflows/ci.yml
- `Proofrail CI Workflow` --implements--> `Proofrail Web Entrypoint`  [INFERRED]
  .github/workflows/ci.yml → apps/web/index.html
- `createSignedEvidence()` --calls--> `sha256Hex()`  [EXTRACTED]
  apps/api/src/origins.ts → packages/core/src/crypto.ts
- `createGitHubCiEvidence()` --calls--> `sha256Hex()`  [EXTRACTED]
  apps/api/src/origins.ts → packages/core/src/crypto.ts
- `createApprovalEvidence()` --calls--> `sha256Hex()`  [EXTRACTED]
  apps/api/src/origins.ts → packages/core/src/crypto.ts

## Import Cycles
- None detected.

## Communities (80 total, 9 thin omitted)

### Community 0 - "store.ts"
Cohesion: 0.06
Nodes (46): GitHubWorkflowDelivery, fromJson(), loadLocalSeed(), PostgresStateStore, moduleDir, prisma, rootDir, toJson() (+38 more)

### Community 1 - "database/package.json"
Cohesion: 0.13
Nodes (14): dependencies, @prisma/client, devDependencies, prisma, prisma, @prisma/client, name, private (+6 more)

### Community 2 - "shared/src/index.ts"
Cohesion: 0.07
Nodes (27): ActionPermit, ActionPermitSchema, ActionTypeSchema, AgentDeploymentContext, AgentDeploymentContextSchema, AnchorRecordSchema, AuditEventSchema, ClaimRequirement (+19 more)

### Community 3 - "scripts"
Cohesion: 0.05
Nodes (38): concurrently, dependencies, @modelcontextprotocol/sdk, devDependencies, concurrently, prisma, tsx, @types/node (+30 more)

### Community 4 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, jsx, lib, noEmit, types, extends, include, src (+6 more)

### Community 5 - "day03.ts"
Cohesion: 0.05
Nodes (39): anchor, approval, approvedAt, decision, expiresAt, moduleDir, result, secrets (+31 more)

### Community 6 - "scripts"
Cohesion: 0.07
Nodes (28): dependencies, fastify, @fastify/cors, @prisma/client, @rational/core, @rational/shared, zod, @prisma/client (+20 more)

### Community 7 - "routes.ts"
Cohesion: 0.14
Nodes (30): isGitHubObservationFresh(), isSameGitHubWorkflowDelivery(), parseGitHubWorkflowDelivery(), verifyAgentActionSignature(), verifyGitHubWebhookSignature(), createAnchorAdapter(), ApprovalRouteError, CollectEvidenceSchema (+22 more)

### Community 8 - "sha256Hex"
Cohesion: 0.19
Nodes (15): migrateV5(), canonicalize(), EncryptedEnvelope, sha256Hex(), SigningIdentity, hashPair(), merkleRoot(), evaluateEvidencePolicy() (+7 more)

### Community 9 - "executor.ts"
Cohesion: 0.07
Nodes (25): createProofrailApi(), defaultConfigPath, DisabledStagingExecutor, ExecutionNotAllowedError, ExecutorConfig, ExecutorConfigSchema, ExternalExecutionError, GitHubWorkflowExecutor (+17 more)

### Community 10 - "App"
Cohesion: 0.18
Nodes (14): App(), chooseNetwork(), chooseScenario(), readDocument(), refresh(), registerDocument(), resetScenario(), run() (+6 more)

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
Cohesion: 0.14
Nodes (16): sendAnchorError(), workerUnavailable(), ApproverKeyConfig, ApproverKeyConfigSchema, correlationRequestId(), fastify, firstHeader(), IdentifierSchema (+8 more)

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

### Community 27 - "Deploy e Proximos Passos"
Cohesion: 0.12
Nodes (17): Arquitetura-alvo, Checklist de transicao, Decisoes de arquitetura, Deploy e Proximos Passos, Entrega 0: fundacao de frontend e dados, Entrega 1: migrar persistencia e contratos de dados, Entrega 2: aplicar controles de API publica completa, Entrega 3: worker Midnight e fila (executar por ultimo) (+9 more)

### Community 28 - "getOrCreateRegistrarSecret"
Cohesion: 0.38
Nodes (7): assertSecret(), getOrCreateRegistrarSecret(), getOrCreateSeed(), recordRegistrarRotation(), registrarEnvName(), saveState(), statePath()

### Community 29 - "App.tsx"
Cohesion: 0.13
Nodes (18): api, apiConfigured, apiLimited, baseUrl, DeclaredDocument, request(), requestTimeoutMessage(), sleep() (+10 more)

### Community 30 - "Onboarding de Desenvolvimento"
Cohesion: 0.18
Nodes (11): 1. Acessar e clonar, 2. Pedir a configuracao correta, 3. Preparar a maquina Windows com WSL, 4. Preparar uma maquina Linux, 5. Validar o codigo antes de abrir, 6. Rodar em modo Local, 7. Testar o fluxo visual, 8. Adicionar Midnight local (+3 more)

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
Cohesion: 0.25
Nodes (6): agentDir, moduleDir, privateKeyPath, publicKeyPath, agentActionSigningPayload(), ProposedActionSchema

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
Cohesion: 0.18
Nodes (10): gru1, maxDuration, buildCommand, framework, functions, api/[...path].js, installCommand, outputDirectory (+2 more)

### Community 55 - "deploy-preflight.mjs"
Cohesion: 0.40
Nodes (3): issues, targetArgument, targetIndex

### Community 58 - "Benchmark de recursos do worker Midnight"
Cohesion: 0.12
Nodes (16): 1. Inventario, 2. Proof server ocioso, 3. Comando monitorado, Benchmark de recursos do worker Midnight, Cenarios, Conclusao de capacidade atual, Criterio de minimo saudavel, Escopo confirmado (+8 more)

### Community 59 - "summarize-midnight-benchmark.mjs"
Cohesion: 0.15
Nodes (7): inventory, metricsPath, number(), percent(), report, samples, summary

### Community 60 - "midnight-adapter.ts"
Cohesion: 0.27
Nodes (9): AnchorAdapter, chainDirectory(), execFileAsync, getNetworkStatus(), LocalAnchorAdapter, MidnightAnchorError, MidnightCliAnchorAdapter, npmInvocation() (+1 more)

### Community 61 - "origins.ts"
Cohesion: 0.35
Nodes (12): createApprovalEvidence(), createGitHubCiEvidence(), createSelfDeclaredEvidence(), createSignedEvidence(), DeclaredDocument, EvidenceVariant, persistEncryptedRaw(), canonicalStringify() (+4 more)

### Community 62 - "limited-public-api.self-test.ts"
Cohesion: 0.18
Nodes (11): app, approverIdentity, approverToken, assertLimited(), authenticator, bearer(), executorToken, operatorScopes (+3 more)

### Community 63 - "Proofrail: ponto de partida do hackathon"
Cohesion: 0.17
Nodes (12): Arquitetura compartilhada, Como chegamos a esta decisao, Componentes e responsabilidades, Decisao de hospedagem, Divisao inicial para tres desenvolvedores, Fatos de capacidade medidos, Leitura de cinco minutos, Opcao A: VM persistente (+4 more)

### Community 64 - "DEPLOYMENT_AND_NEXT_STEPS.md"
Cohesion: 0.24
Nodes (4): 10. Problemas comuns, 11. Antes de abrir um pull request, 9. Preview e Preprod: carteira, faucet, saldo e rede, Depois copie os arquivos de midnight/ para o scaffold conforme scripts/05-scaffold-midnight.ps1.

### Community 65 - "midnight-resource-benchmark.sh"
Cohesion: 0.31
Nodes (8): profile_limits(), record_proof_server_state(), sample_metrics(), midnight-resource-benchmark.sh script, start_proof_server(), stop_sampler(), usage(), write_inventory()

### Community 66 - "mcp/src/index.ts"
Cohesion: 0.20
Nodes (7): AuthSecretsSchema, moduleDir, server, transport, NetworkIdSchema, PublicState, ScenarioIdSchema

### Community 67 - "Integracao Midnight"
Cohesion: 0.25
Nodes (8): Carteiras, faucet e estado local, Contrato e fronteira de confianca, Execucao local com ancoragem publica, Implantar e validar, Integracao Midnight, Objetivo, Operacao segura, Redes suportadas

### Community 68 - "Proofrail: autorizacao verificavel para acoes de alto risco"
Cohesion: 0.25
Nodes (8): Caso demonstrado, Diferenciais, Estado atual e caminho para piloto, Onde se aplica, Problema, Proofrail: autorizacao verificavel para acoes de alto risco, Proposta de valor, Resumo

### Community 69 - "Como funciona"
Cohesion: 0.29
Nodes (7): 1. Camada de experiencia, 2. Camada de compromisso da acao, 3. Camada de evidencias, 4. Camada de politica, 5. Camada de privacidade e ancoragem, 6. Camada de autorizacao e execucao, Como funciona

### Community 70 - "scenarios.ts"
Cohesion: 0.29
Nodes (5): ActionType, ScenarioDefinition, ScenarioSource, ScenarioSeed, seeds

### Community 71 - "Estado Local, Segredos e Arquivos Nao Versionados"
Cohesion: 0.33
Nodes (6): Antes de qualquer commit, Carteira Midnight: politica de equipe, Estado Local, Segredos e Arquivos Nao Versionados, Inventario, O que um desenvolvedor deve pedir ao senior, Regra principal

### Community 72 - "access-control.ts"
Cohesion: 0.50
Nodes (4): ROUTE_ACCESS_RULES, RouteAccessRule, RouteAuthentication, ServiceScope

### Community 73 - "prisma-with-env.mjs"
Cohesion: 0.50
Nodes (3): child, prismaCli, rootDir

## Knowledge Gaps
- **471 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+466 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Database` connect `store.ts` to `sha256Hex`, `origins.ts`, `routes.ts`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `ProposedAction` connect `store.ts` to `mcp/src/index.ts`, `shared/src/index.ts`, `scenarios.ts`, `routes.ts`, `sha256Hex`, `App.tsx`, `github.ts`, `GitHubAppClient`, `origins.ts`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Why does `scenarioById()` connect `routes.ts` to `store.ts`, `scenarios.ts`, `sha256Hex`, `App`, `App.tsx`, `github.self-test.ts`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `registerRoutes()` (e.g. with `.originPrivateKey()` and `.read()`) actually correct?**
  _`registerRoutes()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _471 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `store.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05570745044429255 - nodes in this community are weakly interconnected._
- **Should `database/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._