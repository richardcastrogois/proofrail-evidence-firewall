# Instalação e execução no Windows

Este guia prepara o Proofrail em duas etapas independentes:

- **modo local**: API, interface web, política determinística, criptografia, recibos, Merkle root e MCP;
- **modo Midnight**: tudo do modo local mais node, indexer, proof server e contrato Compact em uma devnet Docker.

Comece pelo modo local. A integração Midnight é opcional e pode ser adicionada depois.

## Convenções usadas pelo projeto

Os comandos deste guia são executados no **PowerShell do Windows**, salvo quando o bloco indicar WSL.

Os exemplos usam o caminho abaixo porque é o caminho desta estação de desenvolvimento. Em outra máquina, substitua-o pela pasta em que o repositório foi clonado; os scripts em `scripts/` detectam a raiz automaticamente.

```text
C:\dev\rational-gate
```

A distribuição WSL padrão é:

```text
Ubuntu
```

Os scripts aceitam outra distribuição com `-Distro`, por exemplo:

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\00-check-prerequisites.ps1 `
  -Mode Local `
  -Distro Ubuntu-24.04
```

Se mudar o caminho ou a distribuição, ajuste também o arquivo local `.codex/config.toml` antes de usar o MCP. A pasta `.codex/` é específica da máquina e não é publicada no GitHub.

## 1. Programas necessários no Windows

### 1.1 WSL 2 e Ubuntu — obrigatório

Verificar:

```powershell
wsl --status
wsl -l -v
```

Instalar, em PowerShell aberto como administrador:

```powershell
wsl --install -d Ubuntu
```

Reinicie o Windows quando solicitado. Na primeira abertura do Ubuntu, crie o usuário e a senha Linux. Essa senha será pedida por comandos `sudo`.

Atualizar o WSL e garantir a versão 2:

```powershell
wsl --update
wsl --set-default-version 2
wsl --set-version Ubuntu 2
```

Se a instalação reclamar de virtualização, habilite a virtualização de hardware no BIOS/UEFI e confirme no Windows:

```powershell
Get-CimInstance Win32_Processor |
  Select-Object VirtualizationFirmwareEnabled,SecondLevelAddressTranslationExtensions
```

### 1.2 Visual Studio Code — recomendado para desenvolvimento

Verificar:

```powershell
code --version
```

Instalar:

```powershell
winget install --exact --id Microsoft.VisualStudioCode
```

### 1.3 Extensão WSL do VS Code — necessária para abrir no Ubuntu

Verificar:

```powershell
code --list-extensions | Select-String '^ms-vscode-remote.remote-wsl$'
```

Instalar:

```powershell
code --install-extension ms-vscode-remote.remote-wsl
```

### 1.4 Docker Desktop — necessário somente para Midnight

Verificar no Windows:

```powershell
docker --version
docker compose version
```

Instalar:

```powershell
winget install --exact --id Docker.DockerDesktop
```

Depois da instalação:

1. abra o Docker Desktop;
2. ative `Use the WSL 2 based engine` nas configurações gerais;
3. abra `Settings > Resources > WSL Integration`;
4. ative a integração para `Ubuntu`;
5. aplique e reinicie o Docker Desktop.

Verificar de dentro do Ubuntu:

```powershell
wsl -d Ubuntu -- docker info
wsl -d Ubuntu -- docker compose version
wsl -d Ubuntu -- docker run --rm hello-world
```

### 1.5 Git para Windows — opcional

O projeto instala Git dentro do Ubuntu. Git para Windows só é necessário se você também quiser trabalhar pelo PowerShell.

Verificar:

```powershell
git --version
```

Instalar:

```powershell
winget install --exact --id Git.Git
```

## 2. Colocar o projeto no caminho esperado

```powershell
New-Item -ItemType Directory -Force C:\dev | Out-Null
Set-Location C:\dev
```

Extraia o ZIP de forma que este arquivo exista:

```text
C:\dev\rational-gate\package.json
```

Depois:

```powershell
Set-Location C:\dev\rational-gate
```

## 3. Preparar o modo local

### 3.1 Conferir o ambiente

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\00-check-prerequisites.ps1 -Mode Local
```

Na primeira execução é esperado que Node ou npm sejam reportados como ausentes.

