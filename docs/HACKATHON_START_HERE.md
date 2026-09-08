# Proofrail: ponto de partida do hackathon

## Leitura de cinco minutos

O Proofrail impede uma acao sensivel ate reunir evidencias independentes,
avaliar uma politica e emitir um permit de uso unico. O caso demonstrado de
ponta a ponta e **Agent + Deploy**: o GitHub App verifica CI e artefato para um
SHA exato, a decisao e ancorada na Midnight Preprod e somente entao o executor
autorizado registra o deploy de staging.

Este repositorio e o baseline compartilhado do time. O frontend e uma API
publica limitada estao hospedados na Vercel; o estado hospedado usa Neon com
Prisma. A carteira, o proof server e a escrita Midnight **nao** estao
hospedados e nunca devem ser enviados ao navegador ou a uma funcao Vercel.

## Como chegamos a esta decisao

O trabalho comecou pela validacao do produto, antes da hospedagem. O fluxo
principal foi implementado e testado localmente; contrato, carteira, proof
server e ancoragem tambem foram exercitados nas redes de teste Midnight. O
cenario Agent + Deploy concluiu a cadeia de evidencias, decisao, ancora, permit
e execucao controlada. Esses resultados confirmam a prova funcional em Local,
Preview e Preprod, mas nao significam que o sistema esteja validado para
producao ou Mainnet.

Com o fluxo funcional comprovado, seguimos para a hospedagem compartilhada. O
frontend foi publicado com sucesso na Vercel e a fundacao de dados foi criada
no Neon/PostgreSQL. A API hospedada permanece deliberadamente limitada: ela
permite demonstrar o frontend e operacoes publicas seguras, sem carregar a
carteira nem iniciar a operacao Midnight completa.

O componente que falta hospedar e o worker. Ele precisa sincronizar a carteira,
manter ou recuperar seu estado, iniciar ou acessar internamente o proof server,
gerar uma prova e aguardar a transacao. Uma rodada medida levou entre 348 e 400
segundos. Esse trabalho nao cabe com seguranca na funcao Vercel atual porque:

- a funcao configurada tem duracao maxima de 30 segundos;
- a operacao e longa, intensiva em memoria e CPU e nao deve prender uma
  requisicao do navegador;
- execucoes serverless sao efemeras e nao oferecem o volume persistente exigido
  pelo checkpoint da carteira;
- carteira, chaves e proof server nao podem ficar no frontend nem em uma
  fronteira publica;
- uma interrupcao exige fila, idempotencia e retomada para nao duplicar uma
  transacao.

A primeira opcao foi uma VM gratuita persistente, capaz de executar tudo junto.
Descartamos as micro VMs de 1 GB como aposta inicial porque pareciam pequenas
para Linux, Docker, Node, carteira e proof server. O Oracle A1 Always Free, com
arquitetura ARM e memoria flexivel, era a opcao gratuita mais compativel. A
imagem do proof server foi verificada como compativel com `arm64`, e tentamos
criar a VM em diferentes fault domains e sem fixar um fault domain. Todas as
tentativas em Brazil East (Sao Paulo) falharam com `Out of capacity`. Nao ha
previsao confiavel de quando a capacidade gratuita sera liberada nessa regiao.

Rodar o worker em um computador pessoal serviria para desenvolvimento pontual,
mas nao resolve a demonstracao. O computador teria de permanecer ligado e com
rede estavel sempre que outro desenvolvedor ou avaliador executasse o fluxo. A
avaliacao do hackathon pode acontecer em horario desconhecido; depender de uma
maquina pessoal tornaria a demo indisponivel justamente quando precisasse ser
testada. Por isso, execucao local nao e a arquitetura de hospedagem escolhida.

Em vez de continuar supondo o tamanho necessario, instrumentamos o fluxo real.
Foram medidas sincronizacao, prova, CPU, memoria, disco, reinicio e execucoes
com o proof server limitado. Os dados reprovaram 1 GB, classificaram 2 GB como
experimental e sustentaram 4 GB de RAM, 2 vCPUs e 20 GB de disco como o perfil
responsavel para o hackathon. Isso substituiu uma estimativa inicial de 6 GB por
um requisito baseado em evidencia.

