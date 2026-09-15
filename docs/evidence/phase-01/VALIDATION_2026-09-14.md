# Evidência textual — 14/09/2026

Registro sanitizado da validação executada na branch `codex/hackathon`. Este
arquivo não substitui os screenshots e o vídeo finais, mas preserva resultados
reproduzíveis sem incluir segredos.

## Git

```text
local HEAD:                 77d04bfe7e228845a361432f12d8c69433df294d
origin/codex/hackathon:     77d04bfe7e228845a361432f12d8c69433df294d
gitlab/codex/hackathon:     086309f6b9d4236f011915dc13553d6d4f5b9cb1
GitLab comparado ao GitHub: 0 1
```

No baseline anterior à publicação, o acesso anônimo aos dois remotes exigia
autenticação e o GitLab ainda não continha o commit da reorganização.

### Auditoria preparatória para tornar o GitHub público

- o histórico alcançável identifica contribuições de Richard e Pedro;
- os três mantenedores confirmaram a decisão Apache-2.0 antes da criação do
  arquivo `LICENSE` na raiz;
- nenhum arquivo de chave privada, carteira, mnemonic ou credencial foi
  encontrado entre os nomes versionados; somente `.env.example` aparece na
  família `.env`;
- a busca por formatos de alta confiança de chaves privadas e tokens GitHub,
  GitLab, AWS e Slack não encontrou ocorrência no histórico alcançável;
- o scanner dedicado `gitleaks` não está instalado, portanto a busca por
  padrões não substitui uma varredura de entropia/segredos do provedor;
- objetos locais inalcançáveis não fazem parte do histórico que será enviado,
  mas também não foram usados como evidência de segurança.

O `LICENSE` foi criado somente depois da anuência dos três mantenedores.

### Publicação inicial da frente Dev 1

```text
commit Docker:  b0782d5cdba6ec26cde9a01d79db75bfb3ac022e
GitLab MR:      !6 (codex/hackathon -> main)
pipeline:       #2848618827
verify:         passou
docker-build:   passou
merge:          não realizado
```

O segundo commit desta frente contém a documentação, a licença e o grafo
atualizado. Por isso, o aceite final exige conferir a pipeline nova criada
depois do respectivo push, e não apenas a execução `#2848618827` acima.

### Publicação do GitHub

Após a revisão do histórico e a autorização dos três mantenedores:

```text
visibilidade:        Public
branch sem login:    codex/hackathon acessível
tópico obrigatório: midnightntwrk visível sem login
```

A verificação anônima foi feita em uma sessão separada, cuja navegação oferecia
`Sign in` e `Sign up`, e mostrou a branch reorganizada com `frontend/`,
`backend/`, `worker/`, `docker-compose.yml` e o tópico exato. Após o push final,
o mesmo teste deve confirmar também `LICENSE` e os documentos desta frente.

## CI local

Passaram:

```text
npm ci
npm run db:generate
npm run db:validate
npm audit --omit=dev --audit-level=high
npm test
npm run typecheck
npm run build
```

Testes observados: contratos da API, autenticação de serviço, configuração de
runtime, aprovação, executor controlado, integração GitHub, webhook, migração do
store e core com nove cenários.

O audit de produção encontrou uma vulnerabilidade moderada indireta em `hono`.
O gate configurado passa porque bloqueia a partir da severidade alta.

## Docker

```text
docker compose config --quiet:                 passou
docker compose --profile worker config --quiet: passou
frontend image:                                build passou
backend image:                                 build passou
worker image:                                  build passou
worker runtime detached:                       iniciou e encerrou com codigo 0 (MCP stdio sem cliente)
PostgreSQL:                                    healthy
backend:                                       healthy
frontend:                                      healthy
GET http://127.0.0.1:8080:                     200
GET http://127.0.0.1:3333/api/health:           200
frontend image:                                20,28 MiB
backend image:                                 211,73 MiB
worker image:                                  193,07 MiB
```

Resposta sanitizada da API:

```json
{"ok":true,"service":"proofrail-api","apiMode":"limited","mode":"local","network":"undeployed"}
```

## Compact e Midnight

Ambiente confirmado:

```text
WSL:              Ubuntu / WSL 2
Node no WSL:      v22.23.1
npm no WSL:       10.9.8
Compact compiler: 0.31.1
Docker Compose:   v2.40.3-desktop.1
```

Compilação:

```text
npm run compile
Compiling 3 circuits
registerDecision: artefatos gerados
rotateRegistrar: artefatos gerados
revokeRegistrar: artefatos gerados
```

Consulta pública somente leitura:

```text
e2e-check: querying indexer (1/8)...
e2e-check passed
contractAddress: 9a1a5ae1cbb7bd5a64e649c5c9b63c9740907df53a2a1a0ba98f8e3a1b33fdd5
network: preprod
```

A consulta de saldo Preprod chegou a `Building wallet (attempt 1/1)...`, mas
foi interrompida após alguns minutos sem snapshot final. Nenhum faucet foi
solicitado e nenhuma transação foi enviada nesta validação. Portanto, saldo,
DUST e uma nova âncora permanecem pendentes de evidência atual.
