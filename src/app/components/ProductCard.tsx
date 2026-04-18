import { useState } from "react";
import { ChevronUp, Loader2, RefreshCw, Printer, CheckCircle, AlertTriangle } from "lucide-react";
import { QuoteModal } from "./QuoteModal";
import { projectId, publicAnonKey } from "/utils/supabase/info";

interface ClariprintQuoteResult {
  success: boolean;
  credentialsMissing?: boolean;
  message?: string;
  error?: string;
  priceHT?: number;
  costs?: {
    paper?: number;
    print?: number;
    makeready?: number;
    packaging?: number;
    delivery?: number;
    total?: number;
  };
  delais?: number;
  weight?: number;
  fournisseur?: string;
  processDuration?: number;
  details?: string;
}

interface ProductCardProps {
  product: {
    id?: string;
    name: string;
    quantity?: number;
    dimensions?: { width: number; height: number };
    format?: string;
    material?: string;
    weight?: number;
    printing?: { recto: string; verso: string };
    finish?: string;
    finishRecto?: string;
    finishVerso?: string;
    packaging?: string;
    deliveryInfo?: string;
    deliveryLocation?: string;
    addressProvided?: string;
    price?: number;
    suggestions?: string[];
    description?: string;
    pages?: number;
    incomplete?: boolean;
    claudeResponse?: string;
    // ✅ Données Clariprint brutes (champs API)
    clariprintData?: any;
  };
  onProductUpdate?: (updatedProduct: any) => void;
  compact?: boolean;
}

type TabType = "sheet" | "pricing" | "mockup" | "form" | "debug" | null;

