# Reorganizacao e Docker

Este documento registra a reorganizacao recente do repositorio e a nova base de Docker para que o time saiba como rodar, testar e evoluir os servicos.

## O Que Mudou

- `apps/web` foi movido para `frontend`.
- `apps/api` foi movido para `backend`.
- `apps/mcp` foi movido para `worker`.
- A Vercel passou a publicar somente o frontend.
- O backend ficou preparado para deploy separado, como Render ou outro host de containers.
- O worker ficou separado e opcional no Compose.
- A pasta `api/` da raiz foi mantida temporariamente, mas nao e mais usada pelo `vercel.json`.

## Estrutura Atual

```text
frontend/          # Aplicacao React/Vite, deploy principal na Vercel
backend/           # API Fastify e comandos de operacao
worker/            # Processo MCP/worker auxiliar
packages/          # Pacotes internos compartilhados
scripts/           # Scripts de instalacao, validacao e deploy
docs/              # Documentacao tecnica e operacional
midnight/          # Fonte versionada dos overrides e contrato Midnight
api/               # Compatibilidade temporaria com Vercel Functions antigas
docker-compose.yml # Stack local com frontend, backend e PostgreSQL
```

## Docker

Foram adicionados arquivos separados por fronteira de runtime:

```text
.dockerignore
frontend/Dockerfile
frontend/nginx.conf
backend/Dockerfile
worker/Dockerfile
docker-compose.yml
```

### Frontend

`frontend/Dockerfile` faz build do Vite e serve os arquivos estaticos com Nginx na porta `8080`.

Uso principal:

- preview local via Docker;
- build de imagem no GitLab;
- validacao de que o bundle estatico esta isolado do backend.

A Vercel continua usando `vercel.json` e `frontend/dist`, sem depender de Docker.

### Backend

`backend/Dockerfile` roda a API Fastify na porta `3333` usando `HOST=0.0.0.0`.

Uso principal:

- deploy em Render ou outro host de containers;
- build e publicacao no GitLab Container Registry;
- execucao local integrada com PostgreSQL via Compose.

Quando `PROOFRAIL_STORE=postgres`, o container executa `prisma migrate deploy` antes de iniciar a API.

### Worker

`worker/Dockerfile` empacota o processo MCP/worker atual.

Importante: o worker atual usa MCP via stdio e ainda nao e o worker assincrono definitivo de producao. Por isso, no Compose ele fica atras de profile opcional.

## Docker Compose

O `docker-compose.yml` sobe a stack local principal:

- `postgres`: PostgreSQL local para o backend;
- `backend`: API Fastify em `http://localhost:3333`;
- `frontend`: frontend em `http://localhost:8080`;
- `worker`: opcional via profile.

Subir stack padrao:

```bash
npm run docker:up
```

ou:

```bash
docker compose up --build
```

Subir tambem o worker:

```bash
docker compose --profile worker up --build
```

Buildar imagens:

```bash
npm run docker:build
```

ou:

```bash
docker compose build
```

## Portas Locais

| Servico | Porta | URL |
| --- | --- | --- |
| Frontend | `8080` | `http://localhost:8080` |
| Backend | `3333` | `http://localhost:3333` |
| Healthcheck backend | `3333` | `http://localhost:3333/api/health` |
| PostgreSQL | `5432` | `localhost:5432` |

## GitLab CI

O `.gitlab-ci.yml` agora possui dois stages:

```text
verify
docker-build
```

O stage `verify` continua rodando:

- instalacao por lockfile;
- Prisma generate;
- Prisma validate;
- audit;
- testes;
- typecheck;
- build.

O stage `docker-build` builda tres imagens separadas:

```text
$CI_REGISTRY_IMAGE/frontend:$CI_COMMIT_SHA
$CI_REGISTRY_IMAGE/backend:$CI_COMMIT_SHA
$CI_REGISTRY_IMAGE/worker:$CI_COMMIT_SHA
```

Na branch principal, tambem publica as tags `latest` correspondentes.

## Deploy

### Vercel

A Vercel publica somente o frontend:

- build command: definido em `vercel.json`;
- output: `frontend/dist`;
- API serverless nao faz mais parte do deploy da Vercel.

Quando o backend estiver hospedado, configurar no projeto Vercel:

```text
VITE_API_URL=https://url-do-backend
```

Sem `VITE_API_URL`, o frontend permanece em modo seguro frontend-only.

### Backend em Render ou Similar

Usar `backend/Dockerfile`.

Variaveis esperadas:

```text
HOST=0.0.0.0
PORT=<porta definida pelo provedor>
DATABASE_URL=<url do banco>
DATABASE_URL_UNPOOLED=<url direta do banco>
PROOFRAIL_STORE=postgres
PROOFRAIL_PUBLIC_ORIGINS=https://dominio-do-frontend
MIDNIGHT_MODE=local
```

Healthcheck sugerido:

```text
/api/health
```

### Worker Futuro

O worker de producao ainda precisa evoluir para consumidor assincrono real.

Ele deve ficar fora da Vercel e deve manter isolados:

- carteira;
- estado Midnight;
- proof server;
- segredos de registrador;
- credenciais de servico.

## Validacoes Ja Executadas

As seguintes validacoes passaram apos a reorganizacao:

```bash
npm run db:generate
npm run typecheck
npm test
npm run build
docker compose config
git diff --check
```

Tambem foi confirmado build Docker local dos servicos padrao do Compose:

```text
frontend: build OK
backend: build OK
```

O worker deve ser validado separadamente com:

```bash
docker compose --profile worker build
```

## Midnight

A pasta `midnight/` faz sentido e deve continuar versionada.

Ela guarda:

- contrato Compact;
- overrides do scaffold Midnight;
- ajustes de Compose para proof server;
- documentacao local da integracao.

A pasta que nao deve ser versionada e `midnight-chain/`, pois pode conter estado sensivel.

## Cuidados De Seguranca

Nao commitar:

- `.env`;
- `.env.local`;
- `data/private/`;
- `midnight-chain/`;
- `.midnight-state.json`;
- `.midnight-wallet-state`;
- seeds, mnemonics, PEMs, tokens ou chaves privadas.

Nao expor publicamente:

- proof server;
- carteira;
- estado Midnight;
- segredos de registrador;
- endpoint interno de prova.

## Proximos Passos Recomendados

1. Commitar a reorganizacao e Docker.
2. Testar `docker compose up --build` com Docker Desktop ativo.
3. Testar o fluxo Midnight local com `undeployed` antes de `preprod`.
4. Escolher o host do backend, como Render.
5. Configurar `VITE_API_URL` na Vercel apontando para o backend hospedado.
6. Planejar o worker assincrono real separado do MCP atual.
