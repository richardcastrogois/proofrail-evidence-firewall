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

- A API, a interface, o store e os segredos estao locais.
- O armazenamento e JsonStore, adequado para demonstracao e nao para
  concorrencia, retencao ou auditoria empresarial.
- Nao ha autenticacao corporativa, banco transacional, fila duravel, worker
  persistente, gestao de chaves por KMS/HSM, rate limiting, observabilidade
  centralizada, destino de deploy real ou SLA.
- Preview e Preprod sao redes de teste. Mainnet esta fora do escopo.

Esses limites devem aparecer com transparencia em qualquer apresentacao
comercial: ha uma prova funcional do controle e da ancoragem, nao uma plataforma
empresarial hospedada pronta para producao.

## Decisoes de arquitetura

| Decisao | Estado | Motivo |
| --- | --- | --- |
| Vercel para interface publica e APIs curtas | definida, nao implantada | entrega web simples, CDN e deploy integrado ao Git |
| Neon PostgreSQL com Prisma | definida, nao implantada | dados transacionais, migracoes e historico de auditoria |
| Worker Midnight persistente em Docker | obrigatorio antes do deploy publico | carteira, sync, proof server e dados de prova nao cabem em funcao serverless |
| Fila duravel entre API e worker | obrigatoria antes do deploy publico | ancoragem e longa e nao pode bloquear o navegador |
| Oracle Cloud Always Free como candidato ao worker | hipotese a validar | pode oferecer VM persistente sem custo inicial, mas capacidade e disponibilidade precisam ser comprovadas |
| Preprod como rede publica de validacao | ativo | permite provar a integracao sem custo de mainnet |
| Mainnet | nao planejada | so avaliar depois de operacao, custodia, observabilidade e suporte definidos |

Vercel, Neon e Prisma nao substituem o worker Midnight. Funcoes serverless sao
efemeras e tem limites de duracao; o worker precisa de volume persistente para
carteira e sincronizacao, proof server local e conexao de rede estavel.

## Arquitetura-alvo

~~~text
Navegador
    |
    v
Vercel: interface e API curta
    |                     \\
    |                      -> Neon PostgreSQL via Prisma
    v
Fila duravel -> worker Midnight persistente em Docker
                   |       |
                   |       -> proof server local, nunca publico
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

### Entrega 0: validar hospedagem do worker

Objetivo: provar que uma VM persistente executa Midnight antes de migrar a
aplicacao.

1. Criar a VM candidata, preferencialmente Oracle Always Free ARM se houver
   recursos disponiveis na regiao.
2. Instalar Docker e executar a imagem do proof server usada pelo projeto.
3. Criar volume persistente para dados de carteira e sincronizacao.
4. Executar health check, sync de carteira Preprod e uma ancora de teste.
5. Medir memoria, disco, tempo de sync frio e quente, prova e confirmacao.
6. Documentar custo real, limites de conta e recuperacao.

Aceite: uma ancora Preprod concluida no worker apos reinicio, com dados
persistidos e proof server inacessivel publicamente.

Nao compre plano pago nem envie a carteira ao faucet novamente sem necessidade.
Primeiro valide compatibilidade da VM e disponibilidade de capacidade.

### Entrega 1: persistencia e contratos de dados

1. Criar Neon PostgreSQL e repositorio Prisma.
2. Modelar organizacoes, usuarios, agentes, politicas, acoes, evidencias,
   decisoes, permits, execucoes, ancoras e operacoes assincronas.
3. Definir idempotencia, transacoes e retencao.
4. Migrar JsonStore por adaptacao incremental, preservando testes.
5. Separar evidencia auditavel de payload bruto e manter commitments/Merkle
   roots como referencia de integridade.

Aceite: duas requisicoes concorrentes nao emitem ou consomem o mesmo permit; a
auditoria pode ser consultada apos reinicio.

### Entrega 2: worker e fila

1. Definir interface de fila e operacao duravel.
2. Implementar worker Docker com health check, backoff e limite de concorrencia.
3. Mover carteira, proof server e CLI para o worker.
4. Criar timeouts por etapa e recuperacao segura de operacao interrompida.
5. Publicar metricas de sync, prova, submissao, confirmacao e falha.

Aceite: a API responde em segundos; a interface acompanha estados reais; uma
operacao pode ser retomada sem duplicar registro on-chain.

### Entrega 3: aplicacao publica controlada

1. Configurar Vercel, variaveis por ambiente e dominio.
2. Conectar Neon com pooling e Prisma.
3. Configurar autenticacao organizacional, papeis e escopo por tenant.
4. Adicionar rate limiting, CORS restritivo, cabecalhos de seguranca,
   validacao de origem de webhook e logs estruturados.
5. Manter a interface clara sobre Local, Preview e Preprod nao serem producao.

Aceite: nenhuma chave de carteira, PEM, endpoint de proof server ou arquivo de
estado esta no bundle, log publico ou variavel de cliente.

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

1. [README da raiz](../README.md);
2. [Arquitetura](ARCHITECTURE.md);
3. [Seguranca](SEGURANCA.md);
4. este documento;
5. [Integracao Midnight](MIDNIGHT.md).

Em seguida:

1. confirme git status --short --branch e nao reverta mudancas locais;
2. confirme quais contas ja existem: Vercel, Neon e Oracle;
3. escolha e valide a VM do worker antes de migrar dados ou expor a aplicacao;
4. nao rode faucet, deploy publico ou escrita on-chain sem confirmacao explicita;
5. nao prometa producao, SLA, mainnet ou integracao empresarial enquanto os
   criterios deste documento nao forem concluidos.

## Checklist de transicao

- [ ] Conta e regiao candidatas para worker identificadas.
- [ ] Compatibilidade Docker/proof server validada na VM.
- [ ] Volume persistente e backup definidos.
- [ ] Neon e Prisma modelados com migracoes revisadas.
- [ ] Fila e operacao assincrona implementadas.
- [ ] Segredos separados por ambiente e fora de Vercel/browser.
- [ ] Autenticacao, autorizacao por tenant e rate limiting implementados.
- [ ] Observabilidade e alertas testados.
- [ ] Primeiro cenario adicional com integracao externa real validado.
- [ ] Revisao de seguranca concluida antes de piloto.
