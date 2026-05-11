import { lazy, Suspense, useEffect, useState } from "react";
import {
  Send, History, X, CheckSquare, Square, BookmarkPlus,
  MessageSquare, SquarePen, Paperclip, Mic, Sparkles,
} from "lucide-react";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import { MagritLogo } from "./brand/MagritLogo";
import { ProductCard } from "./ProductCard";
import { CartButton } from "./CartButton";
// R7 (refacto 2026-05-11) : lazy-load la modale library picker (modale lourde,
// pas necessaire au shell initial du chat).
const LibraryPickerModal = lazy(() =>
  import("./LibraryPickerModal").then((m) => ({ default: m.LibraryPickerModal })),
);
import { useConversation, ConversationHistory } from "../contexts/ConversationContext";
import { useAuth } from "../contexts/AuthContext";
import { useLibrary } from "../contexts/LibraryContext";
import { usePlan } from "../hooks/usePlan";
import { useTenant } from "../contexts/TenantContext";
import { ENABLE_STREAMING_CHAT } from "../lib/featureFlags";
import { TEST_IDS } from "../lib/testIds";
import {
  ClaudeSseStreamError,
  MAX_CONTEXT_MESSAGES,
  truncateMessages,
  useClaudeSseStream,
} from "../hooks/useClaudeSseStream";

// R2 Phase A : readClaudeSseStream extrait dans useClaudeSseStream.ts
// (avec AbortController + detection billing error + troncage 25 msg).

interface ChatInterfaceProps {
  onShowResults?: () => void;
  onProductConfigReceived?: (config: any) => void;
}