As medicoes tambem mostraram que simplesmente trocar de Linux ou comprimir a
imagem nao resolveria: a imagem do proof server ocupa cerca de 25,49 MiB, mas o
processo Node e a carteira chegaram a aproximadamente 1 GiB. A nova linha de
investigacao e uma refatoracao arquitetural, nao apenas de imagem: retirar o
fluxo longo da API, executa-lo como job sob demanda, restaurar somente o estado
necessario e terminar depois de registrar o resultado. Se o conjunto integral
for aprovado sob limites menores e com retomada segura, poderemos comparar
outros provedores sem depender da capacidade imprevisivel da Oracle.

Esse rumo foi escolhido pelo prazo do hackathon: manter a Oracle como
oportunidade paralela, mas desenvolver uma fronteira assincrona portavel e
testavel. A decisao final entre VM e job continua condicionada aos testes de
memoria total, persistencia, repetibilidade, seguranca e risco de cobranca
descritos abaixo.

## Componentes e responsabilidades

| Componente | Responsabilidade | Estado atual |
| --- | --- | --- |
| Web | apresenta proposta, evidencias, decisao e auditoria | hospedado na Vercel |
| API | valida entradas e coordena o dominio | local completo; hospedado em modo limitado |
| Neon/PostgreSQL | persiste o estado hospedado e operacoes assincronas | adapter inicial e migracao aplicados |
| Worker Midnight | consome uma operacao, sincroniza a carteira, solicita a prova e envia a transacao | ainda nao implementado |
| Proof server | calcula a prova criptografica localmente para o worker | usado nos testes; nunca deve ser publico |
| Docker | empacota e isola o proof server; nao e o calculo em si | usado localmente |
| Estado da carteira | checkpoint necessario para retomar a sincronizacao | local e privado |

## Fatos de capacidade medidos

Os testes de 2026-09-05 mediram a CLI, a carteira e o proof server atuais:

- pico combinado conservador: **1,17 GiB**, antes de Linux, Docker e caches;
- sincronizacao quente: **404 s** e pico Node de **1,03 GiB**;
- ancora Preprod real: **348 a 400 s**;
- proof server: pico de **174,60 MiB**;
- uma prova concluiu com o proof server limitado a **0,5 CPU**;
- dados locais da aplicacao: aproximadamente **343 MiB** antes de sistema,
  caches e logs.

Conclusao atual:

| Ambiente | Classificacao |
| --- | --- |
| 1 GB RAM | reprovado; o pico medido ja excede a memoria total |
| 2 GB RAM / 1 vCPU | minimo tecnico experimental, sem margem saudavel comprovada |
| 4 GB RAM / 2 vCPU / 20 GB | recomendacao responsavel para o hackathon |
| 6 GB RAM | margem adicional; nao e requisito demonstrado |

Esses numeros nao certificam ainda o worker definitivo. Faltam limitar o
conjunto inteiro, executar dez operacoes consecutivas e testar idempotencia
apos reinicio. Consulte [o benchmark completo](MIDNIGHT_RESOURCE_BENCHMARK.md).

## Decisao de hospedagem

Existem duas linhas viaveis, e reduzir apenas o tamanho da imagem nao resolve o
gargalo: a imagem do proof server tem cerca de 25,49 MiB, enquanto o processo
Node/carteira chegou a aproximadamente 1 GiB.

### Opcao A: VM persistente

Executa worker, carteira e proof server juntos. E a opcao com menos refatoracao
e permite manter o checkpoint da carteira em disco. O Oracle A1 Always Free e
o candidato gratuito que atende ao envelope, mas a criacao em Sao Paulo esta
bloqueada por falta de capacidade e uma instancia gratuita ociosa pode ser
recuperada pelo provedor. A imagem do proof server suporta `amd64` e `arm64`.

