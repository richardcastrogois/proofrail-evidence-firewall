CREATE TABLE "ProofrailState" (
    "id" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProofrailState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Policy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "commitment" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Action" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "actionCommitment" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceClass" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "receipt" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "actionCommitment" TEXT NOT NULL,
    "evidenceRoot" TEXT NOT NULL,
    "policyCommitment" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Anchor" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "contractAddress" TEXT,
    "transactionId" TEXT,
    "status" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Anchor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Permit" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Permit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Execution" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "permitId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "externalRef" TEXT,
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Execution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AsyncOperation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AsyncOperation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "type" TEXT NOT NULL,
    "requestId" TEXT,
    "operationId" TEXT,
    "message" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE UNIQUE INDEX "Policy_organizationId_name_version_key" ON "Policy"("organizationId", "name", "version");
CREATE UNIQUE INDEX "Action_requestId_key" ON "Action"("requestId");
CREATE UNIQUE INDEX "Action_actionCommitment_key" ON "Action"("actionCommitment");
CREATE UNIQUE INDEX "Anchor_decisionId_key" ON "Anchor"("decisionId");
CREATE UNIQUE INDEX "Permit_decisionId_key" ON "Permit"("decisionId");
CREATE UNIQUE INDEX "Execution_idempotencyKey_key" ON "Execution"("idempotencyKey");
CREATE UNIQUE INDEX "AsyncOperation_idempotencyKey_key" ON "AsyncOperation"("idempotencyKey");
CREATE INDEX "Policy_organizationId_active_idx" ON "Policy"("organizationId", "active");
CREATE INDEX "Action_organizationId_createdAt_idx" ON "Action"("organizationId", "createdAt");
CREATE INDEX "Evidence_actionId_sourceId_idx" ON "Evidence"("actionId", "sourceId");
CREATE INDEX "Evidence_expiresAt_idx" ON "Evidence"("expiresAt");
CREATE INDEX "Decision_actionId_createdAt_idx" ON "Decision"("actionId", "createdAt");
CREATE INDEX "Anchor_network_createdAt_idx" ON "Anchor"("network", "createdAt");
CREATE INDEX "Permit_expiresAt_idx" ON "Permit"("expiresAt");
CREATE INDEX "Execution_permitId_status_idx" ON "Execution"("permitId", "status");
CREATE INDEX "AsyncOperation_status_availableAt_idx" ON "AsyncOperation"("status", "availableAt");
CREATE INDEX "AsyncOperation_organizationId_createdAt_idx" ON "AsyncOperation"("organizationId", "createdAt");
CREATE INDEX "AuditEvent_organizationId_createdAt_idx" ON "AuditEvent"("organizationId", "createdAt");
CREATE INDEX "AuditEvent_requestId_idx" ON "AuditEvent"("requestId");
CREATE INDEX "AuditEvent_operationId_idx" ON "AuditEvent"("operationId");

ALTER TABLE "Policy" ADD CONSTRAINT "Policy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Action" ADD CONSTRAINT "Action_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Action" ADD CONSTRAINT "Action_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Anchor" ADD CONSTRAINT "Anchor_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Execution" ADD CONSTRAINT "Execution_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Execution" ADD CONSTRAINT "Execution_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "Permit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