### 3.2 Instalar Git, ferramentas de compilação, NVM, Node 22 e npm no Ubuntu

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\01-install-wsl-toolchain.ps1 -Mode Local
```

O script pode solicitar a senha Linux criada na primeira abertura do Ubuntu.

Verificar manualmente:

```powershell
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && node --version && npm --version && git --version"
```

O Node deve ser versão 22 ou superior.

Instalação manual equivalente, caso não queira usar o script:

```powershell
wsl -d Ubuntu -- bash -lc "sudo apt-get update && sudo apt-get install -y git curl build-essential ca-certificates unzip"
wsl -d Ubuntu -- bash -lc "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash"
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && nvm install 22 && nvm alias default 22 && nvm use 22"
```

### 3.3 Repetir a verificação local

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\00-check-prerequisites.ps1 -Mode Local
```

O comando termina com código `0` apenas quando os requisitos locais estão válidos.

### 3.4 Instalar as dependências do projeto

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\02-install-project.ps1
```

O script executa `npm ci` dentro do WSL usando o `package-lock.json`. Não execute `npm install` com o Node do Windows na mesma pasta, porque isso pode misturar dependências nativas de Windows e Linux.

### 3.5 Validar antes de iniciar

```powershell
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate && npm test"
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate && npm run typecheck"
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate && npm run build"
```

Esses testes agora incluem o motor das nove políticas e a matriz criptográfica do conector GitHub do Dia 02. Eles não substituem o teste contra um repositório real.

Se esta pasta já foi usada antes do Dia 02, migre uma vez o store antigo antes de reiniciar:

```powershell
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate && npm run store:migrate --workspace @rational/api"
```

O resultado esperado é `schema v4` sem chaves privadas no store público. O comando preserva um backup dentro de `data/private`, que já está ignorado pelo Git.

### 3.6 Opcional: configurar o primeiro conector real

O site funciona sem credenciais no modo laboratório. Para fazer a fonte **Pipeline CI** consultar um repositório e artefato reais, siga [GITHUB_APP.md](GITHUB_APP.md). A API carrega um arquivo `.env` local na inicialização; ele é ignorado pelo Git e nunca deve ser compartilhado.

### 3.7 Abrir no VS Code conectado ao WSL

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\03-open-vscode.ps1
```

O canto inferior esquerdo do VS Code deve mostrar `WSL: Ubuntu`.

### 3.8 Executar API e frontend

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\04-run-local.ps1
```

O comando fica em primeiro plano. Use `Ctrl+C` para encerrar.

Abrir:

- interface: <http://localhost:5173>;
- health check: <http://localhost:3333/api/health>.

Verificar a API pelo PowerShell:

```powershell
Invoke-RestMethod http://127.0.0.1:3333/api/health
```

## 4. Roteiro funcional da demonstração local

1. Escolha uma das nove políticas. **Agente + Deploy** é o piloto principal.
2. Registre a alegação do agente e avalie sem fontes: o esperado é `DENY`.
3. Confirme identidade, política de ferramentas, CI e scanner: em produção/risco 45, o esperado é `REVIEW_REQUIRED`.
4. Confirme a aprovação responsável e avalie: o esperado é `ALLOW` com âncora e permit.
5. Reinicie e simule conflito no CI ou scanner: o esperado é `DENY`.
6. Execute o permit e confirme que ele não pode ser consumido duas vezes.
7. Destrua as chaves e confirme que os dados brutos acessíveis caem para zero.
8. Para uma apresentação curta, reinicie e use `Rodar trilha completa`.

O tutorial de cliques e o significado de cada retorno estão em `GUIA_DO_PROJETO.md`.

## 5. Adicionar a integração Midnight

### 5.1 Instalar Compact no Ubuntu

O script reutiliza Node 22, instala o Compact devtools 0.5.1 e seleciona o compilador 0.31.1 esperado pelo scaffold fixado:

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\01-install-wsl-toolchain.ps1 -Mode Midnight
```

Verificar:

```powershell
wsl -d Ubuntu -- bash -lc 'source "$HOME/.local/bin/env"; compact --version && compact compile --version'
```

Instalação manual:

```powershell
wsl -d Ubuntu -- bash -lc "curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/download/compact-v0.5.1/compact-installer.sh | sh"
wsl -d Ubuntu -- bash -lc 'source "$HOME/.local/bin/env"; compact update 0.31.1'
```

### 5.2 Validar todos os requisitos Midnight

