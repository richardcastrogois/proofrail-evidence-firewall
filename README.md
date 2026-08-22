# Proofrail

**Evidence firewall for AI agents, automations, and high-risk operations.**

Proofrail sits between a request and its execution. It turns a sensitive action
into a verifiable authorization flow: independent sources attest the facts, a
deterministic policy evaluates them, Midnight anchors the decision, and a
short-lived permit authorizes only the exact action that was approved.

An AI agent can request a deployment, payment, access grant, or data operation.
It cannot approve itself, replace the commit after validation, swap the
artifact, ignore contradictory evidence, or reuse an old authorization.

```text
request -> independent evidence -> policy decision -> Midnight anchor
        -> one-time permit -> controlled executor -> audit trail
```

## The problem

AI agents and automated workflows are increasingly able to call tools and
change real systems. Authentication answers **who made the request**, but it
does not prove that the requested action is correct, current, reviewed, and
safe to execute.

Proofrail adds an evidence boundary before the side effect. Authorization is
released only when multiple trusted origins agree about the same immutable
action.

## How it works

1. **Propose** - bind the actor, task, repository, commit, artifact, service,
   environment, risk, and nonce into an action commitment.
2. **Prove** - collect signed receipts from independent origins such as IAM,
   tool policy, CI, security scanners, ERP, or a responsible approver.
3. **Decide** - apply a deterministic policy and return `DENY`,
   `REVIEW_REQUIRED`, or `ALLOW`.
4. **Anchor** - publish the evidence Merkle root and policy commitments to a
   Compact contract on Midnight without publishing the raw business evidence.
5. **Authorize** - issue a signed, short-lived permit bound to the action,
   evidence, policy, network, contract, and on-chain anchor.
6. **Execute once** - a closed executor validates every binding, consumes the
   permit, records the result, and rejects replay.

## Agent deployment flow

The primary workflow protects a deployment requested by an AI agent:

- the agent identity must match an authorized Ed25519 key;
- the repository, commit, workflow run, artifact ID, and digest must agree;
- the tool policy must permit the service and environment;
- the security source must report no blocking finding;
- production or elevated risk requires an independent human approval;
- the executor accepts only a fixed staging workflow, never arbitrary shell;
- changing any protected field invalidates the collected evidence and permit.

The GitHub App connector verifies CI against the exact SHA and artifact. The
executor uses a separate, narrowly scoped credential, preserving separation
between evidence collection and execution.

## Security properties

- **Exact action binding:** SHA-256 commitments prevent action fields from
  changing after evidence collection.
- **Independent origins:** a requester's own statement never satisfies a
  required source.
- **Signed evidence:** Ed25519 receipts bind source, claim, action, timestamps,
  and normalized values.
- **Contradiction blocking:** conflicting evidence fails closed.
- **Human separation of duties:** responsible approval uses an independent key
  and is bound to the persisted review decision.
- **On-chain authority:** the Compact contract requires an authorized registrar
  witness and supports rotation, revocation, and recovery.
- **Privacy-aware anchoring:** Midnight stores commitments and public decision
  state rather than raw enterprise documents.
- **One-time authorization:** permits are short-lived, action-specific, and
  rejected after consumption.
- **Cryptographic erasure:** encrypted raw evidence can become inaccessible by
  destroying its data key while commitments remain auditable.

## Product experience

The web application has two product views:

- **Overview** explains the evidence firewall, the actors, and the trust model.
- **Demonstration** lets a user submit an action, confirm or contradict evidence,
  inspect the decision, see the Midnight receipt, and execute an eligible
  permit.

Nine policy configurations illustrate agent deployment, payments, credit,
contracts, traditional deployment, claims, supplier compliance, agent tool
usage, and sensitive data operations. External systems can replace the
interactive evidence controls through API, MCP, webhooks, and signed adapters.

The environment selector targets separate Local, Preview/Testnet, and Preprod
wallets and contracts. Public-network decisions expose the real contract and
transaction receipt in the interface.

## Where it applies

- deployment and release authorization;
- privileged access and temporary credentials;
- payments, refunds, and treasury operations;
- supplier and compliance checks;
- customer onboarding and credit decisions;
- claims and regulated approvals;
- sensitive data export, deletion, or sharing;
- controlled tool use by autonomous agents.

## Architecture

```text
React/Vite web
    -> Fastify API + service authentication
        -> deterministic policy and cryptographic receipts
        -> GitHub App / signed evidence adapters
        -> Compact contract through Midnight CLI
        -> closed staging executor
    -> persistent audit and lifecycle state
```

Core components:

- `apps/web` - product interface and network-aware decision workflow;
- `apps/api` - evidence collection, policy orchestration, authorization,
  execution, logging, and API/MCP boundaries;
- `packages/core` - commitments, signatures, encryption, Merkle roots, and
  deterministic policy evaluation;
- `packages/shared` - runtime schemas and contracts shared across services;
- `midnight` - Compact contract, authorized registrar, network adapters, and
  security matrix;
- `.github/workflows/staging-deploy.yml` - fixed GitHub Actions execution path.

The repository ships a controlled staging executor. An enterprise deployment
should connect its own identity provider, scanner, transactional database,
KMS/HSM, observability, rate limiting, rollback, and destination-specific
execution adapter.

## Documentation

- [Product guide](docs/GUIA_DO_PROJETO.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security model](docs/SEGURANCA.md)
- [GitHub App connector](docs/GITHUB_APP.md)
- [Midnight integration](docs/MIGRACAO_MIDNIGHT.md)
- [Windows setup](docs/SETUP_WINDOWS.md)
- [Documentation index](docs/README.md)

## Run locally

### Requirements

- Windows with PowerShell;
- WSL 2 with Ubuntu;
- Docker Desktop;
- Node.js 22 or newer inside WSL;
- Compact compiler `0.31.1` for Midnight mode.

### Install and validate the environment

From the repository root in PowerShell:

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\00-check-prerequisites.ps1 -Mode Midnight
PowerShell -ExecutionPolicy Bypass -File .\scripts\01-install-wsl-toolchain.ps1 -Mode Midnight
PowerShell -ExecutionPolicy Bypass -File .\scripts\02-install-project.ps1
```

### Run with a local Midnight contract

The first execution creates the official Midnight scaffold, starts the proof
server, compiles the Compact contract, and deploys it locally:

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\05-scaffold-midnight.ps1 -Network undeployed
PowerShell -ExecutionPolicy Bypass -File .\scripts\06-run-with-midnight.ps1
```

Open <http://localhost:5173>. API health is available at
<http://localhost:3333/api/health>.

For later executions, start the proof server before the application:

```powershell
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate/midnight-chain && npm run proof-server:start"
PowerShell -ExecutionPolicy Bypass -File .\scripts\06-run-with-midnight.ps1
```

To run the interface with the persistent local anchor simulator instead of a
Compact contract:

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\04-run-local.ps1
```

### Validate the codebase

```powershell
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate && npm audit --omit=dev --audit-level=high"
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate && npm test && npm run typecheck && npm run build"
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate/midnight-chain && npm run compile && npx tsc --noEmit"
```

Stop API and web with `Ctrl+C`. Stop the proof server with:

```powershell
wsl -d Ubuntu -- bash -lc "source ~/.nvm/nvm.sh && cd /mnt/c/dev/rational-gate/midnight-chain && npm run proof-server:stop"
```

Preview and Preprod require separate public wallets, faucet funding, contracts,
and validation. Follow [Windows setup](docs/SETUP_WINDOWS.md) and the
[Preprod operations runbook](docs/ETAPA_04_PREPROD_OPERACAO.md).
