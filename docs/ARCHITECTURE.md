# Arquitetura do Proofrail

## Visão geral

```text
Agente de IA / Pessoa / Sistema
              |
         React ou MCP
              |
              v
        API Fastify local
      /        |         \
 origens    política    ciclo de vida
 assinadas  determinística  AES
      \        |         /
       decisão + permit
              |
      Merkle + commitments
              |
     CLI Midnight por rede
              |
       contrato Compact
```

O navegador nunca fala diretamente com a blockchain. Ele chama a API. A API coleta e verifica os recibos, aplica a política, assina o permit e chama a CLI Midnight. A CLI usa a carteira e os providers da rede selecionada para enviar a transação ao contrato.

## Fluxo de dados

1. O frontend seleciona cenário e rede.
2. A API cria uma `requestId` única e carrega a política do cenário.
3. Cada origem produz dado bruto, criptografa-o e emite um recibo assinado. No piloto, `Pipeline CI` pode vir do GitHub real; as demais origens ainda usam o laboratório.
4. O recibo é vinculado a `requestId`, cenário, sujeito, referência, valor e origem.
5. O motor verifica assinatura, commitment da ação, frescor, campos esperados, independência e contradições.
6. Para agente + deploy, quatro fontes técnicas são obrigatórias e produção/risco alto exige uma quinta fonte de revisão humana.
7. A API ancora a decisão e, somente em `ALLOW`, cria um permit assinado com a mesma validade da âncora.
8. Recibos aceitos viram folhas de uma Merkle tree; ação e política viram commitments.
9. A CLI envia somente os resumos e contagens ao contrato Compact.
10. O contrato impede `ALLOW` com evidência insuficiente, contradição ou ação já ancorada.
11. O executor local verifica assinatura, versão da política, rede, contrato, âncora, commitments e validade; depois impede reutilização.
12. As chaves AES podem ser destruídas; ciphertext e commitments permanecem para auditoria.

## Fronteiras de confiança

### O que é verificado

- schemas e limites de entrada na borda HTTP;
- webhook GitHub validado sobre o corpo bruto com HMAC SHA-256 e delivery ID idempotente;
- identidade do agente, allowlist de repositório, installation ID, SHA e digest exatos;
- assinatura Ed25519 dos recibos simulados;
- vínculo da evidência com a solicitação atual;
- frescor, cobertura da política e contradições;
- assinatura, validade, commitments, âncora e uso único do permit;
- integridade da Merkle root e dos commitments;
- no contrato, contagem mínima, ausência de contradição e replay de `ALLOW`.

### O que ainda precisa de infraestrutura real

- autenticidade de ERP, governo, banco, IAM e demais sistemas externos além do primeiro conector GitHub CI;
- custódia profissional de chaves em KMS/HSM;
- autenticação e autorização de usuários da API;
- banco transacional, filas, idempotência distribuída e alta disponibilidade;
- prova Compact completa das assinaturas e regras privadas;
- execução real em banco, CI/CD, seguradora ou ferramenta empresarial.
- implantação de custódia profissional para a chave registradora e a operação
  do worker de ancoragem fora do ambiente local.

## Mapa de pastas e arquivos

Arquivos gerados dentro de `node_modules`, `dist` e `midnight-chain/contracts/managed` não são descritos individualmente.

### Raiz

| Caminho | Responsabilidade |
|---|---|
| `README.md` | Página de entrada, resumo e links para os guias. |
| `docs/` | Documentação técnica, operacional, de segurança e onboarding. |
| `package.json` | Workspaces e comandos globais de desenvolvimento, teste e build. |
| `package-lock.json` | Versões reproduzíveis das dependências Node. |
| `tsconfig.base.json` | Regras TypeScript compartilhadas. |
| `.env.example` | Referência das variáveis de execução manual. |
| `.gitignore` | Exclui dependências, builds, estado local e segredos. |
| `.gitlab-ci.yml` | Pipeline de Merge Request com os jobs `verify` e `docker-build`. |
| `docker-compose.yml` | Stack local de PostgreSQL, backend, frontend e profile opcional do MCP. |
| `proofrail.code-workspace` | Workspace do VS Code com configurações portáveis para o projeto. |

### `docs` — documentação

