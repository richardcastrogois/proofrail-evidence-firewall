# Entregáveis da Fase 01

Este documento transforma os requisitos apresentados nos prints da plataforma
AKINDO em um plano verificável para o Proofrail. Os prints são referência de
requisito fornecida pelo time, não instruções operacionais. Antes da submissão,
um integrante deve conferir o texto e o prazo diretamente na página oficial.

## Resumo executivo

O portão técnico principal está atendido no código: existe um contrato Compact
não trivial e ele compila com Compact `0.31.1`. Em 14/09/2026, uma consulta
somente leitura ao indexador Preprod confirmou o contrato no endereço
`9a1a5ae1cbb7bd5a64e649c5c9b63c9740907df53a2a1a0ba98f8e3a1b33fdd5`.

A submissão, entretanto, **ainda não está pronta**. A licença Apache-2.0 já foi
aprovada pelos três mantenedores e documentada; o GitHub está público com o
tópico obrigatório, e a Merge Request do GitLab está aberta. Ainda faltam
validar a pipeline do conteúdo documental final, produzir slides e vídeo e
capturar uma execução nova com hash de transação e evidências sanitizadas.

## Matriz dos requisitos

| Requisito apresentado | Onde deve ficar | Estado em 14/09/2026 | Para concluir |
| --- | --- | --- | --- |
| Repositório GitHub público com código relevante | raiz do repositório GitHub | **Atendido**: `codex/hackathon` abriu sem login após a publicação | preservar a revisão de segredos e repetir o teste anônimo após o push final |
| README claro com projeto, setup, arquitetura, integração Midnight e validação | `README.md` | **Parcial** | usar a seção de validação do avaliador e manter os links deste checklist atualizados |
| Apresentação de slides | link na submissão; fonte em local definido pelo time | **Faltando** | criar deck com problema, solução, arquitetura, demo, Midnight, progresso e próximos passos |
| Vídeo de demonstração/apresentação | link acessível aos avaliadores | **Faltando** | gravar fluxo completo, mostrar contrato/transação e testar o link anonimamente |
| Descrição do progresso da onda | `docs/HACKATHON_START_HERE.md` e resumo na submissão | **Existe** | condensar o progresso em texto de submissão e atualizar com a reorganização Docker |
| Explicação do que mudou em relação a edição anterior | submissão e este documento | **Aplicável se for reenvio** | listar diferenças objetivas; não inventar se for primeira participação |
| Tópico GitHub `midnightntwrk` | metadata do repositório GitHub | **Atendido**: tópico exato visível sem login | preservar o tópico na submissão |
| Código Midnight em conformidade com Apache 2.0 | `LICENSE` e preservação de avisos de terceiros | **Atendido**: os três mantenedores aprovaram Apache-2.0 e o texto oficial está na raiz | preservar a licença e os avisos aplicáveis nas redistribuições |
| Pelo menos um contrato Compact compilado | `midnight/contract/hello-world.compact` | **Atendido** | preservar comando e evidência de compilação |
| Funcionalidade relevante relacionada à Midnight | contrato, CLI, backend e documentação | **Atendido no código** | demonstrar `registerDecision` e o recibo público em vídeo/evidência nova |
| Não ser bifurcação/cópia superficial | README, pitch e histórico Git | **Atendido tecnicamente** | explicar contribuição original: evidências, política, commitments, registrar e replay protection |
| Cumprir elegibilidade e demais regras | responsabilidade da equipe | **Pendente de conferência humana** | revisar página oficial e dados cadastrais antes de enviar |

## Organização do que já existe

| Artefato | Caminho canônico |
| --- | --- |
| Visão geral e caminho rápido | `README.md` |
| Contrato Compact controlado | `midnight/contract/hello-world.compact` |
| Integração e operação Midnight | `docs/MIDNIGHT.md` |
| Arquitetura e mapa de pastas | `docs/ARCHITECTURE.md` |
| Reorganização e Docker | `docs/REORGANIZACAO_E_DOCKER.md` |
| Progresso e decisão de hospedagem | `docs/HACKATHON_START_HERE.md` |
| Pitch base para slides | `docs/PITCH.md` |
| Benchmark de recursos | `docs/MIDNIGHT_RESOURCE_BENCHMARK.md` |
| Como validar GitLab | `docs/GITLAB_VALIDATION_GUIDE.md` |
| Manifesto de provas | `docs/evidence/phase-01/README.md` |

`midnight-chain/` é estado gerado e privado. Não deve ser enviado ao Git: pode
conter seed, checkpoints da wallet, segredo do registrador e artefatos pesados.
O contrato versionado é sempre o arquivo em `midnight/contract/`.