Com o Docker Desktop aberto:

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\00-check-prerequisites.ps1 -Mode Midnight
```

Essa verificação exige Docker Engine acessível no WSL, Docker Compose v2, Git, curl, Node 22+, npm e Compact.

### 5.3 Criar e implantar o contrato local

Feche o servidor local com `Ctrl+C` ou abra outro PowerShell:

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\05-scaffold-midnight.ps1
```

O script:

1. usa `create-mn-app@0.4.3` para evitar mudanças inesperadas do scaffold;
2. cria `midnight-chain`;
3. verifica se a estrutura esperada existe;
4. substitui o contrato Hello World pelo contrato Proofrail;
5. substitui a CLI;
6. executa `npm run setup`, que inicia a devnet Docker, compila e implanta;
7. grava o estado em `midnight-chain/.midnight-state.json`.

A primeira execução baixa imagens Docker e gera artefatos ZK, podendo consumir vários minutos e espaço em disco.

### 5.4 Preparar Testnet/Preview e Preprod

Cada ambiente tem carteira, fundos de teste e endereço de contrato próprios. O seletor da tela só pode usar uma rede depois que ela tiver um contrato implantado.

Faça **Preview/Testnet primeiro**. No PowerShell, dentro de `C:\dev\rational-gate`, gere a carteira e mostre o endereço público sem sincronizar a blockchain:

```powershell
& .\scripts\05-prepare-midnight-wallet.ps1 -Network preview
```

Copie apenas o valor de `Endereco publico`, abra o faucet Preview e solicite tNIGHT. Não abra nem copie a seed gravada em `.midnight-state.json`.

Depois que o faucet confirmar o envio, compile, sincronize, gere tDUST e implante o contrato:

```powershell
& .\scripts\05-scaffold-midnight.ps1 -Network preview
```

Essa segunda etapa pode levar vários minutos. Em uma carteira nova, a sincronização inicial da rede pública pode chegar perto de uma hora. O script mantém o terminal aberto, registra UTXOs de tNIGHT para geração de tDUST, usa o proof server local, implanta o contrato e grava o endereço.

Somente depois de validar todo o fluxo na Testnet, repita para Preprod:

```powershell
& .\scripts\05-prepare-midnight-wallet.ps1 -Network preprod
# solicite tNIGHT no faucet Preprod e espere o envio
& .\scripts\05-scaffold-midnight.ps1 -Network preprod
```

- Preview faucet: <https://midnight-tmnight-preview.nethermind.dev>
- Preprod faucet: <https://midnight-tmnight-preprod.nethermind.dev>

Portanto, faucet não é a única etapa. Ele fornece tNIGHT de teste; o projeto ainda precisa sincronizar a carteira, registrar tNIGHT para gerar tDUST, produzir a prova e implantar uma cópia do contrato em cada rede. Tudo isso, exceto a interação humana com o faucet, é executado pelo script de implantação.

Não compartilhe nem envie ao Git o arquivo `midnight-chain/.midnight-state.json`: ele contém a seed local da carteira. A troca de rede na interface muda endpoints, carteira e contrato ativos para as próximas transações; ela não copia contratos ou saldos entre ambientes.

### 5.5 Executar com ancoragem Midnight

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\06-run-with-midnight.ps1
```

Nesse modo, a API usa `MIDNIGHT_MODE=cli` e chama a CLI em `midnight-chain`. Deixe o terminal aberto: ele mostra os logs `[API]` e `[WEB]`. Use `Ctrl+C` para parar.

Na tela, clique em **Local**, **Testnet** ou **Preprod**. Um ponto verde indica que há contrato implantado. Se não houver, a própria tela exibe o comando de preparação.

Confirme no terminal que o servidor está realmente usando a CLI Midnight:

```powershell
Invoke-RestMethod http://127.0.0.1:3333/api/health
```

O retorno correto contém `mode : cli`. `mode : local` significa que o simulador foi iniciado por engano com `04-run-local.ps1` ou `npm run dev`.

## 6. Conectar o MCP ao Codex

O projeto contém `.codex/config.toml` preparado para o caminho e distribuição padrão. Abra `C:\dev\rational-gate` como projeto confiável no Codex e mantenha a API executando.

O servidor MCP expõe:

- `get_proofrail_state`;
- `select_proofrail_scenario`;
- `select_midnight_network`;
- `run_proofrail_simulation`;
- `execute_action_permit`;
- `expire_raw_evidence`;
- `reset_proofrail_lab`.

O servidor MCP não precisa de chave de API de IA. Ele é um adaptador determinístico para a API local.

## 7. Variáveis de ambiente

Os scripts já fornecem os valores necessários. Para execução manual, copie `.env.example` para `.env` e exporte as variáveis no shell; o código não carrega `.env` automaticamente.

| Variável | Padrão | Uso |
|---|---|---|
| `PORT` | `3333` | Porta da API |
| `HOST` | `127.0.0.1` | Interface da API |
| `PROOFRAIL_API_URL` | `http://127.0.0.1:3333` | URL preferida pelo MCP |
| `RATIONAL_API_URL` | `http://127.0.0.1:3333` | Alias legado aceito pelo MCP |
| `MIDNIGHT_MODE` | `local` | `local` ou `cli` |
| `MIDNIGHT_CHAIN_DIR` | caminho WSL de `midnight-chain` | Obrigatório em modo `cli` |
| `MIDNIGHT_CLI_TIMEOUT_MS` | `360000` | Limite para sincronizar, provar e enviar uma transação Midnight |
| `DATA_DIR` | `data` na raiz | Sobrescreve o diretório de persistência |

