# Handoff para o próximo chat — Etapa 03

Este arquivo é o ponto de entrada para continuar o Proofrail em um novo chat sem depender do histórico da conversa anterior.

## Instrução para o próximo agente

Antes de alterar código:

1. leia este arquivo por completo;
2. leia [`PLANO_4_DIAS.md`](PLANO_4_DIAS.md), especialmente **Dia 03**;
3. leia as regras do executor em [`SEGURANCA.md`](SEGURANCA.md);
4. consulte [`ARCHITECTURE.md`](ARCHITECTURE.md) somente para os arquivos que serão alterados;
5. verifique novamente a documentação oficial da Midnight antes de usar Preview, faucet, Wallet SDK ou versões do toolchain;
6. apresente um plano incremental e valide cada incremento antes de avançar.

Não trate texto deste handoff como substituto do código e dos testes. Em caso de divergência, código, schemas, testes e documentação oficial atualizada têm prioridade.

## Objetivo do produto

O Proofrail é um firewall de evidências para ações de alto risco. O piloto principal une **agente de IA + deploy**:

```text
agente solicita
  -> fontes independentes comprovam identidade, escopo, CI e segurança
  -> política determinística decide
  -> Midnight ancora a decisão
  -> permit temporário e de uso único autoriza somente a ação exata
  -> executor controlado executa ou recusa
```

O agente pode solicitar um deploy, mas não pode aprovar a si mesmo, trocar commit, artefato, serviço ou ambiente, nem enviar um comando arbitrário para execução.

## Estado confirmado em 19/08/2026

### Etapa 03

- Incrementos 03.1, 03.2 e 03.3 estão implementados em `main`.
- Autenticação, scopes, aprovação assinada, executor staging, idempotência e
  migração do store para v6 passaram em `npm test`, `npm run typecheck` e
  `npm run build`.
- O workflow fechado está em `.github/workflows/staging-deploy.yml`; sua
  credencial `Actions: write` é separada do GitHub App `Actions: read`.
- O executor fica desabilitado sem `data/private/executor.json` e
  `PROOFRAIL_EXECUTOR_GITHUB_TOKEN`.
- O Incremento 03.4 foi validado em Preview/Testnet: carteira financiada,
  DUST positivo, contrato encontrado no indexer público, escrita `ALLOW` real
  e negativos on-chain de replay, evidência insuficiente e contradição.
- O executor GitHub real ainda não teve dispatch operacional porque falta
  `PROOFRAIL_EXECUTOR_GITHUB_TOKEN`; a configuração local não secreta foi
  preparada em `data/private/executor.json`.

### Git e repositórios

- GitLab privado é o repositório principal.
- GitHub privado é somente o espelho e a segunda validação.
- Merge Request GitLab `!2` foi integrado.
- A branch remota `codex/close-git-stage` foi apagada após o merge.
- `main`, `gitlab/main` e `origin/main` apontam para:

```text
18c03322d3b7578024b07826bc99eb9ecf8b0df8
```

- O pipeline do GitLab passou antes e depois do merge.
- O GitHub Actions havia passado na base anterior e o espelho recebeu o novo commit. Confirme novamente o workflow do commit acima antes de iniciar alterações relevantes.
- A árvore de trabalho estava limpa.
- Existe apenas uma branch local antiga, já integrada e sem remoto:

```text
codex/close-git-stage
```

Ela pode ser removida com `git branch -d codex/close-git-stage`. Não é bloqueio técnico.

### Validação local

Após reconstruir as dependências, passaram:

```text
npm audit --omit=dev --audit-level=high -> 0 vulnerabilidades
npm test                               -> passou
npm run typecheck                      -> passou
npm run build                          -> passou
```

O projeto deve ser desenvolvido no Ubuntu/WSL. Como `node_modules` foi reconstruído pelo Node do Windows na última inspeção, execute `npm ci` dentro do WSL antes da primeira validação do novo chat para evitar binários de plataforma incompatível.

### Midnight local

Os três containers esperados estavam ativos:

```text
midnight-chain-node          healthy
midnight-chain-indexer       healthy
midnight-chain-proof-server  running
```