export function ProductCard({ product, onProductUpdate, compact }: ProductCardProps) {
  const [localProduct, setLocalProduct] = useState(product);
  const [activeTab, setActiveTab] = useState<TabType>(null);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);

  // ─── États Clariprint ───────────────────────────────────────────────────
  const [clariprintLoading, setClariprintLoading] = useState(false);
  const [clariprintQuote, setClariprintQuote] = useState<ClariprintQuoteResult | null>(null);
  const [lastRequestSent, setLastRequestSent] = useState<any>(null);
  const [lastRawResponse, setLastRawResponse] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  // ─── Appel API Clariprint ───────────────────────────────────────────────
  const fetchClariprintQuote = async () => {
    if (!localProduct.clariprintData) return;
    setClariprintLoading(true);
    setClariprintQuote(null);
    setLastRawResponse(null);

    // Capturer la requête exacte envoyée
    const requestPayload = { clariprint: localProduct.clariprintData };
    setLastRequestSent(requestPayload);
    console.log("📤 Requête envoyée à Clariprint:", JSON.stringify(requestPayload, null, 2));

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e3db71a4/clariprint-quote`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify(requestPayload),
        }
      );

      const data = await response.json();
      console.log("🖨️ Résultat Clariprint:", data);
      // Stocker la réponse brute pour le debug
      setLastRawResponse(JSON.stringify(data, null, 2));
      setClariprintQuote(data);
    } catch (error) {
      console.error("❌ Erreur appel Clariprint:", error);
      setClariprintQuote({
        success: false,
        error: "Erreur réseau lors de la connexion à Clariprint",
      });
    } finally {
      setClariprintLoading(false);
    }
  };

  const updateProduct = (updates: any) => {
    const updated = { ...localProduct, ...updates };
    setLocalProduct(updated);
    if (onProductUpdate) onProductUpdate(updated);
  };

  const toggleTab = (tab: TabType) => {
    setActiveTab(activeTab === tab ? null : tab);
  };

  // ─── Composant valeur cliquable ─────────────────────────────────────────
  const BoldValue = ({
    value,
    onClick,
  }: {
    value: string | number;
    onClick?: () => void;
  }) => (
    <strong
      className={onClick ? "cursor-pointer hover:text-blue-600 transition-colors" : ""}
      onClick={onClick}
    >
      {value}
    </strong>
  );

  // ─── Prix estimé (fallback si pas Clariprint) ────────────────────────────
  const estimatePrice = (): number => {
    const qty = localProduct.quantity || 500;
    const name = (localProduct.name || "").toLowerCase();
    let base = 0.15;
    if (name.includes("carte") && name.includes("visite")) base = 0.08;
    else if (name.includes("flyer") || name.includes("tract")) base = 0.12;
    else if (name.includes("brochure") || name.includes("catalogue")) base = 1.5;
    else if (name.includes("affiche") || name.includes("poster")) base = 5.0;
    else if (name.includes("dépliant")) base = 0.25;

    let price = base * qty;
    if ((localProduct.weight || 0) > 300) price *= 1.3;
    else if ((localProduct.weight || 0) > 200) price *= 1.15;
    if (localProduct.printing?.verso && localProduct.printing.verso !== "Sans impression") price *= 1.4;
    if (localProduct.finishRecto?.toLowerCase().includes("pelliculage")) price += qty * 0.05;
    if (qty >= 5000) price *= 0.7;
    else if (qty >= 2000) price *= 0.8;
    else if (qty >= 1000) price *= 0.9;
    return Math.round(price * 100) / 100;
  };

  const estimatedPrice = localProduct.price || estimatePrice();

  // Prix final à afficher (Clariprint si dispo, sinon estimé)
  const displayPriceHT =
    clariprintQuote?.success && clariprintQuote.priceHT != null
      ? clariprintQuote.priceHT
      : estimatedPrice;

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="w-full h-full flex flex-col">
      {/* CAS : Produit incomplet */}
      {localProduct.incomplete ? (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl shadow-sm p-6 h-full flex flex-col">
          <div className="flex items-start gap-3 mb-4">
            <div className="text-2xl">⚠️</div>
            <div>
              <h3 className="text-lg font-bold text-amber-900 mb-1">Précisions nécessaires</h3>
              <p className="text-sm text-amber-700">
                J'ai besoin de plus d'informations pour configurer votre produit.
              </p>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 mb-4">
            <h4 className="font-semibold text-gray-900 mb-3">📋 Informations disponibles</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-600">Produit :</span>
                <span className="font-semibold text-gray-900 ml-2">{localProduct.name}</span>
              </div>
              <div>
                <span className="text-gray-600">Quantité :</span>
                <span className="font-semibold text-gray-900 ml-2">{localProduct.quantity}</span>
              </div>
            </div>
          </div>
          {localProduct.suggestions && localProduct.suggestions.length > 0 && (
            <div className="bg-white rounded-xl p-4 flex-1">
              <h4 className="font-semibold text-gray-900 mb-3">❓ Questions à préciser</h4>
              <ul className="space-y-2">
                {localProduct.suggestions.map((q, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-amber-600 font-bold">{i + 1}.</span>
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="h-full flex flex-col">
          {/* ── Bloc principal ── */}
          <div
            className={`bg-white border-2 border-gray-300 rounded-2xl shadow-sm mb-3 flex-1 ${
              compact ? "p-4" : "p-6"
            }`}
          >
            <div className={`leading-relaxed text-gray-900 ${compact ? "text-xs" : "text-sm"}`}>
              <p className="mb-2">Vous avez demandé :</p>

              <p>
                <BoldValue
                  value={localProduct.quantity || 0}
                  onClick={() => {
                    const v = prompt("Nouvelle quantité :", String(localProduct.quantity || 0));
                    if (v) updateProduct({ quantity: parseInt(v) });
                  }}
                />{" "}
                {localProduct.name},<br />
                Format :{" "}
                <BoldValue
                  value={
                    localProduct.format ||
                    `${localProduct.dimensions?.width || 0} mm×${localProduct.dimensions?.height || 0} mm`
                  }
                  onClick={() => {
                    const w = prompt("Largeur (mm) :", String(localProduct.dimensions?.width || 0));
                    const h = prompt("Hauteur (mm) :", String(localProduct.dimensions?.height || 0));
                    if (w && h)
                      updateProduct({ dimensions: { width: parseInt(w), height: parseInt(h) } });
                  }}
                />
                <br />
                impression{" "}
                <BoldValue
                  value={localProduct.printing?.recto || "Quadrichromie (CMJN)"}
                  onClick={() => {
                    const v = prompt("Impression recto :", localProduct.printing?.recto);
                    if (v) updateProduct({ printing: { ...localProduct.printing, recto: v } });
                  }}
                />{" "}
                /{" "}
                <BoldValue
                  value={localProduct.printing?.verso || "Sans impression"}
                  onClick={() => {
                    const v = prompt("Impression verso :", localProduct.printing?.verso);
                    if (v) updateProduct({ printing: { ...localProduct.printing, verso: v } });
                  }}
                />{" "}
                sur papier{" "}
                <BoldValue
                  value={`${localProduct.material || ""} ${localProduct.weight || 0} g`}
                  onClick={() => {
                    const m = prompt("Type de papier :", localProduct.material || "");
                    const w = prompt("Grammage (g) :", String(localProduct.weight || 0));
                    if (m || w)
                      updateProduct({
                        material: m || localProduct.material,
                        weight: w ? parseInt(w) : localProduct.weight,
                      });
                  }}
                />
                ,<br />
                finition{" "}
                <BoldValue
                  value={localProduct.finishRecto || localProduct.finish || "Sans finition"}
                  onClick={() => {
                    const v = prompt("Finition recto :", localProduct.finishRecto || localProduct.finish || "");
                    if (v) updateProduct({ finishRecto: v, finish: v });
                  }}
                />{" "}
                /{" "}
                <BoldValue
                  value={localProduct.finishVerso || "Sans finition"}
                  onClick={() => {
                    const v = prompt("Finition verso :", localProduct.finishVerso || "");
                    if (v) updateProduct({ finishVerso: v });
                  }}
                />
                .
              </p>

              {!compact && localProduct.suggestions && localProduct.suggestions.length > 0 && (
                <>
                  <p className="mt-3 mb-1">Pour plus d'impact je vous propose :</p>
                  {localProduct.suggestions.map((s, i) => (
                    <p key={i} className="text-gray-700">
                      {s}
                    </p>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* ── 4 boutons ── */}
          <div className={`grid grid-cols-5 mb-3 ${compact ? "gap-1" : "gap-2"}`}>
            {(["sheet", "pricing", "mockup", "form", "debug"] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => toggleTab(tab)}
                className={`font-medium rounded-xl border-2 transition-colors ${
                  compact ? "px-1 py-1.5 text-xs" : "px-2 py-2.5 text-xs"
                } ${
                  activeTab === tab
                    ? tab === "debug"
                      ? "bg-slate-800 text-white border-slate-800"
                      : "bg-gray-900 text-white border-gray-900"
                    : tab === "debug"
                    ? "bg-slate-50 text-slate-500 border-slate-300 hover:bg-slate-100 hover:text-slate-700"
                    : "bg-white text-gray-900 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {tab === "sheet" && (compact ? "Fiche" : "Fiche")}
                {tab === "pricing" && (compact ? "Prix" : "Prix & Devis")}
                {tab === "mockup" && (compact ? "3D" : "Mockup 3D")}
                {tab === "form" && (compact ? "Éditer" : "Éditer")}
                {tab === "debug" && "🔍 Debug"}
              </button>
            ))}
          </div>

          {/* ── Fiche produit ── */}
          {activeTab === "sheet" && (
            <div className="bg-white border-2 border-gray-300 rounded-2xl p-6 mb-3 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900">Fiche produit détaillée</h3>
                <button onClick={() => setActiveTab(null)} className="text-gray-500 hover:text-gray-900">
                  <ChevronUp className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-2 text-sm">
                {[
                  ["Produit", localProduct.name],
                  ["Quantité", localProduct.quantity || 0],
                  [
                    "Format",
                    localProduct.format ||
                      `${localProduct.dimensions?.width || 0} × ${localProduct.dimensions?.height || 0} mm`,
                  ],
                  ["Papier", localProduct.material || "—"],
                  ["Grammage", `${localProduct.weight || 0} g/m²`],
                  [
                    "Impression",
                    `${localProduct.printing?.recto || "Quadrichromie"} / ${localProduct.printing?.verso || "Sans impression"}`,
                  ],
                  ["Finition recto", localProduct.finishRecto || localProduct.finish || "Sans finition"],
                  ["Finition verso", localProduct.finishVerso || "Sans finition"],
                  ...(localProduct.pages ? [["Pages", localProduct.pages]] : []),
                  ...(localProduct.clariprintData?.kind
                    ? [["Type Clariprint", localProduct.clariprintData.kind]]
                    : []),
                ].map(([label, value], i, arr) => (
                  <div
                    key={String(label)}
                    className={`flex justify-between py-2 ${i < arr.length - 1 ? "border-b border-gray-100" : ""}`}
                  >
                    <span className="text-gray-600">{label}</span>
                    <span className="font-semibold">{String(value)}</span>
                  </div>
                ))}
              </div>

              {/* Config Clariprint brute */}
              {localProduct.clariprintData && (
                <details className="mt-4">
                  <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-900">
                    🔧 Voir la config Clariprint (JSON API)
                  </summary>
                  <pre className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 overflow-auto max-h-48">
                    {JSON.stringify(localProduct.clariprintData, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}

          {/* ── Prix & Devis ── */}
          {activeTab === "pricing" && (
            <div className="bg-white border-2 border-gray-300 rounded-2xl p-6 mb-3 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900">Tarification</h3>
                <button onClick={() => setActiveTab(null)} className="text-gray-500 hover:text-gray-900">
                  <ChevronUp className="w-5 h-5" />
                </button>
              </div>

              {/* ─ Prix estimé (toujours visible) ─ */}
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500 text-xs">
                    {clariprintQuote?.success ? "Prix Clariprint HT" : "Prix estimé HT"}
                  </span>
                  <span className="font-semibold">{displayPriceHT.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">TVA (20%)</span>
                  <span className="font-semibold">{(displayPriceHT * 0.2).toFixed(2)} €</span>
                </div>
                <div
                  className="flex justify-between items-center py-3 bg-gray-900 text-white px-4 rounded-lg mt-1 cursor-pointer hover:bg-gray-800 transition-colors"
                  onClick={() => setIsQuoteModalOpen(true)}
                  title="Cliquer pour le devis"
                >
                  <span className="font-semibold text-sm">Total TTC</span>
                  <span className="text-xl font-bold">{(displayPriceHT * 1.2).toFixed(2)} €</span>
                </div>
              </div>

              {/* ─ Section Clariprint ─ */}
              {localProduct.clariprintData && (
                <div className="border-t border-gray-100 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Printer className="w-4 h-4 text-indigo-600" />
                      <h4 className="text-sm font-semibold text-gray-800">Prix réel Clariprint</h4>
                    </div>
                    {/* Bouton debug */}
                    <button
                      onClick={() => setShowDebug((v) => !v)}
                      className={`text-xs px-2 py-1 rounded border transition-colors ${
                        showDebug
                          ? "bg-gray-800 text-white border-gray-800"
                          : "text-gray-400 border-gray-200 hover:border-gray-400 hover:text-gray-600"
                      }`}
                      title="Afficher / masquer la requête envoyée à Clariprint"
                    >
                      {showDebug ? "Masquer debug" : "🔍 Debug"}
                    </button>
                  </div>

                  {/* ─ Panneau debug : requête + réponse brute ─ */}
                  {showDebug && (
                    <div className="mb-4 space-y-3">
                      {/* Requête envoyée */}
                      <div className="bg-slate-900 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-mono font-bold text-slate-300">
                            📤 POST /optimproject/json.wcl
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(
                                JSON.stringify(
                                  { clariprint_product: localProduct.clariprintData },
                                  null,
                                  2
                                )
                              );
                            }}
                            className="text-xs text-slate-400 hover:text-white transition-colors"
                          >
                            Copier
                          </button>
                        </div>
                        <pre className="text-xs text-green-300 overflow-auto max-h-64 leading-relaxed">
                          {JSON.stringify({ clariprint_product: localProduct.clariprintData }, null, 2)}
                        </pre>
                      </div>

                      {/* Réponse brute reçue */}
                      {lastRawResponse && (
                        <div className="bg-slate-800 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-mono font-bold text-slate-300">
                              📩 Réponse Clariprint (brute)
                            </span>
                            <button
                              onClick={() => navigator.clipboard.writeText(lastRawResponse)}
                              className="text-xs text-slate-400 hover:text-white transition-colors"
                            >
                              Copier
                            </button>
                          </div>
                          <pre className="text-xs text-yellow-200 overflow-auto max-h-64 leading-relaxed">
                            {lastRawResponse}
                          </pre>
                        </div>
                      )}

                      {!lastRawResponse && !clariprintLoading && (
                        <p className="text-xs text-slate-400 italic">
                          La réponse brute s'affichera ici après l'appel.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Loading */}
                  {clariprintLoading && (
                    <div className="flex items-center gap-2 text-indigo-600 text-sm py-3">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Calcul en cours auprès des imprimeurs...</span>
                    </div>
                  )}

                  {/* Credentials manquants */}
                  {!clariprintLoading && clariprintQuote?.credentialsMissing && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium text-amber-800 mb-1">Credentials non configurés</p>
                          <p className="text-amber-700 text-xs">
                            Ajoutez <code className="bg-amber-100 px-1 rounded">CLARIPRINT_LOGIN</code> et{" "}
                            <code className="bg-amber-100 px-1 rounded">CLARIPRINT_PASSWORD</code> dans vos secrets Supabase.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={fetchClariprintQuote}
                        className="mt-3 text-xs text-amber-700 underline hover:no-underline"
                      >
                        Réessayer
                      </button>
                    </div>
                  )}

                  {/* Succès Clariprint */}
                  {!clariprintLoading && clariprintQuote?.success && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2 text-sm">
                      <div className="flex items-center gap-1 mb-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-xs font-medium text-green-700">
                          Prix obtenu depuis le réseau Clariprint
                        </span>
                      </div>

                      {/* Détail des coûts */}
                      {clariprintQuote.costs && (
                        <div className="space-y-1 text-xs">
                          {[
                            ["Papier", clariprintQuote.costs.paper],
                            ["Impression", clariprintQuote.costs.print],
                            ["Calage / Make-ready", clariprintQuote.costs.makeready],
                            ["Conditionnement", clariprintQuote.costs.packaging],
                            ["Livraison", clariprintQuote.costs.delivery],
                          ]
                            .filter(([, v]) => v != null && (v as number) > 0)
                            .map(([label, val]) => (
                              <div key={String(label)} className="flex justify-between text-gray-600">
                                <span>{label}</span>
                                <span>{(val as number).toFixed(2)} €</span>
                              </div>
                            ))}
                          <div className="flex justify-between font-semibold text-green-800 border-t border-green-200 pt-1 mt-1">
                            <span>Total HT</span>
                            <span>{(clariprintQuote.costs.total || clariprintQuote.priceHT || 0).toFixed(2)} €</span>
                          </div>
                        </div>
                      )}

                      {/* Total TTC */}
                      <div className="flex justify-between bg-green-700 text-white px-3 py-2 rounded-lg font-bold text-sm">
                        <span>Total TTC</span>
                        <span>
                          {(
                            (clariprintQuote.costs?.total || clariprintQuote.priceHT || 0) * 1.2
                          ).toFixed(2)}{" "}
                          €
                        </span>
                      </div>

                      {/* Infos complémentaires */}
                      <div className="grid grid-cols-2 gap-2 pt-1 text-xs text-green-700">
                        {clariprintQuote.delais != null && (
                          <div className="bg-white rounded-lg p-2 border border-green-100">
                            <div className="text-gray-500 mb-0.5">Délai estimé</div>
                            <div className="font-semibold">
                              {clariprintQuote.delais} jour{clariprintQuote.delais > 1 ? "s" : ""}
                            </div>
                          </div>
                        )}
                        {clariprintQuote.weight != null && (
                          <div className="bg-white rounded-lg p-2 border border-green-100">
                            <div className="text-gray-500 mb-0.5">Poids</div>
                            <div className="font-semibold">{clariprintQuote.weight.toFixed(2)} kg</div>
                          </div>
                        )}
                        {clariprintQuote.fournisseur && (
                          <div className="bg-white rounded-lg p-2 border border-green-100 col-span-2">
                            <div className="text-gray-500 mb-0.5">Imprimeur sélectionné</div>
                            <div className="font-semibold">{clariprintQuote.fournisseur}</div>
                          </div>
                        )}
                      </div>

                      {/* Recalculer */}
                      <button
                        onClick={fetchClariprintQuote}
                        className="w-full mt-1 flex items-center justify-center gap-1.5 text-xs text-green-700 hover:text-green-900 transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Recalculer
                      </button>
                    </div>
                  )}

                  {/* Erreur Clariprint */}
                  {!clariprintLoading &&
                    clariprintQuote &&
                    !clariprintQuote.success &&
                    !clariprintQuote.credentialsMissing && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm">
                        <p className="text-red-700 font-medium mb-1">❌ Erreur Clariprint</p>
                        <p className="text-red-600 text-xs mb-1">
                          {clariprintQuote.message || clariprintQuote.error || "Erreur inconnue"}
                        </p>
                        {clariprintQuote.details && (
                          <details className="mt-1">
                            <summary className="text-xs text-red-500 cursor-pointer hover:text-red-700">
                              Voir les détails techniques
                            </summary>
                            <pre className="mt-1 p-2 bg-red-100 rounded text-xs text-red-700 overflow-auto max-h-32 whitespace-pre-wrap">
                              {clariprintQuote.details}
                            </pre>
                          </details>
                        )}
                        <button
                          onClick={fetchClariprintQuote}
                          className="mt-2 text-xs text-red-600 underline hover:no-underline"
                        >
                          Réessayer
                        </button>
                      </div>
                    )}

                  {/* Bouton initial */}
                  {!clariprintLoading && !clariprintQuote && (
                    <button
                      onClick={fetchClariprintQuote}
                      className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      <Printer className="w-4 h-4" />
                      Obtenir le prix réel Clariprint
                    </button>
                  )}
                </div>
              )}

              {/* ─ Bouton devis/panier ─ */}
              <button
                onClick={() => setIsQuoteModalOpen(true)}
                className="w-full mt-4 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
              >
                Imprimer le devis / Ajouter au panier
              </button>
            </div>
          )}

          {/* ── Mockup & 3D ── */}
          {activeTab === "mockup" && (
            <div className="bg-white border-2 border-gray-300 rounded-2xl p-6 mb-3 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900">Aperçu 3D & Mockup</h3>
                <button onClick={() => setActiveTab(null)} className="text-gray-500 hover:text-gray-900">
                  <ChevronUp className="w-5 h-5" />
                </button>
              </div>
              <div className="text-sm text-gray-600">
                <p className="mb-3">Visualisez votre produit en 3D avant impression.</p>
                <div className="bg-gray-100 rounded-lg p-12 text-center">
                  <div className="text-gray-400 text-6xl mb-3">🎨</div>
                  <p className="text-gray-500">Aperçu 3D disponible après upload de votre design</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Formulaire d'édition ── */}
          {activeTab === "form" && (
            <div className="bg-white border-2 border-gray-300 rounded-2xl p-6 mb-3 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900">Éditer la configuration</h3>
                <button onClick={() => setActiveTab(null)} className="text-gray-500 hover:text-gray-900">
                  <ChevronUp className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantité</label>
                  <input
                    type="number"
                    value={localProduct.quantity || 0}
                    onChange={(e) => updateProduct({ quantity: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type de papier</label>
                  <input
                    type="text"
                    value={localProduct.material || ""}
                    onChange={(e) => updateProduct({ material: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Grammage (g/m²)</label>
                  <input
                    type="number"
                    value={localProduct.weight || 0}
                    onChange={(e) => updateProduct({ weight: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={() => {
                    setClariprintQuote(null); // Reset le prix Clariprint si on modifie
                    setActiveTab(null);
                  }}
                  className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
                >
                  Sauvegarder et fermer
                </button>
              </div>
            </div>
          )}

          {/* ── Onglet Debug Clariprint ── */}
          {activeTab === "debug" && (
            <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl p-4 mb-3 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-slate-300 font-mono font-bold text-sm">🔍 Debug Clariprint</span>
                </div>
                <button onClick={() => setActiveTab(null)} className="text-slate-400 hover:text-white">
                  <ChevronUp className="w-5 h-5" />
                </button>
              </div>

              {/* Requête envoyée */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold text-slate-300">
                    📤 Requête envoyée à Clariprint (POST /optimproject/json.wcl)
                  </span>
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(
                        JSON.stringify({ clariprint_product: localProduct.clariprintData }, null, 2)
                      )
                    }
                    className="text-xs text-slate-400 hover:text-white border border-slate-600 px-2 py-0.5 rounded transition-colors"
                  >
                    Copier
                  </button>
                </div>
                {localProduct.clariprintData ? (
                  <pre className="text-xs text-green-300 overflow-auto max-h-72 leading-relaxed bg-slate-950 rounded-lg p-3">
                    {JSON.stringify({ clariprint_product: localProduct.clariprintData }, null, 2)}
                  </pre>
                ) : (
                  <p className="text-xs text-slate-500 italic p-3 bg-slate-950 rounded-lg">
                    Aucune donnée Clariprint disponible sur ce produit.
                  </p>
                )}
              </div>

              {/* Réponse brute reçue */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold text-slate-300">
                    📩 Réponse brute Clariprint
                  </span>
                  {lastRawResponse && (
                    <button
                      onClick={() => navigator.clipboard.writeText(lastRawResponse)}
                      className="text-xs text-slate-400 hover:text-white border border-slate-600 px-2 py-0.5 rounded transition-colors"
                    >
                      Copier
                    </button>
                  )}
                </div>
                {lastRawResponse ? (
                  <pre className="text-xs text-yellow-200 overflow-auto max-h-72 leading-relaxed bg-slate-950 rounded-lg p-3">
                    {lastRawResponse}
                  </pre>
                ) : (
                  <p className="text-xs text-slate-500 italic p-3 bg-slate-950 rounded-lg">
                    {clariprintLoading
                      ? "⏳ Appel en cours..."
                      : "Aucune réponse encore — cliquez \"Obtenir le prix réel Clariprint\" dans l'onglet Prix & Devis."}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Modal devis */}
          <QuoteModal
            isOpen={isQuoteModalOpen}
            onClose={() => setIsQuoteModalOpen(false)}
            product={{
              ...localProduct,
              price: displayPriceHT,
              clariprintQuote: clariprintQuote?.success ? clariprintQuote : undefined,
            }}
          />
        </div>
      )}
    </div>
  );
}