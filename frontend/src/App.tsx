import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight,
  Bot,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Database,
  FileCheck2,
  FileWarning,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  Network,
  Play,
  RefreshCcw,
  ScrollText,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Upload,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import type {
  DecisionResult,
  GitHubIntegrationStatus,
  NetworkId,
  NetworkStatus,
  ProposedAction,
  PublicState,
  ScenarioId,
} from "@rational/shared";
import { SCENARIOS, scenarioById } from "@rational/shared";
import { api, apiConfigured, apiLimited, type DeclaredDocument } from "./api";

gsap.registerPlugin(useGSAP, ScrollTrigger, ScrollToPlugin);

type Surface = "overview" | "lab";
type MotionMode = "full" | "reduced";
type LabDocument = DeclaredDocument & { source: "sample" | "upload" };
type ConnectionStatus = "idle" | "checking" | "online" | "offline";

const networkCopy: Record<
  NetworkId,
  { label: string; short: string; description: string }
> = {
  undeployed: {
    label: "Devnet local",
    short: "Local",
    description: "Node, indexer e proof server no seu Docker.",
  },
  preview: {
    label: "Testnet Preview",
    short: "Testnet",
    description: "Rede pública Midnight com ativos tNIGHT.",
  },
  preprod: {
    label: "Preprod",
    short: "Preprod",
    description: "Validação pública mais próxima de produção.",
  },
};

const pipeline = [
  ["01", "Propor", "Defina exatamente a ação"],
  ["02", "Comprovar", "Confirme em origens independentes"],
  ["03", "Decidir", "Aplique a política"],
  ["04", "Autorizar", "Emita um permit limitado"],
  ["05", "Executar", "Consuma o permit e registre"],
] as const;

const disconnectedMessage =
  "API pública ainda não conectada. Este preview mostra o frontend em modo seguro; decisões, banco e Midnight permanecem bloqueados até a API ser publicada separadamente.";
const limitedApiMessage =
  "API pública limitada conectada. Estado e autodeclarações usam Neon; evidência assinada, ancoragem Midnight, aprovação, troca de rede e execução ficam bloqueadas até definirmos chaves e worker.";

const fallbackNetwork: NetworkStatus = {
  active: "preprod",
  deployments: {
    undeployed: null,
    preview: null,
    preprod:
      "9a1a5ae1cbb7bd5a64e649c5c9b63c9740907df53a2a1a0ba98f8e3a1b33fdd5",
  },
  faucets: {
    undeployed: null,
    preview: "https://faucet.testnet-02.midnight.network/",
    preprod: "https://faucet.preprod-01.midnight.network/",
  },
};

const disconnectedGithub: GitHubIntegrationStatus = {
  configured: false,
  webhookConfigured: false,
  agentIdentityConfigured: false,
  requireWebhook: true,
  allowedRepositories: [],
  apiVersion: "frontend-only",
  missingConfiguration: ["API pública não publicada"],
};

function createDisconnectedState(
  scenarioId: ScenarioId = "agent_deploy",
  network: NetworkStatus = fallbackNetwork,
): PublicState {
  const scenario = scenarioById(scenarioId);
  const now = new Date().toISOString();

  return {
    mode: "cli",
    selectedScenarioId: scenario.id,
    scenarios: SCENARIOS,
    defaultAction: scenario.defaultAction,
    policy: scenario.policy,
    network,
    integrations: { github: disconnectedGithub },
    origins: [],
    evidence: [],
    decisions: [],
    anchors: [],
    executions: [],
    audit: [
      {
        id: "frontend-only-preview",
        type: "state_initialized",
        message: "Frontend iniciado sem API pública conectada.",
        metadata: {},
        createdAt: now,
      },
    ],
    metrics: {
      originalRawBytes: 0,
      accessibleRawBytes: 0,
      persistentAnchorBytes: 0,
      reductionPercent: 0,
    },
  };
}

function statusIcon(status: DecisionResult["status"]) {
  if (status === "ALLOW") return <CheckCircle2 aria-hidden="true" />;
  if (status === "REVIEW_REQUIRED") return <TriangleAlert aria-hidden="true" />;
  return <XCircle aria-hidden="true" />;
}

function shortHash(value: string | null | undefined, size = 10) {
  if (!value) return "—";
  return `${value.slice(0, size)}…${value.slice(-6)}`;
}

function bytesLabel(value: number) {
  if (value < 1024) return `${value} B`;
  return `${(value / 1024).toFixed(1)} KB`;
}

