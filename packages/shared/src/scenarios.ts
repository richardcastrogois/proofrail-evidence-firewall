import type {
  ActionType,
  EvidencePolicy,
  ProposedAction,
  ScenarioDefinition,
  ScenarioId,
  ScenarioSource,
  SourceClass,
} from "./index";

type ScenarioSeed = Omit<
  ScenarioDefinition,
  "defaultAction" | "policy" | "sources" | "fields"
> & {
  subjectLabel: string;
  subjectHelp: string;
  subjectPlaceholder: string;
  referenceLabel: string;
  referenceHelp: string;
  referencePlaceholder: string;
  valueLabel: string;
  valueHelp: string;
  valuePlaceholder: string;
  defaultSubject: string;
  defaultReference: string;
  defaultValue: number;
  maxAutomaticValue: number;
  maxAllowedValue?: number;
  maxAgeMinutes: number;
  defaultDeployment?: NonNullable<ProposedAction["deployment"]>;
  reviewRequiredEnvironments?: Array<"staging" | "production">;
  sources: Array<{
    id: string;
    name: string;
    description: string;
    sourceClass: Exclude<SourceClass, "self_declared">;
    claimType: string;
    validValue: string;
    contradictoryValue: string;
    role?: "required" | "review";
  }>;
};

function buildScenario(seed: ScenarioSeed): ScenarioDefinition {
  const action: ProposedAction = {
    requestId: "00000000-0000-4000-8000-000000000001",
    scenarioId: seed.id,
    type: seed.actionType,
    subjectId: seed.defaultSubject,
    referenceId: seed.defaultReference,
    value: seed.defaultValue,
    unit: seed.unit,
    deployment: seed.defaultDeployment,
  };
  const sources: ScenarioSource[] = seed.sources.map((source) => ({
    ...source,
    field: "status",
    role: source.role ?? "required",
  }));
  const requiredSources = sources.filter((source) => source.role === "required");
  const reviewSources = sources.filter((source) => source.role === "review");
  const policy: EvidencePolicy = {
    id: `${seed.id}-policy`,
    scenarioId: seed.id,
    name: `Política de ${seed.shortTitle.toLowerCase()}`,
    version: seed.id === "agent_deploy" ? 3 : 2,
    actionType: seed.actionType,
    minIndependentSources: requiredSources.length,
    maxAgeMinutes: seed.maxAgeMinutes,
    maxValueWithoutReview: seed.maxAutomaticValue,
    maxValueAllowed: seed.maxAllowedValue,
    denyOnContradiction: true,
    rawRetentionSeconds: 300,
    requiredClaims: requiredSources.map((source) => ({
      claimType: source.claimType,
      sourceClass: source.sourceClass,
      field: source.field,
      expectedValue: source.validValue,
    })),
    reviewRequiredClaims: reviewSources.map((source) => ({
      claimType: source.claimType,
      sourceClass: source.sourceClass,
      field: source.field,
      expectedValue: source.validValue,
    })),
    reviewRequiredEnvironments: seed.reviewRequiredEnvironments ?? [],
  };

  return {
    id: seed.id,
    actionType: seed.actionType,
    title: seed.title,
    shortTitle: seed.shortTitle,
    description: seed.description,
    outcome: seed.outcome,
    unit: seed.unit,
    defaultAction: action,
    policy,
    sources,
    fields: [
      { key: "subjectId", label: seed.subjectLabel, help: seed.subjectHelp, placeholder: seed.subjectPlaceholder, type: "text" },
      { key: "referenceId", label: seed.referenceLabel, help: seed.referenceHelp, placeholder: seed.referencePlaceholder, type: "text" },
      { key: "value", label: seed.valueLabel, help: seed.valueHelp, placeholder: seed.valuePlaceholder, type: "number" },
    ],
  };
}

