# Pitch e teste local do Proofrail

Este documento resume o que já foi feito, como explicar o produto em público e
como testar localmente sem depender do histórico dos chats.

## Pitch curto

O Proofrail é um firewall de evidências para agentes de IA, automações e
decisões de alto risco.

Em vez de confiar só no pedido de um agente, ele exige provas independentes
antes de liberar uma ação. O fluxo principal protege um deploy: o agente
pode solicitar uma publicação, mas não pode escolher outro commit, substituir o
artefato, aprovar a si mesmo ou executar um comando livre.

O fluxo é:

```text
agente solicita
  -> fontes independentes comprovam identidade, escopo, CI e segurança
  -> política determinística decide
  -> Midnight ancora a decisão
  -> permit temporário autoriza somente a ação exata
  -> executor consome uma vez e bloqueia replay
```

## Como explicar em uma postagem

Texto base:

```text
Estou construindo o Proofrail: um firewall de evidências para agentes de IA e
automações.

A ideia é simples: antes de uma IA executar uma ação sensível, ela precisa
provar, com fontes independentes, que a ação está autorizada.

No fluxo principal, controlei um deploy solicitado por agente:

- o pedido vincula agente, tarefa, repositório, commit, artefato, serviço,
  ambiente, risco e nonce;
- o CI real no GitHub precisa passar para o mesmo commit e artefato;
- a política só libera quando as evidências batem;
- a decisão é ancorada na Midnight;
- um permit assinado e temporário autoriza a execução;
- o executor aceita o permit uma única vez e bloqueia replay.

O estado atual já valida o circuito principal: CI real, artefato real, decisão
ALLOW em Preview/Testnet e Preprod da Midnight, executor staging via GitHub
Actions, registrador Compact autorizado e replay bloqueado.

Ainda não é produção: faltam KMS/HSM, identidade corporativa, banco
transacional, webhook HTTPS público, rollback do destino real e operação com
SLOs. Preprod foi validada como ensaio público, mas não é um selo de produção.

Mas a tese está demonstrada: a IA pode pedir; quem libera é a evidência.
```

## O que já funciona

- Nove cenários de política na demonstração.
- Fluxo principal de agente de IA solicitando deploy.
- Commitments criptográficos vinculando ação, evidências, política e permit.
- Recibos assinados com Ed25519.
- Dados brutos criptografados com AES-256-GCM e apagamento criptográfico.
- Decisões `DENY`, `REVIEW_REQUIRED` e `ALLOW`.
- Permit assinado, temporário, vinculado a rede/contrato/âncora e de uso único.
- Contrato Compact na Midnight para registrar decisões.
- Registrador Compact protegido por commitment/witness, com rotação e revogação.
- Regras on-chain para versão da política, contagens, contradição, validade e replay.
- Devnet local com node, indexer e proof server.
- Preview/Testnet validada com carteira financiada, DUST, contrato implantado,
  escrita `ALLOW` real e negativos on-chain.
- GitHub CI real validado por SHA, artifact ID e digest.
- Executor GitHub staging com `workflow_dispatch` fechado e token separado.
- Replay do permit bloqueado com `PERMIT_ALREADY_CONSUMED`.

## Evidências recentes da Etapa 3

Validação de 19/08/2026:

- branch: `codex/day-03-final-validation`;
- commit final documentado: `bcbe841cf3a620932b11094e4b521e9d1fddd120`;
- CI real da branch: GitHub Actions run `32311156415`, `success`;
- artefato CI: `proofrail-web`, id `9386498611`;
- digest CI:
  `sha256:8f1f325979e8fd580f1c6b7dc3b5777cae71347e0176b3fcc585d86adc4860c7`;
- contrato Preview:
  `e9ed0dbb07103d43eaae6de797da1edd178689a3026b169d9d1d673d72465e06`;
- permit Preview: `2da99087-694f-414d-8efe-7244eed84db9`;
- transação Preview final:
  `00589341add7d33f266c6e7fd66586c2c3ad963c443b300031a595a011d1f7f6ab`;