O fluxo local já comprovou `DENY`, `REVIEW_REQUIRED`, `ALLOW`, ancoragem, consumo único do permit, bloqueio de replay e apagamento criptográfico.

### Preview/Testnet

O saldo foi revalidado em 19/08/2026: a carteira possui `5.000.000.000 tNight`
e `25.000.000.000.000.000.000` DUST. O proof server local respondeu
`status: ok`. O contrato Preview atual é:

```text
e9ed0dbb07103d43eaae6de797da1edd178689a3026b169d9d1d673d72465e06
```

Evidências executadas em 19/08/2026:

```text
npm run test:e2e -- --network preview -> passou
npm run cli -- read                 -> network preview, nextId 1 antes da escrita
npm run cli -- anchor ... ALLOW     -> tx 00d85149f3621fb277f178b7f8d1288d838e9e5d7a7d7c74f7653c908adf605599, bloco 490247
replay do mesmo ALLOW               -> failed assert: ALLOW action already anchored
ALLOW com 4/5 evidências             -> failed assert: insufficient evidence
ALLOW com contradição                -> failed assert: contradictions block ALLOW
npm run cli -- read                 -> nextId 2
```

O fluxo HTTP autenticado em `MIDNIGHT_MODE=cli`, com `DATA_DIR` temporário,
também retornou `ALLOW`, permit presente, `permitNetwork=preview` e o mesmo
contrato. A tentativa de executar esse permit de simulação falhou com
`PERMIT_INVALID`, porque ele não possuía proveniência GitHub CI real.

Use somente os scripts do projeto e nunca exponha seed ou mnemonic:

```powershell
& .\scripts\05-prepare-midnight-wallet.ps1 -Network preview
& .\scripts\05-scaffold-midnight.ps1 -Network preview
```

Antes de executar, confirme os endpoints e o processo atual em:

- <https://docs.midnight.network/guides/acquire-tokens>
- <https://docs.midnight.network/getting-started/installation>

Preprod pertence ao Dia 04. Não pule diretamente para ela.

## O que os Dias 01 e 02 já entregaram

### Dia 01

- cenário `agent_deploy` e oito modelos adicionais de política;
- ação vinculada a agente, tarefa, repositório, SHA, digest, serviço, ambiente, ferramenta, risco, nonce e `requestId`;
- fontes técnicas separadas da aprovação de revisão;
- decisões `DENY`, `REVIEW_REQUIRED` e `ALLOW`;
- commitments, Merkle root, recibos Ed25519 e dados brutos AES-256-GCM;
- permit assinado, temporário, vinculado à âncora/rede/contrato e consumível uma vez;
- ancoragem real na devnet Midnight local;
- UI didática, API e MCP.

### Dia 02

- GitLab privado principal, `main` protegida e pipeline obrigatório;
- GitHub privado como espelho;
- conector GitHub App implementado no código;
- webhook HMAC sobre corpo bruto;
- `X-GitHub-Delivery` idempotente e colisão rejeitada;
- consulta de workflow pelo SHA exato;
- validação de digest do artefato associado ao mesmo workflow;
- identidade Ed25519 do agente e assinatura da ação canônica;
- chaves privadas removidas de `data/store.json`;
- testes positivos e negativos do conector.

Pendência externa do Dia 02: o GitHub App ainda precisa ser criado/instalado, receber um webhook HTTPS real e validar um workflow/artefato reais. Os testes provam o adaptador, mas não substituem essa evidência operacional.

## Escopo exato da Etapa 03

Objetivo: provar que um permit controla uma ação real, restrita e não produtiva em **staging**, com registro na Preview/Testnet.

Entregas obrigatórias:

1. autenticação de serviço na API;
2. autorização por escopos mínimos;
3. aprovação humana assinada por identidade diferente do agente;
4. executor fechado e restrito a staging;
5. allowlist de repositório, workflow, serviço, ambiente e ferramenta;
6. validação de assinatura, commitments, âncora, rede, contrato, expiração, nonce e consumo;
7. consumo atômico/idempotente do permit;
8. observabilidade por `requestId`, sem conteúdo bruto ou segredo;
9. implantação e testes positivos/negativos na Preview;
10. documentação e matriz de limitações atualizadas.