const seeds: ScenarioSeed[] = [
  {
    id: "agent_deploy", actionType: "authorize_agent_deploy", title: "Deploy solicitado por agente de IA", shortTitle: "Agente + Deploy", unit: "risk points",
    description: "Autoriza um agente a publicar somente o commit, artefato, serviço e ambiente comprovados pela política.", outcome: "Emitir um permit de uso único vinculado ao agente e ao artefato exato.",
    subjectLabel: "Agente operacional", subjectHelp: "Identidade autenticada do agente ou gateway MCP.", subjectPlaceholder: "agent-release-01",
    referenceLabel: "Commit SHA", referenceHelp: "Commit imutável que originou o artefato.", referencePlaceholder: "a91c4ad39ff6b8266d04cd22f13e4179f743a903",
    valueLabel: "Risco da mudança", valueHelp: "Produção e risco acima de 40 exigem aprovação humana.", valuePlaceholder: "45",
    defaultSubject: "agent-release-01", defaultReference: "a91c4ad39ff6b8266d04cd22f13e4179f743a903", defaultValue: 45, maxAutomaticValue: 40, maxAllowedValue: 80, maxAgeMinutes: 15,
    reviewRequiredEnvironments: ["production"],
    defaultDeployment: {
      agentId: "agent-release-01",
      taskId: "TASK-DEPLOY-2026-001",
      repository: "proofrail/proofrail-demo",
      commitSha: "a91c4ad39ff6b8266d04cd22f13e4179f743a903",
      artifactDigest: "sha256:5f70bf18a086007016e948b04aed3b82103a36be44a0c13d57f656979435d25a",
      serviceId: "proofrail-demo",
      environment: "production",
      requestedTool: "deploy",
      riskScore: 45,
      nonce: "00000000-0000-4000-8000-000000000002",
    },
    sources: [
      { id: "identity-agent-deploy", name: "Identidade do agente", description: "Confirma a identidade operacional que abriu a tarefa.", sourceClass: "signed_identity", claimType: "agent_authenticated", validValue: "authenticated", contradictoryValue: "invalid" },
      { id: "scope-agent-deploy", name: "Política de ferramentas", description: "Confirma que o agente pode publicar este serviço e ambiente.", sourceClass: "signed_tool_policy", claimType: "tool_scope_allowed", validValue: "allowed", contradictoryValue: "denied" },
      { id: "ci-agent-deploy", name: "Pipeline CI", description: "Confirma testes e build do mesmo commit informado na ação.", sourceClass: "signed_ci", claimType: "pipeline_passed", validValue: "passed", contradictoryValue: "failed" },
      { id: "security-agent-deploy", name: "Scanner de segurança", description: "Confirma que o artefato não possui achado bloqueador.", sourceClass: "signed_security", claimType: "security_gate", validValue: "passed", contradictoryValue: "critical_findings" },
      { id: "approval-agent-deploy", name: "Aprovação responsável", description: "Confirma revisão humana para produção ou risco elevado.", sourceClass: "signed_approval", claimType: "production_approved", validValue: "approved", contradictoryValue: "rejected", role: "review" },
    ],
  },
  {
    id: "supplier_payment", actionType: "approve_supplier_payment", title: "Pagamento de fornecedor", shortTitle: "Pagamento", unit: "BRL",
    description: "Impede que uma fatura seja paga sem aprovação, entrega e fornecedor ativo.", outcome: "Emitir um permit de pagamento vinculado à fatura.",
    subjectLabel: "Fornecedor", subjectHelp: "Empresa que receberá o pagamento.", subjectPlaceholder: "SUP-001",
    referenceLabel: "Nota fiscal", referenceHelp: "Documento que vincula evidências e ação.", referencePlaceholder: "NF-2026-001",
    valueLabel: "Valor", valueHelp: "Acima do limite automático exige revisão humana.", valuePlaceholder: "8400",
    defaultSubject: "SUP-001", defaultReference: "NF-2026-001", defaultValue: 8400, maxAutomaticValue: 10000, maxAgeMinutes: 120,
    sources: [
      { id: "erp-payment", name: "ERP financeiro", description: "Confirma aprovação e valor da fatura.", sourceClass: "signed_erp", claimType: "invoice_approved", validValue: "approved", contradictoryValue: "rejected" },
      { id: "logistics-payment", name: "Logística", description: "Confirma a entrega vinculada à nota.", sourceClass: "signed_logistics", claimType: "delivery_completed", validValue: "delivered", contradictoryValue: "in_transit" },
      { id: "registry-payment", name: "Cadastro de fornecedores", description: "Confirma que o fornecedor está ativo.", sourceClass: "signed_registry", claimType: "supplier_active", validValue: "active", contradictoryValue: "suspended" },
    ],
  },
  {
    id: "credit_release", actionType: "release_credit", title: "Liberação de crédito", shortTitle: "Crédito", unit: "BRL",
    description: "Exige identidade, capacidade financeira e análise externa antes de liberar crédito.", outcome: "Emitir um permit de crédito limitado à proposta.",
    subjectLabel: "Solicitante", subjectHelp: "Pessoa ou empresa analisada.", subjectPlaceholder: "CLIENTE-042",
    referenceLabel: "Proposta", referenceHelp: "Identificador do pedido de crédito.", referencePlaceholder: "CRED-2026-042",
    valueLabel: "Limite solicitado", valueHelp: "Valores altos seguem para revisão humana.", valuePlaceholder: "25000",
    defaultSubject: "CLIENTE-042", defaultReference: "CRED-2026-042", defaultValue: 25000, maxAutomaticValue: 50000, maxAgeMinutes: 60,
    sources: [
      { id: "identity-credit", name: "Identidade/KYC", description: "Confirma identidade e titularidade.", sourceClass: "signed_identity", claimType: "identity_verified", validValue: "verified", contradictoryValue: "mismatch" },
      { id: "bureau-credit", name: "Bureau de crédito", description: "Confirma elegibilidade segundo a consulta.", sourceClass: "signed_credit_bureau", claimType: "credit_eligible", validValue: "eligible", contradictoryValue: "blocked" },
      { id: "income-credit", name: "Origem de renda", description: "Confirma capacidade mínima para a proposta.", sourceClass: "signed_income", claimType: "income_sufficient", validValue: "sufficient", contradictoryValue: "insufficient" },
    ],
  },
  {
    id: "contract_approval", actionType: "approve_contract", title: "Aprovação de contrato", shortTitle: "Contrato", unit: "BRL",
    description: "Bloqueia assinatura sem parecer jurídico, compliance e orçamento.", outcome: "Autorizar a assinatura de uma versão específica.",
    subjectLabel: "Contraparte", subjectHelp: "Organização com quem o contrato será firmado.", subjectPlaceholder: "ACME-LTDA",
    referenceLabel: "Versão do contrato", referenceHelp: "Hash ou identificador imutável da minuta.", referencePlaceholder: "CTR-88-v4",
    valueLabel: "Valor contratual", valueHelp: "Controla o nível de revisão exigido.", valuePlaceholder: "80000",
    defaultSubject: "ACME-LTDA", defaultReference: "CTR-88-v4", defaultValue: 80000, maxAutomaticValue: 100000, maxAgeMinutes: 1440,
    sources: [
      { id: "legal-contract", name: "Jurídico", description: "Confirma aprovação da minuta exata.", sourceClass: "signed_legal", claimType: "legal_approved", validValue: "approved", contradictoryValue: "changes_required" },
      { id: "compliance-contract", name: "Compliance", description: "Confirma ausência de bloqueios de integridade.", sourceClass: "signed_compliance", claimType: "compliance_passed", validValue: "passed", contradictoryValue: "blocked" },
      { id: "budget-contract", name: "Controladoria", description: "Confirma disponibilidade orçamentária.", sourceClass: "signed_budget", claimType: "budget_available", validValue: "available", contradictoryValue: "unavailable" },
    ],
  },
  {
    id: "production_deploy", actionType: "deploy_to_production", title: "Deploy em produção", shortTitle: "Deploy", unit: "risk points",
    description: "Impede publicação sem pipeline verde, segurança e aprovação responsável.", outcome: "Emitir um permit para uma release e ambiente exatos.",
    subjectLabel: "Serviço", subjectHelp: "Aplicação que receberá a alteração.", subjectPlaceholder: "payments-api",
    referenceLabel: "Release/commit", referenceHelp: "Artefato imutável que será publicado.", referencePlaceholder: "v2.8.1+sha.a91c",
    valueLabel: "Risco da mudança", valueHelp: "Pontuação acima do limite força revisão.", valuePlaceholder: "35",
    defaultSubject: "payments-api", defaultReference: "v2.8.1+sha.a91c", defaultValue: 35, maxAutomaticValue: 60, maxAgeMinutes: 30,
    sources: [
      { id: "ci-deploy", name: "Pipeline CI", description: "Confirma testes e build do commit.", sourceClass: "signed_ci", claimType: "pipeline_passed", validValue: "passed", contradictoryValue: "failed" },
      { id: "security-deploy", name: "Scanner de segurança", description: "Confirma ausência de achado bloqueador.", sourceClass: "signed_security", claimType: "security_gate", validValue: "passed", contradictoryValue: "critical_findings" },
      { id: "approval-deploy", name: "Change approval", description: "Confirma aprovação da mudança.", sourceClass: "signed_approval", claimType: "change_approved", validValue: "approved", contradictoryValue: "rejected" },
    ],
  },
  {
    id: "insurance_claim", actionType: "settle_insurance_claim", title: "Análise de sinistro", shortTitle: "Sinistro", unit: "BRL",
    description: "Combina cobertura, vistoria e antifraude antes de liquidar um sinistro.", outcome: "Autorizar uma indenização limitada ao sinistro.",
    subjectLabel: "Segurado", subjectHelp: "Titular da apólice.", subjectPlaceholder: "SEG-1008",
    referenceLabel: "Sinistro", referenceHelp: "Evento específico em análise.", referencePlaceholder: "SIN-2026-778",
    valueLabel: "Indenização", valueHelp: "Valores altos exigem adjudicação humana.", valuePlaceholder: "18000",
    defaultSubject: "SEG-1008", defaultReference: "SIN-2026-778", defaultValue: 18000, maxAutomaticValue: 30000, maxAgeMinutes: 720,
    sources: [
      { id: "coverage-claim", name: "Sistema de apólices", description: "Confirma cobertura vigente.", sourceClass: "signed_insurer", claimType: "coverage_active", validValue: "active", contradictoryValue: "excluded" },
      { id: "assessment-claim", name: "Vistoria", description: "Confirma dano e vínculo com o evento.", sourceClass: "signed_assessor", claimType: "damage_verified", validValue: "verified", contradictoryValue: "unverified" },
      { id: "fraud-claim", name: "Antifraude", description: "Confirma ausência de alerta bloqueador.", sourceClass: "signed_fraud_screen", claimType: "fraud_screen", validValue: "clear", contradictoryValue: "flagged" },
    ],
  },
  {
    id: "supplier_compliance", actionType: "approve_supplier_compliance", title: "Regularidade de fornecedor", shortTitle: "Regularidade", unit: "risk points",
    description: "Verifica cadastro, tributos e sanções antes de habilitar um fornecedor.", outcome: "Autorizar a habilitação por uma janela definida.",
    subjectLabel: "Fornecedor", subjectHelp: "Empresa avaliada.", subjectPlaceholder: "FORN-778",
    referenceLabel: "Avaliação", referenceHelp: "Ciclo de due diligence.", referencePlaceholder: "DD-2026-Q3-778",
    valueLabel: "Risco residual", valueHelp: "Risco alto exige revisão de compliance.", valuePlaceholder: "25",
    defaultSubject: "FORN-778", defaultReference: "DD-2026-Q3-778", defaultValue: 25, maxAutomaticValue: 40, maxAgeMinutes: 1440,
    sources: [
      { id: "registry-compliance", name: "Registro empresarial", description: "Confirma situação cadastral ativa.", sourceClass: "signed_registry", claimType: "company_active", validValue: "active", contradictoryValue: "inactive" },
      { id: "tax-compliance", name: "Regularidade fiscal", description: "Confirma certidão dentro da cobertura consultada.", sourceClass: "signed_tax_registry", claimType: "tax_regular", validValue: "regular", contradictoryValue: "irregular" },
      { id: "sanctions-compliance", name: "Lista de sanções", description: "Confirma ausência de correspondência.", sourceClass: "signed_sanctions", claimType: "sanctions_clear", validValue: "clear", contradictoryValue: "match" },
    ],
  },
  {
    id: "agent_action", actionType: "authorize_agent_action", title: "Ação de agente de IA", shortTitle: "Agente de IA", unit: "risk points",
    description: "Impede que um agente use uma ferramenta fora do pedido, escopo ou política.", outcome: "Emitir uma capability limitada à ferramenta e tarefa.",
    subjectLabel: "Agente", subjectHelp: "Identidade operacional do agente.", subjectPlaceholder: "agent-procurement-01",
    referenceLabel: "Tarefa", referenceHelp: "Solicitação que originou a ação.", referencePlaceholder: "TASK-9481",
    valueLabel: "Risco da ação", valueHelp: "Ações críticas exigem aprovação humana.", valuePlaceholder: "45",
    defaultSubject: "agent-procurement-01", defaultReference: "TASK-9481", defaultValue: 45, maxAutomaticValue: 50, maxAgeMinutes: 15,
    sources: [
      { id: "request-agent", name: "Solicitação assinada", description: "Confirma intenção e solicitante.", sourceClass: "signed_governance", claimType: "request_authorized", validValue: "authorized", contradictoryValue: "revoked" },
      { id: "scope-agent", name: "Política de ferramentas", description: "Confirma escopo da ferramenta e parâmetros.", sourceClass: "signed_tool_policy", claimType: "tool_scope_allowed", validValue: "allowed", contradictoryValue: "denied" },
      { id: "approval-agent", name: "Aprovação responsável", description: "Confirma supervisão para a classe de risco.", sourceClass: "signed_approval", claimType: "agent_action_approved", validValue: "approved", contradictoryValue: "rejected" },
    ],
  },
  {
    id: "sensitive_data_access", actionType: "authorize_sensitive_data_access", title: "Acesso a dados sensíveis", shortTitle: "Dados sensíveis", unit: "sensitivity points",
    description: "Bloqueia leitura ou divulgação sem identidade, finalidade e autorização do dado.", outcome: "Emitir um permit de acesso com escopo e prazo mínimos.",
    subjectLabel: "Solicitante", subjectHelp: "Usuário ou serviço que acessará o dado.", subjectPlaceholder: "analyst-204",
    referenceLabel: "Dataset/recurso", referenceHelp: "Conjunto exato de dados solicitado.", referencePlaceholder: "customers-pii-v3",
    valueLabel: "Sensibilidade", valueHelp: "Classificação alta exige revisão adicional.", valuePlaceholder: "70",
    defaultSubject: "analyst-204", defaultReference: "customers-pii-v3", defaultValue: 70, maxAutomaticValue: 60, maxAgeMinutes: 15,
    sources: [
      { id: "identity-data", name: "IAM", description: "Confirma identidade e sessão do solicitante.", sourceClass: "signed_identity", claimType: "requester_authenticated", validValue: "authenticated", contradictoryValue: "invalid" },
      { id: "purpose-data", name: "DLP/Finalidade", description: "Confirma finalidade permitida e minimização.", sourceClass: "signed_dlp", claimType: "purpose_allowed", validValue: "allowed", contradictoryValue: "forbidden" },
      { id: "owner-data", name: "Responsável pelo dado", description: "Confirma autorização do proprietário lógico.", sourceClass: "signed_data_owner", claimType: "data_access_approved", validValue: "approved", contradictoryValue: "rejected" },
    ],
  },
];

export const SCENARIOS: ScenarioDefinition[] = seeds.map(buildScenario);

export function scenarioById(id: ScenarioId): ScenarioDefinition {
  const scenario = SCENARIOS.find((entry) => entry.id === id);
  if (!scenario) throw new Error(`Unknown scenario: ${id}`);
  return scenario;
}
