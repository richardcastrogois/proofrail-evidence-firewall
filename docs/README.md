# Documentação do Proofrail

Este diretório concentra a documentação destinada a desenvolvedores, avaliadores e futuros mantenedores. O [`README.md` da raiz](../README.md) continua sendo a apresentação pública do projeto.

## Ordem de leitura recomendada

1. [`PITCH_E_TESTE_LOCAL.md`](PITCH_E_TESTE_LOCAL.md) — resumo para postagem, venda do pitch e roteiro simples para testar localmente.
2. [`HANDOFF_ETAPA_03.md`](HANDOFF_ETAPA_03.md) — contexto mínimo e verificável para iniciar a Etapa 03 em um novo chat.
3. [`GUIA_DO_PROJETO.md`](GUIA_DO_PROJETO.md) — o que o produto resolve, como funciona e como testar o fluxo visual.
4. [`SETUP_WINDOWS.md`](SETUP_WINDOWS.md) — instalação, execução local e comandos de diagnóstico no Windows/WSL.
5. [`ARCHITECTURE.md`](ARCHITECTURE.md) — componentes, arquivos, fluxo de dados e fronteiras de confiança.
6. [`SEGURANCA.md`](SEGURANCA.md) — ameaças, controles implementados e bloqueios antes de produção.
7. [`GITHUB_APP.md`](GITHUB_APP.md) — configuração do conector GitHub com privilégio mínimo.
8. [`MIGRACAO_MIDNIGHT.md`](MIGRACAO_MIDNIGHT.md) — garantias atuais e evolução do contrato/provas na Midnight.
9. [`PLANO_4_DIAS.md`](PLANO_4_DIAS.md) — histórico do plano incremental e critérios de aceite.
10. [`REPOSITORIO_PRIVADO_GRATUITO.md`](REPOSITORIO_PRIVADO_GRATUITO.md) — estratégia GitLab privado principal + GitHub privado como espelho, proteção da `main` e fluxo diário.

## O que nunca deve ser publicado

- `.env`, PEM de GitHub App, chaves privadas, mnemonics ou seeds;
- `data/private/`, `data/raw/` e `data/store.json`;
- `midnight-chain/`, `.midnight-wallet-state/` e `.midnight-state.json`;
- `.codex/`, `.agents/` e configurações locais com caminhos da máquina;
- `node_modules/`, `dist/`, `coverage/`, logs e backups de execução.

Esses caminhos são protegidos por [`.gitignore`](../.gitignore). Antes de cada publicação, confira a lista real com `git status --short --ignored` e nunca force um arquivo ignorado com `git add -f`.