async function sha256(value: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function DecisionPipeline({ completed }: { completed: boolean[] }) {
  return (
    <section className="pipeline" aria-label="Fluxo de decisão em cinco etapas">
      {pipeline.map(([number, title, description], index) => (
        <div className={completed[index] ? "pipeline-step complete" : "pipeline-step"} data-reveal-item key={number}>
          <span className="pipeline-marker">
            <b>{number}</b>
            {completed[index] ? <Check aria-label="etapa concluída" /> : null}
          </span>
          <div><strong>{title}</strong><small>{description}</small></div>
          {index < pipeline.length - 1 ? <ArrowRight className="pipeline-arrow" /> : null}
        </div>
      ))}
    </section>
  );
}

export function App() {
  const appRef = useRef<HTMLElement>(null);
  const surfaceContentRef = useRef<HTMLDivElement>(null);
  const headerDynamicRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<PublicState | null>(null);
  const [action, setAction] = useState<ProposedAction | null>(null);
  const [surface, setSurface] = useState<Surface>(() =>
    window.location.hash === "#lab" ? "lab" : "overview",
  );
  const [document, setDocument] = useState<LabDocument | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [busySince, setBusySince] = useState<number | null>(null);
  const [busyElapsedSeconds, setBusyElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [stateLoading, setStateLoading] = useState(false);
  const [motionMode, setMotionMode] = useState<MotionMode>(() => {
    const saved = window.localStorage.getItem("proofrail-motion");
    return saved === "reduced" ? "reduced" : "full";
  });

  const motionReduced = motionMode === "reduced";
  const apiLabel =
    import.meta.env.VITE_API_URL === "."
      ? "Mesmo domínio"
      : import.meta.env.VITE_API_URL || "Ambiente local";

  function toggleMotion() {
    const next: MotionMode = motionReduced ? "full" : "reduced";
    window.localStorage.setItem("proofrail-motion", next);
    setMotionMode(next);
  }

  async function refresh() {
    if (!apiConfigured) {
      const next = createDisconnectedState(
        state?.selectedScenarioId ?? "agent_deploy",
        state?.network ?? fallbackNetwork,
      );
      setState(next);
      setAction((current) =>
        !current || current.scenarioId !== next.defaultAction.scenarioId
          ? next.defaultAction
          : current,
      );
      return next;
    }

    const next = await api.state();
    setState(next);
    setAction((current) =>
      !current || current.requestId !== next.defaultAction.requestId
        ? next.defaultAction
        : current,
    );
    return next;
  }

  function connectionLabel() {
    if (connectionStatus === "checking") return "Ligando backend";
    if (connectionStatus === "online") return "Online";
    if (connectionStatus === "offline") return "Backend indisponível";
    return "Backend aguardando";
  }

  async function checkConnection() {
    if (!apiConfigured) {
      setConnectionStatus("offline");
      setError(disconnectedMessage);
      return;
    }

    setConnectionStatus("checking");
    setStateLoading(false);
    setError(null);
    let backendOnline = false;
    try {
      await api.health();
      backendOnline = true;
      setConnectionStatus("online");
      setStateLoading(true);
      await refresh();
      setStateLoading(false);
      setConnectionStatus("online");
    } catch (caught) {
      setConnectionStatus(backendOnline ? "online" : "offline");
      setStateLoading(false);
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function run(label: string, task: () => Promise<unknown>) {
    if (!apiConfigured) {
      setError(disconnectedMessage);
      return;
    }

    setBusy(label);
    setBusySince(Date.now());
    setBusyElapsedSeconds(0);
    setError(null);
    try {
      await task();
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(null);
      setBusySince(null);
      setBusyElapsedSeconds(0);
    }
  }

  useEffect(() => {
    if (apiConfigured) {
      checkConnection();
      return;
    }
    refresh().catch((caught) =>
      setError(caught instanceof Error ? caught.message : String(caught)),
    );
  }, []);

  useEffect(() => {
    if (busySince === null) return;
    const interval = window.setInterval(() => {
      setBusyElapsedSeconds(Math.floor((Date.now() - busySince) / 1_000));
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [busySince]);

  const { contextSafe } = useGSAP(
    () => {
      if (!state || !surfaceContentRef.current) return;

      if (motionReduced) {
        gsap.set([surfaceContentRef.current, headerDynamicRef.current], {
          autoAlpha: 1,
          y: 0,
          scale: 1,
        });
        return;
      }

      const surfaceChildren = Array.from(surfaceContentRef.current.children);
      const visibleChildren = surface === "overview"
        ? surfaceChildren.slice(0, 1)
        : surfaceChildren.slice(0, 3);
      const entrance = gsap.timeline();
      entrance
        .fromTo(
          surfaceContentRef.current,
          { autoAlpha: 0, y: 34, scale: 0.94, transformOrigin: "50% 18%" },
          { autoAlpha: 1, y: 0, scale: 1, duration: 0.82, ease: "power3.out", clearProps: "transform,opacity,visibility" },
        )
        .fromTo(
          visibleChildren,
          { autoAlpha: 0, y: 26, scale: 0.965, transformOrigin: "50% 30%" },
          { autoAlpha: 1, y: 0, scale: 1, duration: 0.58, stagger: 0.09, ease: "power2.out", clearProps: "transform,opacity,visibility" },
          "-=0.56",
        )
        .fromTo(
          headerDynamicRef.current,
          { autoAlpha: 0, scale: 0.9, transformOrigin: "50% 50%" },
          { autoAlpha: 1, scale: 1, duration: 0.46, ease: "back.out(1.35)", clearProps: "transform,opacity,visibility" },
          "<",
        );

      if (surface === "overview") {
        gsap.utils.toArray<HTMLElement>("[data-reveal-section]").forEach((section) => {
          const items = section.querySelectorAll<HTMLElement>("[data-reveal-item]");
          const timeline = gsap.timeline({
            scrollTrigger: {
              trigger: section,
              start: "clamp(top 92%)",
              end: "clamp(top 54%)",
              scrub: 0.7,
              invalidateOnRefresh: true,
            },
          });
          gsap.set(section, {
            autoAlpha: 0.28,
            y: 68,
            scale: 0.94,
            transformOrigin: "50% 50%",
          });
          timeline.to(section, {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 1,
            ease: "none",
          });
          if (items.length > 0) {
            gsap.set(items, {
              autoAlpha: 0,
              y: 44,
              scale: 0.9,
              transformOrigin: "50% 50%",
            });
            timeline.to(
              items,
              { autoAlpha: 1, y: 0, scale: 1, duration: 1, stagger: 0.14, ease: "none" },
              0.08,
            );
          }
        });
      }

      const refreshFrame = window.requestAnimationFrame(() => ScrollTrigger.refresh());
      return () => {
        window.cancelAnimationFrame(refreshFrame);
      };
    },
    { scope: appRef, dependencies: [surface, Boolean(state), motionMode], revertOnUpdate: true },
  );

  const evidenceBySource = useMemo(() => {
    const map = new Map<string, number>();
    for (const receipt of state?.evidence ?? []) {
      map.set(receipt.sourceId, (map.get(receipt.sourceId) ?? 0) + 1);
    }
    return map;
  }, [state]);

  if (!state || !action) {
    const connecting = connectionStatus === "checking";
    const loadingState = connectionStatus === "online" && stateLoading;
    const stateFailed = connectionStatus === "online" && Boolean(error);
    const offline = connectionStatus === "offline";
    return (
      <main className="loading-screen">
        <div className={connecting || loadingState ? "loader-mark loading" : "loader-mark"}>
          {connecting || loadingState ? <span className="connection-spinner" aria-hidden="true" /> : offline || stateFailed ? <TriangleAlert /> : <Fingerprint />}
        </div>
        <strong>
          {connecting
            ? "Ligando backend"
            : loadingState
              ? "Carregando estado"
              : stateFailed
                ? "Não foi possível carregar o estado"
                : offline
                  ? "Backend indisponível"
                  : "Preparando o Proofrail"}
        </strong>
        <p>
          {connecting
            ? "Aguardando o worker e a API no Render responderem. Isso pode levar até 90 segundos."
            : loadingState
              ? "Backend conectado. Buscando políticas, cenários e evidências."
              : stateFailed
                ? "Backend conectado, mas a API retornou erro ao buscar /api/state."
            : offline
              ? "Não foi possível conectar ao backend. Verifique o worker no Render e recarregue a página."
              : "Carregando políticas, cenários e estado da rede."}
        </p>
        {error ? <span>{error}</span> : null}
        {(offline || stateFailed) && apiConfigured ? (
          <button className="loading-retry" onClick={checkConnection} type="button">
            <RefreshCcw /> Tentar novamente
          </button>
        ) : null}
      </main>
    );
  }

  const scenario = state.scenarios.find(
    (entry) => entry.id === state.selectedScenarioId,
  )!;
  const latestDecision = state.decisions.at(-1) ?? null;
  const latestAnchor = state.anchors.at(-1) ?? null;
  const latestExecution = state.executions.at(-1) ?? null;
  const activeDeployment = state.network.deployments[state.network.active];
  const networkReady = state.mode === "local" || activeDeployment !== null;
  const github = state.integrations?.github ?? {
    configured: false,
    webhookConfigured: false,
    agentIdentityConfigured: false,
    requireWebhook: true,
    allowedRepositories: [],
    apiVersion: "indisponível",
    missingConfiguration: ["Reinicie a API para carregar a configuração do conector"],
  };
  const verifiedSources = new Set(
    state.evidence.filter((entry) => entry.verified).map((entry) => entry.sourceId),
  ).size;
  const selfDeclaredCount = evidenceBySource.get("user-declaration") ?? 0;
  const completedStages = [
    true,
    verifiedSources >= state.policy.minIndependentSources,
    latestDecision !== null,
    Boolean(latestDecision?.permit),
    latestExecution !== null,
  ];

  const openSurface = contextSafe((next: Surface) => {
    if (surface === next) {
      gsap.to(window, { duration: motionReduced ? 0 : 0.8, scrollTo: { y: 0 }, ease: "power3.inOut" });
      return;
    }

    const commit = () => {
      setSurface(next);
      window.history.replaceState(null, "", next === "lab" ? "#lab" : "#overview");
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => window.scrollTo({ top: 0 }));
      });
    };
    if (motionReduced || !surfaceContentRef.current) {
      commit();
      return;
    }
    gsap.to(surfaceContentRef.current, {
      autoAlpha: 0,
      y: -24,
      scale: 0.955,
      duration: 0.36,
      ease: "power3.in",
      overwrite: "auto",
      onComplete: commit,
    });
  });

  const scrollToHowItWorks = contextSafe(() => {
    gsap.to(window, {
      duration: motionReduced ? 0 : 1.15,
      scrollTo: { y: "#how-it-works", offsetY: 104 },
      ease: "power3.inOut",
    });
  });

  async function chooseScenario(scenarioId: ScenarioId) {
    if (!apiConfigured) {
      const next = createDisconnectedState(scenarioId, state?.network ?? fallbackNetwork);
      setState(next);
      setAction(next.defaultAction);
      setDocument(null);
      setError(null);
      return;
    }

    setBusy("scenario");
    setError(null);
    try {
      const next = await api.selectScenario(scenarioId);
      setState(next);
      setAction(next.defaultAction);
      setDocument(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(null);
    }
  }

  async function chooseNetwork(network: NetworkId) {
    if (apiLimited) {
      setError(limitedApiMessage);
      return;
    }

    if (!apiConfigured) {
      const nextNetwork = {
        ...(state?.network ?? fallbackNetwork),
        active: network,
      };
      const next = createDisconnectedState(
        state?.selectedScenarioId ?? "agent_deploy",
        nextNetwork,
      );
      setState(next);
      setAction((current) => current ?? next.defaultAction);
      setError(null);
      return;
    }

    const currentState = state;
    if (!currentState || currentState.mode !== "cli") {
      setError("Troca de rede exige backend com MIDNIGHT_MODE=cli. A demonstração hospedada usa o simulador local.");
      return;
    }

    await run("network", () => api.selectNetwork(network));
  }

  function setActionField(
    key: "subjectId" | "referenceId" | "value",
    value: string,
  ) {
    if (!action) return;
    const normalizedValue = key === "value" ? Number(value) : value;
    const deployment = action.deployment
      ? {
          ...action.deployment,
          agentId:
            key === "subjectId" ? String(normalizedValue) : action.deployment.agentId,
          commitSha:
            key === "referenceId" ? String(normalizedValue) : action.deployment.commitSha,
          riskScore:
            key === "value" ? Number(normalizedValue) : action.deployment.riskScore,
        }
      : undefined;
    setAction({
      ...action,
      [key]: normalizedValue,
      deployment,
    });
  }

  async function readDocument(file: File) {
    setError(null);
    if (file.size > 10 * 1024 * 1024) {
      setError("A demonstração aceita arquivos de até 10 MB.");
      return;
    }
    setBusy("hash-document");
    try {
      setDocument({
        name: file.name,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        sha256: await sha256(await file.arrayBuffer()),
        source: "upload",
      });
    } finally {
      setBusy(null);
    }
  }

  async function useFakeDocument() {
    setBusy("hash-document");
    setError(null);
    try {
      const bytes = new TextEncoder().encode(
        "DEMO: documento criado pelo solicitante e falsamente apresentado como aprovado",
      );
      setDocument({
        name: "comprovante_aprovacao_falso.pdf",
        size: 48_320,
        mimeType: "application/pdf",
        sha256: await sha256(bytes.buffer as ArrayBuffer),
        source: "sample",
      });
    } finally {
      setBusy(null);
    }
  }

  async function registerDocument() {
    if (!document || !action) return;
    const { source: _source, ...declaredDocument } = document;
    await run("document", () => api.document(action, declaredDocument));
  }

  async function resetScenario() {
    setDocument(null);
    if (!apiConfigured) {
      const next = createDisconnectedState(scenario.id, state?.network ?? fallbackNetwork);
      setState(next);
      setAction(next.defaultAction);
      setError(null);
      return;
    }

    await run("reset", () => api.reset(scenario.id));
  }

  return (
    <main className="app-shell" ref={appRef}>
      <header className="masthead">
        <button className="wordmark" onClick={() => openSurface("overview")} aria-label="Proofrail — visão geral">
          <span className="wordmark-symbol"><Fingerprint /></span>
          <span>
            <strong>Proofrail</strong>
            <small>Evidence firewall</small>
            <em className={`connection-inline ${connectionStatus}`}>
              <i aria-hidden="true" />
              {connectionLabel()}
            </em>
          </span>
        </button>

        <nav className="surface-nav" aria-label="Navegação principal">
          <span
            className={`surface-nav-indicator ${surface}`}
            aria-hidden="true"
            style={{ transitionDuration: motionReduced ? "0ms" : "620ms" }}
          />
          <button className={surface === "overview" ? "active" : ""} onClick={() => openSurface("overview")}>Visão geral</button>
          <button className={surface === "lab" ? "active" : ""} onClick={() => openSurface("lab")}>Demonstração</button>
        </nav>

        <div className="header-dynamic" ref={headerDynamicRef}>
        {surface === "lab" ? (
          <div className="network-switcher" aria-label="Rede Midnight">
            <span className="network-title"><Network /> Ambiente</span>
            <div className="network-options">
              {(Object.keys(networkCopy) as NetworkId[]).map((network) => (
                (() => {
                  const available = network === "undeployed" && state.mode === "local"
                    ? true
                    : Boolean(state.network.deployments[network]);
                  return (
                    <button
                      className={state.network.active === network ? "active" : ""}
                      disabled={busy !== null || apiLimited || state.mode !== "cli"}
                      key={network}
                      onClick={() => chooseNetwork(network)}
                    >
                      <span className={available ? "status-dot ready" : "status-dot"} />
                      {networkCopy[network].short}
                    </button>
                  );
                })()
              ))}
            </div>
          </div>
        ) : (
          <button className="header-cta" onClick={() => openSurface("lab")}>
            Abrir demonstração <ArrowRight />
          </button>
        )}
        </div>
      </header>

      {connectionStatus === "checking" ? (
        <div className="connection-loading" role="status" aria-live="polite">
          <div>
            <span className="connection-spinner" aria-hidden="true" />
            <strong>Verificando conexão</strong>
            <span>O backend pode levar alguns segundos para acordar.</span>
            <small>Aguarde, isso pode demorar até 90 segundos.</small>
          </div>
        </div>
      ) : null}

      <button
        className="motion-toggle"
        type="button"
        aria-pressed={motionReduced}
        onClick={toggleMotion}
      >
        <Sparkles aria-hidden="true" />
        Movimento: {motionReduced ? "reduzido" : "completo"}
      </button>

      <div className={`surface-content surface-${surface}`} ref={surfaceContentRef}>
      {surface === "overview" ? (
        <>
          <section className="story-hero" id="overview">
            <div>
              <span className="kicker">AUTORIZAÇÃO ANTES DA AUTOMAÇÃO</span>
              <h1>Agentes podem propor um deploy. O Proofrail decide se podem executá-lo.</h1>
              <p>
                O Proofrail é um firewall de evidências para ações de alto risco. Ele
                vincula agente, tarefa, repositório, commit, artefato e ambiente; exige
                confirmações independentes; registra a decisão na Midnight; e entrega
                um permit curto e de uso único somente para a ação aprovada.
              </p>
              <div className="story-actions">
                <button onClick={() => openSurface("lab")}><Play /> Testar agente + deploy</button>
                <button className="story-link" onClick={scrollToHowItWorks}>Entender as cinco etapas <ArrowRight /></button>
              </div>
            </div>
            <aside className="story-proof">
              <span>O QUE A DEMONSTRAÇÃO PROVA</span>
              <ol>
                <li><b>Agente não se autoautoriza</b><small>identidade e escopo precisam ser comprovados</small></li>
                <li><b>CI e segurança cobrem o SHA exato</b><small>evidência de outro commit é rejeitada</small></li>
                <li><b>Produção exige responsável</b><small>risco alto permanece em revisão</small></li>
                <li><b>Midnight registra commitments</b><small>sem publicar código, tokens ou evidência bruta</small></li>
                <li><b>Permit de uso único</b><small>limita agente, artefato, serviço, ambiente e validade</small></li>
              </ol>
              <div className="story-network-status">
                <CheckCircle2 />
                <div>
                  <strong>{networkCopy[state.network.active].label} ativa</strong>
                  <small>{activeDeployment ? `Contrato ${shortHash(activeDeployment)}` : "Contrato ainda não implantado"}</small>
                </div>
              </div>
            </aside>
          </section>

          <section className="false-document-story" data-reveal-section>
            <div className="false-document-file" data-reveal-item>
              <FileWarning />
              <div><strong>comprovante_aprovacao.pdf</strong><span>“Aprovado” — declarado pelo próprio cliente</span></div>
              <small>SEM ORIGEM VERIFICADA</small>
            </div>
            <ArrowRight />
            <div className="false-document-gate" data-reveal-item>
              <Fingerprint />
              <div><strong>Proofrail verifica a proveniência</strong><span>O arquivo pode ter integridade e ainda não provar que o ERP o emitiu.</span></div>
            </div>
            <ArrowRight />
            <div className="false-document-result" data-reveal-item><XCircle /><strong>DENY</strong><span>sozinho, não autoriza</span></div>
          </section>

          <section className="story-section" data-reveal-section>
            <div className="story-section-heading">
              <span>01</span>
              <div>
                <h2>O primeiro fluxo real: um agente solicita deploy</h2>
                <p>O agente pode iniciar a operação, mas não pode fabricar as provas nem ampliar o próprio escopo.</p>
              </div>
            </div>
            <div className="agent-deploy-narrative">
              <article data-reveal-item><Bot /><span>Solicitação</span><h3>Agente + tarefa</h3><p>O MCP identifica quem pediu, qual ferramenta pretende usar e qual tarefa originou a ação.</p></article>
              <article data-reveal-item><Fingerprint /><span>Escopo</span><h3>Identidade + política</h3><p>A política confirma se esse agente pode publicar esse serviço no ambiente solicitado.</p></article>
              <article data-reveal-item><CheckCircle2 /><span>Proveniência</span><h3>CI + segurança</h3><p>Testes, build e scanner precisam cobrir exatamente o mesmo commit e artefato.</p></article>
              <article data-reveal-item><Users /><span>Supervisão</span><h3>Aprovação responsável</h3><p>Produção ou risco elevado permanece em revisão até uma identidade diferente aprovar.</p></article>
              <article data-reveal-item><Database /><span>Prova</span><h3>Âncora Midnight</h3><p>Merkle root, commitments, política e decisão são registrados; dados empresariais permanecem fora da cadeia.</p></article>
              <article data-reveal-item><ShieldCheck /><span>Execução</span><h3>Permit limitado</h3><p>O executor aceita somente agente, SHA, digest, serviço e ambiente assinados, uma única vez.</p></article>
            </div>
          </section>

          <section id="how-it-works" className="story-section" data-reveal-section>
            <div className="story-section-heading">
              <span>02</span>
              <div><h2>Como a autorização é construída</h2><p>Os números são etapas fixas; o check indica apenas o que já foi concluído.</p></div>
            </div>
            <DecisionPipeline completed={[false, false, false, false, false]} />
          </section>

          <section className="story-section actors-section" data-reveal-section>
            <div className="story-section-heading">
              <span>03</span>
              <div><h2>Quem usa, para quê e em qual momento</h2><p>O produto serve a pessoas diferentes ao longo da mesma decisão.</p></div>
            </div>
            <div className="actor-grid">
              <article data-reveal-item><Bot /><span>Antes da ação</span><h3>Agente ou solicitante</h3><p>Propõe a ação e recebe apenas o permit compatível com seu pedido.</p></article>
              <article data-reveal-item><Building2 /><span>Durante a comprovação</span><h3>Sistemas de origem</h3><p>ERP, IAM, CI ou cadastro respondem automaticamente com recibos assinados.</p></article>
              <article data-reveal-item><ShieldCheck /><span>Na decisão</span><h3>Risco e segurança</h3><p>Definem quais fontes, limites, validade e contradições bloqueiam a ação.</p></article>
              <article data-reveal-item><ScrollText /><span>Depois e em incidentes</span><h3>Compliance e auditoria</h3><p>Reconstroem quem pediu, por que foi permitido e qual registro foi ancorado.</p></article>
            </div>
          </section>

          <section className="story-section use-cases-section" data-reveal-section>
            <div className="story-section-heading">
              <span>04</span>
              <div>
                <h2>Um mecanismo, vários controles antes da ação</h2>
                <p>Agente + deploy é o fluxo principal. As demais políticas mostram onde o mesmo mecanismo pode operar.</p>
              </div>
            </div>
            <div className="use-case-grid">
              {state.scenarios.map((entry) => (
                <article className={entry.id === "agent_deploy" ? "featured" : ""} data-reveal-item key={entry.id}>
                  <span>{entry.id === "agent_deploy" ? "FLUXO PRINCIPAL" : "POLÍTICA DISPONÍVEL"}</span>
                  <h3>{entry.title}</h3>
                  <p>{entry.description}</p>
                  <div><strong>Comprova com</strong><small>{entry.sources.map((source) => source.name).join(" · ")}</small></div>
                  <div><strong>Entrega</strong><small>{entry.outcome}</small></div>
                </article>
              ))}
            </div>
          </section>

          <section className="story-section architecture-story" data-reveal-section>
            <div>
              <span className="kicker">ARQUITETURA E FRONTEIRAS DE CONFIANÇA</span>
              <h2>A política decide fora da cadeia; a Midnight torna a decisão verificável.</h2>
            </div>
            <div className="architecture-path">
              <div data-reveal-item><strong>Navegador</strong><span>localhost:5173</span></div><ArrowRight />
              <div data-reveal-item><strong>API Proofrail</strong><span>{apiLabel}</span></div><ArrowRight />
              <div data-reveal-item><strong>CLI + prova</strong><span>carteira local</span></div><ArrowRight />
              <div className="onchain" data-reveal-item><strong>Contrato Midnight</strong><span>{shortHash(activeDeployment)}</span></div>
            </div>
            <p>
              Na execução local, node, indexer, proof server, contrato e transações
              Midnight operam no Docker. O conector GitHub valida Actions, commit e
              artefato com permissões mínimas. Fontes sem conector configurado usam
              respostas controladas para demonstrar as decisões de política.
            </p>
          </section>

          <section className="story-final-cta" data-reveal-section>
            <div><span className="kicker">PRONTO PARA VER A DIFERENÇA?</span><h2>Primeiro avalie sem provas. Depois construa a autorização do agente até o permit.</h2></div>
            <button onClick={() => openSurface("lab")}><Play /> Abrir demonstração</button>
          </section>
        </>
      ) : (
        <>
          <section className="lab-intro" id="lab">
            <div>
              <span className="kicker">CONTROLE DE EXECUÇÃO</span>
              <h1>{scenario.id === "agent_deploy" ? "Autorize um agente antes do deploy." : `Teste a decisão na ${networkCopy[state.network.active].label}.`}</h1>
              <p>A política, a criptografia, o permit e a âncora Midnight operam de ponta a ponta. Conectores configurados validam fontes externas; as demais fontes usam respostas controladas nesta demonstração.</p>
            </div>
            <div className={`environment-note ${networkReady ? "ready" : "pending"}`}>
              {networkReady ? <CheckCircle2 /> : <TriangleAlert />}
              <div>
                <strong>{networkCopy[state.network.active].label}</strong>
                <span>{networkReady ? networkCopy[state.network.active].description : "Rede selecionada, mas o contrato ainda não foi implantado nela."}</span>
              </div>
            </div>
          </section>

          <aside className={`github-integration ${github.configured ? "ready" : "pending"}`}>
            {github.configured ? <CheckCircle2 /> : <TriangleAlert />}
            <div>
              <span className="kicker">EVIDÊNCIA DE CI</span>
              <strong>{github.configured ? "GitHub App conectado" : "GitHub App disponível para configuração"}</strong>
              <p>
                {github.configured
                  ? `Repositórios permitidos: ${github.allowedRepositories.join(", ")}. O agente assina a ação; o webhook e a API do GitHub comprovam o mesmo commit e digest.`
                  : "A demonstração permanece disponível com respostas controladas. Para validar CI externo, configure as variáveis abaixo e entregue o webhook workflow_run à API."}
              </p>
              {!github.configured ? <code>{github.missingConfiguration.join(" · ")}</code> : null}
            </div>
          </aside>

          <DecisionPipeline completed={completedStages} />

          {!apiConfigured ? <div className="error-banner"><TriangleAlert />{disconnectedMessage}</div> : null}
          {apiConfigured && apiLimited ? <div className="error-banner"><TriangleAlert />{limitedApiMessage}</div> : null}
          {error ? <div className="error-banner"><TriangleAlert />{error}</div> : null}

          {!networkReady ? (
            <aside className="setup-callout" role="status">
              <TriangleAlert />
              <div>
                <strong>Prepare {networkCopy[state.network.active].label} antes de avaliar</strong>
                <p>Não é um erro da tela: esta rede ainda não tem uma carteira financiada nem o contrato Proofrail.</p>
                <ol className="network-setup-steps">
                  <li><b>1</b><span>No <strong>PowerShell, dentro da pasta em que você clonou o projeto</strong>, prepare a carteira e copie somente o endereço público exibido.</span></li>
                  <li><b>2</b><span>Abra o faucet desta rede, cole o endereço exibido e solicite tNIGHT.</span></li>
                  <li><b>3</b><span>Depois do saldo chegar, rode a implantação. Ela sincroniza a carteira e registra o tNIGHT para gerar tDUST.</span></li>
                  <li><b>4</b><span>O script compila, prova e implanta o contrato. Ao terminar, recarregue esta tela.</span></li>
                </ol>
                <code>& .\scripts\05-prepare-midnight-wallet.ps1 -Network {state.network.active}</code>
                <code>& .\scripts\05-scaffold-midnight.ps1 -Network {state.network.active}</code>
              </div>
              {state.network.faucets[state.network.active] ? <a href={state.network.faucets[state.network.active]!} target="_blank" rel="noreferrer">Abrir faucet</a> : null}
            </aside>
          ) : null}

          <section className="autopilot autopilot-first">
            <div className="autopilot-mark"><Zap /></div>
            <div>
              <span className="kicker">VERIFICAÇÃO TÉCNICA</span>
              <h2>Comprovar {scenario.shortTitle} antes da autorização</h2>
              <p>Gera recibos assinados, aplica a política e ancora a decisão na Midnight. Quando a política exigir revisão independente, o fluxo para em REVIEW_REQUIRED e nenhum permit é emitido.</p>
              {busy === "auto" && state.network.active !== "undeployed" ? (
                <small className="network-wait-note">
                  Ancoragem real na {networkCopy[state.network.active].label};
                  isso pode levar alguns minutos. Tempo decorrido: {busyElapsedSeconds}s.
                </small>
              ) : null}
            </div>
            <button disabled={busy !== null || !networkReady || !apiConfigured || apiLimited} onClick={() => run("auto", () => api.runSimulation(action))}>
              {busy === "auto" ? <RefreshCcw className="spin" /> : <Play />}
              {busy === "auto" ? "Provando na rede…" : "Verificar evidências"}
            </button>
          </section>

          <section className="scenario-section">
            <div className="section-heading">
              <div><span className="section-index">A</span><div><h2>Escolha o cenário</h2><p>Cada cenário aplica uma combinação específica de ação, fontes, limites e política.</p></div></div>
              <span className="scenario-count">{state.scenarios.length} políticas</span>
            </div>
            <div className="scenario-grid">
              {state.scenarios.map((entry, index) => (
                <button className={`${entry.id === scenario.id ? "scenario-option active" : "scenario-option"}${entry.id === "agent_deploy" ? " featured" : ""}`} disabled={busy !== null} key={entry.id} onClick={() => chooseScenario(entry.id)}>
                  <span>{String(index + 1).padStart(2, "0")}</span><strong>{entry.shortTitle}</strong><small>{entry.description}</small><ChevronDown />
                </button>
              ))}
            </div>
          </section>

          <div className="manual-mode-heading">
            <span className="kicker">MODO APRENDIZAGEM</span>
            <h2>Abra a decisão e teste cada etapa</h2>
            <p>Aqui você clica manualmente para enxergar o que, em produção, seria feito por conectores e workflows.</p>
          </div>

          <section className="workbench">
            <div className="workbench-main">
              <div className="section-heading compact">
                <div><span className="section-index">B</span><div><h2>{scenario.title}</h2><p>{scenario.outcome}</p></div></div>
                <span className="policy-chip"><LockKeyhole /> Política v{state.policy.version}</span>
              </div>

              <div className="action-evidence-grid">
                <article className="action-form">
                  <div className="card-title"><span>01</span><div><h3>Ação proposta</h3><p>Usado pelo solicitante ou agente antes de qualquer execução.</p></div></div>
                  {scenario.fields.map((field) => (
                    <label key={field.key}>
                      <span>{field.label}<small>{field.help}</small></span>
                      <div className="input-wrap">
                        <input type={field.type} value={action[field.key]} placeholder={field.placeholder} min={field.type === "number" ? 0 : undefined} onChange={(event) => setActionField(field.key, event.target.value)} />
                        {field.key === "value" ? <em>{scenario.unit}</em> : null}
                      </div>
                    </label>
                  ))}
                  {action.deployment ? (
                    <div className="deployment-context">
                      <div><strong>Escopo técnico vinculado</strong><span>Esses campos entram no action commitment e não podem mudar depois da decisão.</span></div>
                      <dl>
                        <div><dt>Tarefa</dt><dd>{action.deployment.taskId}</dd></div>
                        <div><dt>Repositório</dt><dd>{action.deployment.repository}</dd></div>
                        <div><dt>Serviço</dt><dd>{action.deployment.serviceId}</dd></div>
                        <div><dt>Ambiente do deploy</dt><dd>{action.deployment.environment}</dd></div>
                        <div><dt>Artefato</dt><dd title={action.deployment.artifactDigest}>{shortHash(action.deployment.artifactDigest, 16)}</dd></div>
                        <div><dt>Nonce</dt><dd>{shortHash(action.deployment.nonce, 8)}</dd></div>
                      </dl>
                    </div>
                  ) : null}
                  <div className="request-id"><span>Request ID — impede replay</span><code>{shortHash(action.requestId, 8)}</code></div>

                  {action.deployment ? (
                    <div className="document-lab agent-claim-lab">
                      <div className="document-lab-title"><Bot /><div><strong>Alegação do próprio agente</strong><span>“Meu deploy está autorizado” não comprova identidade, CI, segurança ou aprovação.</span></div></div>
                      <p>A alegação é vinculada ao pedido e auditada, mas permanece autodeclarada e nunca satisfaz uma origem exigida pela política.</p>
                      <button className="secondary-button" disabled={busy !== null || !apiConfigured} onClick={() => run("self-declared", () => api.selfDeclared(action))}>
                        <Bot /> Registrar alegação sem origem
                      </button>
                      <small className="document-next-step">Depois avalie: o resultado esperado é DENY, porque faltam fontes independentes.</small>
                    </div>
                  ) : (
                  <div className="document-lab">
                    <div className="document-lab-title"><FileWarning /><div><strong>Documento apresentado pelo cliente</strong><span>Anexar não significa comprovar a origem.</span></div></div>
                    <p>O arquivo é lido no navegador. A API recebe apenas nome, tamanho, tipo e SHA-256 — nunca o conteúdo nesta demonstração.</p>
                    <div className="document-actions">
                      <label className="file-picker">
                        <Upload /> Escolher arquivo
                        <input type="file" accept=".pdf,.png,.jpg,.jpeg" disabled={busy !== null} onChange={(event) => { const file = event.target.files?.[0]; if (file) void readDocument(file); }} />
                      </label>
                      <button disabled={busy !== null} onClick={useFakeDocument}><FileWarning /> Usar exemplo falso</button>
                    </div>
                    {document ? (
                      <div className="document-selected">
                        <FileCheck2 />
                        <div><strong>{document.name}</strong><span>{bytesLabel(document.size)} · SHA-256 {shortHash(document.sha256, 8)}</span></div>
                        <em>AUTODECLARADO</em>
                      </div>
                    ) : null}
                    <button className="secondary-button" disabled={busy !== null || !document || !apiConfigured} onClick={registerDocument}>
                      <FileCheck2 /> {selfDeclaredCount > 0 ? "Registrar outra alegação" : "Registrar documento como alegação"}
                    </button>
                    <small className="document-next-step">Depois, avalie sem coletar fontes: o resultado esperado é DENY.</small>
                  </div>
                  )}
                </article>

                <article className="evidence-stack">
                  <div className="card-title"><span>02</span><div><h3>Fontes exigidas</h3><p>Em produção, ERP, IAM, CI ou cadastro responderiam automaticamente.</p></div></div>
                  <div className="source-explainer">
                    <strong>Na demonstração, você controla a resposta:</strong>
                    <span><b>Confirmar evidência</b> representa a origem confirmando o fato.</span>
                    <span><b>Registrar conflito</b> representa a origem devolvendo valor ou estado divergente.</span>
                  </div>
                  <div className="policy-rule"><ShieldCheck /><span><strong>{state.policy.minIndependentSources} fontes obrigatórias{(state.policy.reviewRequiredClaims?.length ?? 0) > 0 ? ` + ${state.policy.reviewRequiredClaims?.length ?? 0} de revisão quando aplicável` : ""}</strong> · até {state.policy.maxAgeMinutes} min · conflito bloqueia</span></div>
                  {scenario.sources.map((source, index) => {
                    const collected = evidenceBySource.get(source.id) ?? 0;
                    return (
                      <div className={collected > 0 ? "source-row collected" : "source-row"} key={source.id}>
                        <span className="source-number">{collected > 0 ? <Check /> : index + 1}</span>
                        <div><strong>{source.name}{source.role === "review" ? <em className="source-role">REVISÃO</em> : null}{source.id === "ci-agent-deploy" ? <em className={`source-role connector ${github.configured ? "ready" : ""}`}>GITHUB APP</em> : null}</strong><p>{source.description}</p><small>{source.id === "ci-agent-deploy" && github.configured ? "Conector externo disponível via API/MCP; os controles ao lado usam respostas de demonstração." : `${collected} recibo(s) verificado(s)`}</small></div>
                        <div className="source-actions">
                          <button disabled={busy !== null || !apiConfigured || apiLimited} onClick={() => run(source.id, () => api.collect(source.id, action, "valid"))}>Confirmar evidência</button>
                          <button className="conflict-button" disabled={busy !== null || !apiConfigured || apiLimited} onClick={() => run(`${source.id}-bad`, () => api.collect(source.id, action, "contradictory"))}>Registrar conflito</button>
                        </div>
                      </div>
                    );
                  })}
                  <button className="evaluate-button" disabled={busy !== null || !networkReady || !apiConfigured || apiLimited} onClick={() => run("evaluate", () => api.evaluate(action))}>
                    <ShieldCheck /> Avaliar evidências disponíveis <span>decisão + âncora</span>
                  </button>
                </article>
              </div>
            </div>

            <aside className="decision-rail">
              <div className="card-title"><span>03–05</span><div><h3>Decisão, autorização e execução</h3><p>O sistema decide; usuário ou agente recebe somente o resultado permitido.</p></div></div>
              {latestDecision ? (
                <>
                  <div className={`decision-status ${latestDecision.status.toLowerCase()}`}>{statusIcon(latestDecision.status)}<div><small>DECISÃO</small><strong>{latestDecision.status}</strong><p>{latestDecision.reasons[0]}</p></div></div>
                  <div className="decision-facts"><div><span>Fontes</span><strong>{latestDecision.independentSources}/{latestDecision.requiredSources}</strong></div><div><span>Contradições</span><strong>{latestDecision.contradictions.length}</strong></div><div><span>Permit</span><strong>{latestDecision.permit ? "emitido" : "não emitido"}</strong></div></div>
                  {latestDecision.missingRequirements.length > 0 ? <div className="finding"><strong>O que ainda falta</strong>{latestDecision.missingRequirements.map((item) => <span key={item}>— {item}</span>)}</div> : null}
                  {latestDecision.contradictions.length > 0 ? <div className="finding danger"><strong>Conflitos detectados</strong>{latestDecision.contradictions.map((item) => <span key={item}>— {item}</span>)}</div> : null}
                  <div className="chain-receipt"><div><Database /><strong>Recibo Midnight</strong></div><dl><div><dt>Rede</dt><dd>{state.network.active}</dd></div><div><dt>Contrato</dt><dd title={latestAnchor?.contractAddress ?? undefined}>{shortHash(latestAnchor?.contractAddress)}</dd></div><div><dt>Transação</dt><dd title={latestAnchor?.txId ?? undefined}>{shortHash(latestAnchor?.txId)}</dd></div><div><dt>Merkle root</dt><dd title={latestDecision.evidenceRoot}>{shortHash(latestDecision.evidenceRoot)}</dd></div></dl></div>
                  {latestDecision.permit ? <button className="permit-button" disabled={busy !== null || !apiConfigured || apiLimited || latestExecution?.permitId === latestDecision.permit.id} onClick={() => run("execute", () => api.execute(latestDecision.permit!.id))}><Play />{latestExecution?.permitId === latestDecision.permit.id ? "Permit consumido" : "Executar com permit"}</button> : null}
                </>
              ) : (
                <div className="decision-empty"><div><Circle /><ArrowRight /><ShieldCheck /></div><strong>Ainda sem decisão</strong><p>Registre um documento, simule as fontes ou rode a trilha completa.</p></div>
              )}
            </aside>
          </section>

          <section className="aftercare">
            <article>
              <div className="section-heading compact"><div><span className="section-index">C</span><div><h2>Minimização de dados</h2><p>Apague o que não precisa sobreviver.</p></div></div></div>
              <div className="lifecycle-visual"><div><span>Bruto recebido</span><strong>{state.metrics.originalRawBytes} B</strong></div><ArrowRight /><div className={state.metrics.accessibleRawBytes === 0 ? "erased" : ""}><span>Bruto acessível</span><strong>{state.metrics.accessibleRawBytes} B</strong></div><ArrowRight /><div><span>Commitments</span><strong>{state.metrics.persistentAnchorBytes} B</strong></div></div>
              <p className="data-note">Em demos pequenas, o recibo pode ser maior que o dado. O ganho aparece com documentos grandes e batching.</p>
              <button className="erase-button" disabled={busy !== null || !apiConfigured} onClick={() => run("expire", () => api.expire())}><KeyRound /> Destruir chaves deste pedido</button>
            </article>

            <article className="audit-panel">
              <div className="section-heading compact"><div><span className="section-index">D</span><div><h2>Trilha de auditoria</h2><p>Para compliance, segurança, auditoria e investigação operacional.</p></div></div></div>
              <div className="audit-purpose"><Users /><div><strong>Quem consulta?</strong><span>Compliance, segurança, auditor interno/externo e responsáveis por incidentes.</span></div><div><strong>Quando importa?</strong><span>Prestação de contas, disputa, investigação, fiscalização e explicação de uma decisão automatizada.</span></div></div>
              <div className="audit-list">{state.audit.slice(0, 12).map((event) => <div className="audit-row" key={event.id}><span /><div><strong>{event.type.replaceAll("_", " ")}</strong><p>{event.message}</p><time>{new Date(event.createdAt).toLocaleString("pt-BR")}</time></div></div>)}</div>
            </article>
          </section>

          <footer><div><strong>Proofrail</strong><span>A blockchain registra integridade; a política decide suficiência.</span></div><button disabled={busy !== null} onClick={resetScenario}><RefreshCcw /> Reiniciar este cenário</button></footer>
        </>
      )}
      </div>
    </main>
  );
}