| Arquivo | Responsabilidade |
|---|---|
| `docs/README.md` | Índice e ordem de leitura recomendada. |
| `docs/SETUP_WINDOWS.md` | Instalação, comandos de verificação e execução Windows/WSL. |
| `docs/ARCHITECTURE.md` | Este mapa técnico e as fronteiras de confiança. |
| `docs/SEGURANCA.md` | Modelo de ameaças, controles implementados e riscos P0/P1. |
| `docs/MIDNIGHT.md` | Contrato, garantias, limitações e operação nas redes Midnight. |
| `docs/GITHUB_APP.md` | Configuração segura do primeiro conector real de CI. |
| `docs/DEPLOYMENT_AND_NEXT_STEPS.md` | Estado confirmado, arquitetura-alvo e plano de continuidade. |
| `docs/GITLAB_VALIDATION_GUIDE.md` | Sincronização, reprodução e aceite da pipeline GitLab. |
| `docs/PHASE_01_DELIVERABLES.md` | Matriz dos requisitos e lacunas da primeira fase. |
| `docs/evidence/phase-01/` | Evidências sanitizadas e manifesto do que ainda precisa ser capturado. |

Diretórios como `.codex/`, `.agents/`, `.vscode/`, `data/private/` e `midnight-chain/` são estado local ou gerado e não fazem parte do repositório público.

### `frontend` — interface

| Arquivo | Responsabilidade |
|---|---|
| `frontend/index.html` | Documento HTML usado pelo Vite. |
| `frontend/package.json` | Dependências e scripts do frontend. |
| `frontend/vite.config.ts` | Servidor Vite, porta e proxy de desenvolvimento. |
| `frontend/tsconfig.json` | Configuração TypeScript do React. |
| `frontend/src/main.tsx` | Ponto de montagem do React. |
| `frontend/src/App.tsx` | Toda a experiência: rede, cenários, ação, origens, fluxo automático, decisão, lifecycle e auditoria. |
| `frontend/src/api.ts` | Cliente HTTP tipado para as rotas Fastify. |
| `frontend/src/styles.css` | Direção visual editorial/operacional, layout responsivo e estados de interação. |

### `backend` — orquestração e segurança da aplicação

| Arquivo | Responsabilidade |
|---|---|
| `backend/package.json` | Dependências e scripts da API. |
| `backend/tsconfig.json` | Configuração TypeScript da API. |
| `backend/src/server.ts` | Inicializa Fastify, restringe CORS ao localhost, define limites e registra rotas. |
| `backend/src/routes.ts` | Endpoints, validação Zod, registro de documento autodeclarado, avaliação, âncora, permit, execução, reset e lifecycle. |
| `backend/src/access-control.ts` | Matriz declarativa de autenticação e menor scope por rota. |
| `backend/src/day03-contracts.self-test.ts` | Testes negativos dos contratos de principal, aprovação, execução, idempotência, erros e matriz de rotas. |
| `backend/src/service-auth.ts` | Autenticação bearer em tempo constante, cadastro confiável de principals/aprovadores e enforcement da matriz de scopes. |
| `backend/src/service-auth-init.ts` | Gera configuração local separando hashes/chaves públicas dos segredos de cliente, sem imprimir credenciais. |
| `backend/src/approver-cli.ts` | Assina a aprovação canônica com a identidade humana local e chama a rota autenticada. |
| `backend/src/executor.ts` | Executor fechado de `workflow_dispatch`, allowlists e credencial de escrita separada do conector CI. |
| `backend/src/executor.self-test.ts` | Valida request fechado, allowlists, corpo do dispatch e ausência do token no payload. |
| `backend/src/store.ts` | Estado JSON v6, migrações fail-closed v3→v6, separação de chaves e gravação serializada/atômica. |
| `backend/src/store-migrate.ts` | Executa e verifica explicitamente a migração do store ativo para o schema v6 sem imprimir segredos. |
| `backend/src/types.ts` | Tipos internos do banco, identidades de origem e ciphertext. |
| `backend/src/origins.ts` | Recibos simulados e recibo real do GitHub CI: normalização, AES-256-GCM e assinatura. |
| `backend/src/github.ts` | GitHub App, JWT, token de instalação, HMAC do webhook, identidade do agente e validação de workflow/artefato. |
| `backend/src/github.self-test.ts` | Testes positivos e negativos do conector GitHub sem usar credenciais reais. |
| `backend/src/github-routes.self-test.ts` | Teste HTTP isolado do webhook e da verificação CI: HMAC, replay, colisão, commit, artefato e recibo adulterado. |
| `backend/src/approval-routes.self-test.ts` | Testa escopo, independência, commitments, assinatura e replay de aprovação. |
| `backend/src/store.self-test.ts` | Valida migrações v3/v4/v5→v6 e confirma que chaves privadas não permanecem no store público. |
| `backend/src/agent-cli.ts` | Gera identidade local de desenvolvimento e assina a ação canônica do agente. |
| `backend/src/midnight-adapter.ts` | Lê a rede ativa, troca Local/Preview/Preprod e chama a CLI para ancorar. |

