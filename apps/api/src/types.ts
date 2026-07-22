import type {
  AnchorRecord,
  AuditEvent,
  DecisionResult,
  EvidencePolicy,
  EvidenceReceipt,
  ProposedAction,
  ScenarioId,
  SourceClass,
} from "@rational/shared";
import type { GitHubWorkflowDelivery } from "./github";

export interface OriginRecord {
  id: string;
  name: string;
  description: string;
  scenarioId: ScenarioId;
  sourceClass: Exclude<SourceClass, "self_declared">;
  claimType: string;
  field: string;
  validValue: string | number | boolean | null;
  contradictoryValue: string | number | boolean | null;
  publicKeyPem: string;
}

export interface FabricIdentityRecord {
  publicKeyPem: string;
}

export interface SigningSecrets {
  schemaVersion: 1;
  originPrivateKeys: Record<string, string>;
  fabricPrivateKeyPem: string;
}

export interface EvidenceSecret {
  encryptedPath: string;
  encryptionKeyBase64?: string;
}

export interface ExecutedAction {
  id: string;
  permitId: string;
  action: ProposedAction;
  executedAt: string;
}

export interface Database {
  schemaVersion: 4;
  selectedScenarioId: ScenarioId;
  defaultAction: ProposedAction;
  policy: EvidencePolicy;
  origins: OriginRecord[];
  fabricIdentity: FabricIdentityRecord;
  githubDeliveries: GitHubWorkflowDelivery[];
  evidence: EvidenceReceipt[];
  evidenceSecrets: Record<string, EvidenceSecret>;
  decisions: DecisionResult[];
  anchors: AnchorRecord[];
  executions: ExecutedAction[];
  audit: AuditEvent[];
}