## Evidência técnica já confirmada

### 1. Ambiente Midnight

O script oficial passou em 14/09/2026:

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\00-check-prerequisites.ps1 -Mode Midnight
```

Resultado relevante: WSL 2, Node `v22.23.1`, npm `10.9.8`, Docker acessível e
Compact compiler `0.31.1`.

### 2. Compilação do contrato

```powershell
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate/midnight-chain && npm run compile"
```

Resultado: três circuitos compilados — `registerDecision`, `rotateRegistrar` e
`revokeRegistrar` — com arquivos prover/verifier e ZKIR regenerados.

### 3. Contrato existente em Preprod

```powershell
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate/midnight-chain && npm run test:e2e -- --network preprod"
```

Resultado confirmado:

```text
e2e-check passed
contractAddress: 9a1a5ae1cbb7bd5a64e649c5c9b63c9740907df53a2a1a0ba98f8e3a1b33fdd5
network: preprod
```

Esse teste prova que o indexador encontra o contrato. Ele não prova sozinho
quem fez o deploy, o saldo atual, a transação de deploy ou uma nova chamada
`registerDecision`.

### 4. Aplicação e containers

A sequência equivalente à CI passou: Prisma generate/validate, audit no nível
alto, testes, typecheck e build. As imagens `frontend`, `backend` e `worker`
foram construídas. A stack respondeu `200` no frontend e em `/api/health`.

Foram corrigidos durante a validação:

- permissão do PID do Nginx quando executado como usuário não-root;
- OpenSSL ausente no container do backend/Prisma;
- geração Prisma desnecessária dentro da imagem do MCP/worker.

O diretório `worker/` ainda contém o servidor MCP atual. Ele **não** implementa
o consumidor assíncrono Midnight descrito na arquitetura-alvo. Em execução
detached pelo Compose, ele inicia e encerra com código `0` porque o transporte
MCP é `stdio` e não existe cliente anexado. A imagem é válida, mas não representa
um serviço persistente pronto para hospedagem.

Tamanhos medidos das imagens locais após o build:

| Imagem | Tamanho aproximado |
| --- | ---: |
| `rational-gate-frontend` | 20,28 MiB |
| `rational-gate-backend` | 211,73 MiB |
| `rational-gate-worker` | 193,07 MiB |

A separação melhora isolamento, deploy e responsabilidade, mas não reduz por si
só o pico de memória da wallet/prova Midnight. Backend e MCP ainda copiam o
monorepo e instalam dependências de desenvolvimento; multi-stage build e
`npm prune --omit=dev` podem reduzir as imagens. Mesmo assim, o benchmark mostra
que o gargalo principal para Oracle é memória em runtime, não o tamanho dessas
imagens. O worker assíncrono, a fila persistente e o teste integral limitado a
2 GB/4 GB continuam pendentes antes de um deploy responsável.

## O que ainda deve ser provado com uma execução nova

Antes da publicação do repositório, a frente de Repositório e CI também deve
fechar estes gates:

- [x] registrar a concordância dos três mantenedores com Apache-2.0;
- [x] criar o `LICENSE` somente depois dessa concordância;
- [x] confirmar que GitHub e GitLab apontam para o mesmo primeiro commit
  aprovado; repetir após o commit documental final;
- [x] confirmar `verify` e `docker-build` verdes na Merge Request do primeiro
  commit da frente; repetir a conferência após o commit documental final;
- [x] tornar o GitHub público, adicionar exatamente `midnightntwrk` e testar
  sem sessão autenticada.

Crie provas somente com dados públicos e sanitizados. Nunca capture seed,
mnemonic, chaves, `.env`, tokens, `data/private`, `.midnight-state.json` ou o
conteúdo de `.midnight-wallet-state`.

| Prova | Conteúdo mínimo | Nome sugerido |
| --- | --- | --- |
| Contrato fonte | editor mostrando o caminho e os circuitos principais | `01-compact-contract-source.png` |
| Compilação | comando e saída concluída | `02-compact-compile-success.png` |
| Carteira pública | rede e endereço público, sem seed | `03-wallet-public-address.png` |
| Faucet | confirmação da rede e envio para o endereço público | `04-faucet-tnight.png` |
| Saldo | `tNIGHT` e `DUST` após sincronização concluída | `05-wallet-balance.png` |
| Registro DUST | linha final `DUST registration transaction submitted.` e confirmação posterior | `06-dust-registration.png` |
| Deploy | rede, endereço do contrato e hash/identificador da transação | `07-contract-deploy.png` |
| Contrato no indexador | `e2e-check passed` com rede/endereço | `08-indexer-contract-found.png` |
| Âncora real | recibo com contrato, `txId`, Merkle root e action commitment | `09-register-decision-receipt.png` |
| Leitura do ledger | `nextId` maior após a âncora | `10-contract-ledger-after-anchor.png` |
| Fluxo do produto | evidências, decisão, permit e execução controlada | `11-product-flow.png` |

Guarde os arquivos em `docs/evidence/phase-01/`. Antes de versionar, faça uma
segunda revisão visual procurando dados sensíveis.

## Runbook seguro para a captura Midnight

### Gate A — escolher uma única rede

Use Preprod para manter coerência com o contrato já confirmado. Não misture
wallet, faucet, endereço ou screenshot de Preview com Preprod.

### Gate B — leitura de saldo antes de faucet

```powershell
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate/midnight-chain && npm run check-balance -- --network preprod"
```

O faucet entrega `tNIGHT`; `DUST` é obtido pelo fluxo de registro da wallet. Se
`tNIGHT` já for maior que zero, não solicite faucet novamente. Em 14/09/2026, a
consulta foi interrompida após alguns minutos sem snapshot final; portanto o
saldo atual **não foi reconfirmado** neste trabalho.

### Gate C — deploy somente com autorização da equipe

O próximo comando consome token de teste e altera estado público. Execute apenas
depois de confirmar rede, endereço público, backup do estado local e saldo:

```powershell
$env:MIDNIGHT_DUST_WAIT_TIMEOUT_MS="2700000"
PowerShell -ExecutionPolicy Bypass -File .\scripts\05-scaffold-midnight.ps1 -Network preprod
```

Não considere o registro de DUST submetido antes da linha:

```text
DUST registration transaction submitted.
```

Não apague nem recrie a carteira apenas por timeout. Preserve os checkpoints e
rode novamente a consulta de saldo.

### Gate D — confirmar o contrato sem escrever

```powershell
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate/midnight-chain && npm run test:e2e -- --network preprod"
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate/midnight-chain && npm run cli -- read --network preprod"
```

### Gate E — produzir uma nova âncora pelo produto

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\06-run-with-midnight.ps1
```

