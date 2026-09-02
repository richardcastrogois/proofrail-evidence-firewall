# Estado Local, Segredos e Arquivos Nao Versionados

## Regra principal

Arquivos ignorados pelo Git existem para manter segredos, carteiras e dados de
execucao fora do repositorio. Eles podem ser necessarios para executar uma
instalacao especifica, mas nao devem ser enviados por e-mail, chat, commit,
print, arquivo ZIP ou drive compartilhado sem controle de acesso.

O arquivo versionado .env.example e o modelo de configuracao. Ele documenta
nomes de variaveis sem conter valores reais.

## Inventario

| Caminho ou padrao | Por que existe localmente | Como obter | Compartilhar? |
| --- | --- | --- | --- |
| .env | configuracao da maquina e integracoes | copiar .env.example e preencher o minimo necessario | somente valores nao sensiveis; segredos pelo canal corporativo |
| data/store.json | estado de demonstracao, recibos, decisoes e auditoria local | gerado pela aplicacao | nao; cada desenvolvedor pode gerar o proprio estado |
| data/private/signing-secrets.json | chaves privadas locais de recibos e permits | gerado pela aplicacao/migracao | nunca |
| data/private/service-auth.json | hashes e chaves publicas confiadas pela API | gerar com service-auth:init ou receber configuracao sem segredos | somente se o responsavel autorizar; preferir gerar por ambiente |
| data/private/service-auth-secrets.json | tokens locais e chave privada do aprovador | gerado junto com service-auth:init | nunca |
| data/private/executor.json | allowlists do executor | copiar config/executor.example.json e ajustar sem token | pode ser revisado sem tokens; nao enviar junto com credenciais |
| data/raw | ciphertexts de evidencia bruta | gerado pela aplicacao | nao, salvo procedimento de auditoria aprovado |
| midnight-chain | scaffold oficial, dependencias, contrato compilado e estado de runtime | gerar com scripts/05-scaffold-midnight.ps1 | nao copie a pasta entre pessoas; ela pode conter estado sensivel |
| midnight-chain/.midnight-state.json | seed de carteira, deployment e segredo registrador | criado pelo scaffold/carteira | nunca |
| midnight-chain/.midnight-wallet-state | checkpoint e estado privado da wallet | criado durante sync | nunca |
| *.pem, *.key, *.p12, *.pfx | chaves de integracao, certificados e GitHub App | responsavel de seguranca | nunca |
| .codex, .agents, .vscode, .idea | configuracao local, caminhos e preferencias de ferramenta | cada maquina | nao versionar |
| logs, dist, coverage, node_modules | artefatos gerados | comandos locais | nao |

## O que um desenvolvedor deve pedir ao senior

Depois de clonar, o desenvolvedor deve pedir ao responsavel tecnico:

1. qual modo precisa executar: somente Local, Midnight local, Preview ou
   Preprod;
2. o arquivo .env minimo para aquele ambiente, ou os valores nao sensiveis que
   deve preencher a partir de .env.example;
3. se a demonstracao exige GitHub App, quais variaveis de integracao foram
   provisionadas e por qual cofre ou gerenciador de segredos elas serao
   entregues;
4. se precisa executar o workflow de staging, uma configuracao executor.json
   sem token e a orientacao de qual token pessoal de menor privilegio usar;
5. qual rede Midnight esta autorizada e se o desenvolvedor deve criar carteira
   propria de teste.

O senior nao deve entregar seed, mnemonic, .midnight-state.json,
.midnight-wallet-state, signing-secrets.json, service-auth-secrets.json, PEM
ou token de outra pessoa. Esses arquivos permitem agir em nome do dono ou
acessar estado sensivel.

## Carteira Midnight: politica de equipe

Nao compartilhe sua carteira pessoal ou de desenvolvimento com estagiarios.
Mesmo em testnet, compartilhar seed causa tres problemas:

- qualquer pessoa pode gastar os mesmos tokens e bloquear o trabalho de outra;
- o estado local e os UTXOs podem entrar em conflito entre maquinas;
- a chave deixa de ter um responsavel identificavel e nao pode ser revogada de
  forma limpa.

Para aprendizado, cada desenvolvedor cria sua propria carteira Preview ou
Preprod e solicita tokens ao faucet correspondente. Para uma demonstracao
compartilhada, o responsavel executa a ancoragem em uma maquina controlada.
Na arquitetura hospedada, uma carteira de servico existira somente no worker
Midnight com volume persistente, controles de acesso e rotacao; ela nunca sera
distribuida para computadores pessoais.

## Antes de qualquer commit

No PowerShell, na raiz do repositorio:

~~~powershell
git status --short --ignored
git diff --check
~~~

Se aparecer um arquivo de segredo como nao ignorado, pare e fale com o senior.
Nao use git add -f para contornar o .gitignore.

Para revisar o modelo de configuracao sem revelar valores:

~~~powershell
Get-Content .env.example
Get-Content config\executor.example.json
~~~

No Linux ou WSL:

~~~bash
git status --short --ignored
git diff --check
sed -n '1,220p' .env.example
sed -n '1,220p' config/executor.example.json
~~~

Consulte tambem [Onboarding de desenvolvimento](DEVELOPER_ONBOARDING.md) e
[Seguranca](SEGURANCA.md).