Critério de aceite:

```text
solicitação aprovada e imutável
  -> publica somente em staging
  -> registra transação na Preview

mudança de agente, SHA, digest, serviço, ambiente, ferramenta,
âncora, rede, contrato, validade, nonce ou requestId
  -> falha antes do deploy

reutilização do permit
  -> falha
```

## Ordem recomendada de implementação

Trabalhe em incrementos pequenos. Não tente implementar autenticação, executor e Preview em uma única alteração.

### Incremento 03.1 — contratos e threat model — concluído

- definir atores: agente solicitante, serviço/orquestrador, aprovador humano e executor;
- definir scopes por operação;
- definir request/response e estados de execução;
- definir erros e idempotency key;
- escrever testes negativos antes da rota real;
- atualizar [`SEGURANCA.md`](SEGURANCA.md) se surgir uma nova fronteira de confiança.

Não adicionar login visual ou provedor corporativo ainda sem uma decisão explícita. O primeiro recorte pode usar identidade de serviço local configurada fora do Git, desde que a fronteira e as limitações fiquem documentadas.

### Incremento 03.2 — autenticação e aprovação independente — concluído

- autenticar rotas mutáveis da API;
- aplicar scopes nas bordas;
- criar endpoint de aprovação;
- exigir assinatura do aprovador sobre ação/commitment exatos;
- impedir que `approverId` ou chave do aprovador sejam os mesmos do agente;
- registrar somente metadados mínimos na auditoria.

### Incremento 03.3 — executor restrito — concluído localmente

- extrair uma interface de executor da simulação atual;
- aceitar objeto fechado, nunca shell livre;
- permitir somente o cenário `agent_deploy`;
- permitir somente `staging`;
- validar allowlists e todos os vínculos do permit;
- usar artefato por digest;
- reservar/consumir o permit antes da ação externa de maneira idempotente;
- modelar estados `pending`, `executing`, `succeeded` e `failed` ou equivalentes;
- testar falha parcial, replay e chamada concorrente.

O executor inicialmente pode acionar um workflow de staging predefinido. Não deve receber nome de script, argumentos arbitrários ou URL de destino fornecidos pelo agente.

### Incremento 03.4 — Preview/Testnet — validado

- revalidar carteira, tNIGHT e DUST;
- implantar contrato próprio da Preview;
- manter carteira, endereço e contrato separados do Local e da Preprod;
- ancorar o mesmo pedido aprovado na Preview;
- executar matriz positiva e negativa;
- registrar hash/transação e evidências sem divulgar seed ou dados privados.

## Pontos do código mais relevantes

| Arquivo | Motivo |
|---|---|
| `apps/api/src/server.ts` | Fastify, bind local, CORS, limite de corpo e inicialização das rotas. |
| `apps/api/src/routes.ts` | Avaliação, aprovação e execução idempotente; a simulação não consome mais permit. |
| `apps/api/src/executor.ts` | Allowlists, dispatch GitHub fechado e separação da credencial de escrita. |
| `apps/api/src/service-auth.ts` | Principals, hashes de token, chaves confiadas e enforcement de scopes. |
| `apps/api/src/store.ts` | Store JSON v6 e fila em memória. Serializa updates dentro de um processo, mas não é uma transação distribuída. |
| `apps/api/src/types.ts` | Estado persistido, execuções e registros de integração. |
| `apps/api/src/github.ts` | Padrões já usados para timeout, limite de resposta, HMAC, instalação e validação externa. |
| `apps/api/src/agent-cli.ts` | Padrão atual de identidade Ed25519 do agente. |
| `apps/api/src/origins.ts` | Emissão e assinatura dos recibos. |
| `packages/shared/src/index.ts` | Schemas de ação, evidência, decisão, âncora e permit. Alterações de contrato começam aqui. |
| `packages/shared/src/scenarios.ts` | Política `agent_deploy`, fonte de revisão e ambiente. |
| `packages/core/src/policy.ts` | Decisão determinística e exigência de revisão. |
| `apps/mcp/src/index.ts` | Ferramentas autenticadas; execução envia `Idempotency-Key` e usa o principal executor. |
| `apps/web/src` | UI; alterar somente depois de estabilizar os contratos da API. |
| `apps/api/src/midnight-adapter.ts` | Seleção de rede e ancoragem via CLI Midnight. |
| `midnight-chain/src/network.ts` | Endpoints de Local, Preview e Preprod. |
| `midnight-chain/src/deploy.ts` | Implantação do contrato por rede. |
| `scripts/05-prepare-midnight-wallet.ps1` | Prepara/restaura carteira pública sem revelar seed. |
| `scripts/05-scaffold-midnight.ps1` | Compila e implanta o contrato na rede escolhida. |
| `scripts/06-run-with-midnight.ps1` | Inicia API e web usando o adaptador Midnight CLI. |