export function ChatInterface({ onShowResults }: ChatInterfaceProps) {
  const {
    messages,
    setMessages,
    products,
    setProducts,
    history: conversationHistory,
    currentConversationId,
    saveCurrent: saveCurrentConversation,
    loadConversation: loadFromContext,
    deleteConversation: deleteFromContext,
    startNewConversation: resetConversation,
  } = useConversation();

  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { canUse } = usePlan();
  const { addProductsBulk } = useLibrary();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  // R2 Phase B (bug E4) : banner billing explicite au lieu de bascule
  // demo silencieuse quand Anthropic renvoie un 402 / billing error.
  const [billingError, setBillingError] = useState(false);
  const { send: sendSseStream } = useClaudeSseStream();
  // E3.1 — nb de chunks de texte recus pendant un stream en cours.
  // null quand pas de stream actif. Permet l indicateur "Marguerite redige...".
  const [streamingChunks, setStreamingChunks] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLibraryPickerOpen, setBulkLibraryPickerOpen] = useState(false);
  // E2.2 — options cliquables associees a la derniere clarification mode strict
  const [pendingOptions, setPendingOptions] = useState<string[]>([]);
  // E2 — Mode Marguerite (open=extrapolation libre / strict=interpretation litterale)
  // Persiste en localStorage pour reprendre le dernier mode utilise.
  const [mode, setMode] = useState<"open" | "strict">(() => {
    try {
      return (localStorage.getItem("magrit.marguerite.mode") as "open" | "strict") || "open";
    } catch {
      return "open";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("magrit.marguerite.mode", mode);
    } catch { /* noop */ }
  }, [mode]);

  // ─── ⌘K : ouvrir l'historique rapidement ────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowHistory((v) => !v);
      }
      if (e.key === "Escape" && showHistory) {
        setShowHistory(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showHistory]);

  const loadConversation = (conv: ConversationHistory) => {
    loadFromContext(conv);
    setShowHistory(false);
    if (conv.products.length > 0) onShowResults?.();
  };

  const deleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteFromContext(id);
  };

  const startNewConversation = () => {
    resetConversation();
    setShowHistory(false);
  };

  // ─── Mapper les configs JSON Clariprint → objets ProductCard ─────────────
  const parseConfigsToProducts = (configs: any[]): any[] => {
    if (!configs || configs.length === 0) return [];
    return configs.map((config: any, index: number) => {
      const d = config.display || {};
      const c = config.clariprint || {};
      return {
        id: `product-${Date.now()}-${index}`,
        name: d.productName || c.reference || "Produit",
        quantity: d.quantity || c.quantity || 0,
        format: d.format || `${c.width} × ${c.height} cm`,
        material: d.support || "",
        weight: typeof d.grammage === "number" ? d.grammage : parseInt(d.grammage) || 0,
        printing: {
          recto: d.impression?.recto || "Quadrichromie (CMJN)",
          verso: d.impression?.verso || (c.back_colors?.length > 0 ? "Quadrichromie (CMJN)" : "Sans impression"),
        },
        finish: d.finitionRecto || "",
        finishRecto: d.finitionRecto || "",
        finishVerso: d.finitionVerso || "Sans finition",
        suggestions: Array.isArray(d.suggestions) ? d.suggestions : [],
        pages: c.pages || null,
        clariprintData: c,
      };
    });
  };

  // ─── handleSend ───────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    await sendMessage(input.trim());
    setInput("");
  };

  // E2.2 — clic sur un chip d'option propose en mode strict
  const handleOptionClick = async (option: string) => {
    if (isLoading) return;
    await sendMessage(option);
  };

  const sendMessage = async (userMessage: string) => {
    if (!userMessage || isLoading) return;
    setIsLoading(true);
    setPendingOptions([]); // reset des options precedentes
    setBillingError(false);

    // R2 Phase B (bug E5) : on tronque l'historique a 25 messages max
    // (NFR43, project-context §3.4) AVANT d'ajouter le nouveau user message,
    // pour garantir que le payload envoye au LLM ne depasse jamais la limite.
    const fullMessages = [...messages, { role: "user", content: userMessage }];
    const { truncated: contextMessages, droppedCount } = truncateMessages(
      fullMessages,
      MAX_CONTEXT_MESSAGES,
    );
    setMessages(fullMessages); // l'UI conserve tout l'historique (l'indicateur signale le troncage)
    if (droppedCount > 0) {
      console.info(
        `[R2 E5] Conversation tronquee : ${droppedCount} messages les plus anciens omis du contexte LLM (limite ${MAX_CONTEXT_MESSAGES}).`,
      );
    }

    let assistantMessage = "";
    let parsedProducts: any[] = [];

    try {
      // R2 Phase A : passe par useClaudeSseStream (extraction + AbortController
      // + detection billing). Le payload final reste de meme forme.
      const baseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-e3db71a4`;
      const requestBody = {
        messages: contextMessages,
        userId: user?.id ?? null,
        tenantId: currentTenant?.id ?? null,
        mode,
      };

      const data = await sendSseStream(
        {
          endpoint: `${baseUrl}/${ENABLE_STREAMING_CHAT ? 'claude-proxy-stream' : 'claude-proxy'}`,
          authToken: publicAnonKey,
          body: requestBody,
          onDelta: ENABLE_STREAMING_CHAT
            ? () => setStreamingChunks((n) => (n ?? 0) + 1)
            : undefined,
        },
        ENABLE_STREAMING_CHAT,
      );

      if (ENABLE_STREAMING_CHAT) setStreamingChunks(0);

      // v3 : le edge function peut retourner un teachingNote (reponse
      // pedagogique en markdown) pour les questions du type
      // "quelle difference entre X et Y", "quel papier choisir pour...".
      // S'il est present, c'est ce qu'on affiche dans le message assistant,
      // sinon on fallback sur un texte generique (on n'affiche plus le
      // JSON brut de Claude qui etait illisible).

      // E2.2 — Si mode strict + Claude a demande une clarification, on
      // l'affiche comme un message assistant et on ne genere pas de produits.
      const clarification: string | null =
        typeof data.clarification === "string" && data.clarification.trim()
          ? data.clarification.trim()
          : null;

      // E2.1 — Si Marguerite a fait des hypotheses, on les liste en bandeau
      // markdown au-dessus du contenu.
      const assumptions: string[] = Array.isArray(data.assumptions)
        ? data.assumptions.filter((s: unknown) => typeof s === "string" && s.trim())
        : [];
      const assumptionsBlock = assumptions.length
        ? `> 🌿 **Hypothèses de Marguerite** :\n${assumptions.map((a) => `> - ${a}`).join("\n")}\n\n`
        : "";

      if (clarification) {
        // Le marqueur visuel (icone moderne + chips cliquables) est rendu par
        // l'UI, pas par l'emoji texte. Le message lui-meme reste sobre.
        assistantMessage = `**Précision demandée :** ${clarification}`;
        const options: string[] = Array.isArray(data.clarificationOptions)
          ? data.clarificationOptions.filter(
              (s: unknown) => typeof s === "string" && s.trim()
            )
          : [];
        setPendingOptions(options);
      } else if (typeof data.teachingNote === "string" && data.teachingNote.trim()) {
        assistantMessage = assumptionsBlock + data.teachingNote.trim();
      } else if (data.configs && Array.isArray(data.configs) && data.configs.length > 0) {
        // Demande classique : on laisse les ProductCards parler d'elles-memes.
        // Mais si on a des hypotheses, on les affiche tout de meme en haut.
        assistantMessage = assumptionsBlock.trimEnd();
      } else {
        assistantMessage = "Désolé, je n'ai pas pu traiter votre demande.";
      }

      // Ne push un message assistant que s'il a du contenu utile a afficher.
      if (assistantMessage) {
        setMessages((prev) => [...prev, { role: "assistant", content: assistantMessage }]);
      }
      setIsDemoMode(!!data.demoMode);

      if (data.configs && Array.isArray(data.configs) && data.configs.length > 0) {
        parsedProducts = parseConfigsToProducts(data.configs);
      }

      if (parsedProducts.length > 0) {
        setProducts((prev) => [...prev, ...parsedProducts]);
        onShowResults?.();
      }
    } catch (error) {
      console.error("❌ Chat error:", error);

      // R2 Phase B (bug E4) : si l'erreur est de type billing, on affiche
      // un banner explicite au lieu de basculer silencieusement en demo.
      // Le user choisit s'il veut malgre tout voir un exemple demo (opt-in).
      const isBilling =
        error instanceof ClaudeSseStreamError && error.kind === 'billing';
      if (isBilling) {
        setBillingError(true);
        assistantMessage =
          "IA temporairement indisponible — facturation Anthropic suspendue. " +
          "Contactez votre administrateur Magrit pour reactivation. " +
          "Vous pouvez continuer en mode demo via le bouton ci-dessous.";
        setMessages((prev) => [...prev, { role: "assistant", content: assistantMessage }]);
        return;
      }

      // Autres erreurs reseau / serveur : fallback demo (comportement
      // historique conserve, mais documente comme fallback uniquement).
      setIsDemoMode(true);
      const demoConfigs = [
        {
          clariprint: {
            reference: "Cartes de visite",
            kind: "leaflet",
            quantity: 500,
            width: "8.5",
            height: "5.5",
            with_bleeds: "1",
            front_colors: ["4-color"],
            back_colors: ["4-color"],
            papers: { custom: { quality: "Couché Brillant PEFC", weight: "350" } },
            finishing_front: "PELLIC_ACETATE_MAT",
            finishing_back: "PELLIC_ACETATE_MAT",
          },
          display: {
            productName: "Cartes de visite",
            quantity: 500,
            format: "85 × 55 mm (format standard)",
            support: "Papier couché brillant",
            grammage: 350,
            impression: { recto: "Quadrichromie (CMJN)", verso: "Quadrichromie (CMJN)" },
            finitionRecto: "Pelliculage mat",
            finitionVerso: "Pelliculage mat",
            suggestions: [],
          },
        },
      ];
      parsedProducts = parseConfigsToProducts(demoConfigs);
      assistantMessage = "Mode démo — voici un exemple de produit.";
      setMessages((prev) => [...prev, { role: "assistant", content: assistantMessage }]);
      setProducts((prev) => [...prev, ...parsedProducts]);
      onShowResults?.();
    } finally {
      setIsLoading(false);
      setStreamingChunks(null);
      const finalMessages = [...newMessages, { role: "assistant", content: assistantMessage }];
      const allProducts = [...products, ...parsedProducts];
      saveCurrentConversation(finalMessages, allProducts);
    }
  };

  const handleProductUpdate = (index: number, updatedProduct: any) => {
    setProducts((prev) => {
      const next = [...prev];
      next[index] = updatedProduct;
      return next;
    });
  };

  // Grille produit : mêmes règles que la v1
  const getGridClass = () => {
    const n = products.length;
    if (n <= 2) return "grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch";
    if (n <= 6) return "grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch";
    if (n <= 12) return "grid grid-cols-2 lg:grid-cols-3 gap-4 items-stretch";
    return "grid grid-cols-2 lg:grid-cols-4 gap-3 items-stretch";
  };
  const gridClass = getGridClass();

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      data-testid={TEST_IDS.marguerite.chat}
      className="chat-v2 h-[calc(100vh-56px)] bg-bg grid"
      style={{
        gridTemplateColumns: "56px 1fr",
        fontFamily: "var(--font-ui)",
      }}
    >
      {/* ══════════════════════════════════════════════════════════
          Rail latéral 56px : actions + avatar
          Le logo Magrit est dans le Header global — on ne le duplique pas.
          ══════════════════════════════════════════════════════════ */}
      <aside
        className="flex flex-col items-center gap-2 py-4 px-2 border-r border-line bg-bg"
      >
        <RailIcon
          icon={MessageSquare}
          label="Conversation en cours"
          active={messages.length > 0}
        />
        <RailIcon
          icon={SquarePen}
          label="Nouvelle conversation"
          onClick={startNewConversation}
        />
        <RailIcon
          icon={History}
          label="Historique (⌘K)"
          onClick={() => setShowHistory(true)}
          badge={conversationHistory.length > 0 ? conversationHistory.length : undefined}
        />

        {/* Panier — permet d'agreger plusieurs productcards pour imprimer
            un devis groupe par client. Le composant gere lui-meme le badge. */}
        <CartButton variant="rail" />

        {/* Avatar user en bas (placeholder) */}
        <div
          className="mt-auto w-7 h-7 rounded-full bg-line-2 grid place-items-center text-ink-muted"
          style={{ fontSize: "12px", fontWeight: 500 }}
          aria-label={user?.email ?? "Non connecté"}
          title={user?.email ?? "Non connecté"}
        >
          {user?.email?.[0]?.toUpperCase() ?? "?"}
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════════
          Main canvas : topbar + feed + input sticky
          ══════════════════════════════════════════════════════════ */}
      <main className="relative flex flex-col bg-bg min-w-0">
        {/* Topbar : projet + pills actions */}
        <div className="flex items-center gap-3 px-9 py-3.5 border-b border-line bg-paper">
          <div
            className="text-ink-mute-2 font-mono"
            style={{ fontSize: "13px", fontWeight: 400 }}
          >
            Projet · <span className="text-ink" style={{ fontWeight: 500 }}>
              {conversationHistory.find((c) => c.id === currentConversationId)?.title
                ?.slice(0, 40) ?? "Nouvelle conversation"}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {/* R2 Phase B (bug E4) : banner billing explicite, distinct du mode demo */}
            {billingError && (
              <span
                data-testid={TEST_IDS.marguerite.billingErrorBanner}
                className="px-2.5 py-1 rounded-full font-mono border border-red-300 bg-red-50 text-red-700"
                style={{ fontSize: "11px", letterSpacing: "0.04em", fontWeight: 500 }}
                title="IA indisponible : facturation Anthropic suspendue. Contactez votre administrateur."
              >
                ⚠ FACTURATION IA
              </span>
            )}
            {/* R2 Phase B (bug E5) : indicateur quand l'historique depasse la limite contexte LLM */}
            {messages.length > MAX_CONTEXT_MESSAGES && (
              <span
                data-testid={TEST_IDS.marguerite.contextTruncatedIndicator}
                className="px-2.5 py-1 rounded-full font-mono border border-blue-200 bg-blue-50 text-blue-700"
                style={{ fontSize: "11px", letterSpacing: "0.04em", fontWeight: 500 }}
                title={`Les ${messages.length - MAX_CONTEXT_MESSAGES} message(s) les plus anciens ne sont plus inclus dans le contexte envoye au LLM (limite ${MAX_CONTEXT_MESSAGES}).`}
              >
                CONTEXTE TRONQUE
              </span>
            )}
            {isDemoMode && (
              <span
                className="px-2.5 py-1 rounded-full font-mono border border-warn-bg bg-warn-bg text-warn-fg"
                style={{ fontSize: "11px", letterSpacing: "0.04em", fontWeight: 500 }}
              >
                MODE DÉMO
              </span>
            )}
            {products.length > 0 && (
              <span
                className="px-3 py-1.5 rounded-full border border-line bg-paper text-ink-2"
                style={{ fontSize: "13px", fontWeight: 400 }}
              >
                {products.length} produit{products.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Feed scrollable — deux wrappers : messages centrés 760px,
            grille produits 1180px. Evite que le texte soit mal cadré
            quand des produits sont présents. */}
        <div className="flex-1 overflow-y-auto pb-40">
          {/* Zone messages — toujours max 760px, centrée */}
          <div className="mx-auto w-full px-6 py-8" style={{ maxWidth: "760px" }}>
            {/* Empty state : logo + suggestions */}
            {messages.length === 0 && (
              <div className="text-center pt-12 pb-8">
                <div className="inline-flex items-center justify-center mb-6">
                  <MagritLogo size={96} />
                </div>
                <h1
                  className="text-ink mb-3"
                  style={{
                    fontWeight: 200,
                    fontSize: "49px",
                    letterSpacing: "-0.035em",
                    lineHeight: 1.05,
                  }}
                >
                  Le papier pense.
                </h1>
                <p
                  className="text-ink-muted max-w-xl mx-auto"
                  style={{ fontSize: "17px", fontWeight: 300, lineHeight: 1.6 }}
                >
                  Décrivez votre projet d'impression — je calcule le devis et je construis la fiche produit.
                </p>

                <div
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-10 max-w-2xl mx-auto text-left"
                >
                  {[
                    { label: "Cartes de visite", sub: "500 cartes avec pelliculage mat", msg: "500 cartes de visite avec pelliculage mat" },
                    { label: "Flyers", sub: "1000 flyers A5 recto verso", msg: "1000 flyers A5 recto verso" },
                    { label: "Brochure", sub: "24 pages format A4", msg: "Brochure 24 pages format A4" },
                    { label: "Affiches", sub: "250 affiches A2 brillant", msg: "250 affiches A2 brillant" },
                  ].map((ex) => (
                    <button
                      key={ex.msg}
                      onClick={() => setInput(ex.msg)}
                      className="p-4 border border-line rounded-lg bg-paper hover:border-line-2 transition-colors"
                      style={{ fontFamily: "var(--font-ui)" }}
                    >
                      <div className="text-ink mb-1" style={{ fontSize: "14px", fontWeight: 500 }}>
                        {ex.label}
                      </div>
                      <div className="text-ink-muted" style={{ fontSize: "13px", fontWeight: 400 }}>
                        {ex.sub}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages (sans bulles, Claude-like).
                v3 : les messages assistants restent AFFICHES meme quand des
                productcards sont presentes, parce qu'ils peuvent contenir un
                "teachingNote" pedagogique pour les questions de comparaison
                (ex: couche vs non couche). Rendu markdown simple (bold,
                bullets, titres) via le helper renderMarkdown. */}
            <div className="space-y-6">
              {messages.map((message, index) => {
                if (message.role === "user") {
                  return (
                    <div
                      key={index}
                      data-testid={TEST_IDS.marguerite.message}
                      data-message-role="user"
                      data-message-index={index}
                      className="flex justify-end mb-2"
                    >
                      <div
                        className="bg-[#F5F5F5] rounded-xl px-4 py-3 text-ink max-w-full"
                        style={{ fontSize: "15px", lineHeight: 1.5, fontWeight: 400 }}
                      >
                        {message.content}
                      </div>
                    </div>
                  );
                }
                if (message.role === "assistant" && message.content.trim()) {
                  // E7.7 — sous-testid selon le type de contenu :
                  // - clarification mode strict commence par "**Précision demandée :**"
                  // - hypotheses mode ouvert contiennent "> 🌿 **Hypothèses"
                  let innerTestId: string | undefined;
                  if (message.content.startsWith("**Précision demandée :**")) {
                    innerTestId = TEST_IDS.marguerite.clarificationBubble;
                  } else if (message.content.includes("> 🌿 **Hypothèses")) {
                    innerTestId = TEST_IDS.marguerite.hypothesesBanner;
                  }
                  return (
                    <div
                      key={index}
                      data-testid={TEST_IDS.marguerite.message}
                      data-message-role="assistant"
                      data-message-index={index}
                      className="text-ink-2"
                      style={{ fontSize: "15.5px", lineHeight: 1.65, fontWeight: 300 }}
                    >
                      <div data-testid={innerTestId}>
                        {renderMarkdown(message.content)}
                      </div>
                    </div>
                  );
                }
                return null;
              })}

              {/* Loading : shimmer doux plutôt que bounce */}
              {isLoading && (
                <div aria-label="Magrit réfléchit">
                  <div className="h-3 w-40 rounded bg-line animate-pulse mb-2" />
                  <div className="h-3 w-64 rounded bg-line animate-pulse mb-2" />
                  <div className="h-3 w-52 rounded bg-line animate-pulse" />
                  {/* E3.1 — indicateur live pendant un stream SSE */}
                  {streamingChunks !== null && streamingChunks > 0 && (
                    <p
                      className="mt-2 text-ink-mute-2 font-mono"
                      style={{ fontSize: '11px', letterSpacing: '0.04em' }}
                    >
                      Marguerite redige · {streamingChunks} chunk{streamingChunks > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Zone produits — wrapper indépendant, plus large si besoin */}
          <div className="mx-auto w-full px-6 pb-8" style={{ maxWidth: "1180px" }}>

            {/* Barre de sélection groupée (≥5 produits, Pro+) */}
            {products.length >= 5 && user && canUse('library') && (
              <div
                className="mt-8 mb-3 flex flex-wrap items-center justify-between gap-2 bg-paper border border-line rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (selectedIds.size === products.length) {
                        setSelectedIds(new Set());
                      } else {
                        setSelectedIds(new Set(products.map((p) => p.id)));
                      }
                    }}
                    className="flex items-center gap-2 text-ink hover:text-brand"
                    style={{ fontSize: "13.5px", fontWeight: 500 }}
                  >
                    {selectedIds.size === products.length ? (
                      <CheckSquare className="w-4 h-4" strokeWidth={1.5} />
                    ) : (
                      <Square className="w-4 h-4" strokeWidth={1.5} />
                    )}
                    {selectedIds.size === products.length
                      ? 'Tout désélectionner'
                      : 'Sélectionner tous les produits'}
                  </button>
                  {selectedIds.size > 0 && (
                    <span
                      className="px-2 py-0.5 rounded-full bg-info-bg text-info-fg font-mono"
                      style={{ fontSize: "11px", fontWeight: 500, letterSpacing: "0.02em" }}
                    >
                      {selectedIds.size} / {products.length}
                    </span>
                  )}
                </div>
                {selectedIds.size > 0 && (
                  <button
                    onClick={() => setBulkLibraryPickerOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-ink text-paper rounded-lg hover:bg-black"
                    style={{ fontSize: "13px", fontWeight: 500 }}
                  >
                    <BookmarkPlus className="w-4 h-4" strokeWidth={1.5} />
                    Ajouter {selectedIds.size} produit{selectedIds.size > 1 ? 's' : ''} à une bibliothèque
                  </button>
                )}
              </div>
            )}

            {/* ProductCards en grille sous le dernier message AI */}
            {products.length > 0 && (
              <div data-testid={TEST_IDS.marguerite.quoteResult} className={`${gridClass} mt-6`}>
                {products.map((product, index) => (
                  <ProductCard
                    key={product.id ?? `p-${index}`}
                    data-line-index={index}
                    product={product}
                    onProductUpdate={(updated) => handleProductUpdate(index, updated)}
                    compact={products.length >= 12}
                    selectable={products.length >= 5 && !!user && canUse('library')}
                    selected={selectedIds.has(product.id)}
                    onSelectedChange={(checked) => {
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (checked) next.add(product.id);
                        else next.delete(product.id);
                        return next;
                      });
                    }}
                  />
                ))}
              </div>
            )}

            {bulkLibraryPickerOpen && (
              <Suspense fallback={null}>
              <LibraryPickerModal
                productCount={selectedIds.size}
                onPick={async (libraryId) => {
                  const items = products.filter((p) => selectedIds.has(p.id));
                  await addProductsBulk(
                    items.map((p) => ({
                      library_id: libraryId,
                      client_id: p.client_id ?? null,
                      name: p.name,
                      category: p.clariprintData?.kind || 'Autres',
                      description: `${p.quantity ?? ''} · ${p.format ?? ''} · ${p.material ?? ''}`.trim(),
                      price_ht: p.price ?? 0,
                      image_url: '',
                      config: p,
                      active: true,
                    }))
                  );
                  setSelectedIds(new Set());
                }}
                onClose={() => setBulkLibraryPickerOpen(false)}
              />
              </Suspense>
            )}
          </div>
        </div>

        {/* Input sticky, pill shape */}
        <div className="absolute left-0 right-0 bottom-0 px-6 pb-6 pt-4 bg-gradient-to-t from-bg via-bg to-transparent pointer-events-none">
          <div className="mx-auto max-w-[760px] pointer-events-auto">
            {/* E2.2 — Chips cliquables proposees par Marguerite en mode strict.
                Au clic, la valeur est envoyee comme nouveau message user. */}
            {pendingOptions.length > 0 && (
              <div className="mb-2.5 px-1">
                <div
                  className="flex items-center gap-1.5 mb-2 text-ink-muted"
                  style={{ fontSize: "11.5px", fontWeight: 500, letterSpacing: "0.02em" }}
                >
                  <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Marguerite propose
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {pendingOptions.map((opt, i) => (
                    <button
                      key={`${opt}-${i}`}
                      type="button"
                      onClick={() => handleOptionClick(opt)}
                      disabled={isLoading}
                      className="inline-flex items-center px-3 py-1.5 rounded-full bg-paper border border-line-2 text-ink hover:bg-bg hover:border-ink transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{
                        fontSize: "13px",
                        fontWeight: 400,
                        boxShadow: "var(--v2-shadow-sm)",
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div
              className="bg-paper border border-line-2 rounded-2xl px-4 py-3"
              style={{ boxShadow: "var(--v2-shadow-md)" }}
            >
              <textarea
                data-testid={TEST_IDS.marguerite.messageInput}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Décrivez votre projet d'impression…"
                className="w-full bg-transparent border-0 focus:outline-none resize-none text-ink placeholder:text-ink-mute-2"
                style={{
                  fontSize: "15.5px",
                  fontWeight: 400,
                  fontFamily: "var(--font-ui)",
                  lineHeight: 1.5,
                  padding: "2px 0 8px",
                }}
                rows={2}
              />
              <div className="flex items-center gap-2">
                <ChipTool icon={Paperclip} label="Joindre" />
                <ChipTool icon={Mic} label="Dicter" />
                {/* E2 — Toggle mode Marguerite (open / strict) */}
                <div
                  data-testid={TEST_IDS.marguerite.modeToggle}
                  data-mode={mode}
                  className="inline-flex items-center rounded-full border border-line bg-bg p-0.5"
                  role="group"
                  aria-label="Mode Marguerite"
                  title={
                    mode === "open"
                      ? "Marguerite extrapole quand la demande est vague"
                      : "Marguerite execute litteralement et demande une precision si besoin"
                  }
                >
                  <button
                    type="button"
                    onClick={() => setMode("open")}
                    className={`px-2.5 py-0.5 rounded-full transition-colors ${
                      mode === "open"
                        ? "bg-ink text-paper"
                        : "text-ink-muted hover:text-ink"
                    }`}
                    style={{ fontSize: "11px", fontWeight: 500 }}
                  >
                    🌿 Ouvert
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("strict")}
                    className={`px-2.5 py-0.5 rounded-full transition-colors ${
                      mode === "strict"
                        ? "bg-ink text-paper"
                        : "text-ink-muted hover:text-ink"
                    }`}
                    style={{ fontSize: "11px", fontWeight: 500 }}
                  >
                    🎯 Strict
                  </button>
                </div>
                <div className="flex-1" />
                <button
                  data-testid={TEST_IDS.marguerite.sendBtn}
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-ink text-paper hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  style={{ fontSize: "13px", fontWeight: 500 }}
                >
                  <Send className="w-3.5 h-3.5" strokeWidth={1.8} />
                  Envoyer
                  <kbd
                    className="ml-1 font-mono opacity-70"
                    style={{ fontSize: "11px" }}
                  >
                    ↵
                  </kbd>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Drawer historique (⌘K ou bouton rail) ─────────────────────────── */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowHistory(false)}
          />
          <div
            className="relative w-96 bg-paper border-r border-line overflow-hidden flex flex-col"
            style={{ boxShadow: "var(--v2-shadow-lg)" }}
          >
            <div className="p-4 flex items-center justify-between border-b border-line">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
                <span className="text-ink" style={{ fontSize: "14.5px", fontWeight: 500 }}>
                  Historique
                </span>
                <span
                  className="font-mono text-ink-mute-2"
                  style={{ fontSize: "11px", letterSpacing: "0.04em" }}
                >
                  ⌘K
                </span>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="p-1 hover:bg-bg rounded"
              >
                <X className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
              </button>
            </div>

            <div className="p-3 border-b border-line">
              <button
                onClick={startNewConversation}
                className="w-full inline-flex items-center gap-2 py-2 px-3 rounded-lg bg-ink text-paper hover:bg-black"
                style={{ fontSize: "13.5px", fontWeight: 500 }}
              >
                <SquarePen className="w-4 h-4" strokeWidth={1.5} />
                Nouvelle conversation
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {conversationHistory.length === 0 ? (
                <div className="text-center text-ink-mute-2 py-12">
                  <History className="w-10 h-10 mx-auto mb-2 opacity-40" strokeWidth={1.5} />
                  <p style={{ fontSize: "13px" }}>Aucune conversation</p>
                </div>
              ) : (
                conversationHistory.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => loadConversation(conv)}
                    className={`p-3 rounded-lg cursor-pointer transition-colors group ${
                      currentConversationId === conv.id
                        ? "bg-accent-soft"
                        : "hover:bg-bg"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-ink truncate"
                          style={{ fontSize: "13.5px", fontWeight: 500 }}
                        >
                          {conv.title}
                        </p>
                        <p
                          className="text-ink-mute-2 mt-0.5 font-mono"
                          style={{ fontSize: "11px" }}
                        >
                          {new Date(conv.timestamp).toLocaleDateString("fr-FR", {
                            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                          })}
                          {conv.products.length > 0 && (
                            <span className="ml-2">· {conv.products.length} produit{conv.products.length > 1 ? "s" : ""}</span>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={(e) => deleteConversation(conv.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-err-bg rounded transition-opacity"
                        aria-label="Supprimer"
                      >
                        <X className="w-3.5 h-3.5 text-err-fg" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function RailIcon({
  icon: Icon,
  label,
  onClick,
  active,
  badge,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  onClick?: () => void;
  active?: boolean;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`relative w-9 h-9 rounded-lg grid place-items-center transition-colors ${
        active
          ? "bg-ink text-paper"
          : "text-ink-muted hover:bg-line hover:text-ink"
      }`}
    >
      <Icon className="w-4 h-4" strokeWidth={1.5} />
      {badge != null && badge > 0 && (
        <span
          className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-brand text-brand-ink font-mono grid place-items-center"
          style={{ fontSize: "10px", fontWeight: 500 }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function ChipTool({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F5F5F5] text-ink-muted hover:bg-line transition-colors"
      style={{ fontSize: "12.5px", fontWeight: 400 }}
    >
      <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
      {label}
    </button>
  );
}

// ─── Rendu markdown tres light (bold, listes, titres) ─────────────────────
// Pas de dep externe. Gere **bold**, `- item`, `## Titre`, lignes vides.
// Appeles sur des texts courts (teachingNotes), pas un risque de perf.
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length === 0) return;
    out.push(
      <ul
        key={`ul-${out.length}`}
        className="list-disc list-outside pl-5 my-2 space-y-1"
      >
        {listBuffer.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>
    );
    listBuffer = [];
  };

  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    const bulletMatch = line.match(/^\s*[-*]\s+(.+)/);
    const h2Match = line.match(/^##\s+(.+)/);
    const h3Match = line.match(/^###\s+(.+)/);

    if (bulletMatch) {
      listBuffer.push(bulletMatch[1]);
      return;
    }
    flushList();

    if (h2Match) {
      out.push(
        <h3
          key={`h2-${i}`}
          className="text-ink mt-3 mb-1"
          style={{ fontSize: "15.5px", fontWeight: 500 }}
        >
          {renderInline(h2Match[1])}
        </h3>
      );
      return;
    }
    if (h3Match) {
      out.push(
        <h4
          key={`h3-${i}`}
          className="text-ink mt-2 mb-1"
          style={{ fontSize: "14.5px", fontWeight: 500 }}
        >
          {renderInline(h3Match[1])}
        </h4>
      );
      return;
    }
    if (line.trim() === "") {
      out.push(<div key={`sp-${i}`} className="h-2" />);
      return;
    }
    out.push(
      <p key={`p-${i}`} className="my-1">
        {renderInline(line)}
      </p>
    );
  });
  flushList();
  return out;
}

// Gere **bold** dans une ligne inline.
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match;
  let idx = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <strong key={`b-${idx++}`} className="text-ink" style={{ fontWeight: 500 }}>
        {match[1]}
      </strong>
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}
