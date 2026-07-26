# Guia simples do Proofrail

Este é o documento para entender o projeto antes de entrar nos detalhes técnicos.

## Em uma frase

O **Proofrail** é um firewall de evidências: antes de um sistema, funcionário ou agente de IA executar uma ação importante, ele exige confirmações de fontes independentes, aplica uma regra objetiva e só libera a ação quando as provas combinam.

## Que problema ele resolve

Um documento pode parecer correto e ainda ser falso. Uma API pode responder algo errado. Um usuário pode afirmar que tem autorização sem realmente ter. Uma IA pode pedir uma ação fora do seu limite.

O Proofrail não tenta “adivinhar a verdade”. Ele separa quatro coisas:

1. **Ação proposta:** o que alguém quer fazer.
2. **Evidências de origem:** quais sistemas confiáveis confirmam os fatos.
3. **Política:** quantas confirmações são exigidas, por quanto tempo valem e o que bloqueia.
4. **Execução:** a ação só pode acontecer com uma autorização temporária e de uso único.

Exemplo: para pagar uma nota fiscal, a palavra do solicitante não basta. O ERP confirma a aprovação, a logística confirma a entrega e o cadastro confirma que o fornecedor está ativo. Se faltar uma confirmação ou uma fonte contradizer outra, o pagamento é negado.

## O primeiro produto: agente de IA + deploy

O caso mais completo e viável para evoluir primeiro é controlar um deploy solicitado por um agente de IA. Em linguagem simples: **o agente pode pedir, mas não pode dar a si mesmo a permissão de publicar**.

O pedido descreve exatamente:

- qual agente e tarefa iniciaram a operação;
- qual repositório e commit devem ser usados;
- qual digest imutável identifica o artefato;
- qual serviço e ambiente receberão o deploy;
- qual ferramenta o agente quer usar;
- qual risco foi calculado;
- qual nonce e `requestId` tornam o pedido único.

Depois, cinco atores diferentes podem comprovar partes do pedido:

1. **Identidade do agente:** confirma que o agente existe e abriu a tarefa.
2. **Política de ferramentas:** confirma que ele pode publicar aquele serviço naquele ambiente.
3. **Pipeline CI:** confirma testes e build do mesmo commit.
4. **Scanner de segurança:** confirma que o artefato exato não possui achado bloqueador.
5. **Responsável humano:** aprova produção ou risco elevado; essa fonte tem papel de revisão e não pode ser substituída pela palavra do agente.

Tecnicamente, cada recibo assinado contém um `actionCommitment`. Se alguém trocar o SHA, o artefato, o ambiente, o agente ou qualquer outro campo depois da comprovação, o hash muda e a evidência deixa de servir. Em `ALLOW`, o permit também carrega os commitments, a versão da política, o identificador da âncora, a rede, o contrato e a validade. O executor confere tudo isso e recusa reutilização.

Para uma apresentação, a mensagem é: **o Proofrail não tenta tornar a IA confiável; ele limita o que ela consegue executar sem provas externas e independentes**.

## Por que Midnight entra nisso

Depois de avaliar as evidências, o Proofrail cria resumos criptográficos chamados **commitments** e uma **Merkle root**. Eles funcionam como impressões digitais: permitem detectar alteração sem colocar notas fiscais, contratos ou dados pessoais na blockchain.

O contrato Compact da Midnight registra:

- impressão digital das evidências;
- impressão digital da política;
- impressão digital da ação;
- decisão `ALLOW`, `DENY` ou `REVIEW_REQUIRED`;
- validade, quantidade comprovada, quantidade exigida e contradições.

Para uma decisão `ALLOW`, o contrato rejeita evidência insuficiente, contradição e repetição da mesma ação. Isso fortalece o registro, mas há um limite importante: hoje o backend ainda prepara o resumo. O Pipeline CI já possui um conector GitHub real opcional; as demais origens permanecem simuladas. A blockchain comprova que o registro não foi alterado; ela não transforma uma origem simulada em um fato real.

## Como ler as duas telas

O site foi separado para não misturar explicação com operação:

- **Visão geral:** é a apresentação do produto. Explica o problema, o exemplo de documento falso, as cinco etapas, quem usa cada parte e onde a Midnight entra.
- **Demonstração:** é o laboratório. Primeiro aparece o botão **Rodar trilha completa** para o pitch; abaixo ficam cenários e controles manuais para aprender ou investigar cada etapa.

O fluxo visual das duas telas é:

```text
Propor → Comprovar → Decidir → Autorizar → Executar
```

- **Propor:** preencher quem/qual objeto será afetado, a referência e o valor ou risco.
- **Comprovar:** coletar recibos assinados das origens exigidas.
- **Decidir:** a política produz `DENY`, `REVIEW_REQUIRED` ou `ALLOW`.
- **Autorizar:** em `ALLOW`, é emitido um permit assinado, temporário e de uso único.
- **Executar:** o permit é consumido e não pode ser reutilizado.
- **Minimizar:** as chaves dos dados brutos podem ser destruídas, mantendo apenas recibos e commitments auditáveis.

Os números `01` a `05` são sempre as mesmas etapas. Um check ao lado do número mostra que a etapa terminou; ele não substitui nem renumera a etapa.

### Para que serve a auditoria

A trilha de auditoria não é o painel operacional principal de quem solicita a ação. Ela serve principalmente para compliance, segurança, auditoria interna ou externa e investigação de incidentes. É consultada depois de uma decisão, em uma disputa, fiscalização ou quando alguém precisa explicar por que uma automação ou agente recebeu autorização.

### O que significam os botões das fontes

No laboratório, você controla manualmente respostas que em produção viriam de ERP, IAM, CI, cadastro ou outro sistema:

- **Simular confirmação:** a origem confiável confirma o fato esperado.
- **Simular conflito:** a origem responde com valor ou estado divergente; a política deve bloquear a ação.

Em produção, uma pessoa normalmente não clicaria nesses botões. Conectores e workflows coletariam as respostas automaticamente.

### O que mudou no primeiro conector real

No cenário **Agente + Deploy**, a fonte **Pipeline CI** pode deixar de usar o botão manual. Um GitHub App recebe um webhook assinado, consulta o workflow pelo SHA exato e exige que o digest do artefato seja o mesmo declarado na ação. O agente também assina todo o pedido. Esse caminho é acionado por API ou MCP, porque representa uma automação real; a tela mostra se a integração está configurada, mas preserva os botões simulados para ensino e pitch.

Configuração e teste completo: `GITHUB_APP.md`.

## Teste manual, passo a passo

1. No topo, deixe a rede em **Local** para o primeiro teste.
2. Abra **Demonstração**. O cenário inicial deve ser **Agente + Deploy**.
3. Confira agente, commit, risco e o bloco **Escopo técnico vinculado**.
4. Clique em **Registrar alegação sem origem** e avalie. O esperado é `DENY`: o agente não comprova a própria autorização.
5. Simule confirmação nas quatro fontes obrigatórias e avalie novamente. O esperado é `REVIEW_REQUIRED`, pois produção e risco 45 exigem responsável humano.
6. Simule a confirmação de **Aprovação responsável** e avalie. O esperado é `ALLOW` com âncora e permit.
7. Clique em **Executar com permit**. A auditoria deve mostrar `ACTION_EXECUTED`.
8. Uma nova tentativa com o mesmo permit deve falhar, porque ele é de uso único.
9. Clique em **Destruir chaves**. Os dados brutos acessíveis devem cair para zero e a auditoria deve mostrar `CRYPTOGRAPHIC_ERASURE`.
10. Para validar contradição, reinicie, use **Simular conflito** em CI ou scanner e avalie. O esperado é `DENY`.

Para demonstrar documento falso, troque para **Pagamento** ou **Regularidade**. O arquivo escolhido é lido no navegador; a API recebe apenas nome, tamanho, tipo e SHA-256. Esse registro continua sendo uma **alegação sem origem confiável** e nunca satisfaz sozinho uma fonte exigida.

