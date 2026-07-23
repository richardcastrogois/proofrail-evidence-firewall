# Publicação segura no GitHub

Use este checklist no PowerShell, dentro da pasta do projeto. Ele não envia nenhum arquivo automaticamente.

## 1. Conferir o que está protegido

```powershell
git status --short --ignored
git check-ignore -v .codex/config.toml data/private/signing-secrets.json data/store.json midnight-chain/.midnight-state.json node_modules apps/web/dist .env
```

Os caminhos sensíveis devem aparecer com `!!` no primeiro comando e com a regra correspondente de `.gitignore` no segundo. Nunca use `git add -f` nesses arquivos.

## 2. Preparar o primeiro commit

```powershell
git add .
git status --short
git diff --cached --check
git diff --cached --name-only
```

Antes do commit, confirme que não aparecem `.env`, `.codex/`, `data/private/`, `data/raw/`, `data/store.json`, `midnight-chain/`, `.midnight-wallet-state/`, `node_modules/` ou `dist/`.

Se algo inesperado estiver staged, remova apenas do staging sem apagar o arquivo local:

```powershell
git rm --cached -- caminho/do/arquivo
```

## 3. Criar o commit local

```powershell
git commit -m "feat: publica base inicial segura do Proofrail"
```

## 4. Ligar ao repositório criado no GitHub

Confira primeiro:

```powershell
git remote -v
```

Se não houver `origin`, copie a URL HTTPS exibida na página do seu repositório e execute:

```powershell
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git branch -M main
git push -u origin main
```

Se `origin` já existir, não o adicione novamente. Confira se aponta para o repositório correto antes do `push`.

## 5. Ajustes recomendados no GitHub

- mantenha o repositório privado durante a primeira validação, se ainda houver dúvida sobre o conteúdo;
- habilite **Private vulnerability reporting** em **Settings > Security**;
- proteja `main` exigindo o workflow **Proofrail CI** antes de merge;
- não crie secrets até configurar o GitHub App conscientemente;
- escolha uma licença antes de permitir reutilização externa. Sem `LICENSE`, o código continua protegido por direitos autorais padrão.

## 6. Limite do plano gratuito privado

No plano gratuito de uma conta pessoal, o workflow do GitHub Actions continua executando, mas as regras de proteção não são aplicadas ao repositório privado. Não torne o código público apenas para contornar essa limitação.

Para manter privacidade e proteção sem custo, use o GitLab Free como repositório principal e o GitHub privado como espelho. O procedimento completo está em [`REPOSITORIO_PRIVADO_GRATUITO.md`](REPOSITORIO_PRIVADO_GRATUITO.md).
