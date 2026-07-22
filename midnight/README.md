# Integração Midnight do Proofrail

Esta pasta contém as fontes controladas pelo projeto:

- `contract/hello-world.compact`: contrato Compact;
- `overrides/cli.ts`: CLI de escrita e leitura.

O script `scripts/05-scaffold-midnight.ps1` cria ou reutiliza `midnight-chain`, copia esses dois arquivos, compila e implanta. O nome físico `hello-world` é mantido porque o scaffold oficial usa esse caminho para providers e artefatos gerados.

## Estado on-chain

Cada `registerDecision` grava Merkle root, commitments de política/ação, decisão, validade e contagens de evidência/contradição. Um `ALLOW` exige evidência suficiente, zero contradições e action commitment ainda não utilizado.

Nenhum documento, identificação, valor empresarial ou evidência bruta é gravado. O contrato ainda recebe o resumo preparado pelo backend; consulte [`../docs/MIGRACAO_MIDNIGHT.md`](../docs/MIGRACAO_MIDNIGHT.md) para a fronteira de confiança e o roteiro da prova privada completa.
