# Deploy e Proximos Passos

## Finalidade

Este e o ponto de retomada para a proxima conversa ou equipe que evoluir o
Proofrail. Ele separa fatos confirmados, decisoes de arquitetura e trabalho
pendente. Nao descreve infraestrutura como implantada quando ela ainda e uma
proposta.

## Estado confirmado

### Produto e fluxo

- O produto demonstra um firewall de evidencias antes de uma acao sensivel:
  proposta, evidencias independentes, decisao, ancora Midnight, permit de uso
  unico e execucao controlada.
- Ha nove configuracoes de politica na interface. A demonstracao validada de
  ponta a ponta e Agent + Deploy.
- O conector GitHub App verifica CI e artefato para o SHA exato. O executor
  aceita apenas o workflow de staging autorizado; ele nao aceita shell ou
  destino arbitrario.
- O workflow GitHub atual prova a cadeia de CI e registra recibo de staging.
  Ele ainda nao realiza deploy para um destino empresarial real.

### Midnight

- O contrato Compact possui registrador autorizado, rotacao, revogacao,
  recuperacao, prevencao de replay e validacoes de politica.
- Local, Preview e Preprod foram usados para validacao. A rede Preprod tem
  deployment registrado no endereco
  9a1a5ae1cbb7bd5a64e649c5c9b63c9740907df53a2a1a0ba98f8e3a1b33fdd5.
- O e2e do contrato e a matriz security-check foram aprovados em Preprod.
- A operacao publica pode demorar porque a API local inicia a CLI, restaura a
  carteira, sincroniza, gera prova e espera confirmacao na mesma requisicao.

### Limites atuais

- A interface esta publicada na Vercel com API publica limitada em `/api/*`.
  A API completa ainda nao foi publicada.
- O projeto Vercel `proofrail` existe e esta conectado ao Neon
  `proofrail-dev-sp`.
- Deployment atual:
  `https://proofrail-juaug0uys-richard-castro-gois-projects.vercel.app`
  com alias `https://proofrail-nu.vercel.app`.
- O Neon `proofrail-dev-sp` esta na organizacao Vercel, regiao
  `aws-sa-east-1`, plano Free, PostgreSQL 18, com a primeira migracao Prisma
  aplicada.
- O `JsonStore` continua sendo o padrao local. `PROOFRAIL_STORE=postgres`
  habilita o adapter PostgreSQL inicial, que grava o snapshot versionado em
  `ProofrailState` e mantem segredos privados fora do banco.
- Nao ha autenticacao corporativa, tabelas de dominio plenamente normalizadas,
  fila duravel, worker persistente, gestao de chaves por KMS/HSM, rate
  limiting, observabilidade centralizada, destino de deploy real ou SLA.
- Preview e Preprod sao redes de teste. Mainnet esta fora do escopo.

Esses limites devem aparecer com transparencia em qualquer apresentacao
comercial: ha uma prova funcional do controle e da ancoragem, nao uma plataforma
empresarial hospedada pronta para producao.

## Decisoes de arquitetura

| Decisao | Estado | Motivo |
| --- | --- | --- |
| Vercel para interface publica e APIs curtas | frontend e API limitada publicados | entrega web simples, CDN e deploy integrado ao Git |
| Neon PostgreSQL com Prisma | criado em desenvolvimento | dados transacionais, migracoes e historico de auditoria |
| Executor Midnight isolado | decisao pendente entre VM persistente e job sob demanda | ambos exigem fila, idempotencia, segredos isolados e proof server nao publico |
| Fila duravel entre API e worker | obrigatoria antes do deploy publico | ancoragem e longa e nao pode bloquear o navegador |
| Oracle Cloud Always Free como candidato a VM | bloqueado por capacidade em Sao Paulo | atende ao envelope medido, mas nao pode ser dependencia do cronograma |
| Job sob demanda como alternativa | hipotese a prototipar localmente | evita processo ocioso, mas exige restauracao de estado e nao elimina o pico de memoria |
| Preprod como rede publica de validacao | ativo | permite provar a integracao sem custo de mainnet |
| Mainnet | nao planejada | so avaliar depois de operacao, custodia, observabilidade e suporte definidos |

Vercel, Neon e Prisma nao substituem o executor Midnight. Uma funcao Vercel
continua inadequada para a operacao longa. O executor pode ser uma VM
persistente ou um job com duracao suficiente, desde que o job restaure o estado
privado da carteira, seja idempotente e mantenha o proof server interno.

## Arquitetura-alvo

