# Conector GitHub App

Este conector substitui **somente a evidência Pipeline CI** do cenário
`agent_deploy`. Identidade corporativa, política de ferramenta e scanner ainda
precisam de conectores próprios. A aprovação assinada e o executor staging
existem, mas usam identidades/credenciais separadas deste App.

> Não amplie este GitHub App para `Actions: write`. O executor usa
> `PROOFRAIL_EXECUTOR_GITHUB_TOKEN`, limitado ao repositório da allowlist, e
> nunca reutiliza a credencial de verificação CI.

## O que ele comprova

O Proofrail só emite o recibo de CI quando todas estas condições são verdadeiras:

1. o agente assinou a ação completa com a chave cadastrada para seu `agentId`;
2. o repositório está na allowlist;
3. um webhook `workflow_run` chegou com HMAC válido e `X-GitHub-Delivery` ainda não processado;
4. o webhook pertence à instalação esperada, ao repositório e ao SHA da ação;
5. a API do GitHub confirma o workflow `completed` com `conclusion: success`;
6. um artefato não expirado do mesmo run possui exatamente o digest `sha256:` da ação.

O recibo final é assinado pela origem local `ci-agent-deploy`. Essa assinatura significa “o adaptador Proofrail verificou estes dados no GitHub”; não é uma assinatura nativa do GitHub.

## 1. Criar o GitHub App

No GitHub, abra **Settings > Developer settings > GitHub Apps > New GitHub App**.

Configure:

- **Webhook URL:** `https://SEU-ENDERECO/api/integrations/github/webhook`;
- **Webhook secret:** um segredo aleatório e exclusivo;
- **Repository permissions > Actions:** `Read-only`;
- **Subscribe to events:** `Workflow run`;
- não conceda `Contents: write`, `Actions: write`, `Administration` ou permissões organizacionais.

O GitHub concede acesso básico de metadata automaticamente. Instale o App apenas no repositório de teste escolhido. Guarde:

- **App ID** da página do App;
- **Installation ID**, o número no final da URL da instalação;
- a chave privada PEM gerada na seção **Private keys**.

Para desenvolvimento em `localhost`, o GitHub não alcança `127.0.0.1`. Use um túnel HTTPS temporário de sua confiança ou implante a API em uma URL HTTPS de teste. Nunca exponha a API sem os controles do webhook e sem restringir o repositório.

## 2. Criar a identidade do agente de desenvolvimento

No PowerShell, entre na pasta em que clonou o projeto. Os comandos abaixo usam `C:\dev\rational-gate`, que é somente o exemplo desta estação; substitua o caminho se sua cópia estiver em outro local.

```powershell
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate && npm run agent:keygen --workspace @rational/api -- agent-release-01"
```

O comando cria:

- `data/private/agents/agent-release-01.private.pem` — segredo; não compartilhar;
- `data/private/agents/agent-release-01.public.pem` — chave que a API pode confiar;
- uma linha `PROOFRAIL_AGENT_PUBLIC_KEYS_JSON=...` para a configuração.

Ele recusa sobrescrever uma identidade existente. Em produção, a chave privada deve pertencer ao agente/workload identity e ficar em KMS/HSM, não no mesmo host da API.

## 3. Configurar `.env`

Copie `.env.example` para `.env`. O servidor Node carrega esse arquivo somente para desenvolvimento local; variáveis já definidas no ambiente têm precedência.

Converta o PEM do GitHub App para base64 sem imprimi-lo no terminal:

```powershell
$env:GITHUB_APP_PRIVATE_KEY_BASE64 = [Convert]::ToBase64String(
  [IO.File]::ReadAllBytes("C:\caminho\seu-github-app.private-key.pem")
)
```

Preencha `.env`:

```dotenv
GITHUB_APP_ID=123456
GITHUB_INSTALLATION_ID=7890123
GITHUB_APP_PRIVATE_KEY_BASE64=<base64-do-pem>
GITHUB_WEBHOOK_SECRET=<defina-no-ambiente>
GITHUB_ALLOWED_REPOSITORIES=empresa/repositorio
GITHUB_REQUIRE_WEBHOOK=true
PROOFRAIL_AGENT_PUBLIC_KEYS_JSON='{"agent-release-01":["-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"]}'
```

O `.env`, `data/private` e o estado da carteira estão no `.gitignore`. Não copie esses valores para documentação, prints, logs ou commits.

## 4. Iniciar e conferir o estado

Se o projeto já estava aberto antes de configurar o conector, volte ao PowerShell
que o iniciou, pressione `Ctrl+C` uma vez e execute novamente o comando abaixo.
Uma API anterior pode continuar respondendo sem conhecer `integrations.github`.

