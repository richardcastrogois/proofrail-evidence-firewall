# Modelo de ameaças e estado de segurança

Este documento impede duas confusões: uma demonstração criptográfica não é automaticamente um serviço seguro; e uma transação real na Midnight não torna verdadeira uma evidência falsa produzida fora da cadeia.

## Ativos protegidos

- autoridade para executar deploy;
- identidade do agente e do aprovador;
- commit e digest do artefato;
- políticas, limites e versões;
- chaves de emissores, do permit e da carteira Midnight;
- evidência empresarial bruta;
- permits, âncoras e trilha de auditoria.

## Fronteiras de confiança

```text
Agente não confiável
  -> API autenticada
  -> conectores independentes
  -> motor determinístico
  -> contrato Midnight
  -> executor restrito
```

O agente nunca deve controlar a resposta das fontes, a chave do aprovador, a política, o registrador do contrato ou a implementação do executor.

## Controles implementados no Dia 01

| Ameaça | Controle atual |
|---|---|
| Evidência reaproveitada para outro deploy | recibo assina o `actionCommitment` completo |
| Troca de SHA, digest, ambiente ou agente | schema cruza campos e altera o commitment |
| Autodeclaração do agente | classe `self_declared` não satisfaz fonte exigida |
| Produção sem supervisão | fonte `review` obrigatória em produção ou risco alto |
| Risco acima do aceitável | limite absoluto gera `DENY` |
| Fonte falsa ou assinatura alterada | validação Ed25519 contra a chave cadastrada da origem |
| Evidência vencida | `issuedAt` e `expiresAt` conferidos pela política |
| Contradição | qualquer claim divergente bloqueia `ALLOW` |
| Permit substituído | assinatura e commitments da decisão são verificados |
| Permit sem registro correspondente | execução exige a âncora `ALLOW` exata |
| Validade divergente | validade do permit precisa ser igual à da âncora |
| Replay | permit é de uso único e segunda chamada retorna `409` |
| Exposição de evidência na cadeia | somente commitments, contagens e decisão são ancorados |

## Controles implementados no Dia 02

| Ameaça | Controle atual |
|---|---|
| Webhook forjado ou corpo alterado | HMAC SHA-256 validado sobre os bytes brutos com comparação em tempo constante |
| Reentrega do mesmo webhook | `X-GitHub-Delivery` único e processamento idempotente; o mesmo ID com conteúdo diferente falha com `409` |
| Evento de outro repositório/App | allowlist `owner/repo` e `installationId` exato |
| Branch muda após a decisão | a consulta usa `head_sha` exato, nunca o nome da branch |
| Check pendente ou falho | workflow precisa estar `completed` com `conclusion: success` |
| Artefato trocado | digest `sha256:` precisa pertencer a artefato não expirado do mesmo workflow run/SHA |
| Workflow antigo ou data futura | `updated_at` precisa estar dentro da janela de frescor da política; diferença futura de relógio é limitada a cinco minutos |
| Agente se passa por outro | assinatura Ed25519 cobre a ação canônica completa e é validada pela chave cadastrada do `agentId` |
| Excesso de privilégio do conector | token de instalação é solicitado para um repositório e somente `Actions: read` |
| Token de instalação persistido | token é usado em memória e não entra no store, recibo ou auditoria |
| Chaves misturadas ao estado | chaves privadas ficam em arquivo separado ignorado pelo Git; ausência causa falha fechada |
| Resposta externa excessiva | timeout de 10 s e leitura em streaming limitada a 1 MB |
| Recibo local adulterado | um recibo CI existente só é reutilizado depois de reverificar sua assinatura contra a chave da origem |

O recibo de CI é assinado pelo adaptador Proofrail **depois** de consultar o GitHub. Essa assinatura prova o que o conector verificou; não deve ser descrita como uma assinatura nativa do GitHub sobre o recibo.

## Riscos críticos ainda abertos

### P0 — bloqueiam exposição pública ou produção

- API sem identidade forte, RBAC/ABAC, rate limit distribuído e proteção operacional;
- chaves privadas ainda são arquivos locais; precisam migrar para KMS/HSM antes de produção;
- somente o CI possui primeiro conector real; identidade corporativa, scanner, aprovação e executor ainda são simulações;
- contrato Compact não restringe qual chamador pode registrar uma decisão;
- circuito recebe do backend commitments e contagens e ainda não prova assinaturas e política completas;
- estado JSON não garante transação atômica entre múltiplas instâncias;
- não há executor real com allowlist nem rollback;
- não há rotação/revogação de emissores e administradores.

### P1 — necessários antes de piloto empresarial

- PostgreSQL, migrations, locks/idempotência distribuída e fila confiável;
- KMS/HSM, envelope encryption e separação de chaves por ambiente;
- rate limit e idempotência distribuída para webhooks em múltiplas instâncias;
- logs estruturados com retenção, correlação e mascaramento;
- alertas, backups, disaster recovery, SLO e procedimento de incidente;
- testes de dependências, SAST, secrets scanning e supply chain.

## Regras obrigatórias para o futuro executor

O executor de deploy não deve aceitar um script ou comando shell escrito pelo agente. Ele deve receber um objeto fechado e validar:

- `agentId`, `taskId`, repositório, commit e digest;
- serviço, ambiente e ferramenta permitida;
- `requestId`, nonce, validade e consumo anterior;
- assinatura do permit, commitment da política e âncora Midnight;
- allowlist de workflow e ambiente;
- aprovação humana independente quando aplicável.

O deploy deve usar o artefato por digest, nunca reconstruir silenciosamente de uma branch.

## Contrato Compact: decisão de segurança

O contrato atual comprova contagem mínima, zero contradições e replay de `ALLOW`. Antes de produção, deve adotar um registrador autorizado. O padrão oficial de referência usa commitment de owner e witness privado para provar a autoridade sem expor o segredo. A adaptação precisa ser compilada, testada e reimplantada separadamente em cada rede; não deve ser feita por tentativa e erro em Preprod.

## Testes negativos obrigatórios

- assinatura desconhecida ou alterada;
- recibo de outro `requestId` ou outro commitment;
- SHA correto com digest incorreto e vice-versa;
- branch muda depois da aprovação;
- fonte repetida fingindo independência;
- aprovação do próprio agente;
- claim vencida ou emitida no futuro;
- contradição em CI, scanner ou ambiente;
- permit expirado, alterado, de outra rede/contrato ou já consumido;
- tentativa de registrar decisão por chamador não autorizado;
- falha entre ancoragem e execução;
- indisponibilidade e reorganização de rede.

## Veredito atual

Os Dias 01 e 02 melhoram vínculo, separação de deveres, replay, identidade do agente e proveniência do CI. Ainda não resolvem identidade humana/empresarial, custódia profissional, todos os conectores, registrador on-chain, banco distribuído ou executor real. A versão pode ser demonstrada e integrada a um repositório de teste; não deve ser exposta como serviço de produção.
