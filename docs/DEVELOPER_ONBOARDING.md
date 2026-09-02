# Onboarding de Desenvolvimento

## Para quem e este guia

Este guia permite que uma pessoa nova no projeto clone, instale, execute e
verifique o Proofrail sem depender de conhecimento previo de Midnight. Siga as
etapas na ordem. Comece pelo modo Local; ele valida a aplicacao sem gastar
tokens de teste nem criar carteira publica.

Antes de iniciar, leia [Estado local e segredos](LOCAL_STATE_AND_SECRETS.md).
Ele explica o que voce deve pedir ao senior e o que nunca deve copiar.

## Terminais usados neste guia

| Nome | Quando usar | Como identificar |
| --- | --- | --- |
| PowerShell | comandos Windows e scripts da pasta scripts | prompt inicia com PS C:\... |
| WSL/Ubuntu | Node, npm, Git Linux, Midnight e Docker | prompt comum termina em $ |
| Terminal integrado do VS Code | pode ser PowerShell ou WSL; confira o prompt antes de colar comando | selecione o perfil correto no terminal |

Os blocos marcados PowerShell devem ser executados no Windows. Os blocos
marcados WSL devem ser executados dentro do Ubuntu. Copiar um comando WSL para
PowerShell e uma causa comum de erro.

## 1. Acessar e clonar

Peça ao senior o URL do repositorio e a permissao de leitura ou contribuicao.
Nao use ZIP enviado por chat quando o Git estiver disponivel: o clone preserva
historico, branches e atualizacoes.

No PowerShell:

~~~powershell
New-Item -ItemType Directory -Force C:\dev | Out-Null
Set-Location C:\dev
git clone <URL_DO_REPOSITORIO> rational-gate
Set-Location C:\dev\rational-gate
git status --short --branch
~~~

No Linux:

~~~bash
mkdir -p ~/dev
cd ~/dev
git clone <URL_DO_REPOSITORIO> rational-gate
cd rational-gate
git status --short --branch
~~~

O ultimo comando deve mostrar uma branch e nenhum arquivo modificado. Se
aparecer erro de permissao, pare e solicite acesso ao senior.

## 2. Pedir a configuracao correta

Depois do clone, informe ao senior qual modo voce precisa:

- Local: interface, API, politica, recibos e ancora simulada;
- Midnight local: contrato e proof server Docker na sua maquina;
- Preview ou Preprod: rede publica de teste, carteira propria e faucet.

Peca o arquivo .env minimo ou os valores que precisam ser preenchidos. Nunca
peca a carteira de outra pessoa, seed, mnemonic, arquivos em data/private,
midnight-chain/.midnight-state.json, PEM ou token pronto.

Para o modo Local simples, normalmente basta criar o arquivo local a partir do
modelo:

~~~powershell
Copy-Item .env.example .env
~~~

~~~bash
cp .env.example .env
~~~

Mantenha MIDNIGHT_MODE=local no .env para a primeira execucao. Nao altere
variaveis de GitHub App ou executor sem instrucao do senior.

## 3. Preparar a maquina Windows com WSL

Esta e a rota recomendada para Windows. No PowerShell:

~~~powershell
wsl --status
wsl -l -v
PowerShell -ExecutionPolicy Bypass -File .\scripts\00-check-prerequisites.ps1 -Mode Local
PowerShell -ExecutionPolicy Bypass -File .\scripts\01-install-wsl-toolchain.ps1 -Mode Local
PowerShell -ExecutionPolicy Bypass -File .\scripts\02-install-project.ps1
~~~

Se o WSL ainda nao existir, abra PowerShell como administrador e execute:

~~~powershell
wsl --install -d Ubuntu
~~~

Reinicie o Windows se solicitado. Depois abra Ubuntu uma vez, crie usuario e
senha Linux, e retome o guia.

Confirme Node e npm dentro do WSL:

~~~powershell
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && node --version && npm --version"
~~~

O Node deve ser versao 22 ou superior. Nao execute npm install com Node do
Windows dentro da mesma pasta: o projeto instala dependencias pelo WSL usando o
lockfile.

## 4. Preparar uma maquina Linux

No terminal Linux:

~~~bash
sudo apt-get update
sudo apt-get install -y git curl build-essential ca-certificates unzip
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.nvm/nvm.sh
nvm install 22
nvm use 22
npm ci
~~~

No Linux, os scripts PowerShell nao sao necessarios. Execute npm sempre na raiz
do repositorio e mantenha o Node carregado com source ~/.nvm/nvm.sh em cada
novo terminal.

## 5. Validar o codigo antes de abrir

No PowerShell usando WSL:

~~~powershell
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate && npm test"
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate && npm run typecheck"
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate && npm run build"
~~~

No Linux:

~~~bash
source ~/.nvm/nvm.sh
npm test
npm run typecheck
npm run build
~~~

Os tres comandos devem terminar sem erro. Se falhar, nao altere dependencias
aleatoriamente: copie apenas a mensagem de erro sem segredos e envie ao senior.

## 6. Rodar em modo Local

No PowerShell:

~~~powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\04-run-local.ps1
~~~

No Linux/WSL:

~~~bash
source ~/.nvm/nvm.sh
bash scripts/run-dev-ordered.sh local
~~~

Mantenha este terminal aberto. Abra no navegador:

- interface: http://localhost:5173
- health da API: http://127.0.0.1:3333/api/health

Em outro PowerShell, verifique a API:

~~~powershell
Invoke-RestMethod http://127.0.0.1:3333/api/health
~~~

Em outro terminal Linux/WSL:

~~~bash
curl http://127.0.0.1:3333/api/health
~~~