## 8. Comandos úteis

```powershell
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate && npm run dev:api"
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate && npm run dev:web"
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate && npm run dev:mcp"
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate && npm run reset"
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate/midnight-chain && npm run network"
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate/midnight-chain && npm run cli -- read"
```

## 9. Problemas comuns

### A distribuição não se chama `Ubuntu`

Descubra o nome:

```powershell
wsl -l -v
```

Passe o nome aos scripts com `-Distro` e atualize `.codex/config.toml`.

### Docker não responde dentro do Ubuntu

Abra o Docker Desktop, aguarde o engine iniciar e habilite `Resources > WSL Integration` para a distribuição correta.

### `compact: command not found`

```powershell
wsl -d Ubuntu -- bash -lc 'source "$HOME/.local/bin/env"; compact --version'
```

### Porta ocupada

```powershell
Get-NetTCPConnection -LocalPort 3333 -ErrorAction SilentlyContinue
Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
Get-NetTCPConnection -LocalPort 6300 -ErrorAction SilentlyContinue
```

Os scripts de inicialização agora recusam abrir uma segunda cópia quando `3333` ou `5173` já estão ocupadas. Volte ao PowerShell que está exibindo `[API]` e `[WEB]`, pressione `Ctrl+C` e só então inicie novamente.

Se o navegador continuar mostrando oito cenários ou o antigo fluxo de pagamento, a porta `5173` está servindo uma instância anterior. Não valide essa tela: encerre o terminal antigo com `Ctrl+C`, confirme que as portas foram liberadas com os comandos acima e execute novamente o script de inicialização. A versão do Dia 01 inicia em **Agente + Deploy** e mostra **9 políticas**.

### As animações não aparecem

O Windows ou o navegador pode solicitar movimento reduzido. O Proofrail mantém uma preferência própria para a demonstração: use o botão **Movimento: completo** no canto inferior direito. Ele habilita as transições de tela, a rolagem suave e a montagem reversível das seções; **Movimento: reduzido** remove esses efeitos.

### Recriar a devnet Midnight

Este comando remove volumes e o estado da devnet local. Use apenas quando quiser recriar o ambiente Midnight:

```powershell
wsl -d Ubuntu -- bash -lc "cd /mnt/c/dev/rational-gate/midnight-chain && docker compose down -v"
wsl -d Ubuntu -- bash -lc "cd /mnt/c/dev/rational-gate/midnight-chain && npm run setup"
```

### Dependências foram instaladas pelo Node do Windows

Não reutilize esse `node_modules` dentro do WSL. Remova-o de forma consciente e execute novamente `scripts\02-install-project.ps1` dentro do fluxo WSL.

## 10. Referências oficiais

- [Instalar WSL — Microsoft](https://learn.microsoft.com/windows/wsl/install)
- [Desenvolvimento com WSL no VS Code](https://code.visualstudio.com/docs/remote/wsl)
- [Docker Desktop com WSL 2](https://docs.docker.com/desktop/features/wsl/)
- [Instalação da toolchain Midnight](https://docs.midnight.network/getting-started/installation)
- [`create-mn-app`](https://github.com/midnightntwrk/create-mn-app)
- [Compact devtools 0.5.1](https://github.com/midnightntwrk/compact/releases/tag/compact-v0.5.1)
