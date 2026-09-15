# Graph Report - rational-gate  (2026-09-14)

## Corpus Check
- 109 files · ~61,381 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1075 nodes · 1638 edges · 89 communities (77 shown, 12 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b0782d5c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- compilerOptions
- scripts
- Validation Record 2026-09-14
- scripts
- day03.ts
- origins.ts
- executor.ts
- frontend/package.json
- shared/src/index.ts
- database/package.json
- routes.ts
- github.ts
- App.tsx
- github.self-test.ts
- store.ts
- Entregáveis da Fase 01
- network.ts
- Reorganizacao e Docker
- deploy.ts
- midnight-adapter.ts
- core/package.json
- Deploy e Proximos Passos
- App
- service-auth.ts
- Benchmark de recursos do worker Midnight
- worker/package.json
- github-routes.self-test.ts
- approver-cli.ts
- summarize-midnight-benchmark.mjs
- backend/tsconfig.json
- cli.ts
- limited-public-api.self-test.ts
- Proofrail: ponto de partida do hackathon
- shared/package.json
- compilerOptions
- service-auth-init.ts
- Onboarding de Desenvolvimento
- midnight-resource-benchmark.sh
- approval-routes.self-test.ts
- loadState
- worker/src/index.ts
- Guia de validação do GitLab
- check-balance.ts
- GitHubAppClient
- core/tsconfig.json
- service-auth.self-test.ts
- Integracao Midnight
- Proofrail: autorizacao verificavel para acoes de alto risco
- scenarios.ts
- vercel.json
- agent-cli.ts
- worker/tsconfig.json
- Evidência textual — 14/09/2026
- shared/tsconfig.json
- getOrCreateRegistrarSecret
- Depois copie os arquivos de midnight/ para o scaffold conforme scripts/05-scaffold-midnight.ps1.
- Estado Local, Segredos e Arquivos Nao Versionados
- Proofrail Threat Model
- Cenarios
- Proofrail CI Workflow
- Q: Os outros devs querem seguir essa abordagem para refatorar o código separando e dividindo em partes a hospedagem. O que acha?
- Q: Qual comando foi usado para obter DUST localmente e qual passo a passo enviar ao outro desenvolvedor?
- e2e-check.ts
- deploy-preflight.mjs
- vite.config.ts
- 00-check-prerequisites.ps1
- prisma-with-env.mjs
- run-dev-ordered.sh
- ApiErrorCode
- format-api-log.mjs
- run-preprod-benchmark-anchor.sh
- wsl-install-toolchain.sh
- Closed Staging Workflow
- README.md
- Proofrail Midnight Integration
- check-neon-migration.mjs
- Bounded Midnight Docker Logs

## God Nodes (most connected - your core abstractions)
1. `registerRoutes()` - 42 edges
2. `Database` - 28 edges
3. `sha256Hex()` - 20 edges
4. `App()` - 15 edges
5. `scripts` - 15 edges
6. `ProposedAction` - 14 edges
7. `canonicalStringify()` - 13 edges
8. `signCanonical()` - 13 edges
9. `Benchmark de recursos do worker Midnight` - 13 edges
10. `ScenarioId` - 12 edges

## Surprising Connections (you probably didn't know these)
- `GitLab Verify Pipeline` --semantically_similar_to--> `Proofrail CI Workflow`  [INFERRED] [semantically similar]
  .gitlab-ci.yml → .github/workflows/ci.yml
- `executionDispatch()` --calls--> `sha256Hex()`  [EXTRACTED]
  backend/src/routes.ts → packages/core/src/crypto.ts
- `registerRoutes()` --calls--> `sha256Hex()`  [EXTRACTED]
  backend/src/routes.ts → packages/core/src/crypto.ts
- `registerRoutes()` --calls--> `scenarioById()`  [EXTRACTED]
  backend/src/routes.ts → packages/shared/src/scenarios.ts
- `evaluateAndPersist()` --calls--> `signCanonical()`  [EXTRACTED]
  backend/src/routes.ts → packages/core/src/crypto.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **GitHub CI Attestation Requirements** — docs_github_app_agent_identity, docs_github_app_workflow_run_webhook, docs_github_app_artifact_digest_verification [EXTRACTED 1.00]
- **Phase 01 Validation Evidence** — docs_evidence_phase_01_validation_2026_09_14_git_state, docs_evidence_phase_01_validation_2026_09_14_ci_local_validation, docs_evidence_phase_01_validation_2026_09_14_docker_validation, docs_evidence_phase_01_validation_2026_09_14_compact_validation, docs_evidence_phase_01_validation_2026_09_14_preprod_read_only_validation [EXTRACTED 1.00]
- **Proofrail Authorization Flow** — readme_action_commitment, readme_deterministic_policy, readme_midnight_anchor, readme_one_time_permit, readme_controlled_executor [EXTRACTED 1.00]

## Communities (89 total, 12 thin omitted)

### Community 0 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, jsx, lib, noEmit, types, extends, include, src (+6 more)

### Community 1 - "scripts"
Cohesion: 0.05
Nodes (42): concurrently, dependencies, @modelcontextprotocol/sdk, devDependencies, concurrently, prisma, tsx, @types/node (+34 more)

### Community 2 - "Validation Record 2026-09-14"
Cohesion: 0.05
Nodes (44): Compact Contract, Fastify API, Merkle Root and Commitments, Midnight CLI, Proofrail Architecture, React or MCP Entry Boundary, Signed Evidence Origins, Local CI Validation (+36 more)

### Community 3 - "scripts"
Cohesion: 0.07
Nodes (28): dependencies, fastify, @fastify/cors, @prisma/client, @rational/core, @rational/shared, zod, @prisma/client (+20 more)

### Community 4 - "day03.ts"
Cohesion: 0.08
Nodes (27): approval, executionBase, later, now, permitId, routeKeys, signature, ApiErrorCodeSchema (+19 more)

### Community 5 - "origins.ts"
Cohesion: 0.15
Nodes (27): createApprovalEvidence(), createGitHubCiEvidence(), createSelfDeclaredEvidence(), createSignedEvidence(), DeclaredDocument, EvidenceVariant, persistEncryptedRaw(), migrateV5() (+19 more)

### Community 6 - "executor.ts"
Cohesion: 0.07
Nodes (25): createProofrailApi(), defaultConfigPath, DisabledStagingExecutor, ExecutionNotAllowedError, ExecutorConfig, ExecutorConfigSchema, ExternalExecutionError, GitHubWorkflowExecutor (+17 more)

### Community 7 - "frontend/package.json"
Cohesion: 0.06
Nodes (30): dependencies, gsap, @gsap/react, lucide-react, @rational/shared, react, react-dom, devDependencies (+22 more)

### Community 8 - "shared/src/index.ts"
Cohesion: 0.07
Nodes (27): ActionPermit, ActionPermitSchema, ActionTypeSchema, AgentDeploymentContext, AgentDeploymentContextSchema, AnchorRecordSchema, AuditEventSchema, ClaimRequirement (+19 more)

### Community 9 - "database/package.json"
Cohesion: 0.13
Nodes (14): dependencies, @prisma/client, devDependencies, prisma, prisma, @prisma/client, name, private (+6 more)

### Community 10 - "routes.ts"
Cohesion: 0.14
Nodes (28): isGitHubObservationFresh(), isSameGitHubWorkflowDelivery(), parseGitHubWorkflowDelivery(), verifyAgentActionSignature(), verifyGitHubWebhookSignature(), createAnchorAdapter(), ApprovalRouteError, CollectEvidenceSchema (+20 more)

### Community 11 - "github.ts"
Cohesion: 0.13
Nodes (22): AgentKeyRegistrySchema, ArtifactSchema, ArtifactsSchema, base64Url(), createGitHubAppJwt(), getAgentPublicKeyRegistry(), getGitHubIntegrationStatus(), GitHubCiVerification (+14 more)

### Community 12 - "App.tsx"
Cohesion: 0.13
Nodes (18): api, apiConfigured, apiLimited, baseUrl, DeclaredDocument, request(), requestTimeoutMessage(), sleep() (+10 more)

### Community 13 - "github.self-test.ts"
Cohesion: 0.12
Nodes (17): GitHubRuntimeConfig, action, agentIdentity, agentSignature, appPrivateKeyPem, config, delivery, freshnessNow (+9 more)

### Community 14 - "store.ts"
Cohesion: 0.05
Nodes (48): GitHubWorkflowDelivery, fromJson(), loadLocalSeed(), PostgresStateStore, moduleDir, prisma, rootDir, toJson() (+40 more)

### Community 15 - "Entregáveis da Fase 01"
Cohesion: 0.10
Nodes (19): 1. Ambiente Midnight, 2. Compilação do contrato, 3. Contrato existente em Preprod, 4. Aplicação e containers, Critério final de “pronto para enviar”, Divisão sugerida entre três desenvolvedores, Entregáveis da Fase 01, Evidência técnica já confirmada (+11 more)

### Community 16 - "network.ts"
Cohesion: 0.10
Nodes (18): applyEnvOverrides(), DeploymentRecord, ENV_OVERRIDES, FsOptions, GENESIS_SEED, NETWORK_CONFIGS, NETWORK_IDS, NetworkConfig (+10 more)

### Community 17 - "Reorganizacao e Docker"
Cohesion: 0.11
Nodes (18): Backend, Backend em Render ou Similar, Cuidados De Seguranca, Deploy, Docker, Docker Compose, Estrutura Atual, Frontend (+10 more)

### Community 18 - "deploy.ts"
Cohesion: 0.15
Nodes (16): compiledContract, contractPath, createProviders(), __dirname, isTransientSubmissionError(), main(), { network, config: networkConfig }, rawWalletSyncTimeout (+8 more)

### Community 19 - "midnight-adapter.ts"
Cohesion: 0.27
Nodes (9): AnchorAdapter, chainDirectory(), execFileAsync, getNetworkStatus(), LocalAnchorAdapter, MidnightAnchorError, MidnightCliAnchorAdapter, npmInvocation() (+1 more)

### Community 20 - "core/package.json"
Cohesion: 0.12
Nodes (15): dependencies, @rational/shared, devDependencies, tsx, exports, @rational/shared, tsx, name (+7 more)

### Community 21 - "Deploy e Proximos Passos"
Cohesion: 0.12
Nodes (17): Arquitetura-alvo, Checklist de transicao, Decisoes de arquitetura, Deploy e Proximos Passos, Entrega 0: fundacao de frontend e dados, Entrega 1: migrar persistencia e contratos de dados, Entrega 2: aplicar controles de API publica completa, Entrega 3: worker Midnight e fila (executar por ultimo) (+9 more)

### Community 22 - "App"
Cohesion: 0.18
Nodes (14): App(), chooseNetwork(), chooseScenario(), readDocument(), refresh(), registerDocument(), resetScenario(), run() (+6 more)

### Community 23 - "service-auth.ts"
Cohesion: 0.12
Nodes (20): ROUTE_ACCESS_RULES, RouteAccessRule, RouteAuthentication, sendAnchorError(), workerUnavailable(), ApproverKeyConfig, ApproverKeyConfigSchema, correlationRequestId() (+12 more)

### Community 24 - "Benchmark de recursos do worker Midnight"
Cohesion: 0.17
Nodes (12): Benchmark de recursos do worker Midnight, Conclusao de capacidade atual, Criterio de minimo saudavel, Escopo confirmado, Limites atuais, O que sera medido, Objetivo, Ordem de execucao (+4 more)

### Community 25 - "worker/package.json"
Cohesion: 0.13
Nodes (14): dependencies, @modelcontextprotocol/sdk, @rational/shared, zod, @modelcontextprotocol/sdk, @rational/shared, zod, name (+6 more)

### Community 26 - "github-routes.self-test.ts"
Cohesion: 0.14
Nodes (11): agentIdentity, app, appPrivateKeyPem, executorToken, observedAt, operatorToken, rsa, serviceAuthenticator (+3 more)

### Community 27 - "approver-cli.ts"
Cohesion: 0.15
Nodes (12): anchor, approval, approvedAt, decision, expiresAt, moduleDir, result, secrets (+4 more)

### Community 28 - "summarize-midnight-benchmark.mjs"
Cohesion: 0.15
Nodes (7): inventory, metricsPath, number(), percent(), report, samples, summary

### Community 29 - "backend/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, noEmit, types, extends, include, node, src, ../tsconfig.base.json

### Community 30 - "cli.ts"
Cohesion: 0.22
Nodes (12): bytes32FromHex(), compiledContractFor(), contractPath, createProviders(), decisionValue(), __dirname, hexFromBytes(), main() (+4 more)

### Community 31 - "limited-public-api.self-test.ts"
Cohesion: 0.18
Nodes (11): app, approverIdentity, approverToken, assertLimited(), authenticator, bearer(), executorToken, operatorScopes (+3 more)

### Community 32 - "Proofrail: ponto de partida do hackathon"
Cohesion: 0.17
Nodes (12): Arquitetura compartilhada, Como chegamos a esta decisao, Componentes e responsabilidades, Decisao de hospedagem, Divisao inicial para tres desenvolvedores, Fatos de capacidade medidos, Leitura de cinco minutos, Opcao A: VM persistente (+4 more)

### Community 33 - "shared/package.json"
Cohesion: 0.17
Nodes (11): dependencies, zod, exports, zod, name, private, scripts, typecheck (+3 more)

### Community 34 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, noUncheckedIndexedAccess, resolveJsonModule (+3 more)

### Community 35 - "service-auth-init.ts"
Cohesion: 0.18
Nodes (8): approverPair, approverPrivateKeyPem, approverPublicKeyPem, config, moduleDir, privateDir, secrets, tokens

### Community 37 - "Onboarding de Desenvolvimento"
Cohesion: 0.18
Nodes (11): 1. Acessar e clonar, 2. Pedir a configuracao correta, 3. Preparar a maquina Windows com WSL, 4. Preparar uma maquina Linux, 5. Validar o codigo antes de abrir, 6. Rodar em modo Local, 7. Testar o fluxo visual, 8. Adicionar Midnight local (+3 more)

### Community 38 - "midnight-resource-benchmark.sh"
Cohesion: 0.31
Nodes (8): profile_limits(), record_proof_server_state(), sample_metrics(), midnight-resource-benchmark.sh script, start_proof_server(), stop_sampler(), usage(), write_inventory()

### Community 39 - "approval-routes.self-test.ts"
Cohesion: 0.20
Nodes (8): agentIdentity, app, approverIdentity, approverToken, authenticator, operatorToken, orchestratorToken, ApprovalPayload

### Community 40 - "loadState"
Cohesion: 0.44
Nodes (9): cliMain(), getDeployment(), isNetworkId(), loadState(), parseNetworkFlag(), resolveNetwork(), setActiveNetwork(), main() (+1 more)

### Community 41 - "worker/src/index.ts"
Cohesion: 0.20
Nodes (7): NetworkIdSchema, PublicState, ScenarioIdSchema, AuthSecretsSchema, moduleDir, server, transport

### Community 42 - "Guia de validação do GitLab"
Cohesion: 0.20
Nodes (9): 1. Conferir branch e remotes sem alterar o código, 2. Reproduzir localmente o job `verify`, 3. Validar Docker antes do GitLab, 4. Publicar a branch no GitLab, 5. O que conferir na interface do GitLab, Baseline encontrado antes da publicação em 14/09/2026, Critério de aceite, Guia de validação do GitLab (+1 more)

### Community 43 - "check-balance.ts"
Cohesion: 0.33
Nodes (8): main(), MAX_SYNC_ATTEMPTS, { network, config: networkConfig }, SEED, stopWallet(), SYNC_TIMEOUT_MS, syncWalletWithRetry(), withTimeout()

### Community 45 - "core/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, noEmit, types, extends, include, node, src, ../../tsconfig.base.json

### Community 46 - "service-auth.self-test.ts"
Cohesion: 0.15
Nodes (11): FastifyRequest, hashServiceToken(), app, approverIdentity, approverPublicKeyPem, auth, config, tokens (+3 more)

### Community 47 - "Integracao Midnight"
Cohesion: 0.25
Nodes (8): Carteiras, faucet e estado local, Contrato e fronteira de confianca, Execucao local com ancoragem publica, Implantar e validar, Integracao Midnight, Objetivo, Operacao segura, Redes suportadas

### Community 48 - "Proofrail: autorizacao verificavel para acoes de alto risco"
Cohesion: 0.13
Nodes (15): 1. Camada de experiencia, 2. Camada de compromisso da acao, 3. Camada de evidencias, 4. Camada de politica, 5. Camada de privacidade e ancoragem, 6. Camada de autorizacao e execucao, Caso demonstrado, Como funciona (+7 more)

### Community 49 - "scenarios.ts"
Cohesion: 0.29
Nodes (5): ActionType, ScenarioDefinition, ScenarioSource, ScenarioSeed, seeds

### Community 50 - "vercel.json"
Cohesion: 0.25
Nodes (7): gru1, buildCommand, framework, installCommand, outputDirectory, regions, $schema

### Community 51 - "agent-cli.ts"
Cohesion: 0.25
Nodes (6): agentDir, moduleDir, privateKeyPath, publicKeyPath, agentActionSigningPayload(), ProposedActionSchema

### Community 52 - "worker/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, noEmit, types, extends, include, node, src, ../tsconfig.base.json

### Community 53 - "Evidência textual — 14/09/2026"
Cohesion: 0.29
Nodes (6): Auditoria preparatória para tornar o GitHub público, CI local, Compact e Midnight, Docker, Evidência textual — 14/09/2026, Git

### Community 54 - "shared/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, noEmit, extends, include, src, ../../tsconfig.base.json

### Community 55 - "getOrCreateRegistrarSecret"
Cohesion: 0.38
Nodes (7): assertSecret(), getOrCreateRegistrarSecret(), getOrCreateSeed(), recordRegistrarRotation(), registrarEnvName(), saveState(), statePath()

### Community 56 - "Depois copie os arquivos de midnight/ para o scaffold conforme scripts/05-scaffold-midnight.ps1."
Cohesion: 0.50
Nodes (4): 10. Problemas comuns, 11. Antes de abrir um pull request, 9. Preview e Preprod: carteira, faucet, saldo e rede, Depois copie os arquivos de midnight/ para o scaffold conforme scripts/05-scaffold-midnight.ps1.

### Community 57 - "Estado Local, Segredos e Arquivos Nao Versionados"
Cohesion: 0.33
Nodes (6): Antes de qualquer commit, Carteira Midnight: politica de equipe, Estado Local, Segredos e Arquivos Nao Versionados, Inventario, O que um desenvolvedor deve pedir ao senior, Regra principal

### Community 58 - "Proofrail Threat Model"
Cohesion: 0.33
Nodes (6): Fail-Closed Executor, Negative Security Test Matrix, Registrar Rotation, Revocation, and Recovery, Separation of Duties, Proofrail Threat Model, Proofrail Security Policy

### Community 59 - "Cenarios"
Cohesion: 0.50
Nodes (4): 1. Inventario, 2. Proof server ocioso, 3. Comando monitorado, Cenarios

### Community 60 - "Proofrail CI Workflow"
Cohesion: 0.40
Nodes (5): Proofrail CI Workflow, Reproducible CI Verification, Controlled Staging Deployment, Exact Artifact Binding, GitLab Verify Pipeline

### Community 61 - "Q: Os outros devs querem seguir essa abordagem para refatorar o código separando e dividindo em partes a hospedagem. O que acha?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Os outros devs querem seguir essa abordagem para refatorar o código separando e dividindo em partes a hospedagem. O que acha?, Source Nodes

### Community 62 - "Q: Qual comando foi usado para obter DUST localmente e qual passo a passo enviar ao outro desenvolvedor?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Qual comando foi usado para obter DUST localmente e qual passo a passo enviar ao outro desenvolvedor?, Source Nodes

### Community 63 - "e2e-check.ts"
Cohesion: 0.60
Nodes (4): fail(), isHexAddress(), main(), { network, config: networkConfig }

### Community 64 - "deploy-preflight.mjs"
Cohesion: 0.40
Nodes (3): issues, targetArgument, targetIndex

### Community 65 - "vite.config.ts"
Cohesion: 0.67
Nodes (3): configure(), moduleDir, tokenForRoute()

### Community 67 - "prisma-with-env.mjs"
Cohesion: 0.50
Nodes (3): child, prismaCli, rootDir

## Knowledge Gaps
- **540 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+535 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Database` connect `store.ts` to `routes.ts`, `origins.ts`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `sha256Hex()` connect `origins.ts` to `routes.ts`, `store.ts`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Why does `App()` connect `App` to `App.tsx`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `registerRoutes()` (e.g. with `.originPrivateKey()` and `.read()`) actually correct?**
  _`registerRoutes()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _540 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.046511627906976744 - nodes in this community are weakly interconnected._