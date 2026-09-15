# Guia de validação do GitLab

Este guia explica como confirmar que o código esperado chegou ao GitLab e como
reproduzir localmente o mesmo gate definido em `.gitlab-ci.yml`. Ele não exige
copiar tokens, chaves ou variáveis protegidas.

## Baseline encontrado antes da publicação em 14/09/2026

| Verificação | Resultado |
| --- | --- |
| Branch local | `codex/hackathon` em `77d04bfe7e228845a361432f12d8c69433df294d` |
| GitHub `codex/hackathon` | mesmo commit `77d04bf` |
| GitLab `codex/hackathon` | `086309f6b9d4236f011915dc13553d6d4f5b9cb1` |
| Diferença | GitLab está um commit atrás |
| Acesso anônimo | GitHub e GitLab solicitaram autenticação; não atendem hoje ao requisito de repositório GitHub público |
| Pipeline do commit `77d04bf` no GitLab | não existe enquanto o commit não for enviado ao GitLab |
| Validação local equivalente ao job `verify` | passou |
| Build das três imagens | passou |
| Stack local | PostgreSQL, backend e frontend saudáveis; `/` e `/api/health` responderam `200` |

Esse era o estado de entrada da frente Dev 1. A seção seguinte permanece como
runbook reproduzível; o resultado final da publicação deve ser conferido pelo
SHA da Merge Request, não inferido a partir deste snapshot histórico.

## Resultado da frente Dev 1

O primeiro commit da frente foi publicado nos dois remotes e validado no
GitLab antes do commit documental final:

| Item | Resultado |
| --- | --- |
| Commit de runtime Docker | `b0782d5cdba6ec26cde9a01d79db75bfb3ac022e` |
| Merge Request | `!6` — `codex/hackathon` para `main` |
| Pipeline | `#2848618827` |
| Job `verify` | passou |
| Job `docker-build` | passou |
| GitHub público | confirmado em sessão separada sem login |
| Tópico obrigatório | `midnightntwrk` confirmado sem login |

O MR foi mantido aberto e sem merge. O commit documental final deve provocar
uma nova pipeline; a equipe deve conferir o SHA e os dois jobs dessa execução
mais recente antes de fazer merge ou submeter o projeto.

## 1. Conferir branch e remotes sem alterar o código

Na raiz do repositório:

```powershell
git status --short --branch
git remote -v
git fetch --prune origin
git fetch --prune gitlab
git rev-parse HEAD
git rev-parse origin/codex/hackathon
git rev-parse gitlab/codex/hackathon
git rev-list --left-right --count gitlab/codex/hackathon...origin/codex/hackathon
```

Interpretação do último comando:

- `0 0`: as duas branches apontam para o mesmo histórico;
- `0 1`: GitHub está um commit à frente do GitLab;
- `1 0`: GitLab está um commit à frente do GitHub;
- números nos dois lados: os históricos divergiram; não use push forçado.

Para ver exatamente o que falta no GitLab:

```powershell
git log --oneline gitlab/codex/hackathon..origin/codex/hackathon
git diff --stat gitlab/codex/hackathon..origin/codex/hackathon
```

## 2. Reproduzir localmente o job `verify`

Use Node 22. O script de pré-requisitos confirma a versão no WSL:

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\00-check-prerequisites.ps1 -Mode Midnight
```

No WSL, a mesma ordem do GitLab CI é:

```powershell
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate && npm ci"
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate && npm run db:generate"
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate && DATABASE_URL='postgresql://proofrail:proofrail@localhost:5432/proofrail' DATABASE_URL_UNPOOLED='postgresql://proofrail:proofrail@localhost:5432/proofrail' npm run db:validate"
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate && npm audit --omit=dev --audit-level=high"
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate && npm test"
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate && npm run typecheck"
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate && npm run build"
```

O audit verificado em 14/09/2026 encontrou uma vulnerabilidade moderada em uma
dependência `hono`. O gate atual passa porque bloqueia a partir de severidade
alta. Isso é risco conhecido, não resultado de “zero vulnerabilidades”.

## 3. Validar Docker antes do GitLab

```powershell
docker compose config --quiet
docker compose --profile worker config --quiet
docker compose --profile worker build
docker compose up -d --wait
docker compose ps
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8080
Invoke-RestMethod http://127.0.0.1:3333/api/health
docker compose down
```

Não use `docker compose down -v` durante uma verificação normal: `-v` também
remove o volume do PostgreSQL.

## 4. Publicar a branch no GitLab

Somente depois de revisar `git status`, `git diff` e os resultados anteriores:

```powershell
git push gitlab codex/hackathon
```

Não use `--force`. Depois, abra uma Merge Request de `codex/hackathon` para a
branch padrão.

A regra atual de `.gitlab-ci.yml` cria pipeline apenas para:

- evento de Merge Request; ou
- commit na branch padrão.

Um push isolado em `codex/hackathon` sem Merge Request não dispara a pipeline.
Na Merge Request, `verify` e `docker-build` devem executar; as imagens são
construídas, mas só são publicadas no Container Registry quando o commit está na
branch padrão.

## 5. O que conferir na interface do GitLab

1. Em **Code > Branches**, confirme que `codex/hackathon` aponta para o SHA esperado.
2. Em **Build > Pipelines**, abra a pipeline da Merge Request.
3. Confirme os jobs `verify` e `docker-build` verdes.
4. No job `verify`, confira instalação, Prisma generate/validate, audit, testes,
   typecheck e build.
5. Baixe o artifact `frontend/dist` e confirme que não está vazio.
6. No `docker-build`, confirme as três imagens: `frontend`, `backend` e `worker`.
7. Depois do merge na branch padrão, confira as tags por SHA e `latest` no
   Container Registry.

Nunca copie para issues, logs ou documentação variáveis mascaradas, tokens do
registry, seeds Midnight, PEMs ou conteúdo de `data/private`.

## Critério de aceite

Considere a validação GitLab concluída somente quando:

- GitLab contém o commit revisado;
- a Merge Request aponta para a branch e o SHA corretos;
- a pipeline desse SHA está verde;
- o artifact web foi produzido;
- as três imagens foram construídas;
- os logs não expõem segredos;
- a branch pública de submissão no GitHub contém o mesmo conteúdo aprovado.