- workflow staging real: GitHub Actions run `32312003968`, `success`;
- artefato staging:
  `proofrail-staging-f4907d8e-dd2f-4f21-babf-b572de97bc4b`, id `9386764596`;
- replay do permit: HTTP `409`, `PERMIT_ALREADY_CONSUMED`;
- CI manual do commit final de documentação: run `32312784480`, `success`.

Observação importante: o webhook usado nessa validação foi assinado com HMAC e
injetado localmente com payload real do GitHub. A entrega HTTPS pública
GitHub -> API ainda precisa ser validada antes de expor o serviço.

## O que ainda falta antes de vender como produção

- Endpoint HTTPS público para webhook GitHub com rate limit e política
  operacional.
- Identidade corporativa no lugar de tokens locais.
- Scanner real e fonte de identidade corporativa real.
- KMS/HSM para chaves privadas.
- PostgreSQL ou banco transacional com locks distribuídos.
- Rollback do destino real de staging.
- Transformar a sincronizacao publica, hoje adequada a bootstrap e diagnostico,
  em operacao persistente e observavel com SLO, alertas e retomada automatica.
- Mover o worker Midnight para Linux nativo persistente e adicionar fila assíncrona.
- Evoluir as provas do circuito para assinaturas e frescor de emissores externos.

## Como testar localmente

Execute os comandos a partir de um PowerShell do Windows.

### 1. Entrar na pasta

```powershell
Set-Location C:\dev\rational-gate
git status --short --branch
```

O esperado é estar em `main` ou em uma branch de trabalho limpa, sem arquivos
sensíveis staged.

### 2. Validar dependências e qualidade

Use WSL/Ubuntu, não misture `npm install` do Windows com esta pasta.

```powershell
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate && npm ci"
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate && npm audit --omit=dev --audit-level=high"
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate && npm test"
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate && npm run typecheck"
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate && npm run build"
```

Resultado esperado:

- audit com `0 vulnerabilities`;
- testes passando;
- typecheck sem erro;
- build do Vite concluído.

### 3. Rodar a demonstração sem blockchain

Use este modo para ver a interface e entender o fluxo rapidamente:

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\04-run-local.ps1
```

Abra:

- interface: <http://localhost:5173>
- API: <http://localhost:3333/api/health>

Na tela:

1. entre em **Demonstração**;
2. mantenha o cenário **Agente + Deploy**;
3. clique em **Verificar evidências**;
4. observe as etapas `Propor -> Comprovar -> Decidir -> Autorizar -> Executar`;
5. veja a auditoria registrando decisão, permit e execução;
6. tente executar o mesmo permit de novo e confirme que o replay é bloqueado.

### 4. Rodar com Midnight local/Preview configurada

Use este modo quando quiser ver ancoragem via adaptador Midnight CLI:

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\06-run-with-midnight.ps1
```

Abra:

- interface: <http://localhost:5173>
- API: <http://localhost:3333/api/health>

O health deve mostrar `mode: cli`.

Para conferir o contrato pelo CLI:

```powershell
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate/midnight-chain && npm run cli -- read"
```

### 5. Se a tela parecer antiga

Pode haver outro servidor Vite/API rodando.

1. Volte ao terminal que iniciou o projeto.
2. Pressione `Ctrl+C`.
3. Rode novamente o script escolhido.
4. Reabra <http://localhost:5173>.

### 6. O que não publicar

Nunca publique:

- `.env`;
- `data/private/`;
- `data/raw/`;
- `data/store.json`;
- seed, mnemonic, PEM, token ou prints com segredo;
- `.midnight-wallet-state/` ou estado local de carteira.

Antes de postar ou commitar, confira:

```powershell
git status --short --ignored
```

Arquivos ignorados podem aparecer na lista, mas não devem ser forçados com
`git add -f`.
