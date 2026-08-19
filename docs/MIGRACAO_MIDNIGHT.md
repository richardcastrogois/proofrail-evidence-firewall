# Proofrail na Midnight: estado real e próximos passos

## Resposta curta

O projeto já executa uma integração real com uma devnet Midnight local: carteira, node, indexer, proof server, prova, transação e contrato Compact. Também conhece os ambientes públicos Preview/Testnet e Preprod.

Isso não significa que a visão de produção esteja completa. O GitHub CI já possui um primeiro conector real opcional; as demais origens ainda são simuladas e o backend ainda calcula boa parte da decisão. O contrato reforçado valida o resumo enviado, mas ainda não prova dentro do circuito todas as assinaturas, regras e fatos privados.

## O que foi validado

| Camada | Estado atual |
|---|---|
| React + API | nove cenários; agente + deploy é o piloto principal |
| Core | ausência, commitment incorreto, contradição, revisão humana e replay testados |
| Criptografia local | Ed25519, AES-256-GCM, SHA-256 e Merkle root |
| Permit | assinado, vinculado, temporário, ancorado e de uso único |
| Compact | compila e registra decisões na devnet local |
| Devnet local | node, indexer e proof server em Docker |
| Preview/Testnet | implantada e validada com escrita e negativos on-chain |
| Preprod | configurada; implantação depende de faucet/saldo |
| Fontes empresariais reais | GitHub CI implementado; demais fontes ainda não integradas |
| Execução empresarial real | executor staging validado com GitHub Actions; destino real e rollback pendentes |

O endereço atual de cada contrato não deve ser copiado para a documentação, porque muda a cada implantação. A fonte correta é:

```powershell
Get-Content (Join-Path (Get-Location) "midnight-chain\.midnight-state.json")
```

## O que o contrato Compact verifica agora

Cada âncora contém:

- Merkle root das evidências aceitas;
- commitment da política;
- commitment da ação;
- decisão;
- validade;
- quantidade de fontes comprovadas;
- quantidade mínima exigida;
- quantidade de contradições.

Para `ALLOW`, o circuito exige:

- quantidade comprovada maior ou igual à exigida;
- zero contradições;
- action commitment ainda não utilizado em outro `ALLOW`.

Os dados brutos não são enviados à cadeia. Commitments e decisão são divulgados de propósito para auditoria.

## Segurança fora do contrato

A API também verifica:

- cenário e tipo de ação iguais aos da política;
- mesma `requestId`, sujeito, referência e valor;
- assinatura e chave pública do recibo;
- origem/classe exigida;
- validade temporal;
- ausência de contradições;
- assinatura e expiração do permit;
- commitments do permit iguais aos da decisão;
- existência da âncora antes da execução;
- consumo único do permit.

No fluxo agente + deploy, o permit também fica vinculado à versão da política, ao identificador e validade da âncora, à rede e ao contrato. Uma evidência só serve quando seu `actionCommitment` corresponde ao conjunto completo de agente, tarefa, repositório, commit, artefato, serviço, ambiente, ferramenta, risco, nonce e `requestId`.

A API limita corpo HTTP, escuta em `127.0.0.1`, restringe CORS ao localhost e deixa a leitura do dado bruto desativada, salvo quando `ALLOW_RAW_EVIDENCE_READ=true` for definido conscientemente.

## Limite criptográfico que ainda existe

O circuito recebe as contagens e os commitments preparados pelo backend. Portanto, ele impede inconsistências simples, mas não recalcula sozinho toda a política privada.

Uma migração completa precisa fazer o circuito verificar o bundle privado:

- assinaturas dos emissores;
- registro, rotação e revogação de chaves autorizadas;
- classes de origem e independência;
- vínculo de todos os campos com a ação;
- frescor e expiração;
- contradições;
- versão e commitment da política;
- limite de risco;
- autorização de quem pode registrar decisões.

Witnesses são dados off-chain e não devem ser tratados como confiáveis sem assertions no circuito.

### Risco P0 do contrato atual

O circuito ainda não restringe qual identidade pode chamar `registerDecision`. Isso significa que uma implantação pública não deve ser tratada como pronta enquanto o contrato não verificar um registrador autorizado. A referência oficial Bulletin Board demonstra o padrão de owner commitment + witness privado; a adaptação ao Proofrail precisa ser compilada, testada contra chamador indevido e implantada separadamente em cada rede.

## Local, Preview/Testnet e Preprod

| Tela | ID técnico | Infraestrutura | Uso recomendado |
|---|---|---|---|
| Local | `undeployed` | node, indexer e proof server locais | desenvolvimento e testes rápidos |
| Testnet | `preview` | rede pública + proof server configurado | demonstração pública e integração |
| Preprod | `preprod` | rede pública + proof server configurado | ensaio antes de produção |

### Snapshot oficial verificado em 19/08/2026