~~~text
Navegador
    |
    v
Vercel: interface e API curta
    |                     \\
    |                      -> Neon PostgreSQL via Prisma
    v
Fila duravel -> executor Midnight isolado (VM ou job)
                   |       |
                   |       -> proof server interno, nunca publico
                   v
              Midnight Preprod
~~~

Fluxo assincrono esperado:

1. A API valida identidade, politica e evidencias; persiste a decisao.
2. A API cria operacao de ancora e devolve 202 Accepted com operationId.
3. O worker consome a operacao e registra queued, syncing, proving, submitted,
   confirmed ou failed.
4. A interface consulta ou assina atualizacoes de estado sem manter uma
   requisicao HTTP aberta por varios minutos.
5. Depois de confirmed, a API emite o permit e permite a execucao compativel
   com a politica.

O navegador nunca fala diretamente com carteira, CLI, proof server ou a rede
Midnight. Segredos de carteira e registrador ficam somente no worker.

## Plano de entregas

### Entrega 0: fundacao de frontend e dados

Estado: iniciada. Em 2026-09-02, o projeto Vercel `proofrail` foi criado e o
Neon `proofrail-dev-sp` foi provisionado em Sao Paulo via integracao Vercel.
O frontend e a API publica limitada foram publicados na Vercel.

1. `vercel.json` publica o bundle Vite e uma Vercel Function curta em `/api/*`.
   Sem `VITE_API_URL`, a interface renderiza um preview frontend-only e bloqueia
   acoes de backend.
2. `packages/database/prisma` define o contrato PostgreSQL/Neon e a primeira
   migracao, incluindo estado de transicao, entidades de dominio, auditoria e
   operacoes assincronas.
3. `npm run deploy:preflight` bloqueia a API publica sem `DATABASE_URL`,
   `PROOFRAIL_STORE=postgres` e `PROOFRAIL_PUBLIC_ORIGINS`. Antes do worker,
   a API so pode passar em `PROOFRAIL_PUBLIC_API_MODE=limited`, que recusa
   ancoragem Midnight, aprovacao, troca de rede e execucao com `503`.
4. A API usa `JsonStore` por padrao. O adapter PostgreSQL inicial pode ser
   ativado com `PROOFRAIL_STORE=postgres`; a evolucao para tabelas normalizadas
   deve preservar os testes e separar os segredos do banco de dados.

Aceite: schema validado, migracao aplicada em um Neon de desenvolvimento,
adapter PostgreSQL inicial validado, frontend publicado e API limitada
respondendo em Vercel com `apiMode=limited`. Isso nao inclui ancoragem
Midnight publica.

Antes de qualquer publicacao, execute `npm run deploy:preflight`. Para validar
somente o frontend Vercel, execute
`node scripts/deploy-preflight.mjs --target=vercel-static`. `VITE_API_URL` e
opcional nessa etapa; quando ausente, a interface deve permanecer em modo
frontend-only.

Para validar uma API hospedada antes do worker, use somente o modo limitado:
`PROOFRAIL_PUBLIC_API_MODE=limited`, `PROOFRAIL_STORE=postgres`,
`PROOFRAIL_PUBLIC_ORIGINS` com os dominios Vercel permitidos e
`MIDNIGHT_MODE=local`. Esse modo permite leitura de estado, selecao de cenario
e declaracoes publicas controladas; ele bloqueia avaliacao, simulacao,
aprovacao, troca de rede, coleta assinada por origem e execucao. A API completa
segue bloqueada por projeto ate a fronteira publica, CORS, autenticacao e
worker assincrono estarem definidos.

### Entrega 1: migrar persistencia e contratos de dados

1. Evoluir o adapter PostgreSQL inicial para cobrir testes de concorrencia e
   reinicio usando o snapshot versionado em `ProofrailState`.
2. Planejar a normalizacao progressiva para tabelas de dominio, sem migrar
   arquivos de segredos para o banco.
3. Definir idempotencia, transacoes, retencao e cofre de segredos.
4. Criar testes de concorrencia, reinicio e rollback da migracao.

Aceite: duas requisicoes concorrentes nao emitem ou consomem o mesmo permit; a
auditoria pode ser consultada apos reinicio.

### Entrega 2: aplicar controles de API publica completa

1. Evoluir a API hospedada alem do modo limitado somente depois de definir
   autenticacao, fila e worker.
2. Restringir CORS por `PROOFRAIL_PUBLIC_ORIGINS`, configurar autenticacao
   organizacional, papeis e escopo por tenant.