O arquivo escolhido é lido no navegador. Nesta demonstração, a API recebe apenas nome, tamanho, tipo e SHA-256, não o conteúdo bruto. O registro é uma **alegação não confiável** e não conta como uma das origens exigidas.

O fluxo foi novamente validado na devnet local em 19/07/2026: um documento autodeclarado gerou `DENY` na transação `009d408b…e59bee`; depois, três origens válidas geraram `ALLOW` na transação `006ce9dd…c3deba`, consumiram o permit, executaram a ação e destruíram quatro chaves. O contrato usado foi `ee758d725a…3f0fcb`.

## Teste automático para apresentação

O botão **Rodar trilha completa**, no início da demonstração, existe para o pitch e para representar uma integração empresarial.

Ele faz numa única chamada:

1. coleta todas as origens exigidas;
2. verifica assinaturas e vínculos com a mesma solicitação;
3. avalia a política;
4. registra a âncora Midnight;
5. consome o permit se a decisão for `ALLOW`;
6. destrói as chaves dos dados brutos;
7. devolve toda a trilha na auditoria.

No mundo real, normalmente um orquestrador, workflow ou agente faria essas etapas automaticamente. O modo manual continua na tela para ensinar e depurar cada etapa.

## Cenários disponíveis

Cada cenário troca campos, origens, limite e política na tela.

| Cenário | Ação protegida | Evidências exigidas | Regra automática principal |
|---|---|---|---|
| Agente + deploy | publicar artefato solicitado por agente | identidade, política da ferramenta, CI, scanner e responsável | produção ou risco acima de 40 exige revisão humana; acima de 80 é negado |
| Pagamento de fornecedor | liberar pagamento | ERP, logística e cadastro | acima de R$ 10 mil exige revisão |
| Liberação de crédito | conceder limite | identidade, bureau e renda | acima de R$ 50 mil exige revisão |
| Aprovação de contrato | autorizar contrato | jurídico, compliance e orçamento | acima de R$ 100 mil exige revisão |
| Deploy em produção | publicar uma versão | CI, segurança e aprovação de mudança | risco acima de 60 exige revisão |
| Análise de sinistro | pagar indenização | cobertura, vistoria e antifraude | acima de R$ 30 mil exige revisão |
| Regularidade de fornecedor | habilitar fornecedor | cadastro, situação fiscal e sanções | risco acima de 40 exige revisão |
| Ação de agente de IA | liberar uso de ferramenta | pedido assinado, escopo e supervisão | risco acima de 50 exige revisão |
| Dados sensíveis | permitir acesso/divulgação | IAM, DLP e dono do dado | sensibilidade acima de 60 exige revisão |

Outros bons cenários futuros são onboarding de clientes, alteração de dados bancários, emissão de reembolso, acesso privilegiado temporário e transferência de ativos digitais.

## Redes: Local, Testnet e Preprod

O seletor no topo muda o alvo usado pelas próximas âncoras:

- **Local:** node, indexer e proof server em Docker na sua máquina. É o melhor ambiente para aprender.
- **Testnet:** corresponde à rede pública `preview` da Midnight.
- **Preprod:** corresponde à rede pública `preprod`, usada como ensaio mais próximo da produção.

Trocar o botão muda endpoints, carteira ativa e contrato usado. A tela não inventa um contrato: se a carteira ainda não estiver financiada e o contrato não tiver sido implantado naquela rede, ela mostra essa pendência e o comando correto. Consulte `SETUP_WINDOWS.md`.

## Como iniciar e ver os logs

Abra um **PowerShell do Windows**. Não execute estes comandos dentro da aba Ubuntu.

```powershell
Set-Location C:\dev\rational-gate
PowerShell -ExecutionPolicy Bypass -File .\scripts\06-run-with-midnight.ps1
```

Deixe essa janela aberta. Ela é o servidor e exibirá logs com os prefixos `[API]` e `[WEB]`. Depois abra:

- interface: <http://localhost:5173>
- saúde da API: <http://localhost:3333/api/health>

Para parar, volte ao PowerShell e pressione `Ctrl+C`. Para iniciar novamente, execute o mesmo script.

