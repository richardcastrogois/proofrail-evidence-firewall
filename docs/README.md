# Documentacao do Proofrail

Este diretorio contem a documentacao duravel do produto e da sua operacao. O
[README da raiz](../README.md) apresenta o produto e o caminho rapido para
executar localmente.

## Ordem de leitura

1. [Ponto de partida do hackathon](HACKATHON_START_HERE.md) - contexto,
   capacidade medida, decisao de hospedagem e divisao inicial do trabalho.
2. [Onboarding de desenvolvimento](DEVELOPER_ONBOARDING.md) - guia completo
   para clonar, configurar e executar.
3. [Estado local e segredos](LOCAL_STATE_AND_SECRETS.md) - arquivos ignorados,
   responsabilidade e recuperacao segura.
4. [Arquitetura](ARCHITECTURE.md) - componentes, fluxo de dados e fronteiras de
   confianca.
5. [Seguranca](SEGURANCA.md) - ameacas, controles atuais e limites antes de
   producao.
6. [Deploy e proximos passos](DEPLOYMENT_AND_NEXT_STEPS.md) - estado confirmado,
   arquitetura-alvo e plano de continuidade.

## Referencia por assunto

- [Pitch do produto](PITCH.md) - proposta de valor, casos de uso e limites.
- [Integracao GitHub](GITHUB_APP.md) - conector de CI com privilegio minimo.
- [Integracao Midnight](MIDNIGHT.md) - contrato, redes, carteiras e operacao.
- [Benchmark Midnight](MIDNIGHT_RESOURCE_BENCHMARK.md) - metodologia, dados e
  conclusao de capacidade.
- [Setup Windows](SETUP_WINDOWS.md) - instalacao e diagnostico em Windows/WSL.

## Principios de manutencao

- Documente o comportamento atual e diferencie-o claramente de decisoes ainda
  nao implementadas.
- Preserve aqui somente material que ajuda a entender, executar, operar ou
  evoluir o produto. Historico de entregas pertence ao Git e as discussoes de
  projeto, nao a este diretorio.
- Atualize o documento tecnico correspondente quando uma interface, limite de
  seguranca, rede suportada ou procedimento operacional mudar.

## O que nunca deve ser publicado

- .env, PEM de GitHub App, chaves privadas, mnemonics ou seeds;
- data/private, data/raw e data/store.json;
- midnight-chain, .midnight-wallet-state e .midnight-state.json;
- .codex, .agents e configuracoes locais com caminhos da maquina;
- node_modules, dist, coverage, logs e backups de execucao.

Esses caminhos sao protegidos por [.gitignore](../.gitignore). Antes de cada
publicacao, confira a lista real com git status --short --ignored e nunca force
um arquivo ignorado com git add -f.