3. Adicionar rate limiting, cabecalhos de seguranca, validacao de origem de
   webhook e logs estruturados.
4. Manter chamadas Midnight indisponiveis na API hospedada ate o worker ser
   ativado.

Aceite: nenhuma chave de carteira, PEM, endpoint de proof server ou arquivo de
estado esta no bundle, log publico ou variavel de cliente.

### Entrega 3: worker Midnight e fila (executar por ultimo)

Objetivo: provar o executor Midnight em ambiente limitado antes de escolher ou
criar infraestrutura cloud.

1. Implementar o consumidor de `AsyncOperation` separado da API publica.
2. Empacotar Node, carteira e proof server para medir o conjunto inteiro.
3. Executar o fluxo com limite total de 2 GB/1 CPU e depois 4 GB/2 CPUs.
4. Testar sincronizacao fria e quente, reinicio, idempotencia e dez operacoes.
5. Se 2 GB reprovar, adotar 4 GB como piso do hackathon sem novos testes de
   provedor menor.
6. Comparar VM persistente e job sob demanda quanto a estado, timeout, segredo,
   disponibilidade, cota e risco de cobranca.
7. Criar infraestrutura somente depois da escolha documentada. Oracle A1 pode
   ser usada se houver capacidade; job com billing nao deve ser criado sem
   autorizacao explicita e limite de custo.

Aceite: dez ancoras Preprod concluidas no menor perfil saudavel, incluindo
retomada apos reinicio sem duplicacao, com segredos persistidos de forma privada
e proof server inacessivel publicamente.

Nao compre plano pago nem envie a carteira ao faucet novamente sem necessidade.
Primeiro valide compatibilidade da VM e disponibilidade de capacidade.

### Entrega 4: operacao e seguranca

1. Centralizar logs com requestId, operationId e commitment de acao, sem
   registrar segredos ou evidencia bruta.
2. Criar alertas para fila parada, saldo baixo, falha RPC, falha de prova,
   operacao vencida e replay.
3. Definir backup, restauracao e rotacao de chaves.
4. Adicionar SAST, analise de dependencias, secret scanning, testes de
   autorizacao, carga e recuperacao.
5. Fazer revisao independente de contrato, API e executor antes de piloto.

Aceite: um incidente simulado pode ser detectado, investigado e recuperado sem
expor dados ou perder rastreabilidade.

### Entrega 5: ampliar provas de cenario

Prioridade sugerida:

1. Uso de ferramenta por agente: integrar gateway/MCP com identidade assinada e
   allowlist de ferramenta e acao.
2. Acesso a dados sensiveis: integrar identidade e conector de dados para
   liberar exportacao, exclusao ou compartilhamento somente apos permit.
3. Pagamento: somente apos modelar valor, beneficiario, limites, reconciliacao
   e reversao; nao o tratar como variacao visual de deploy.

Cada cenario so entra como comprovado depois de origem externa real, executor
fechado, matriz negativa e trilha de auditoria.

## Guia para a proxima conversa

Leia nesta ordem:

1. [Ponto de partida do hackathon](HACKATHON_START_HERE.md);
2. [Onboarding](DEVELOPER_ONBOARDING.md);
3. [Arquitetura](ARCHITECTURE.md);
4. [Seguranca](SEGURANCA.md);
5. este documento;
6. [Benchmark Midnight](MIDNIGHT_RESOURCE_BENCHMARK.md).

Em seguida:

1. confirme git status --short --branch e nao reverta mudancas locais;
2. confirme quais contas ja existem: Vercel, Neon e Oracle;
3. valide o adapter PostgreSQL e escolha a VM do worker antes de expor a API;
4. nao rode faucet, deploy publico ou escrita on-chain sem confirmacao explicita;
5. nao prometa producao, SLA, mainnet ou integracao empresarial enquanto os
   criterios deste documento nao forem concluidos.

## Checklist de transicao

- [ ] Conta e regiao candidatas para worker identificadas.
- [ ] Compatibilidade Docker/proof server validada na VM.
- [ ] Volume persistente e backup definidos.
- [x] Neon e Prisma modelados com migracao inicial aplicada em desenvolvimento.
- [ ] Fila e operacao assincrona implementadas.
- [ ] Segredos separados por ambiente e fora de Vercel/browser.
- [ ] Autenticacao, autorizacao por tenant e rate limiting implementados.
- [ ] Observabilidade e alertas testados.
- [ ] Primeiro cenario adicional com integracao externa real validado.
- [ ] Revisao de seguranca concluida antes de piloto.
