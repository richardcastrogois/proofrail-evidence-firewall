# Etapa 04: Compact, Preprod e operacao

Este documento registra o fechamento tecnico da Etapa 04. Preprod e um ensaio
publico final da Midnight; nao e producao e nao substitui controles corporativos
de identidade, disponibilidade, banco transacional, KMS/HSM e observabilidade.

## Escopo entregue

- registrador autorizado por commitment publico e secret witness privado;
- rotacao e revogacao do registrador com contador publico de epoca;
- versao e commitment da politica vinculados a ancora e ao permit;
- quantidade minima de evidencias, contradicao, validade e replay verificados no circuito;
- carteiras e contratos separados por `undeployed`, `preview` e `preprod`;
- matriz negativa executavel pela CLI;
- logs da API correlacionados por request ID, com redacao de segredos;
- logs Docker limitados a tres arquivos de 10 MB e proof server sem modo verboso;
- procedimentos de incidente, backup, recuperacao e rollback abaixo.

## Evidencias de fechamento

| Ambiente | Contrato | Estado validado |
| --- | --- | --- |
| Local | `84b4309c3787eef686ebda0c1e898e2c4106824e8cb6182b9ac1674b309986ba` | matriz 10/10; transacao ALLOW `00bb8b132eaa0d833868611835e3b047918c1085222adbbd67edd624522dfc5d45`; registrador recuperado |
| Preview | `c3683d7c2d75156495f89f7dfab16d184bc2e23af1eb0d0dfd43e56317f75a58` | matriz 10/10; transacao ALLOW `008696eab0d513704f64bd355bd609ce9b7c7359d0997099153a7a4802b4c965df`; registrador recuperado |
| Preprod | `9a1a5ae1cbb7bd5a64e649c5c9b63c9740907df53a2a1a0ba98f8e3a1b33fdd5` | E2E aprovado; matriz 10/10; transacao final da matriz `00232315c78e7ed7459e91724c94dd4c9f47cfe4a27493651036caa6226666fca1`; registrador recuperado |

O gate Preprod foi aprovado em 21/08/2026. A carteira financiada foi restaurada
do checkpoint, sincronizou, registrou uma NIGHT UTXO, gerou DUST e implantou o
contrato separado. O E2E encontrou o contrato no indexer na primeira consulta e
a matriz publica aprovou os dez controles.

## Comandos de validacao

Execute no PowerShell, em `C:\dev\rational-gate`:

```powershell
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate && npm test && npm run typecheck && npm run build"
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate/midnight-chain && npm run compile && npx tsc --noEmit"
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate/midnight-chain && npm run cli -- security-check --network undeployed"
```

Repita o ultimo comando com `preview` e `preprod` somente depois que cada rede
tiver carteira financiada e contrato proprio implantado. O resultado correto e
uma linha `SECURITY_RESULT` em que todos os controles sao `true`.

Para inspecionar apenas estado publico do contrato:

```powershell
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate/midnight-chain && npm run cli -- read --network preprod"
```

O comando nao imprime seed nem segredo do registrador.

## Preparar Preprod

```powershell
& .\scripts\05-prepare-midnight-wallet.ps1 -Network preprod
```

1. Copie somente o endereco publico exibido.
2. Solicite tNIGHT no faucet Preprod indicado pelo script.
3. Confira o saldo:

```powershell
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate/midnight-chain && npm run check-balance -- --network preprod"
```

4. Implante e valide:

```powershell
& .\scripts\05-scaffold-midnight.ps1 -Network preprod
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate/midnight-chain && npm run test:e2e -- --network preprod"
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate/midnight-chain && npm run cli -- security-check --network preprod"
```

### Diagnostico da primeira tentativa Preprod

Evidencias preservadas em 20/08/2026:

- endereco financiado: `mn_addr_preprod1tmrk2y8p5r3732xa9403ey3vrfv4xcasugdmq8zqc79v3utnacuqvh89u2`;
- transacao retornada pelo faucet: `0070f44db7a519c415f188a59fceb5d5abd7039533e56ab177f117ce33bb86a336`;
- `waitForSyncedState()` permaneceu ativo por 60 min 22 s;
- processo Node permaneceu executando e chegou a aproximadamente 83% de CPU;
- nao houve erro fatal de RPC, consulta de saldo, registro de DUST ou deploy;
- nao foi criada pasta `preprod` em `.midnight-wallet-state` nessa tentativa;
- a seed e o endereco permanecem em `.midnight-state.json`, que nao deve ser publicado.

Conclusao: nao ha evidencia de falta de faucet, porque o faucet confirmou uma
transacao. Tambem nao ha confirmacao local do saldo, pois a carteira nao terminou
de sincronizar para consultar a UTXO. O bloqueio observado foi a sincronizacao
inicial da carteira/SDK, anterior ao Proofrail e ao deploy do contrato.

Na proxima tentativa, verifique primeiro o saldo isoladamente:

```powershell
Set-Location C:\dev\rational-gate
PowerShell -ExecutionPolicy Bypass -File .\scripts\05-prepare-midnight-wallet.ps1 -Network preprod
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate/midnight-chain && npm run check-balance -- --network preprod"
```

Interpretacao:

- `Wallet is funded`: faucet confirmado; prossiga para deploy;
- `Wallet has no tNight`: aguarde a indexacao e consulte novamente; so repita o
  faucet depois de confirmar que o endereco exibido e exatamente o mesmo;
