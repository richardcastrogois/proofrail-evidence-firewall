# Proofrail

**Firewall de evidências para agentes, automações e decisões de alto risco.**

O Proofrail fica entre uma intenção e sua execução. Ele descreve exatamente a ação pedida, exige recibos assinados de fontes independentes, aplica uma política determinística e emite um permit temporário e de uso único somente quando as provas cobrem a mesma ação.

O primeiro piloto une **agente de IA + deploy**: um agente pode solicitar a publicação, mas não pode provar sozinho a própria identidade, escolher outro commit, substituir o artefato nem aprovar uma mudança de produção. Identidade, política da ferramenta, CI, scanner e aprovação responsável precisam concordar.

## O que o produto faz

```text
Agente solicita -> fontes comprovam -> política decide
        -> Midnight ancora -> permit autoriza -> executor consome uma vez
```

- vincula agente, tarefa, repositório, commit, artefato, serviço, ambiente, risco e nonce;
- rejeita evidência de outra ação, fonte desconhecida, assinatura inválida, dado vencido ou contraditório;
- retorna `DENY`, `REVIEW_REQUIRED` ou `ALLOW` de forma reproduzível;
- registra commitments e Merkle root na Midnight sem publicar a evidência empresarial bruta;
- assina um permit vinculado à decisão e à âncora, com validade curta e proteção contra replay;
- preserva uma trilha para segurança, compliance, auditoria e investigação.

## Cenários modelados

O laboratório possui nove políticas: agente + deploy, pagamento, crédito, contratos, deploy tradicional, sinistros, regularidade de fornecedores, uso de ferramentas por agentes e dados sensíveis. **Agente + deploy é o piloto principal**; os outros oito são modelos de política e ainda não possuem conectores empresariais reais.

## Estado atual, sem maquiagem

Implementado e testado:

- React/Vite, API Fastify, servidor MCP e schemas Zod compartilhados;
- recibos Ed25519 vinculados ao commitment da ação;
- AES-256-GCM, SHA-256, Merkle root e apagamento criptográfico;
- revisão humana obrigatória para produção ou risco elevado;
- permit assinado e vinculado à política, decisão, rede, contrato e âncora;
- execução única e bloqueio de replay;
- contrato Compact e CLI para Local, Preview/Testnet e Preprod;
- fluxo `DENY -> REVIEW_REQUIRED -> ALLOW -> executar -> bloquear replay` validado localmente.
- GitHub App com webhook HMAC, delivery ID idempotente e consulta do workflow pelo SHA exato;
- validação do digest do artefato no mesmo workflow run e recibo real de `Pipeline CI`;
- identidade Ed25519 do agente vinculada à ação e chaves privadas separadas de `data/store.json`.

Ainda é laboratório ou exige configuração externa:

- o conector de CI está implementado, mas só se torna real após configurar e instalar o GitHub App; os botões manuais continuam sendo simulações didáticas;
- as respostas de identidade corporativa, scanner, aprovação e a execução final ainda são simuladas;
- a API não possui autenticação empresarial, RBAC, rate limit distribuído ou banco transacional;
- chaves privadas locais ficam em `data/private`, fora do store e do Git, mas ainda não em KMS/HSM;
- o contrato ainda confia no backend para preparar a decisão e não restringe o registrador on-chain;
- Preview e Preprod dependem de carteira financiada e implantação própria em cada rede.

Portanto, a versão atual demonstra e testa as garantias; **não deve receber credenciais de produção nem executar deploy real**.

## Começar

No PowerShell do Windows, substitua o caminho abaixo pela pasta em que clonou o repositório:

```powershell
Set-Location C:\dev\rational-gate
PowerShell -ExecutionPolicy Bypass -File .\scripts\06-run-with-midnight.ps1
```

Abra <http://localhost:5173> e mantenha o terminal aberto para acompanhar `[API]` e `[WEB]`. Se a tela parecer antiga, encerre a instância anterior com `Ctrl+C` e execute o comando novamente; duas instâncias Vite podem fazer você validar código antigo.

## Documentação

- [Índice completo da documentação](docs/README.md)
- [Entender, apresentar e testar o produto](docs/GUIA_DO_PROJETO.md)
- [Plano de quatro dias e estado dos Dias 01 e 02](docs/PLANO_4_DIAS.md)
- [Fluxo privado GitLab principal + GitHub espelho](docs/REPOSITORIO_PRIVADO_GRATUITO.md)
- [Modelo de ameaças e bloqueios de produção](docs/SEGURANCA.md)
- [Configurar e validar o conector GitHub App](docs/GITHUB_APP.md)
- [Instalar e executar no Windows](docs/SETUP_WINDOWS.md)
- [Arquitetura e função de cada arquivo](docs/ARCHITECTURE.md)
- [Garantias e migração Midnight](docs/MIGRACAO_MIDNIGHT.md)