Use o modo sem blockchain apenas quando quiser desenvolver mais rápido:

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\04-run-local.ps1
```

## Como confirmar que está realmente na Midnight

No PowerShell, com o servidor aberto em outra janela:

```powershell
Invoke-RestMethod http://127.0.0.1:3333/api/health
docker ps --format "table {{.Names}}\t{{.Status}}"
wsl -d Ubuntu -- bash -lc 'source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate/midnight-chain && npm run cli -- read'
```

O health deve mostrar `mode: cli`. No modo local, os três contêineres Midnight devem estar saudáveis. O `nextId` do contrato cresce quando uma decisão é ancorada.

## Em que pé o projeto está

### Resumo de 22/07/2026

- **Dia 01 concluído:** o domínio de agente + deploy, as políticas, os commitments, o permit e os caminhos `DENY`, `REVIEW_REQUIRED`, `ALLOW` e replay foram implementados e validados localmente.
- **Dia 02 concluído no código:** o conector GitHub App, webhook HMAC, consulta por SHA/digest e identidade Ed25519 foram implementados e cobertos por testes locais.
- **Dia 02 ainda tem uma pendência externa:** criar e instalar o GitHub App em um repositório de teste e receber um workflow real. Sem isso, o conector existe, mas ainda não possui evidência operacional externa.
- **Versionamento fechado:** GitLab privado é a fonte principal protegida; GitHub privado é o espelho. Os dois pipelines passaram sobre o mesmo commit.
- **Dia 03 local concluído:** autenticação por scopes, aprovação humana
  assinada, executor staging fechado e idempotência persistida foram
  implementados e validados.
- **Próximo gate:** concluir a submissão do contrato em Preview. A carteira
  está financiada, mas o RPC encerrou a conexão durante o registro de DUST. O
  executor GitHub também permanece desabilitado até receber configuração e
  token `Actions: write` próprios. A API não deve ser exposta publicamente.

### Git explicado para quem está começando

Pense nestes elementos como partes diferentes:

| Elemento | O que é | Como é usado aqui |
|---|---|---|
| repositório local | pasta e histórico na sua máquina | onde você edita, testa e cria commits |
| branch | linha de trabalho separada | cada etapa nasce em `codex/nome-curto`; `main` contém somente trabalho aprovado |
| commit | fotografia identificada das alterações | registra exatamente o que mudou e permite auditoria ou retorno controlado |
| remoto `gitlab` | servidor principal privado | recebe branches, executa pipeline e protege `main` por Merge Request |
| remoto `origin` | servidor espelho privado no GitHub | mantém portfólio/compatibilidade e executa uma segunda validação |
| pipeline | robô que instala, audita, testa e compila | impede que um Merge Request com falhas seja aceito no GitLab |
| Merge Request | pedido para incorporar uma branch à `main` | é o ponto de revisão e controle no GitLab |

Fluxo seguro, sempre a partir do PowerShell em `C:\dev\rational-gate`:

```powershell
git switch main
git pull --ff-only gitlab main
git switch -c codex/minha-alteracao

# editar e validar
npm audit --omit=dev --audit-level=high
npm test
npm run typecheck
npm run build

