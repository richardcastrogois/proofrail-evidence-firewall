# Benchmark de recursos do worker Midnight

## Objetivo

Determinar, com medidas reproduziveis, o menor ambiente que executa o worker
Proofrail e o proof server Midnight de forma estavel. O resultado orienta a
escolha de uma hospedagem gratuita sem assumir que o limite minimo da Oracle
corresponde ao consumo real da aplicacao.

Este benchmark nao escolhe um provedor. Ele produz requisitos de CPU, memoria
e disco que podem ser comparados com Oracle, Google Cloud ou outra oferta.

## Escopo confirmado

Para `preview` e `preprod`, o projeto usa o node RPC e o indexador publicos da
Midnight. O ambiente do worker precisa hospedar apenas:

- Linux e servicos basicos do sistema;
- runtime Node.js e worker Proofrail;
- carteira e seu estado persistente de sincronizacao;
- Docker e `midnightntwrk/proof-server:8.1.0`, quando a prova for local;
- logs operacionais limitados.

Ele nao precisa hospedar o node ou o indexador Midnight em Preprod.

## O que sera medido

| Medida | Motivo |
| --- | --- |
| RSS de cada processo Node e seus filhos | separar o custo do worker do proof server |
| memoria e CPU do container | capturar o pico durante a prova |
| memoria disponivel no host | detectar pressao que nao aparece em um processo isolado |
| tamanho das imagens Docker | estimar disco inicial |
| tamanho de `.midnight-wallet-state` | estimar estado persistente sem ler seu conteudo |
| duracao e codigo de saida | detectar configuracoes lentas ou instaveis |
| I/O, rede e quantidade de processos do container | explicar gargalos e reinicios |

Os resultados ficam em `.tmp/midnight-benchmark/`, que nao deve ser
versionado. O coletor nao grava variaveis de ambiente, seeds, chaves ou
conteudo dos arquivos privados.

## Cenarios

### 1. Inventario

Coleta versoes, memoria, disco, tamanho das imagens e tamanho do estado local.
Nao inicia containers e nao acessa redes externas.

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\07-benchmark-midnight.ps1 -Scenario Inventory
```

### 2. Proof server ocioso

Inicia um container exclusivo do benchmark, publicado apenas em
`127.0.0.1:16300`, aguarda resposta e coleta amostras. O container e removido
ao final, mesmo quando houver erro.

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\07-benchmark-midnight.ps1 `
  -Scenario ProofIdle -Profile A1 -DurationSeconds 60
```

### 3. Comando monitorado

Executa um comando e mede a arvore de processos. Com `-WithProofServer`, tambem
inicia o proof server e define `MIDNIGHT_PROOF_SERVER_URL` somente para o
comando medido.

Exemplo somente leitura, sem transacao:

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\07-benchmark-midnight.ps1 `
  -Scenario Command -Profile A1 -WithProofServer `
  -TimeoutSeconds 1200 `
  -Command "npm run test:e2e -- --network preprod"
```

`check-balance` sincroniza a carteira e pode alterar apenas o checkpoint local.
Ele nao envia transacao, mas deve ser executado somente depois de confirmar que
a carteira Preprod local e a pretendida:

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\07-benchmark-midnight.ps1 `
  -Scenario Command -Profile A1 -WithProofServer `
  -Command "npm run check-balance -- --network preprod"
```

Uma ancoragem real nao e automatizada pelo benchmark. Ela consome recursos da
rede e exige aprovacao explicita antes da execucao.

Depois da aprovacao, use o comando dedicado abaixo. Ele cria compromissos
aleatorios nao sensiveis, envia somente uma decisao `ALLOW` valida e se recusa
a executar sem a confirmacao explicita no ambiente:

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\07-benchmark-midnight.ps1 `
  -Scenario Command -Profile Unrestricted -WithProofServer `
  -Command "PROOFRAIL_BENCHMARK_ALLOW_PREPROD=1 bash ../scripts/run-preprod-benchmark-anchor.sh"
