# Proofrail: autorizacao verificavel para acoes de alto risco

## Resumo

Proofrail e uma camada de controle que fica entre um pedido sensivel e sua
execucao. Antes de um agente de IA, automacao ou usuario executar um deploy,
pagamento, acesso privilegiado ou operacao sobre dados, o produto exige
evidencias independentes, aplica uma politica deterministica, ancora a decisao
e libera um permit de uso unico somente para a acao exata aprovada.

Em vez de perguntar apenas "quem pediu?", Proofrail responde:

- qual acao foi solicitada;
- quais fatos externos confirmam essa acao;
- qual politica foi aplicada;
- quem aprovou quando revisao humana era exigida;
- qual decisao foi tomada;
- qual executor realizou o efeito e se o permit foi reutilizado.

## Problema

Agentes e automacoes ja conseguem chamar ferramentas e alterar sistemas reais.
Autenticacao tradicional identifica o solicitante, mas nao impede que ele:

- troque o commit ou artefato depois da aprovacao;
- apresente uma declaracao propria como se fosse prova externa;
- ignore uma contradicao de CI, seguranca ou aprovacao;
- use uma autorizacao antiga em outro contexto;
- acione um executor generico com argumentos arbitrarios.

Isso cria uma lacuna entre autonomia e controle. Empresas precisam permitir
velocidade sem transformar agentes em administradores irrestritos.

## Proposta de valor

Proofrail transforma uma acao em uma autorizacao verificavel e limitada.

~~~text
pedido -> evidencias independentes -> politica -> ancora Midnight
       -> permit de uso unico -> executor fechado -> auditoria
~~~

O resultado e uma fronteira de confianca antes do efeito colateral. Um agente
pode propor uma acao, mas nao pode aprova-la sozinho, alterar seus campos
protegidos, ignorar contradicoes ou reutilizar uma permissao consumida.

## Como funciona

### 1. Camada de experiencia

A interface apresenta os cenarios, mostra as evidencias exigidas, permite
registrar confirmacoes ou conflitos, exibe a decisao e acompanha o ciclo do
permit. Ela foi desenhada para demonstrar o controle, nao para mascarar
integracoes inexistentes.

### 2. Camada de compromisso da acao

Campos como agente, tarefa, repositorio, commit, artefato, servico, ambiente,
risco e nonce formam um commitment SHA-256. Qualquer mudanca relevante gera
outro commitment e invalida a evidencia ou permit anterior.

### 3. Camada de evidencias

Cada origem gera um recibo assinado que vincula fonte, claim, acao, horario e
valor normalizado. O produto separa origem autodeclarada de origem independente.
Uma declaracao do proprio agente nao satisfaz uma fonte exigida pela politica.

O primeiro conector externo real e a GitHub App: ela verifica workflow de CI,
SHA e artefato antes de emitir o recibo Proofrail correspondente.

### 4. Camada de politica

O motor avalia as evidencias de forma deterministica e retorna DENY,
REVIEW_REQUIRED ou ALLOW. Contradicoes bloqueiam ALLOW. Risco elevado ou
producao pode exigir aprovacao humana independente.

### 5. Camada de privacidade e ancoragem

O backend calcula a raiz de Merkle das evidencias e ancora commitments da
acao, politica e decisao em um contrato Compact na Midnight. A cadeia nao
recebe documento, identidade empresarial, payload bruto ou evidencia completa.

O contrato exige registrador autorizado, protege contra replay de ALLOW e tem
rotacao, revogacao e recuperacao de registrador.

### 6. Camada de autorizacao e execucao

Depois da ancora valida, Proofrail emite um permit assinado, curto e vinculado
a acao, politica, evidencia, rede, contrato e prazo. O executor consome o
permit uma unica vez e aceita somente um fluxo fechado de staging; ele nao
aceita shell, workflow ou destino arbitrario enviados pelo agente.

## Caso demonstrado

O fluxo Agent + Deploy esta validado de ponta a ponta:

1. um agente solicita deploy de um commit e artefato especificos;
2. identidade do agente, politica de ferramenta, CI e scanner sao exigidos;
3. producao ou risco elevado exige aprovacao humana independente;
4. a decisao e ancorada na Midnight;
5. um permit limitado autoriza o workflow de staging;
6. o executor valida os bindings e bloqueia replay.

O contrato Compact e as matrizes de seguranca foram exercitados em Local,
Preview e Preprod. O conector GitHub e o workflow de staging tambem foram
validados com GitHub Actions.

## Onde se aplica

- autorizacao de releases e deploys;
- concessao de acesso privilegiado e credenciais temporarias;
- pagamentos, reembolsos e operacoes de tesouraria;
- uso de ferramentas por agentes autonomos;
- exportacao, exclusao e compartilhamento de dados sensiveis;
- checagens de fornecedor, compliance, sinistro, credito e onboarding.

Os nove cenarios visuais mostram como a politica pode variar. Eles nao devem
ser apresentados como integracoes completas quando ainda usam evidencias de
laboratorio. Hoje, Agent + Deploy e a prova de integracao mais completa.

## Diferenciais

- evidencia ligada a acao imutavel, nao a uma aprovacao generica;
- fontes independentes e contradicao como bloqueio;
- separacao entre agente, aprovador, conector e executor;
- politica explicita e reproduzivel;
- recibo de auditoria e permit de uso unico;
- ancoragem com preservacao de privacidade;
- executor fechado em vez de automacao com shell livre.

## Estado atual e caminho para piloto

O produto atual comprova o desenho e o fluxo Agent + Deploy em ambiente local
e redes Midnight de teste. Ainda nao e uma plataforma empresarial hospedada.
Faltam banco transacional, autenticacao organizacional, fila duravel, worker
Midnight persistente, custodia de chaves, observabilidade centralizada e
destino real de deploy.

O proximo passo de produto e hospedar interface e API curta na Vercel, dados em
Neon com Prisma e o componente Midnight em um worker Docker persistente. A
ancoragem passara a ser assincrona para o usuario nao esperar sincronizacao,
prova e confirmacao dentro de uma unica requisicao HTTP.

Detalhes tecnicos e plano de implantacao estao em
[Arquitetura](ARCHITECTURE.md), [Seguranca](SEGURANCA.md) e
[Deploy e proximos passos](DEPLOYMENT_AND_NEXT_STEPS.md).
