# Plano de evolução em quatro dias

Este plano transforma o Proofrail de laboratório em um primeiro serviço demonstrável. O recorte principal é **agente de IA que solicita deploy**. Local, Preview/Testnet e Preprod são gates sucessivos; não devem ser tratados como três produtos diferentes.

## Resultado esperado ao final

Uma solicitação real identifica agente, tarefa, repositório, commit, artefato, serviço e ambiente. Conectores independentes comprovam identidade, permissão, CI e segurança. Produção exige revisão humana. A política gera uma decisão, a Midnight registra a âncora e um executor controlado aceita um permit uma única vez.

## Dia 01 — contrato da aplicação e política segura

Objetivo: fazer o domínio representar corretamente agente + deploy antes de integrar sistemas externos.

Entregas:

- criar o cenário `agent_deploy` e torná-lo o piloto inicial;
- vincular a ação a agente, tarefa, repositório, SHA, digest, serviço, ambiente, ferramenta, risco e nonce;
- separar fontes obrigatórias de fonte de revisão;
- exigir revisão para produção ou risco acima do limite automático;
- negar risco acima do limite absoluto;
- incluir o commitment completo da ação em cada recibo;
- vincular o permit à versão da política, âncora, rede, contrato e validade;
- comprovar `DENY -> REVIEW_REQUIRED -> ALLOW -> execução -> replay bloqueado`;
- atualizar site, MCP e documentação sem chamar simulação de produção.

Estado em 19/07/2026: **concluído no modo local**. Testes de core, typecheck, build e fluxo HTTP passaram. A interface foi inspecionada no navegador. O fluxo ainda usa origens e executor simulados.

Critério de aceite:

```text
0 fontes                         -> DENY
4 fontes técnicas               -> REVIEW_REQUIRED
4 fontes + responsável humano   -> ALLOW
primeiro consumo do permit       -> sucesso
segundo consumo                  -> HTTP 409
```

## Dia 02 — primeiro conector real e identidade

Objetivo: remover a principal simulação ligando o Proofrail a um repositório e pipeline reais.

Entregas:

- preparar um repositório Git privado com branch principal protegida e validação automática;
- criar uma GitHub App com permissões mínimas de leitura de repositório, checks e artefatos;
- receber webhook autenticado com validação HMAC sobre o corpo bruto, delivery ID e idempotência;
- consultar o check suite pelo SHA exato, nunca por branch mutável;
- validar que o digest informado pertence ao build daquele SHA;
- modelar identidade do agente/gateway MCP com chave ou workload identity rotacionável;
- substituir pelo menos `Pipeline CI` por um recibo real assinado pelo conector;
- guardar segredos fora de `data/store.json` e impedir log de token, seed ou payload sensível;
- adicionar testes de assinatura inválida, webhook repetido, SHA trocado e artefato substituído.

Estado em 22/07/2026: **implementação concluída e validada localmente; Git e
CI privados estão operacionais.** Em 19/08/2026, o conector também foi validado
contra workflow e artefato reais durante o fechamento do Dia 03.

Implementado:

- GitLab privado definido como repositório principal, com `main` protegida, push direto bloqueado e pipeline obrigatório;
- GitHub privado mantido como espelho, com workflow de validação; os dois remotos foram sincronizados no mesmo commit;
- GitHub App com token de instalação limitado ao repositório e `Actions: read`;
- webhook sobre corpo bruto com HMAC SHA-256, allowlist, installation ID e `X-GitHub-Delivery` idempotente; colisão do mesmo ID com outro conteúdo retorna `409`;
- consulta do workflow concluído com sucesso pelo SHA exato;
- validação de artefato não expirado e digest SHA-256 pertencente ao mesmo workflow run;
- identidade Ed25519 rotacionável do agente e assinatura da ação canônica;
- recibo real de `Pipeline CI`, assinado pelo adaptador Proofrail depois da verificação externa;
- chaves das origens e do permit migradas para `data/private/signing-secrets.json`, fora do store e do Git;
- limite de 10 s e 1 MB nas respostas consumidas da API do GitHub;
- recibo CI armazenado só é reutilizado depois de reverificar sua assinatura;
- testes de função e de rota HTTP para ação alterada, HMAC alterado, replay, colisão, digest substituído e recibo adulterado.

Pendente de exposição pública: configurar um endpoint HTTPS para receber o
webhook diretamente do GitHub, com rate limit e política operacional. A
validação de commit, workflow e artefato reais foi executada em 19/08/2026 com
payload real assinado e injetado localmente.

Critério de aceite atendido para o recorte local: workflow e artefato corretos
produzem recibo; outro SHA, check pendente, assinatura incorreta, digest
trocado, colisão de delivery e recibo adulterado falham ou exigem nova
verificação. A reentrega idêntica é aceita sem duplicar evento. A entrega
pública do webhook ainda precisa ser comprovada antes de expor a API.

### Fechamento antes do Dia 03

O fechamento de versionamento foi validado em 22/07/2026:

1. a mudança entrou na `main` do GitLab por Merge Request;
2. o pipeline do GitLab passou antes do merge;
3. a mesma `main` foi enviada ao espelho GitHub;
4. o GitHub Actions passou sobre o mesmo commit;
5. branches temporárias já mescladas foram removidas;
6. branches automáticas do Dependabot foram retiradas do espelho, pois o GitLab é a fonte principal e o audit já roda nos dois pipelines.

Isso encerra a infraestrutura Git necessária para começar o Dia 03. Não encerra a pendência externa do GitHub App: integração de CI real e infraestrutura de versionamento são controles relacionados, mas diferentes.

## Dia 03 — executor controlado, autenticação e Preview

Objetivo: provar que o permit controla uma ação real em ambiente não produtivo.