Nao basear o cronograma do hackathon na disponibilidade da A1. Continuar
tentando e aceitavel, mas ela deve ser tratada como oportunidade, nao como
dependencia do time.

### Opcao B: job sob demanda

Refatorar o fluxo longo para um job contendo Node, carteira e proof server. A
API curta cria uma `AsyncOperation` no Neon; o job processa uma operacao por
vez, registra o resultado no Neon e termina. Isso reduz o tempo ligado, mas nao
o pico de memoria da prova.

Antes de escolher um provedor, o prototipo deve provar localmente:

1. container unico limitado a 2 GB e 1 CPU executando o fluxo completo;
2. estado da carteira restaurado de armazenamento privado ou sincronizado em
   tempo aceitavel em uma inicializacao fria;
3. operacao idempotente, concorrencia igual a um e retomada sem transacao
   duplicada;
4. segredos injetados em tempo de execucao, sem imagem, Git, Neon ou logs;
5. custo limitado por cota e desligamento automatico.

Cloud Run Jobs e servicos equivalentes sao candidatos, nao uma hospedagem
gratuita garantida. Cota gratuita pode existir, mas uma conta faturavel e
excesso de uso podem gerar cobranca. Como o requisito do projeto e nao correr
risco de custo acidental, nenhum recurso desse tipo deve ser criado sem uma
decisao explicita e controles de orcamento.

## Arquitetura compartilhada

~~~text
Browser
   |
   v
Vercel: web + API limitada ----> Neon/PostgreSQL
                                      |
                                      v
                                AsyncOperation
                                      |
                           +----------+----------+
                           |                     |
                    VM persistente       job sob demanda
                           |                     |
                           +---- worker Node ----+
                                      |
                                proof server
                                      |
                                Midnight Preprod
~~~

O frontend e a API nao dependem da escolha final entre VM e job. O contrato de
integracao deve ser a operacao assincrona persistida, com os estados `queued`,
`syncing`, `proving`, `submitted`, `confirmed` e `failed`.

## Divisao inicial para tres desenvolvedores

1. **API e dados:** fechar o contrato de `AsyncOperation`, idempotencia,
   concorrencia e testes do adapter PostgreSQL.
2. **Worker e Midnight:** extrair a execucao longa para um consumidor separado,
   criar o container de teste e medir o conjunto inteiro com 2 GB e 4 GB.
3. **Web e demonstracao:** consumir estados assincronos, exibir falhas reais e
   manter indisponiveis as acoes que a API limitada recusa.

Mudancas no contrato entre essas frentes devem ser combinadas antes da
implementacao. Nenhum desenvolvedor deve precisar de seed ou chave privada de
outro membro; use arquivos locais ignorados e credenciais por ambiente.

## Primeiro dia

1. Leia este documento e [o onboarding](DEVELOPER_ONBOARDING.md).
2. Siga [Estado local e segredos](LOCAL_STATE_AND_SECRETS.md) antes de criar
   `.env` ou carteira.
3. Execute `npm ci`, `npm run typecheck`, `npm test` e `npm run build`.
4. Leia [Arquitetura](ARCHITECTURE.md) e [Seguranca](SEGURANCA.md) antes de
   alterar fronteiras publicas.
5. Escolha uma tarefa pequena, registre o aceite e trabalhe em branch propria a
   partir da branch compartilhada do hackathon.

## Regras que nao sao negociaveis

- Preview e Preprod sao redes de teste; nao chamar isso de producao.
- Nunca publicar seed, mnemonic, PEM, chave privada, carteira ou estado local.
- Nunca expor o proof server diretamente a internet.
- Nao liberar a API completa sem autenticacao, fila e worker isolado.
- Nao criar recurso pago, usar trial ou executar faucet/escrita on-chain sem
  confirmacao explicita.
- Nao declarar o perfil de 2 GB aprovado antes do teste integral e repetivel.
