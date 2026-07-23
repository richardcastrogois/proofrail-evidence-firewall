# Repositório privado e proteção gratuita

## Decisão atual

O código permanece privado. A estratégia recomendada é:

- **GitLab Free como repositório principal**, porque permite proteger a branch padrão de um projeto privado, bloquear push direto e exigir pipeline bem-sucedido antes do merge;
- **GitHub privado como espelho e portfólio**, preservando o histórico e o workflow já existente;
- **sem Jenkins nesta fase**, porque um Jenkins próprio adicionaria servidor, atualizações, plugins, credenciais, backups e monitoramento sem resolver sozinho a proteção do repositório.

Não descreva o GitHub privado gratuito como branch protegida. O workflow executa validações, mas o plano atual não impede o proprietário de enviar diretamente para `main` ou fazer merge com CI falho.

## Controles que continuam locais ao repositório

- `.gitignore` bloqueia credenciais, chaves, estado da carteira, dados brutos, artefatos e configurações locais;
- `.github/workflows/ci.yml` valida pull requests e `main` no GitHub;
- `.gitlab-ci.yml` valida merge requests e a branch padrão no GitLab;
- o próprio pipeline executa `npm audit` nas dependências de produção;
- atualizações de dependências são abertas de forma controlada no GitLab, uma por vez, em vez de duplicar pull requests automáticos no espelho GitHub;
- nenhum secret de produção deve ser cadastrado enquanto o serviço ainda estiver em laboratório.

## Configuração obrigatória no GitLab

Depois de importar o projeto como **Private**:

1. Abra **Settings > Repository > Branch rules**.
2. Proteja `main`.
3. Em **Allowed to merge**, selecione `Maintainers`.
4. Em **Allowed to push and merge**, selecione explicitamente `No one`.
5. Mantenha **Allowed to force push** desligado.
6. Abra **Settings > Merge requests**.
7. Em **Merge checks**, habilite **Pipelines must succeed**.
8. Mantenha **Skipped pipelines are considered successful** desligado.
9. Habilite a exclusão da branch de origem após o merge e prefira squash para branches de trabalho curtas.

Como existe apenas um mantenedor, uma aprovação humana independente ainda não pode ser garantida gratuitamente. Para mudanças críticas, solicite revisão a uma segunda pessoa antes do merge, mesmo quando a plataforma não a exigir.

## Estado verificado em 22/07/2026

- `main`, `gitlab/main` e `origin/main` apontavam para o mesmo commit após o primeiro Merge Request protegido;
- o pipeline do GitLab e o workflow do GitHub passaram no mesmo conteúdo;
- o GitLab ficou com somente a branch `main` após excluir a branch já mesclada;
- as sete branches automáticas do Dependabot que sustentavam pull requests no GitHub eram ruído do espelho e foram removidas;
- a configuração `.github/dependabot.yml` foi retirada para impedir que esse ruído volte. O audit de segurança continua nos dois pipelines.

## Fluxo diário

```powershell
git switch main
git pull --ff-only gitlab main
git switch -c codex/nome-curto

# desenvolver e validar
npm ci
npm audit --omit=dev --audit-level=high
npm test
npm run typecheck
npm run build

git push -u gitlab codex/nome-curto
```

Crie um Merge Request para `main`. O GitLab deve impedir push direto e bloquear o merge até o pipeline `verify` ficar verde.

Depois do merge no GitLab, sincronize o espelho do GitHub:

```powershell
git switch main
git pull --ff-only gitlab main
git push origin main
```

Nunca use `git push --force` em `main`, `git add -f` para incluir arquivo ignorado ou copie secrets entre as plataformas.

### Sobre o botão “Publicar Branch” do VS Code

Não use esse botão sem conferir o remoto: o VS Code pode escolher `origin`, que neste projeto é apenas o espelho GitHub. Publique explicitamente no repositório principal:

```powershell
git push -u gitlab codex/nome-curto
```

Depois crie o Merge Request no GitLab, aguarde o pipeline verde e faça o merge. Só então sincronize `main` no GitHub.

## Remotes esperados

```text
gitlab -> repositório privado principal
origin -> espelho privado no GitHub
```

Confira antes de qualquer envio:

```powershell
git remote -v
git status --short --branch
```

## Limites desta solução

- O proprietário do projeto ainda administra as regras e pode alterá-las.
- Proteção de branch não substitui revisão de código nem segurança da aplicação.
- GitLab CI e GitHub Actions executam código do repositório; secrets não devem ser expostos a pipelines de contribuições não confiáveis.
- Para produção empresarial serão necessários identidade forte, segregação de funções, KMS/HSM, executor isolado, logs imutáveis e resposta a incidentes, conforme `SEGURANCA.md`.