```

Nao use `security-check` para medir uma unica prova. Esse comando executa uma
matriz de operacoes negativas e positivas, incluindo rotacao e revogacao do
registrador, portanto altera mais estado do que o benchmark necessita.

## Perfis

Os perfis aplicam limites ao proof server, que e o componente isolado em
container. O consumo total da VM e calculado pela soma dos picos medidos; o
perfil nao simula sozinho todo o sistema operacional.

| Perfil | Limite do proof server | CPU do proof server | Envelope avaliado |
| --- | ---: | ---: | ---: |
| `Micro` | 512 MiB | 0,125 CPU | VM de 1 GB |
| `Small` | 1 GiB | 0,5 CPU | VM de 2 GB |
| `Medium` | 2 GiB | 1 CPU | VM de 4 GB |
| `A1` | 4 GiB | 1 CPU | VM de 6 GB |
| `Unrestricted` | sem limite | sem limite | descobrir o pico natural |

O perfil `Micro` e deliberadamente restritivo: em uma VM de 1 GB ainda e
necessario reservar memoria para Linux, Docker, Node e carteira.

## Ordem de execucao

1. Inventario do ambiente.
2. Proof server ocioso sem limite e nos perfis `A1`, `Medium`, `Small` e
   `Micro`.
3. Consulta publica `test:e2e`, quando existir deployment Preprod local.
4. Sincronizacao fria e quente da carteira com `check-balance`.
5. Uma operacao real aprovada, primeiro sem limite e depois reduzindo o perfil.
6. Reinicio do worker e repeticao para avaliar persistencia e idempotencia.
7. Dez operacoes consecutivas no menor perfil candidato.

## Criterio de minimo saudavel

O menor perfil aprovado deve:

- completar sincronizacao, prova e confirmacao sem OOM, timeout ou reinicio;
- completar dez operacoes consecutivas;
- retomar depois de reinicio sem duplicar uma transacao;
- manter pelo menos 30% de folga sobre o pico combinado de memoria;
- manter pelo menos 40% do disco livre apos estado, imagens e logs;
- apresentar tempo de operacao compativel com a demonstracao do hackathon;
- funcionar novamente com a carteira em estado quente.

Para os testes de hackathon, o limite tecnico por operacao e de 20 minutos e
o alvo de experiencia e de ate 10 minutos. O limite impede que um perfil com
CPU insuficiente fique executando indefinidamente; o alvo separa uma simples
conclusao tecnica de uma configuracao adequada para demonstracao.

Uma execucao isolada nao aprova um perfil. Falha por memoria reprova o perfil;
falha de rede deve ser repetida e classificada separadamente.

## Resultado esperado

Ao final, registrar uma tabela com os picos e classificar:

- **minimo tecnico**: menor perfil que conclui uma operacao;
- **minimo saudavel**: menor perfil que atende todos os criterios;
- **recomendado**: minimo saudavel mais margem para demonstracao;
- **nao suportado**: perfil que sofre OOM, reinicio ou tempo inaceitavel.

## Limites atuais

- O worker remoto e a fila duravel ainda sao entregas futuras do projeto.
- `test:e2e` e somente leitura e nao mede geracao de prova.
- `check-balance` mede sincronizacao, mas nao substitui uma ancoragem real.
- O pico definitivo so pode ser confirmado com uma operacao Preprod aprovada.

## Resultados de 2026-09-05

As medicoes abaixo foram executadas no WSL 2 com Node.js `22.23.1`, Docker
`29.1.3` e proof server `8.1.0`. Elas descrevem este checkout e esta carteira;
nao devem ser generalizadas para outro contrato sem repetir o benchmark.

| Cenario | Duracao | Node/processos | Proof server | Resultado |
| --- | ---: | ---: | ---: | --- |
| consulta publica `test:e2e` | 136 s | 274,93 MiB; 42,7% CPU | nao utilizado | aprovada |
| sincronizacao quente `check-balance` | 404 s | 1,03 GiB; 94,7% CPU | nao utilizado | aprovada; carteira financiada |
| uma ancora Preprod sem limite | 348 s | 1.021,57 MiB; 46,2% CPU | 174,60 MiB; 461,9% CPU | aprovada; um resultado de ancora |
| uma ancora Preprod, perfil `A1` | 400 s | 995,83 MiB; 62,1% CPU | 159,50 MiB; 99,27% CPU | aprovada; sem timeout ou OOM |
| uma ancora Preprod, perfil `Small` | 400 s | 976,79 MiB; 60,4% CPU | 160,70 MiB; 50,35% CPU | aprovada; sem timeout ou OOM |

O estado persistido da carteira ocupou aproximadamente 11,21 MiB depois da
ancora. As dependencias de `midnight-chain` ocuparam 295,74 MiB, os contratos
10,45 MiB e a imagem do proof server 25,49 MiB. A carga observada da aplicacao
fica em aproximadamente 343 MiB antes de sistema operacional, Docker, caches e
logs. Assim, 10 GB e o minimo tecnico de disco e 20 GB e a reserva recomendada;
o volume de 50 GB da Oracle decorre do minimo da imagem escolhida, nao de uma
necessidade medida do Proofrail.

O pico conservador, somando os maximos de Node e proof server, foi de cerca de
1,17 GiB. Esse valor ainda exclui Linux, daemon Docker, cache de pagina e
servicos do sistema. Portanto, uma VM total de 1 GB esta reprovada para a
arquitetura com prova local. Uma VM de 2 GB permanece apenas como candidata a
teste; 4 GB ou mais oferece uma margem inicial mais realista.

O proof server sem limite utilizou momentaneamente mais de quatro CPUs logicas.
Com uma CPU ele concluiu em 400 segundos, apenas 52 segundos acima da rodada
sem limite. Com meia CPU tambem concluiu em 400 segundos. Portanto, o fluxo
atual nao exige quatro CPUs e meia CPU e tecnicamente suficiente para esta
operacao medida. Esses limites foram aplicados somente ao proof server; o
processo Node permaneceu sem limite artificial.

A saida apos a ancora registrou duas desconexoes WebSocket com codigo `1000`
(`Normal Closure`). Como houve codigo de saida zero e um unico
`ANCHOR_RESULT`, elas foram classificadas como encerramento normal da conexao,
nao como falha da operacao.

## Plano de fechamento e estado atual

| Gate | Evidencia exigida | Estado em 2026-09-05 |
| --- | --- | --- |
| pico natural | sincronizacao e uma prova real sem limites | concluido |
| CPU reduzida | prova real com 1 CPU e 0,5 CPU | concluido |
| memoria minima | pico combinado mais 30% de folga e overhead do sistema | parcial; WSL nao isola o overhead da VM |
| reinicio | novo proof server usando a carteira persistida | concluido em duas novas execucoes |
| repetibilidade | dez operacoes no menor perfil saudavel | pendente |
| worker definitivo | medir o consumidor remoto e sua fila duravel | bloqueado pela implementacao ainda inexistente |

Nao foi executada uma ancora no perfil `Micro`, pois o pico natural combinado
de Node e proof server ja excede 1 GiB. Outra transacao nesse perfil nao poderia
aprovar uma VM total de 1 GB: o perfil limita apenas o container e deixaria o
Node sem representar o limite real da maquina.

O perfil `Medium` tambem nao foi repetido. Ele aplica a mesma CPU do `A1` e
2 GiB ao proof server, enquanto o maior pico medido desse container foi de
174,60 MiB. Repeti-lo produziria, na pratica, o mesmo ensaio do `A1` sem testar
um novo gargalo.

## Conclusao de capacidade atual

| Capacidade total | Classificacao | Base factual |
| --- | --- | --- |
| 1 GB | nao suportada | pico combinado de ate 1.196,17 MiB, antes do sistema operacional |
| 2 GB | minimo tecnico experimental | a operacao concluiu com proof server em 0,5 CPU, mas sobra no maximo cerca de 0,29 GiB para Linux, Docker e caches quando aplicada a folga de 30% |
| 4 GB | recomendado para o hackathon | comporta o pico medido, 30% de folga e overhead razoavel de Linux/Docker |
| 6 GB | margem adicional, nao requisito observado | nenhuma medicao atual demonstrou necessidade dessa memoria |

Esta e uma conclusao baseada em dados para a CLI, carteira e proof server
atuais. Ela nao e ainda um numero exato para o futuro worker persistente. Para
certificar o minimo saudavel definitivo, faltam implementar o worker e executar
dez operacoes consecutivas em uma maquina ou cgroup que limite o conjunto
inteiro a 4 GB.

A especificacao responsavel para o hackathon e **4 GB de RAM, 2 vCPUs e 20 GB
de disco**. Um ambiente com 2 GB e 1 vCPU permanece apenas um candidato
tecnico: a prova concluiu com o proof server em 0,5 CPU, mas a CPU do processo
Node nao foi limitada junto com ele e a margem de memoria nao atende ao criterio
saudavel. Em Oracle Ampere, testar 1 OCPU e 4 GB continua razoavel, mas deve ser
validado na VM real antes da demonstracao.