A [matriz de compatibilidade](https://docs.midnight.network/relnotes/support-matrix), atualizada em 18/08/2026, informa para Preview: node `1.0.1`, Compact devtools `0.5.1`, compiler `0.31.1`, Compact runtime `0.16.0`, Compact JS `2.5.1`, Midnight.js `4.1.1`, Wallet SDK `1.2.0`, indexer `4.3.5` e proof server `8.1.0`. A [tabela oficial de ambientes e endpoints](https://docs.midnight.network/relnotes/network), também atualizada em 18/08/2026, mantém Preview para desenvolvimento inicial, com:

- RPC `https://rpc.preview.midnight.network`;
- indexer `https://indexer.preview.midnight.network/api/v4/graphql`;
- faucet `https://midnight-tmnight-preview.nethermind.dev/`.

O projeto está alinhado às versões do compiler, runtime, Midnight.js, Wallet SDK e proof server, além dos endpoints públicos `api/v4`. O node `0.22.5` e o indexer standalone `4.2.1` do `docker-compose.yml` pertencem somente à devnet local reproduzível e permanecem pinados por compatibilidade; a matriz das redes públicas não justifica trocá-los sem validar em conjunto node, indexer, genesis e contrato local.

O registro npm também foi conferido: `create-mn-app` está em `0.4.4`. O
template oficial dessa versão conserva Compact runtime `0.16.0`, Midnight.js
`4.1.1`, Wallet SDK `1.2.0` e os mesmos endpoints Preview usados pelo projeto.
Não há justificativa para migrar para canary ou Wallet SDK 2 beta para contornar
uma indisponibilidade sem diagnóstico oficial.

O estado local contém uma carteira Preview financiada com `5.000.000.000
tNight`, `25.000.000.000.000.000.000` DUST e implantação Preview persistida.
Em 19/08/2026, o contrato
`e9ed0dbb07103d43eaae6de797da1edd178689a3026b169d9d1d673d72465e06`
foi confirmado pelo indexer público. Uma escrita `ALLOW` real gerou a transação
`00d85149f3621fb277f178b7f8d1288d838e9e5d7a7d7c74f7653c908adf605599`
no bloco `490247`. Repetir o mesmo `ALLOW` falhou com `ALLOW action already
anchored`; `ALLOW` com 4/5 evidências falhou com `insufficient evidence`; e
`ALLOW` com contradição falhou com `contradictions block ALLOW`.

Observação operacional: a sincronização Preview levou mais de 120 s em
19/08/2026. O verificador de saldo usa agora timeout padrão maior para redes
públicas, preservando `MIDNIGHT_BALANCE_SYNC_TIMEOUT_MS` para override manual.

Cada rede tem sua própria carteira e contrato no arquivo `.midnight-state.json`. Para preparar:

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\05-scaffold-midnight.ps1 -Network undeployed
PowerShell -ExecutionPolicy Bypass -File .\scripts\05-scaffold-midnight.ps1 -Network preview
PowerShell -ExecutionPolicy Bypass -File .\scripts\05-scaffold-midnight.ps1 -Network preprod
```

Preview e Preprod mostram endereço e faucet na primeira tentativa. Financie a carteira com tNIGHT e execute o mesmo comando novamente. O botão da tela passa a funcionar quando a implantação daquela rede existir.

Segundo o guia oficial atual, o faucet entrega tNIGHT para um endereço **unshielded**. A carteira usa tNIGHT para delegar/gerar DUST; faucet, sincronização e maturação são dependências externas e podem limitar o teste no mesmo dia. Consulte sempre [Acquire tokens](https://docs.midnight.network/guides/acquire-tokens) antes de financiar uma rede.

## Definition of Done para produção

A visão completa só deve ser chamada de pronta quando:

- pelo menos uma origem externa real produzir evidência verificável;
- emissores autorizados tiverem rotação e revogação;
- a política crítica for comprovada dentro do circuito;
- somente uma identidade autorizada puder registrar ou atualizar a política;
- dados privados não aparecerem no estado público;
- testes negativos falharem dentro da prova;
- o executor real rejeitar chamadas sem permit válido;
- segredos estiverem em KMS/HSM;
- API tiver identidade, escopo, rate limit e trilha imutável;
- persistência transacional e idempotência distribuída estiverem implementadas;
- o fluxo completo passar em Preview e depois Preprod.

## Ordem recomendada

1. Manter a devnet local como laboratório reproduzível.
2. Integrar uma API assinada real como primeira origem.
3. Criar registro on-chain de emissores e administradores autorizados.
4. Mover regras e validações críticas para o circuito Compact.
5. Criar testes de contrato para falsificação, expiração, contradição e replay.
6. Colocar o permit como requisito técnico de um executor real controlado.
7. Adicionar KMS/HSM, PostgreSQL, autenticação e observabilidade.
8. Implantar em Preview, executar testes negativos e repetir em Preprod.

## Diagnóstico honesto

O Proofrail demonstra bem a tese: autodeclaração não basta, evidência isolada pode não bastar, contradição bloqueia, provas compatíveis liberam uma ação e os dados brutos podem perder a chave sem apagar a auditabilidade.

O ponto mais forte é a separação entre evidência, decisão, autorização e
execução. O GitHub CI e o executor staging já foram validados contra workflow e
artefatos reais em 19/08/2026. O maior risco ainda é a concentração de
confiança no backend, nas origens que permanecem simuladas e na ausência de
registrador autorizado on-chain. O próximo passo é adicionar
identidade/scanner independentes, webhook HTTPS público controlado e fazer o
circuito verificar a parte crítica da política.

Referências oficiais verificadas em 19/07/2026:

- [Midnight: acquire tokens](https://docs.midnight.network/guides/acquire-tokens)
- [Midnight: Bulletin Board DApp](https://docs.midnight.network/examples/dapps/bboard)
