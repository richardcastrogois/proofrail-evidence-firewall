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

Em 19/08/2026, o gate Preview/Testnet também foi validado: carteira com
`5.000.000.000 tNight`, DUST positivo, contrato Preview
`e9ed0dbb07103d43eaae6de797da1edd178689a3026b169d9d1d673d72465e06`,
escrita `ALLOW` real na transação
`00d85149f3621fb277f178b7f8d1288d838e9e5d7a7d7c74f7653c908adf605599`
e negativos on-chain de replay, evidência insuficiente e contradição.

O fechamento operacional do executor também foi validado em 19/08/2026 com
credencial separada `Actions: write`: o CI real passou no run
`32311156415`, artefato `proofrail-web` `9386498611`, digest
`sha256:8f1f325979e8fd580f1c6b7dc3b5777cae71347e0176b3fcc585d86adc4860c7`;
o fluxo autenticado emitiu permit `2da99087-694f-414d-8efe-7244eed84db9`,
ancorou `ALLOW` em Preview na transação
`00589341add7d33f266c6e7fd66586c2c3ad963c443b300031a595a011d1f7f6ab`;
o executor consumiu o permit uma vez e disparou o workflow real de staging
`32312003968`, que terminou com `success` e gerou o artefato
`proofrail-staging-f4907d8e-dd2f-4f21-babf-b572de97bc4b` `9386764596`.
Uma segunda tentativa de execução do mesmo permit retornou
`PERMIT_ALREADY_CONSUMED`. O webhook usado nessa validação foi assinado com
HMAC e injetado localmente com payload de run real; entrega HTTPS pública
GitHub -> API continua fora deste recorte local.

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

## Evidência de validação em 19/08/2026

- contratos compilam em API, web, MCP, core e shared;
- testes negativos cobrem autenticação, aprovação, allowlists, replay e corrida;
- duas chamadas concorrentes com a mesma chave causam um único dispatch;
- store v3/v4/v5 migra para v6 com backup e sem chaves privadas;
- `npm audit --omit=dev --audit-level=high`, `npm test`,
  `npm run typecheck` e `npm run build` passam no WSL com Node 22;
- `npm run check-balance -- --network preview` confirma saldo e DUST;
- `npm run test:e2e -- --network preview` confirma o contrato no indexer;
- `npm run cli -- anchor ... ALLOW` registrou escrita real em Preview;
- replay, evidência insuficiente e contradição falham com asserts do circuito;
- fluxo HTTP autenticado em `MIDNIGHT_MODE=cli` emitiu `ALLOW` e permit em
  `preview`;
- execução de permit de simulação foi recusada com `PERMIT_INVALID` por falta
  de proveniência GitHub CI real;
- CI real da branch `codex/day-03-final-validation` passou no GitHub Actions
  run `32311156415` para o commit
  `fba27e939f535b2d155412fd2e2f68f1f3a634ec`;
- o executor real consumiu o permit Preview uma única vez, disparou o staging
  run `32312003968` e bloqueou replay com `PERMIT_ALREADY_CONSUMED`.
