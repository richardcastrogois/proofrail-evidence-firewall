# Etapa 03 — autenticação, aprovação e execução controlada

Este documento registra o contrato e a implementação dos incrementos 03.1 a
03.3. Os schemas executáveis ficam em `packages/shared/src/day03.ts`; a matriz
de rotas fica em `apps/api/src/access-control.ts`.

## Estado deste incremento

Contratos, autenticação, aprovação assinada e executor controlado estão
implementados e validados localmente. A API aplica menor privilégio a todas as
rotas: somente `/api/health` é pública e o webhook conserva HMAC próprio. O
executor externo permanece desabilitado quando sua configuração ou credencial
separada não existe. A API continua limitada a `127.0.0.1`; este recorte não
inclui rate limit distribuído nem IAM corporativo.

## Atores e separação de deveres

| Ator | Responsabilidade | Autoridade que não possui |
|---|---|---|
| Agente solicitante | Assina a ação exata que deseja executar. | Não aprova, não emite permit e não executa. |
| Serviço/orquestrador | Coleta evidências e solicita avaliação. | Não aprova e não consome permit. |
| Aprovador humano | Assina a aprovação para decisão e commitments exatos. | Não atua como agente nem executor. |
| Executor | Consome um permit válido e dispara uma operação predefinida. | Não escolhe comando, repositório, workflow, serviço ou ambiente. |
| Operador local | Seleciona cenário/rede, executa simulações e tarefas de manutenção. | Não recebe por padrão scopes de aprovação ou execução. |

O `agentId` continua vindo da ação assinada. Identidades de serviço são
diferentes da identidade Ed25519 do agente. O carregamento rejeita token
duplicado, scope acima do teto do papel e reutilização da chave do agente pelo
aprovador.

## Scopes

Os principals possuem um `kind` e uma lista explícita de scopes. O schema aplica um teto por kind:

- `orchestrator`: `state:read`, `github:verify-ci`, `evidence:collect`, `decision:evaluate`;
- `approver`: `state:read`, `approval:create`;
- `executor`: `state:read`, `permit:execute`;
- `operator`: `state:read`, `scenario:select`, `network:select`, `evidence:expire`, `evidence:raw:read`, `simulation:run`, `system:reset`.

Scopes duplicados, desconhecidos ou incompatíveis com o kind falham no carregamento da configuração. O webhook GitHub continua autenticado por HMAC próprio e não usa credencial de serviço. Somente `/api/health` permanece público.

## Credencial do primeiro recorte

O Incremento 03.2 usa identidades de serviço locais configuradas fora do Git.
O contrato não define login visual nem provedor corporativo. A implementação:

- armazenar somente hash ou derivação não reversível do token;
- comparar credenciais em tempo constante;
- falhar na inicialização quando a configuração for inválida;
- nunca retornar ou registrar token, hash, PEM privado, seed ou mnemonic;
- não aceitar scopes informados pelo cliente;
- manter bind em localhost enquanto rate limit e identidade corporativa não existirem.

Esse recorte prova separação de deveres local; não equivale a IAM empresarial.

## Aprovação assinada

`POST /api/approvals` recebe um objeto estrito:

```json
{
  "approval": {
    "schemaVersion": 1,
    "decisionId": "uuid",
    "requestId": "uuid",
    "actionCommitment": "hex-64",
    "evidenceRoot": "hex-64",
    "policyCommitment": "hex-64",
    "approverId": "human-reviewer-01",
    "approverKeyId": "approver-key-2026-01",
    "approvedAt": "ISO-8601",
    "expiresAt": "ISO-8601"
  },
  "signature": "base64-ed25519"
}
```

A chave pública não faz parte do request. `approverKeyId` deve resolver para uma chave previamente confiada fora do Git. A rota futura deve verificar:

1. principal autenticado com `approval:create`;
2. assinatura canônica Ed25519;
3. decisão, `requestId` e três commitments iguais aos persistidos;
4. aprovação ainda válida e nunca além da validade da decisão/âncora;
5. `approverId` e chave diferentes do agente solicitante;
6. ausência de aprovação conflitante.

## Execução e idempotência

`POST /api/execute` recebe apenas:

```json
{ "permitId": "uuid" }
```

O header obrigatório `Idempotency-Key` usa UUID. O body é estrito: campos como
`command`, `script`, `args`, `url`, `workflow` ou `environment` são rejeitados.
Todo o escopo vem do permit persistido e é confrontado com allowlists
administradas fora da solicitação.

Estados:

```text
pending -> executing -> succeeded
                    \-> failed
pending ----------------> failed
```

- `pending`: reserva atômica persistida para `(permitId, idempotencyKey)`;
- `executing`: a chamada externa começou;
- `succeeded`: referência externa mínima foi registrada;
- `failed`: código estável e não secreto foi registrado.

A mesma chave com o mesmo permit retorna o mesmo registro. A mesma chave com outro permit retorna `IDEMPOTENCY_CONFLICT`. Outro pedido para um permit já reservado ou consumido não pode iniciar uma segunda ação externa.

O adaptador `GitHubWorkflowExecutor` aceita somente:

- o repositório e o serviço da allowlist;
- o workflow fixo `staging-deploy.yml` em uma referência configurada;
- `environment=staging` e `requestedTool=deploy`;
- SHA, digest, artifact ID e workflow run presentes no recibo CI verificado;
- permit assinado, vigente e vinculado à âncora da rede/contrato ativos.

A reserva `pending` é gravada antes do `workflow_dispatch`. Uma falha externa
vira `failed` e não libera o permit para outro efeito. O token `Actions: write`
é separado do GitHub App `Actions: read` usado para verificar CI.

## Erros dos novos endpoints

Os endpoints novos usam envelope estável:

```json
{
  "error": {
    "code": "INSUFFICIENT_SCOPE",
    "message": "The caller does not have approval:create",
    "requestId": "uuid"
  }
}
```

O schema não aceita campos extras. Mensagens não devem incluir credenciais, payload bruto, stack trace, assinatura, PEM ou resposta integral de provedor. As rotas antigas conservam temporariamente `{ "error": "..." }` para não introduzir quebra fora do recorte; a migração deve ser explícita.

## Evidência de validação em 23/07/2026

- contratos compilam em API, web, MCP, core e shared;
- testes negativos cobrem autenticação, aprovação, allowlists, replay e corrida;
- duas chamadas concorrentes com a mesma chave causam um único dispatch;
- store v3/v4/v5 migra para v6 com backup e sem chaves privadas;
- `npm test`, `npm run typecheck` e `npm run build` passam no Windows;
- o deploy Midnight Preview ainda não concluiu: a carteira está financiada,
  mas o RPC fechou a conexão durante o registro de DUST em três tentativas.