O retorno deve indicar ok=true, service=proofrail-api e mode=local.

Para encerrar, volte ao terminal que iniciou a aplicacao e pressione Ctrl+C.

## 7. Testar o fluxo visual

1. Abra Demonstracao.
2. Selecione Agente + Deploy.
3. Registre a alegacao do agente e avalie sem fontes: espere DENY.
4. Confirme identidade, politica de ferramentas, Pipeline CI e scanner.
5. Com risco 45 ou producao, confirme tambem a aprovacao responsavel: espere
   REVIEW_REQUIRED antes dela e ALLOW depois dela.
6. Registre conflito em uma fonte e confirme que o resultado volta a DENY.
7. Em ALLOW, execute o permit uma vez e confirme que uma segunda tentativa e
   bloqueada.

No modo Local, a ancora e simulada. Isso e esperado e permite aprender o
fluxo sem rede publica.

## 8. Adicionar Midnight local

Somente siga esta etapa se Docker Desktop estiver aberto no Windows ou Docker
estiver funcional no Linux. No Windows, tambem habilite integracao WSL no Docker
Desktop.

No PowerShell:

~~~powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\00-check-prerequisites.ps1 -Mode Midnight
PowerShell -ExecutionPolicy Bypass -File .\scripts\05-scaffold-midnight.ps1 -Network undeployed
PowerShell -ExecutionPolicy Bypass -File .\scripts\06-run-with-midnight.ps1
~~~

No Linux/WSL:

~~~bash
source ~/.nvm/nvm.sh
cd /caminho/para/rational-gate
npx --yes create-mn-app@0.4.3 midnight-chain --template hello-world --use-npm --skip-git -y
# Depois copie os arquivos de midnight/ para o scaffold conforme scripts/05-scaffold-midnight.ps1.
cd midnight-chain
npm run setup -- --network undeployed
cd ..
bash scripts/run-dev-ordered.sh cli "$(pwd)/midnight-chain"
~~~

O script PowerShell e a rota recomendada porque ele copia automaticamente as
sobrescritas do projeto para o scaffold. O procedimento Linux manual deve ser
feito somente se o senior orientar; compare os arquivos com o script antes de
implantar.

## 9. Preview e Preprod: carteira, faucet, saldo e rede

Esta etapa altera estado local e pode consumir tokens de teste. Faca apenas com
autorizacao do senior e usando sua propria carteira de teste.

Preparar uma carteira Preprod no PowerShell:

~~~powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\05-prepare-midnight-wallet.ps1 -Network preprod
~~~

O comando mostra o endereco publico e o faucet. Cole somente o endereco
publico no faucet. Nao envie seed ou arquivo de estado a ninguem.

Checar saldo no PowerShell:

~~~powershell
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate/midnight-chain && npm run check-balance -- --network preprod"
~~~

Checar saldo no Linux/WSL:

~~~bash
source ~/.nvm/nvm.sh
cd /caminho/para/rational-gate/midnight-chain
npm run check-balance -- --network preprod
~~~

O resultado confiavel e Wallet is funded com saldo de tNight maior que zero.
O primeiro sync pode levar varios minutos; o checkpoint local ajuda as proximas
execucoes.

Ver a rede ativa e o ultimo deployment salvo localmente:

~~~powershell
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate/midnight-chain && npm run network"
$state = Get-Content .\midnight-chain\.midnight-state.json -Raw | ConvertFrom-Json
$state.deployments.preprod | Select-Object address, deployedAt, deployer
~~~

No Linux/WSL:

~~~bash
source ~/.nvm/nvm.sh
cd /caminho/para/rational-gate/midnight-chain
npm run network
~~~

O segundo comando PowerShell le arquivo que contem segredos. Use-o somente na
sua maquina; nao copie a saida inteira para tickets ou chats.

Para validar um contrato que voce mesmo implantou:

~~~powershell
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate/midnight-chain && npm run test:e2e -- --network preprod"
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate/midnight-chain && npm run cli -- security-check --network preprod"
~~~

Nao execute scaffold ou deploy em Preview/Preprod sem autorizacao. Para
demonstrar o contrato compartilhado da equipe, use a maquina controlada pelo
responsavel ou espere o worker persistente planejado.

## 10. Problemas comuns

| Sintoma | Acao inicial |
| --- | --- |
| A tela abre em branco ou mostra erro de API | confira o health e os logs no terminal que iniciou a aplicacao |
| Porta 3333 ou 5173 ocupada | encerre o terminal antigo com Ctrl+C; no PowerShell use Get-NetTCPConnection -LocalPort 3333,5173 |
| API inicia depois do frontend | aguarde alguns segundos e atualize a pagina; os scripts ordenam a inicializacao |
| Midnight demora | o primeiro sync publico pode ser longo; consulte saldo e mantenha o mesmo estado local para retomar checkpoints |
| Wallet is not funded | envie somente o endereco publico ao faucet correto e repita check-balance |
| No deployment for preprod | voce nao tem deployment local proprio; nao copie o estado de outra pessoa, fale com o senior |
| Erro de permissao GitHub | nao crie token amplo; siga GITHUB_APP.md e solicite permissao minima |

## 11. Antes de abrir um pull request

No PowerShell:

~~~powershell
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate && npm test && npm run typecheck && npm run build"
git status --short --ignored
git diff --check
~~~

No Linux:

~~~bash
source ~/.nvm/nvm.sh
npm test
npm run typecheck
npm run build
git status --short --ignored
git diff --check
~~~

Pare se qualquer arquivo de segredo aparecer como nao ignorado. Consulte
[Estado local e segredos](LOCAL_STATE_AND_SECRETS.md) antes de adicionar
arquivos ao commit.