### `worker` — uso por agentes

| Arquivo | Responsabilidade |
|---|---|
| `worker/package.json` | Dependências e scripts do servidor MCP. |
| `worker/tsconfig.json` | Configuração TypeScript do MCP. |
| `worker/src/index.ts` | Ferramentas para consultar estado, verificar GitHub CI, selecionar cenário/rede, rodar fluxo, executar permit e apagar chaves. |

### `packages/shared` — contrato entre aplicações

| Arquivo | Responsabilidade |
|---|---|
| `packages/shared/package.json` | Pacote interno compartilhado. O namespace `@rational/*` foi mantido por compatibilidade. |
| `packages/shared/tsconfig.json` | Configuração TypeScript do pacote. |
| `packages/shared/src/index.ts` | Schemas Zod e tipos de ações, recibos, políticas, decisões, redes e estado público. |
| `packages/shared/src/day03.ts` | Contratos aditivos da Etapa 03 para identidades de serviço, scopes, aprovação assinada, execução idempotente e erros. |
| `packages/shared/src/scenarios.ts` | Catálogo dos nove cenários, incluindo agente + deploy, papéis `required`/`review`, valores padrão e políticas. |

### `packages/core` — lógica determinística e criptografia

| Arquivo | Responsabilidade |
|---|---|
| `packages/core/package.json` | Pacote interno do motor e comando de self-test. |
| `packages/core/tsconfig.json` | Configuração TypeScript do pacote. |
| `packages/core/src/index.ts` | Exporta as funções públicas do core. |
| `packages/core/src/canonical.ts` | Serialização estável usada antes de assinar ou gerar hash. |
| `packages/core/src/crypto.ts` | SHA-256, Ed25519, AES-256-GCM e verificação de assinaturas. |
| `packages/core/src/evidence.ts` | Payload canônico e verificação de recibos vinculados à solicitação. |
| `packages/core/src/merkle.ts` | Construção determinística da Merkle root. |
| `packages/core/src/policy.ts` | Motor `DENY`/`REVIEW_REQUIRED`/`ALLOW`, frescor, requisitos, contradições e commitments. |
| `packages/core/src/self-test.ts` | Testa os nove cenários, ausência, validade, contradição, commitment incorreto e revisão obrigatória. |

### `midnight` — fonte controlada da integração

| Arquivo | Responsabilidade |
|---|---|
| `midnight/README.md` | Explica o contrato e a geração do scaffold. |
| `midnight/contract/hello-world.compact` | Fonte Compact do registro de decisões e proteções mínimas de `ALLOW`. |
| `midnight/overrides/cli.ts` | CLI que conecta carteira/providers, chama `registerDecision` e lê o contrato. |

O nome físico `hello-world` é uma compatibilidade com o template oficial; o conteúdo é do Proofrail.

### `midnight-chain` — aplicação Midnight gerada