Antes do primeiro reinício, você também pode executar explicitamente a migração segura do estado:

```powershell
npm run store:migrate --workspace @rational/api
```

O comando aceita os stores legados suportados (`v3`, `v4` e `v5`), preserva o
backup privado aplicavel, move as chaves de assinatura para
`data/private/signing-secrets.json` e confirma que `data/store.json` ficou no
schema `v6` sem chave privada. Se o estado antigo estiver incompleto, ele falha
sem gerar novas identidades silenciosamente.

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\06-run-with-midnight.ps1
```

Em outro PowerShell:

```powershell
$state = Invoke-RestMethod http://127.0.0.1:3333/api/state
$state.integrations.github | Format-List
```

O esperado é `configured: True`. Se for `False`, `missingConfiguration` mostra apenas os nomes das variáveis ausentes, nunca seus valores.

Na tela **Demonstração**, o cartão de integração também mostra o estado. Os
botões “Simular confirmação/conflito” continuam deliberadamente didáticos; o
conector real é chamado por API ou MCP.

## 5. Preparar e assinar uma ação real

O SHA e o digest padrão da demonstração são fictícios. Substitua pelos valores do seu workflow real e preserve a igualdade entre `referenceId` e `deployment.commitSha`.

```powershell
$state = Invoke-RestMethod http://127.0.0.1:3333/api/state
$action = $state.defaultAction
$action.deployment.repository = "empresa/repositorio"
$action.deployment.commitSha = "SHA_DE_40_HEXADECIMAIS"
$action.referenceId = $action.deployment.commitSha
$action.deployment.artifactDigest = "sha256:DIGEST_DE_64_HEXADECIMAIS"
$action | ConvertTo-Json -Depth 10 | Set-Content .\data\private\action.json -Encoding utf8

$signature = wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate && npm run --silent agent:sign --workspace @rational/api -- agent-release-01 /mnt/c/dev/rational-gate/data/private/action.json" | Select-Object -Last 1
```

A assinatura cobre o propósito `proofrail-agent-action-v1` e toda a ação canônica. Alterar agente, SHA, digest, serviço, ambiente, risco, nonce ou `requestId` invalida a assinatura.

## 6. Entregar o webhook e verificar o CI

O repositório já inclui `.github/workflows/ci.yml`. Ele instala pelo lockfile, audita dependências de produção, executa testes, typecheck e build e publica o artefato `proofrail-web`. Ao final da execução, abra o **Job summary** e copie o valor `sha256:...` exibido em **Proofrail artifact digest** para `deployment.artifactDigest`.

Execute o workflow para o SHA informado. Com a API acessível na Webhook URL, aguarde o evento ou use **Recent deliveries > Redeliver** na configuração do App.

Depois:

```powershell
$requestBody = @{ action = $action } | ConvertTo-Json -Depth 12
Invoke-RestMethod http://127.0.0.1:3333/api/integrations/github/verify-ci `
  -Method Post `
  -ContentType 'application/json' `
  -Headers @{ 'X-Proofrail-Agent-Signature' = $signature } `
  -Body $requestBody
```

O retorno contém `receipt.verified = true`. A auditoria recebe `GITHUB_WORKFLOW_RECEIVED` e `GITHUB_CI_EVIDENCE_VERIFIED`.

## Matriz negativa obrigatória

Antes de considerar a integração aceita, confirme:

| Teste | Resultado esperado |
|---|---|
| assinatura ausente ou alterada | HTTP 401 |
| repositório fora da allowlist | rejeitado |
| webhook com HMAC inválido | HTTP 401 |
| mesmo `X-GitHub-Delivery` e mesmo corpo reenviado | aceito como duplicado, sem novo evento |
| mesmo `X-GitHub-Delivery` com conteúdo diferente | HTTP 409; nada novo é persistido |
| SHA diferente do webhook/workflow | rejeitado |
| workflow pendente, cancelado ou falho | rejeitado |
| digest diferente ou artefato expirado | rejeitado |
| ação alterada depois da assinatura | HTTP 401 |
| recibo válido repetido para a mesma ação | reutilizado sem nova evidência |
| recibo armazenado com assinatura adulterada | não é reutilizado; GitHub é consultado novamente |

Os testes automatizados sem credenciais rodam com:

```powershell
npm test
```

## Referências oficiais

- [Validating webhook deliveries](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)
- [Best practices for using webhooks](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks)
- [Authenticating as a GitHub App installation](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation)
- [Workflow runs REST API](https://docs.github.com/en/rest/actions/workflow-runs?apiVersion=2026-03-10)
- [Artifacts REST API](https://docs.github.com/en/rest/actions/artifacts?apiVersion=2026-03-10)