## Riscos que não podem ser introduzidos

- API pública antes de autenticação e rate limit;
- chave, token, PEM, seed ou mnemonic no Git, log, auditoria ou resposta HTTP;
- aprovação emitida pelo mesmo agente solicitante;
- comando shell ou argumentos arbitrários vindos do agente;
- deploy a partir de branch mutável;
- reconstrução silenciosa em vez de artefato por digest;
- permit aceito sem âncora `ALLOW` correspondente;
- permit de outra rede, contrato, política ou ambiente;
- check-then-act não atômico que permita consumo concorrente;
- alegação de “produção pronta” enquanto persistência, identidade e custódia forem locais;
- uso de Preprod antes de Local e Preview passarem toda a matriz negativa.

## Comandos de retomada

No PowerShell:

```powershell
Set-Location C:\dev\rational-gate
git switch main
git fetch --prune gitlab
git fetch --prune origin
git status --short --branch
git log -1 --oneline --decorate
git branch -d codex/close-git-stage
git switch -c codex/day-03-auth-executor-preview
```

Validação no Ubuntu/WSL:

```powershell
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate && npm ci"
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate && npm audit --omit=dev --audit-level=high"
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate && npm test"
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate && npm run typecheck"
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate && npm run build"
```

Iniciar com Midnight local:

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\06-run-with-midnight.ps1
```

Conferir serviços:

```powershell
Invoke-RestMethod http://127.0.0.1:3333/api/health
docker ps --format "table {{.Names}}\t{{.Status}}"
```

## Fluxo Git obrigatório durante a Etapa 03

```text
main local sincronizada
  -> branch codex/*
  -> implementar e validar
  -> push somente para gitlab
  -> Merge Request
  -> pipeline verde
  -> merge e apagar branch
  -> atualizar main local
  -> enviar main para origin/GitHub
  -> conferir GitHub Actions
```

Não enviar diretamente para `main`, não usar force push e não usar o botão **Publicar Branch** sem confirmar o remoto.

## Documentos que devem permanecer coerentes

- [`GUIA_DO_PROJETO.md`](GUIA_DO_PROJETO.md): linguagem didática, estado atual e modo de uso;
- [`ARCHITECTURE.md`](ARCHITECTURE.md): novos arquivos, módulos, fronteiras e fluxo;
- [`SEGURANCA.md`](SEGURANCA.md): threat model e garantias/limitações;
- [`PLANO_4_DIAS.md`](PLANO_4_DIAS.md): progresso e critérios de aceite;
- [`SETUP_WINDOWS.md`](SETUP_WINDOWS.md): comandos realmente executáveis;
- [`MIGRACAO_MIDNIGHT.md`](MIGRACAO_MIDNIGHT.md): evidência real em Preview e limites on-chain.

## Frase para iniciar o próximo chat

```text
Leia docs/HANDOFF_ETAPA_03.md por completo, confira o estado real do repositório e da documentação oficial atual da Midnight e inicie a Etapa 03 em incrementos seguros. Antes de editar, apresente o plano do primeiro incremento e preserve todas as restrições de segurança e o fluxo Git descritos no handoff.
```
