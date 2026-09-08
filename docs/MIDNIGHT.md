# Integracao Midnight

## Objetivo

Proofrail usa Midnight para ancorar uma decisao de autorizacao sem publicar a
evidencia empresarial bruta. A cadeia recebe commitments criptograficos,
estado publico minimo e o resultado da decisao; os recibos completos permanecem
fora da cadeia.

~~~text
acao vinculada -> recibos assinados -> politica deterministica
               -> raiz de Merkle e commitments -> contrato Midnight
               -> permit de uso unico -> executor controlado
~~~

## Contrato e fronteira de confianca

O contrato Compact esta em [midnight/contract/hello-world.compact](../midnight/contract/hello-world.compact)
e e copiado para [midnight-chain/contracts/hello-world.compact](../midnight-chain/contracts/hello-world.compact).
O nome fisico e preservado porque o scaffold oficial usa esse caminho para
providers e artefatos gerados.

Cada registerDecision registra:

- Merkle root das evidencias;
- commitments de acao e politica;
- resultado da decisao e prazo de validade;
- contagem de evidencias e contradicoes;
- registro publico de que aquele commitment de acao ja foi usado.

Um ALLOW so pode ser registrado quando a evidencia exigida esta presente, nao ha
contradicao e o commitment ainda nao foi consumido. A chamada exige um
registrador autorizado. O contrato tambem contempla rotacao, revogacao e
recuperacao do registrador.

O contrato nao conhece identidade corporativa, documento, valor financeiro,
payload da acao, recibo bruto ou segredo. Ele nao substitui a politica e o
executor: recebe apenas o resumo preparado pelo backend. A integridade dessa
ponte depende das chaves de servico, da politica e da infraestrutura onde o
backend e o worker executam.

## Redes suportadas

| Rede | Uso | Estado esperado |
| --- | --- | --- |
| undeployed | desenvolvimento local | contrato e proof server locais |
| preview | testes publicos rapidos | carteira, faucet e contrato proprios |
| preprod | validacao publica de pre-producao | carteira, faucet e contrato proprios |

Nao trate Preview ou Preprod como producao. Sao redes publicas de teste,
sujeitas a disponibilidade, reinicializacoes e tempo variavel de sincronizacao.
Mainnet nao faz parte do escopo atual.

O contrato validado em Preprod foi implantado no endereco:

~~~text
9a1a5ae1cbb7bd5a64e649c5c9b63c9740907df53a2a1a0ba98f8e3a1b33fdd5
~~~

O endereco e um registro de validacao deste repositorio, nao uma promessa de
disponibilidade permanente da rede nem autorizacao para reutilizar carteiras ou
chaves de outra instalacao.

## Carteiras, faucet e estado local

Cada rede usa carteira e contrato independentes. Prepare uma carteira publica:

~~~powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\05-prepare-midnight-wallet.ps1 -Network preprod
~~~

O comando mostra um endereco mn_addr e o URL do faucet correspondente. Envie
somente o endereco publico ao faucet. Nunca compartilhe seed ou mnemonic,
.midnight-state.json, .midnight-wallet-state, chaves de servico, arquivos .env
ou PEM da GitHub App.

Depois do faucet, confirme sincronizacao e saldo:

~~~powershell
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate/midnight-chain && npm run check-balance -- --network preprod"
~~~

O primeiro sync de uma carteira ou host pode levar varios minutos. O comando
persiste checkpoints em .midnight-wallet-state; uma execucao posterior retoma
desse ponto. Mensagens de desconexao RPC com fechamento normal podem ocorrer
durante a sincronizacao. O resultado confiavel e a conclusao com Wallet is
funded e saldo diferente de zero.

## Implantar e validar

Com a carteira Preprod financiada:

~~~powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\05-scaffold-midnight.ps1 -Network preprod
~~~

O processo compila o contrato, inicia o proof server local e faz o deploy.
Execute contra rede publica somente com intencao explicita: consome tokens de
teste e altera estado publico.

Valide contrato e matriz negativa:

~~~powershell
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate/midnight-chain && npm run test:e2e -- --network preprod"
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate/midnight-chain && npm run cli -- security-check --network preprod"
~~~

O primeiro comando confirma que o indexador consulta o contrato implantado. O
segundo deve retornar passed: true para registrador nao autorizado, evidencia
insuficiente, contradicao, decisao expirada, replay e rotacao/revogacao.

## Execucao local com ancoragem publica

~~~powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\06-run-with-midnight.ps1
~~~

Abra http://localhost:5173, selecione a rede desejada e execute a demonstracao.
A API local ainda chama a CLI Midnight para cada ancora nova. Por isso, a
primeira operacao em Preview ou Preprod pode restaurar a carteira, sincronizar,
gerar prova e aguardar confirmacao. Esse atraso e uma caracteristica da
arquitetura atual de desenvolvimento, nao uma experiencia aceitavel para a
aplicacao hospedada.

O caminho de evolucao esta em [Deploy e proximos passos](DEPLOYMENT_AND_NEXT_STEPS.md):
um worker persistente mantem carteira e sincronizacao quentes, enquanto o
navegador recebe o estado assincrono da operacao.

## Operacao segura

- Mantenha proof server, carteira e dados de sincronizacao fora de funcoes
  serverless e de diretorios efemeros.
- Use carteira de servico por ambiente; nunca use a carteira de teste para uma
  instalacao real.
- Restrinja a chave registradora ao worker de ancoragem e estabeleca rotacao e
  recuperacao antes de qualquer piloto.
- Monitore tempos de sync, prova, submissao, confirmacao, falhas de RPC e
  saldo de tokens.
- Nao exponha a porta do proof server ao navegador ou internet publica.