No frontend, selecione Preprod e execute o cenário demonstrado. Só aceite como
prova uma execução cujo recibo mostre `contractAddress` e `txId` não nulos. O
hash deve corresponder ao log `ANCHOR_RESULT` da CLI e o `nextId` deve aumentar
na leitura do contrato.

O comando `security-check` realiza várias transações, inclusive rotação e
revogação temporária do registrador. Não o use apenas para tirar print; reserve
esse teste para uma janela intencional e com DUST suficiente.

## Slides e vídeo

Roteiro mínimo para os slides:

1. problema e risco de agentes aprovarem a própria ação;
2. proposta Proofrail;
3. fluxo de evidências, política, Midnight, permit e executor;
4. arquitetura `frontend/backend/MCP` atual e worker assíncrono ainda pendente;
5. contrato Compact e propriedades de segurança;
6. demo e recibo on-chain;
7. progresso da fase, benchmark e próximos passos;
8. equipe de três desenvolvedores.

O vídeo deve mostrar a aplicação funcionando, não apenas slides. Grave a versão
curta depois de capturar a execução válida; teste o link em janela anônima.

## Divisão sugerida entre três desenvolvedores

| Frente | Responsabilidade da Fase 01 |
| --- | --- |
| Repositório e CI | sincronizar GitLab, abrir MR, validar pipeline/artifacts e preparar GitHub público/tópico |
| Midnight e evidências | executar runbook Preprod, preservar hashes e revisar screenshots contra vazamento |
| Produto e apresentação | revisar README, preparar slides, gravar vídeo e preencher a página AKINDO |

## Critério final de “pronto para enviar”

- [x] GitHub acessível sem login e com tópico `midnightntwrk`.
- [x] `LICENSE` e obrigações Apache 2.0 revisadas pelos mantenedores.
- [ ] README permite ao avaliador entender, instalar e validar.
- [x] Contrato Compact compila com sucesso.
- [x] Contrato Preprod é encontrado pelo indexador.
- [ ] Nova transação `registerDecision` com `txId` preservado.
- [ ] Saldo tNIGHT/DUST reconfirmado e capturado sem segredo.
- [ ] Pipeline GitLab verde no mesmo conteúdo submetido; a execução
  `#2848618827` passou no primeiro commit e a execução final ainda será gerada.
- [ ] Slides e vídeo publicados e acessíveis sem login.
- [ ] Descrição de progresso e, se aplicável, mudanças desde a edição anterior.
- [ ] Revisão final da página oficial, prazo, elegibilidade e links.