git add docs/GUIA_DO_PROJETO.md
git commit -m "tipo: resumo objetivo"
git push -u gitlab codex/minha-alteracao
```

No GitLab, crie o Merge Request, aguarde o pipeline verde e faça o merge. Depois sincronize o espelho:

```powershell
git switch main
git pull --ff-only gitlab main
git push origin main
```

Não clique em **Publicar Branch** sem verificar o remoto, não envie diretamente para `main` e não use `git add -f`. O arquivo `.gitignore` existe para impedir que `.env`, chaves, estado da carteira e dados privados entrem no commit.

### Última validação antes do Dia 03

Em 22/07/2026, a base foi reinstalada no ambiente correto do projeto (Ubuntu/WSL) e passou por uma rodada completa:

- `npm audit --omit=dev --audit-level=high`: 0 vulnerabilidades;
- `npm test`: conector GitHub, webhook, migração do store e as 9 políticas passaram;
- `npm run typecheck`: API, web, MCP, core e schemas passaram;
- `npm run build`: frontend gerado com sucesso;
- ação sem evidências: `DENY`, 0 de 5 fontes, ancorada na devnet;
- trilha completa: `ALLOW`, 5 de 5 fontes, transação `00112e2f…e7f771` no contrato local `ee758d725a…3f0fcb`;
- leitura independente pelo CLI confirmou o mesmo contrato e `nextId: 8`;
- permit emitido e consumido uma vez; segunda execução recusada com HTTP `409`;
- cinco chaves destruídas e dados brutos acessíveis reduzidos a `0 B`;
- endpoint de dados brutos permaneceu bloqueado com HTTP `403`;
- frontend respondeu HTTP `200` e API informou `mode: cli`;
- node, indexer e proof server Midnight permaneceram ativos; são os três containers esperados.

Durante a validação, a inicialização detectou `node_modules` instalado pelo Node do Windows. Como o projeto roda no WSL, o `esbuild` precisava da versão Linux. A correção foi executar `npm ci` dentro do Ubuntu, como já orienta `SETUP_WINDOWS.md`. Não misture `npm install` do Windows com a mesma pasta usada pelo WSL.

### Funciona hoje

- nove cenários e políticas determinísticas;
- fluxo principal de agente + deploy com fontes obrigatórias e fonte de revisão separadas;
- vínculo criptográfico de agente, tarefa, repositório, commit, artefato, serviço, ambiente, ferramenta, risco e nonce;
- fluxo manual e fluxo completo em um clique;
- recibos assinados com Ed25519;
- dados brutos criptografados com AES-256-GCM;
- vínculo de cada evidência à mesma solicitação, cenário, sujeito, referência e valor;
- detecção de ausência, contradição, expiração e tentativa de replay;
- permit assinado, temporário e de uso único;
- Merkle root e commitments;
- ancoragem por contrato Compact na Midnight;
- Local, Testnet/Preview e Preprod selecionáveis;
- auditoria e apagamento criptográfico.
- GitLab privado com `main` protegida e pipeline obrigatório;
- GitHub privado sincronizado como espelho, com workflow de validação independente.

### Ainda é demonstração

- o GitHub CI possui conector real opcional; aprovação local é criptográfica,
  mas identidade corporativa e scanner ainda são simulados, e o executor
  staging depende de credencial operacional externa;
- chaves privadas ficam em arquivo local;
- não há login, papéis de usuário nem KMS/HSM;
- o armazenamento é JSON, não banco transacional;
- a API foi restringida ao localhost, mas não está pronta para exposição pública;
- o contrato ainda não restringe qual identidade pode chamar `registerDecision`;
- o circuito valida contagens, contradições e replay de `ALLOW`, porém ainda recebe do backend o resumo da decisão;
- não existe ainda uma prova Compact completa de cada assinatura, frescor e regra privada;
- Testnet e Preprod exigem carteira financiada pelo faucet e implantação separada.
- o GitHub App ainda precisa ser criado/instalado para que o recibo de CI seja validado contra um workflow externo real.

## Próximas melhorias recomendadas

1. Integrar uma origem externa real e assinada.
2. Levar verificação de emissores e política privada para o circuito Compact.
3. Substituir tokens locais e aprovador local por identidade corporativa/KMS.
4. Mover segredos para KMS/HSM e dados para PostgreSQL com migrations.
5. Tornar coleta, decisão e execução idempotentes e resilientes a falhas.
6. Validar o executor controlado contra o workflow staging com credencial
   mínima e adicionar rollback do destino real.
7. Criar testes automatizados de API, frontend, MCP, contrato e ponta a ponta.
8. Implantar e repetir os testes negativos em Preview e Preprod.

Para instalação detalhada, use [`SETUP_WINDOWS.md`](SETUP_WINDOWS.md). Para entender cada pasta e arquivo, use [`ARCHITECTURE.md`](ARCHITECTURE.md). Para os limites criptográficos e a evolução até produção, use [`MIGRACAO_MIDNIGHT.md`](MIGRACAO_MIDNIGHT.md).