| Caminho | Responsabilidade |
|---|---|
| `midnight-chain/contracts/hello-world.compact` | Cópia aplicada pelo script a partir de `midnight/contract`. Não editar diretamente. |
| `midnight-chain/contracts/managed/hello-world` | Artefatos ZK gerados pelo compilador Compact. |
| `midnight-chain/src/cli.ts` | Cópia aplicada de `midnight/overrides/cli.ts`. |
| `midnight-chain/src/network.ts` | Endpoints e seleção de `undeployed`, `preview` e `preprod`. |
| `midnight-chain/src/wallet.ts` | Criação, sincronização e persistência da carteira. |
| `midnight-chain/src/deploy.ts` | Implantação do contrato na rede ativa. |
| `midnight-chain/src/index.ts` | Comandos `setup`, `network` e orquestração do scaffold. |
| `midnight-chain/docker-compose.yml` | Node, indexer e proof server da devnet local. |
| `midnight-chain/.midnight-state.json` | Seed local, rede ativa e endereço implantado por rede. É segredo/estado local e não deve ir ao Git. |
| `midnight-chain/package.json` | Scripts `compile`, `setup`, `deploy`, `network` e `cli`. |

### `scripts` — comandos Windows/WSL

| Arquivo | Responsabilidade |
|---|---|
| `scripts/wsl-common.ps1` | Converte caminhos Windows para caminhos `/mnt/...` no WSL. |
| `scripts/wsl-install-toolchain.sh` | Instala Node/NVM e ferramentas necessárias no Ubuntu. |
| `scripts/00-check-prerequisites.ps1` | Diagnóstico de WSL, VS Code, Node e, no modo Midnight, Docker/Compact. |
| `scripts/01-install-wsl-toolchain.ps1` | Executa o instalador Linux dentro da distribuição escolhida. |
| `scripts/02-install-project.ps1` | Instala dependências do monorepo no WSL com lockfile. |
| `scripts/03-open-vscode.ps1` | Abre o projeto no VS Code conectado ao WSL. |
| `scripts/04-run-local.ps1` | Inicia API e React com âncora apenas simulada. |
| `scripts/05-prepare-midnight-wallet.ps1` | Cria/restaura a carteira de Preview ou Preprod e mostra somente endereço público e faucet, sem sincronizar a rede. |
| `scripts/05-scaffold-midnight.ps1` | Cria/atualiza o scaffold, copia contrato/CLI e implanta em Local, Preview ou Preprod. |
| `scripts/06-run-with-midnight.ps1` | Inicia API e React em modo CLI Midnight, mostrando logs no terminal. |

### `data` — estado apenas de desenvolvimento

| Caminho | Responsabilidade |
|---|---|
| `data/store.json` | Políticas, chaves públicas, entregas GitHub, recibos, decisões, permits, âncoras, execuções e auditoria. Não contém mais chaves privadas. |
| `data/private/signing-secrets.json` | Chaves privadas locais das origens e do permit; ignorado pelo Git e destinado apenas ao desenvolvimento. |
| `data/private/agents/*` | Identidades locais opcionais dos agentes de teste; nunca compartilhar ou versionar. |
| `data/private/store.v3.backup-*.json` | Backup privado criado uma vez durante a migração do schema v3. |
| `data/private/service-auth.json` | Hashes de tokens e chaves públicas confiadas; lido somente pela API. |
| `data/private/service-auth-secrets.json` | Tokens de clientes e chave privada do aprovador local; lido por Vite/MCP/CLI, nunca pela API. |
| `data/private/executor.json` | Allowlists do executor; não contém o token GitHub. |
| `data/raw/*.json` | Ciphertexts das evidências brutas. Sem a chave AES, a aplicação não os recupera. |

### Executor de staging

O arquivo versionado `config/executor.example.json` documenta o alvo fechado.
O token fica exclusivamente em `PROOFRAIL_EXECUTOR_GITHUB_TOKEN`. O workflow
`.github/workflows/staging-deploy.yml` valida repositório, serviço, SHA,
artifact ID, workflow run e digest antes de criar o deployment `staging`.
Ausência de configuração ou token mantém o executor desabilitado.

## Dependências entre mudanças

- Alterar `packages/shared` exige validar API, web, MCP e core.
- Alterar um cenário exige atualizar `scenarios.ts`, testes e textos da interface.
- Alterar os argumentos Compact exige atualizar contrato, CLI e adaptador da API, recompilar e reimplantar.
- Alterar `midnight-chain` diretamente será perdido quando o scaffold for reaplicado; altere primeiro `midnight/`.
- Não misture `node_modules` instalado pelo Windows com execução no WSL.