- `Wallet sync timed out`: o saldo ainda nao foi consultado; nao significa saldo
  zero e nao justifica novo faucet.

O deploy agora aplica limite padrao de 75 minutos e tenta salvar um checkpoint
da carteira antes de sair. Para uma janela de 90 minutos:

```powershell
$env:MIDNIGHT_DEPLOY_SYNC_TIMEOUT_MS = 5400000
PowerShell -ExecutionPolicy Bypass -File .\scripts\05-scaffold-midnight.ps1 -Network preprod
Remove-Item Env:MIDNIGHT_DEPLOY_SYNC_TIMEOUT_MS
```

O checkpoint reduz trabalho repetido quando o Wallet SDK consegue serializar o
estado parcial, mas nao garante retomada no mesmo bloco. RPC e indexer Preprod
continuam dependencias externas.

### Retomada e fechamento em 21/08/2026

A verificacao isolada de saldo atingiu o limite de 2.700 segundos e salvou um
checkpoint best-effort. Na segunda execucao, a carteira restaurou `3/3` child
wallets, concluiu a sincronizacao e confirmou saldo de `1,000,000,000 tNight`.
Nao foi solicitado novo faucet.

O deploy seguinte registrou uma NIGHT UTXO, aguardou DUST, confirmou o proof
server e implantou o contrato Preprod. As validacoes finais retornaram:

- `e2e-check passed`, contrato localizado no indexer na tentativa `1/8`;
- `SECURITY_RESULT.passed: true`;
- 10/10 controles aprovados: registrador nao autorizado, evidencia insuficiente,
  contradicao, expiracao, caminho autorizado, replay, rotacao, rejeicao do
  registrador anterior, revogacao e recuperacao.

O limite de sincronizacao e uma protecao operacional para bootstrap e
diagnostico; nao deve ser tratado como SLO do produto.

## Rotacao, revogacao e emergencia

Rotacao planejada:

```powershell
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate/midnight-chain && npm run cli -- rotate-registrar --network preprod"
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate/midnight-chain && npm run cli -- read --network preprod"
```

O segredo novo e gerado e persistido no estado privado somente depois da
confirmacao on-chain. O campo publico `registrarEpoch` deve aumentar.

Em suspeita de comprometimento:

```powershell
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate/midnight-chain && npm run cli -- revoke-registrar --network preprod"
```

Depois da revogacao, pare a API e o executor. Nenhuma nova decisao pode ser
registrada. Investigue o incidente, rotacione credenciais externas e execute
`rotate-registrar`; a rotacao reativa o registrador com uma nova epoca.

## Backup e recuperacao

Faca backup criptografado e com acesso restrito de:

- `midnight-chain/.midnight-state.json`;
- `midnight-chain/.midnight-wallet-state/`;
- `data/private/`;
- configuracao de principals, executor e variaveis de ambiente no cofre real.

Nunca inclua esses itens no Git ou em anexos. Para recuperar, restaure os
arquivos na mesma versao do codigo, valide o saldo com `check-balance`, leia o
estado publico com `cli -- read` e execute a matriz negativa antes de liberar a
API. Se a chave do registrador nao puder ser confiada, revogue ou implante um
novo contrato e atualize a configuracao da rede.

## Rollback operacional

1. Pare API e executor para impedir novos efeitos.
2. Revogue o registrador quando houver risco de novas ancoragens indevidas.
3. Preserve logs, request IDs, commits, transaction IDs e artefatos do incidente.
4. Reverta a aplicacao para um commit validado; nao reverta o historico on-chain.
5. Se o contrato estiver comprometido, implante outro endereco e trate o antigo
   como somente leitura.
6. Execute testes, matriz negativa e fluxo positivo antes de reabrir.

## Logs e diagnostico

Use `LOG_LEVEL=debug` apenas durante investigacao. A API produz JSON estruturado
com `reqId`, `operation`, `durationMs`, rede e transaction ID. Authorization,
cookies, assinaturas, tokens, seeds e chaves privadas sao redigidos.

```powershell
docker compose -f .\midnight-chain\docker-compose.yml -f .\midnight-chain\docker-compose.override.yml ps
docker compose -f .\midnight-chain\docker-compose.yml -f .\midnight-chain\docker-compose.override.yml logs --tail 100 proof-server
```

O proof server nao deve executar com `-v`: esse modo pode registrar o payload
das requisicoes de prova.

## Garantias e limites

| Area | Garantia atual | Limite aceito |
| --- | --- | --- |
| Compact | registrador, politica, contagens, contradicao, validade e replay verificados no circuito | upgrade exige novo deploy e migracao de endereco |
| Evidencia | recibos assinados e vinculados ao commitment da acao | somente GitHub CI possui conector externo completo |
| Executor | permit assinado, ancorado, restrito a staging e de uso unico | store JSON serializa somente uma instancia |
| Midnight | contratos e carteiras isolados por rede | confirmacao publica depende de RPC, indexer e proof server |
| Operacao | logs correlacionados e redigidos | sem stack de metricas, alertas e tracing distribuido |
| Desempenho | timeout impede espera infinita e a interface mostra tempo decorrido | CLI fria em `/mnt/c` recarrega artefatos ZK; operacao comercial requer worker Linux nativo persistente |
| Producao | nenhuma alegacao de prontidao para producao | faltam IAM corporativo, rate limit distribuido, KMS/HSM, banco transacional e SLOs |