Estado em 19/08/2026: **Dia 03 concluído no recorte planejado.** 03.1, 03.2 e
03.3 foram validados localmente; 03.4 foi validado em Preview/Testnet; e o
executor GitHub real foi validado com credencial `Actions: write` separada,
CI real, artifact/run real, dispatch fechado para staging e replay bloqueado.

Implementado:

- autenticação bearer local com tetos de scopes e separação entre
  orquestrador, aprovador, executor e operador;
- aprovação humana Ed25519 independente, vinculada a decisão, request e três
  commitments;
- executor fechado de `workflow_dispatch`, somente staging, com credencial
  separada, allowlists e proveniência do artefato;
- reserva persistida antes do efeito externo, estados v6, replay idempotente e
  bloqueio de corrida/segundo consumo;
- workflow de staging que baixa o artifact ID verificado, confere run, SHA e
  digest e cria deployment no environment `staging`;
- suíte integrada verde: testes, typecheck e build.

Gate Preview: a carteira sincronizou com `5.000.000.000 tNight` e
`25.000.000.000.000.000.000` DUST, o proof server local respondeu saudável, o
contrato Preview `e9ed0dbb07103d43eaae6de797da1edd178689a3026b169d9d1d673d72465e06`
foi encontrado no indexer público, e uma âncora `ALLOW` foi registrada na
transação
`00d85149f3621fb277f178b7f8d1288d838e9e5d7a7d7c74f7653c908adf605599`
no bloco `490247`. A matriz negativa on-chain bloqueou replay, evidência
insuficiente e contradição com os asserts esperados. O fluxo HTTP autenticado
também emitiu `ALLOW` com permit vinculado à rede `preview` e ao contrato
acima.

Gate executor: o CI real da branch `codex/day-03-final-validation` passou no
run `32311156415` para o commit
`fba27e939f535b2d155412fd2e2f68f1f3a634ec`, gerando o artefato `proofrail-web`
`9386498611` com digest
`sha256:8f1f325979e8fd580f1c6b7dc3b5777cae71347e0176b3fcc585d86adc4860c7`.
O fluxo autenticado emitiu permit Preview
`2da99087-694f-414d-8efe-7244eed84db9`, ancorado na transação
`00589341add7d33f266c6e7fd66586c2c3ad963c443b300031a595a011d1f7f6ab`.
O executor consumiu o permit uma vez, disparou o workflow real
`staging-deploy.yml` no run `32312003968`, que terminou com `success`, e gerou
o artefato `proofrail-staging-f4907d8e-dd2f-4f21-babf-b572de97bc4b`
`9386764596`, digest
`sha256:476d86f5d3e621afcf9bda96b5c845a21702640e208650788b478e8196aca2ee`.
Replay do mesmo permit retornou `PERMIT_ALREADY_CONSUMED`.

Limite operacional restante: o webhook usado na validação foi assinado com HMAC
e injetado localmente com payload de run real. A entrega HTTPS pública
GitHub -> API, identidade corporativa, scanner real, KMS/HSM, banco
transacional, rollback e Preprod ficam para o Dia 04 ou posteriores.

Entregas:

- adicionar autenticação de serviço e escopos na API;
- implementar endpoint de aprovação humana com identidade diferente do agente;
- criar executor restrito inicialmente a `staging`, com allowlist de repositório, workflow, serviço e ambiente;
- fazer o executor verificar assinatura, commitments, âncora, expiração, nonce e consumo atômico;
- nunca aceitar comando shell arbitrário enviado pelo agente;
- financiar carteira Preview/Testnet, gerar DUST conforme o Wallet SDK e implantar o contrato próprio da rede;
- executar testes positivos e negativos em Preview;
- adicionar observabilidade correlacionada por `requestId`, sem dados brutos.

Critério de aceite: uma solicitação aprovada publica apenas em staging e gera transação Preview; qualquer alteração no escopo ou replay falha antes do deploy.

## Dia 04 — endurecimento Compact, Preprod e operação

Objetivo: reduzir a confiança no backend e preparar uma demonstração técnica responsável.

Entregas:

- adicionar administradores/registradores autorizados ao contrato Compact conforme o padrão de owner commitment e witness da documentação Midnight;
- provar no circuito as regras críticas que couberem no recorte: autorização do registrador, versão/commitment da política, quantidade, contradição, validade e replay;
- definir rotação/revogação de emissores e procedimento de emergência;
- executar threat model e testes de abuso do contrato, API, webhook e executor;
- financiar e implantar contrato separado em Preprod;
- repetir a matriz negativa antes da demonstração positiva;
- preparar runbook, rollback, backup, recuperação e evidências do teste;
- publicar uma tabela final de garantias, limitações e riscos aceitos.

Critério de aceite: somente registrador autorizado ancora; Preview e Preprod possuem contratos e carteiras separados; o executor recusa qualquer permit que não corresponda à ação ancorada.

## Ordem dos ambientes

1. **Local:** desenvolvimento, testes rápidos e falhas intencionais.
2. **Preview/Testnet:** integração pública, faucet, sincronização e comportamento de rede.
3. **Preprod:** ensaio operacional final com configuração e contrato independentes.

Uma rede só avança quando a anterior passa tanto o caminho positivo quanto falsificação, contradição, expiração, replay, troca de SHA, troca de artefato e chamador não autorizado.

## Referências oficiais Midnight consultadas

- [Adquirir tokens de teste](https://docs.midnight.network/guides/acquire-tokens)
- [Bulletin Board DApp](https://docs.midnight.network/examples/dapps/bboard)
- [Documentação Midnight](https://docs.midnight.network/)

As referências foram verificadas em 19/07/2026. Antes de executar Preview ou Preprod, confirme novamente endpoints, faucet e versões do toolchain, pois são dependências externas mutáveis.
