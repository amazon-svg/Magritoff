import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";

const app = new Hono();

app.use('*', logger(console.log));
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Génère un résumé Markdown lisible depuis les configs Clariprint parsées.
 * Ce texte est affiché dans le fil de conversation.
 */
function generateReadableSummary(configs: any[]): string {
  if (!configs || configs.length === 0) return "Configuration non disponible.";

  let text = "";
  configs.forEach((config: any, index: number) => {
    const d = config.display;
    if (!d) return;
    if (index > 0) text += "\n\n";

    text += `**${d.quantity} ${d.productName}**\n`;
    text += `- **Format** : ${d.format}\n`;
    text += `- **Support** : ${d.support}\n`;
    text += `- **Grammage** : ${d.grammage}g/m²\n`;

    const finitionVersoStr =
      d.finitionVerso &&
      d.finitionVerso !== "Sans finition" &&
      d.finitionVerso !== d.finitionRecto
        ? ` recto / ${d.finitionVerso} verso`
        : " recto/verso";
    text += `- **Finition** : ${d.finitionRecto}${d.finitionRecto !== "Sans finition" ? finitionVersoStr : ""}\n`;

    if (d.suggestions && d.suggestions.length > 0) {
      text += `- **Conseils** :\n`;
      d.suggestions.forEach((s: string) => {
        text += `  ${s}\n`;
      });
    }
  });

  return text;
}

/**
 * Configs de démonstration quand Claude n'est pas disponible.
 * Retourne le même format JSON que Claude.
 */
function generateDemoConfigs(userMessage: string): any[] {
  const msg = userMessage.toLowerCase();
  const qtyMatch = msg.match(/(\d+)/);
  const qty = qtyMatch ? parseInt(qtyMatch[1]) : 500;

  if (msg.includes("carte") && msg.includes("visite")) {
    return [
      {
        clariprint: {
          reference: "Cartes de visite",
          kind: "leaflet",
          quantity: qty,
          width: "8.5",
          height: "5.5",
          with_bleeds: "1",
          front_colors: ["4-color"],
          back_colors: msg.includes("recto verso") || msg.includes("verso") ? ["4-color"] : [],
          papers: { custom: { quality: "Couché Brillant PEFC", weight: "350" } },
          finishing_front: "PELLIC_ACETATE_MAT",
          finishing_back: msg.includes("recto verso") || msg.includes("verso") ? "PELLIC_ACETATE_MAT" : "",
          deliveries: {
            d_livraison: {
              iso: "FR-75",
              address: "",
              quantity: String(qty),
            },
          },
        },
        display: {
          productName: "Cartes de visite",
          quantity: qty,
          format: "85 × 55 mm (format standard)",
          support: "Papier couché brillant",
          grammage: 350,
          impression: {
            recto: "Quadrichromie (CMJN)",
            verso: msg.includes("recto verso") || msg.includes("verso") ? "Quadrichromie (CMJN)" : "Sans impression",
          },
          finitionRecto: "Pelliculage mat",
          finitionVerso: msg.includes("recto verso") || msg.includes("verso") ? "Pelliculage mat" : "Sans finition",
          suggestions: [
            "• Coins ronds pour un look moderne (+8€)",
            "• Vernis sélectif sur le logo (+15€)",
            "• Dorure à chaud pour un effet premium (+35€)",
          ],
        },
      },
    ];
  }

  if (msg.includes("flyer") || msg.includes("tract")) {
    const isA4 = msg.includes("a4");
    const isVerso = msg.includes("verso") || msg.includes("recto verso");
    return [
      {
        clariprint: {
          reference: `Flyers ${isA4 ? "A4" : "A5"}`,
          kind: "leaflet",
          quantity: qty,
          width: isA4 ? "21.0" : "14.8",
          height: isA4 ? "29.7" : "21.0",
          with_bleeds: "1",
          front_colors: ["4-color"],
          back_colors: isVerso ? ["4-color"] : [],
          papers: { custom: { quality: "Couché Brillant PEFC", weight: "170" } },
          finishing_front: "",
          finishing_back: "",
          deliveries: {
            d_livraison: {
              iso: "FR-75",
              address: "",
              quantity: String(qty),
            },
          },
        },
        display: {
          productName: `Flyers ${isA4 ? "A4" : "A5"}${isVerso ? " recto-verso" : ""}`,
          quantity: qty,
          format: isA4 ? "A4 (210 × 297 mm)" : "A5 (148 × 210 mm)",
          support: "Papier couché brillant",
          grammage: 170,
          impression: {
            recto: "Quadrichromie (CMJN)",
            verso: isVerso ? "Quadrichromie (CMJN)" : "Sans impression",
          },
          finitionRecto: "Sans finition",
          finitionVerso: "Sans finition",
          suggestions: [
            "• Pelliculage mat pour plus de résistance (+20€)",
            "• Passez à 250g/m² pour plus de rigidité (+15%)",
            isA4 ? "• Format A3 pour plus d'impact visuel" : "• Format A4 pour plus d'informations",
          ],
        },
      },
    ];
  }

  if (msg.includes("brochure") || msg.includes("catalogue") || msg.includes("livret")) {
    const pagesMatch = msg.match(/(\d+)\s*pages?/);
    const pages = pagesMatch ? parseInt(pagesMatch[1]) : 24;
    return [
      {
        clariprint: {
          reference: "Brochure A4",
          kind: "book",
          quantity: qty,
          width: "21.0",
          height: "29.7",
          with_bleeds: "1",
          front_colors: ["4-color"],
          back_colors: ["4-color"],
          papers: { custom: { quality: "Offset Blanc", weight: "135" } },
          finishing_front: "",
          finishing_back: "",
          binding: pages <= 64 ? "Stitching2" : "PerfectBinding",
          pages: pages,
          deliveries: {
            d_livraison: {
              iso: "FR-75",
              address: "",
              quantity: String(qty),
            },
          },
        },
        display: {
          productName: `Brochure A4 ${pages} pages`,
          quantity: qty,
          format: `A4 (210 × 297 mm) — ${pages} pages`,
          support: "Couverture couché brillant 250g | Intérieur offset 135g",
          grammage: 135,
          impression: { recto: "Quadrichromie (CMJN)", verso: "Quadrichromie (CMJN)" },
          finitionRecto: pages <= 64 ? "Piqûre à cheval (2 agrafes)" : "Dos carré collé",
          finitionVerso: "Sans finition",
          suggestions: [
            "• Pelliculage soft-touch sur la couverture (+32€)",
            "• Couverture en couché brillant 350g pour plus de rigidité (+18€)",
            "• Vernis UV sélectif sur le titre (+28€)",
          ],
        },
      },
    ];
  }

  if (msg.includes("affiche") || msg.includes("poster")) {
    const isA1 = msg.includes("a1");
    const isA0 = msg.includes("a0");
    const isA3 = msg.includes("a3");
    return [
      {
        clariprint: {
          reference: `Affiches ${isA0 ? "A0" : isA1 ? "A1" : isA3 ? "A3" : "A2"}`,
          kind: "leaflet",
          quantity: qty,
          width: isA0 ? "84.1" : isA1 ? "59.4" : isA3 ? "29.7" : "42.0",
          height: isA0 ? "118.9" : isA1 ? "84.1" : isA3 ? "42.0" : "59.4",
          with_bleeds: "1",
          front_colors: ["4-color"],
          back_colors: [],
          papers: { custom: { quality: "Couché Brillant PEFC", weight: "170" } },
          finishing_front: "",
          finishing_back: "",
          deliveries: {
            d_livraison: {
              iso: "FR-75",
              address: "",
              quantity: String(qty),
            },
          },
        },
        display: {
          productName: `Affiches ${isA0 ? "A0" : isA1 ? "A1" : isA3 ? "A3" : "A2"}`,
          quantity: qty,
          format: isA0 ? "A0 (841 × 1189 mm)" : isA1 ? "A1 (594 × 841 mm)" : isA3 ? "A3 (297 × 420 mm)" : "A2 (420 × 594 mm)",
          support: "Papier couché brillant",
          grammage: 170,
          impression: { recto: "Quadrichromie (CMJN)", verso: "Sans impression" },
          finitionRecto: "Sans finition",
          finitionVerso: "Sans finition",
          suggestions: [
            "• Papier blueback 135g pour affichage extérieur (+35€)",
            "• Pelliculage anti-UV pour durabilité extérieure (+42€)",
            isA0 ? "• Format A1 si contraintes d'espace" : "• Format A1 pour plus de visibilité",
          ],
        },
      },
    ];
  }

  if (msg.includes("dépliant") || msg.includes("depliant")) {
    return [
      {
        clariprint: {
          reference: "Dépliant 3 volets A4",
          kind: "folded",
          quantity: qty,
          width: "21.0",
          height: "29.7",
          openwidth: "62.0",
          openheight: "29.7",
          with_bleeds: "1",
          front_colors: ["4-color"],
          back_colors: ["4-color"],
          papers: { custom: { quality: "Couché Brillant PEFC", weight: "170" } },
          finishing_front: "",
          finishing_back: "",
          folds: "2",
          deliveries: {
            d_livraison: {
              iso: "FR-75",
              address: "",
              quantity: String(qty),
            },
          },
        },
        display: {
          productName: "Dépliant 3 volets A4",
          quantity: qty,
          format: "A4 plié en 3 (210 × 297 mm → 99 × 210 mm fermé)",
          support: "Papier couché brillant",
          grammage: 170,
          impression: { recto: "Quadrichromie (CMJN)", verso: "Quadrichromie (CMJN)" },
          finitionRecto: "Sans finition",
          finitionVerso: "Sans finition",
          suggestions: [
            "• Pelliculage mat recommandé pour durabilité (+18€)",
            "• Grammage 250g/m² pour effet premium (+15%)",
            "• Pliage fenêtre ou accordéon disponible (même prix)",
          ],
        },
      },
    ];
  }

  // Config par défaut
  return [
    {
      clariprint: {
        reference: "Impression A4",
        kind: "leaflet",
        quantity: qty,
        width: "21.0",
        height: "29.7",
        with_bleeds: "1",
        front_colors: ["4-color"],
        back_colors: [],
        papers: { custom: { quality: "Offset Blanc", weight: "135" } },
        finishing_front: "",
        finishing_back: "",
        deliveries: {
          d_livraison: {
            iso: "FR-75",
            address: "",
            quantity: String(qty),
          },
        },
      },
      display: {
        productName: "Impression A4",
        quantity: qty,
        format: "A4 (210 × 297 mm)",
        support: "Papier offset blanc",
        grammage: 135,
        impression: { recto: "Quadrichromie (CMJN)", verso: "Sans impression" },
        finitionRecto: "Sans finition",
        finitionVerso: "Sans finition",
        suggestions: [
          "• Précisez le type de produit pour un devis exact",
          "• Pelliculage mat ou brillant disponible",
          "• Contactez-nous pour options personnalisées",
        ],
      },
    },
  ];
}

// ============================================================================
// SYSTEM PROMPT CLAUDE — JSON Clariprint-compatible
// ============================================================================
const CLAUDE_SYSTEM_PROMPT = `Tu es un expert en imprimerie professionnelle et web-to-print avec 20 ans d'expérience (imprimerie offset, numérique, grand format).

🚨 RÈGLE ABSOLUE : Réponds UNIQUEMENT avec du JSON valide. Zéro texte avant ou après. Zéro commentaire JavaScript. Pas de \`\`\`json ni de \`\`\`.

FORMAT DE RÉPONSE OBLIGATOIRE :
{
  "products": [
    {
      "clariprint": {
        "reference": "Nom du produit (libre)",
        "kind": "leaflet",
        "quantity": "1000",
        "width": "14.8",
        "height": "21.0",
        "with_bleeds": "1",
        "front_colors": ["4-color"],
        "back_colors": ["4-color"],
        "papers": {
          "custom": {
            "quality": "Couché Brillant PEFC",
            "weight": "170"
          }
        },
        "finishing_front": "PELLIC_ACETATE_MAT",
        "finishing_back": "",
        "deliveries": {
          "d_livraison": {
            "iso": "FR-75",
            "address": "",
            "quantity": "1000"
          }
        }
      },
      "display": {
        "productName": "Flyers A5 recto-verso",
        "quantity": 1000,
        "format": "A5 (148 × 210 mm)",
        "support": "Papier couché brillant",
        "grammage": 170,
        "impression": {
          "recto": "Quadrichromie (CMJN)",
          "verso": "Quadrichromie (CMJN)"
        },
        "finitionRecto": "Pelliculage mat",
        "finitionVerso": "Sans finition",
        "suggestions": [
          "• Passez à 250g/m² pour plus de rigidité (+20%)",
          "• Vernis UV sélectif sur le logo (+25€)",
          "• Format A4 pour plus d'impact visuel"
        ]
      }
    }
  ]
}

VALEURS "kind" :
- "leaflet" → tout imprimé plat non plié : flyer, carte de visite, affiche, tract, bulletin de vote
- "folded" → dépliant, brochure pliée (2, 3, 4 volets)
- "book" → brochure multi-pages, catalogue, livret (assemblé)

FORMATS EN CM (width × height) — utiliser ces valeurs exactes :
- Carte de visite : width="8.5" height="5.5"
- A6 / Carte postale : width="10.5" height="14.8"
- DL (enveloppe) : width="9.9" height="21.0"
- A5 : width="14.8" height="21.0"
- A4 : width="21.0" height="29.7"
- A3 : width="29.7" height="42.0"
- A2 : width="42.0" height="59.4"
- A1 : width="59.4" height="84.1"
- A0 : width="84.1" height="118.9"

QUALITÉS PAPIER (valeurs exactes pour papers.custom.quality) :
- "Couché Brillant PEFC" → papier couché brillant standard (cartes, flyers premium, affiches)
- "Couché Mat PEFC" → papier couché mat (brochures, haut de gamme)
- "Offset Blanc" → papier offset classique (flyers économiques, affiches intérieur, bulletins)

GRAMMAGES TYPIQUES par produit (champ "weight" en string) :
- Carte de visite : "300" à "400"
- Flyer / Affiche : "135" à "200"
- Dépliant : "135" à "170"
- Brochure intérieur : "90" à "135"
- Brochure couverture : "250" à "300"

CODES FINITIONS (finishing_front / finishing_back) :
- "" → Sans finition (valeur vide si pas de finition)
- "PELLIC_ACETATE_BRILLANT" → Pelliculage brillant
- "PELLIC_ACETATE_MAT" → Pelliculage mat
- "OFFSET_SATIN" → Vernis satin offset
- "UVS_MAT_RESERVE" → Vernis UV mat avec réserve

RÈGLES COULEURS :
- back_colors → ["4-color"] si impression recto-verso, [] si recto seul
- Mention "recto verso", "2 faces", "verso" → back_colors: ["4-color"]

POUR LES DÉPLIANTS (kind="folded"), ajouter dans clariprint :
- "folds": "2" (nombre de plis, typiquement 2 pour 3 volets)
- "openwidth": largeur à plat en cm (ex: "62.0" pour A4 trois volets)
- "openheight": hauteur à plat en cm (ex: "29.7")

POUR LES BROCHURES (kind="book"), ajouter dans clariprint :
- "binding": "Stitching2" (piqûre à cheval ≤ 64 pages) | "PerfectBinding" (dos carré collé > 32p) | "WireO" (Wire-O, calendriers)
- "pages": nombre entier, multiple de 4

RÈGLES IMPORTANTES :
- Si plusieurs produits ou un KIT/ENSEMBLE/PACK → crée PLUSIEURS objets dans "products"
- "quantity" dans clariprint → STRING avec guillemets (ex: "1000" pas 1000)
- "grammage" dans display → nombre entier (pas de guillemets, pas "g/m²")
- "back_colors" → tableau vide [] si recto seul
- Toujours inclure "deliveries" avec iso "FR-75" et la MÊME quantity (en string) que le produit
- Toujours 3 suggestions minimum avec prix indicatifs en euros
- Suggestions commencent par "•"
- Réponds UNIQUEMENT en JSON valide. Aucun texte hors JSON.`;

// ============================================================================
// API ENDPOINTS
// ============================================================================

// Health check
app.get("/make-server-e3db71a4/health", (c) => {
  return c.json({ status: "ok" });
});

// Test de connexion Claude
app.get("/make-server-e3db71a4/claude-test", async (c) => {
  try {
    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      checks: [],
      environment: {},
    };

    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    const magritKey = Deno.env.get("Magrit3");

    diagnostics.environment = {
      ANTHROPIC_API_KEY: anthropicApiKey ? "✅ Configurée" : "❌ Non configurée",
      Magrit3: magritKey ? "✅ Configurée" : "❌ Non configurée",
      CLARIPRINT_HOST: Deno.env.get("CLARIPRINT_HOST") ? "✅ Configurée" : "❌ Non configurée",
      CLARIPRINT_LOGIN: Deno.env.get("CLARIPRINT_LOGIN") ? "✅ Configurée" : "❌ Non configurée",
      CLARIPRINT_PASSWORD: Deno.env.get("CLARIPRINT_PASSWORD") ? "✅ Configurée" : "❌ Non configurée",
    };

    const apiKey = anthropicApiKey || magritKey;
    diagnostics.checks.push({
      name: "API Key présente",
      status: apiKey ? "✅ OK" : "❌ MANQUANTE",
      details: apiKey
        ? `Clé trouvée (${apiKey.substring(0, 7)}...)`
        : "Aucune clé API Claude trouvée",
    });

    if (!apiKey) {
      diagnostics.summary = "❌ Configuration incomplète - Clé API manquante";
      return c.json(diagnostics);
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 50,
          messages: [{ role: "user", content: "Réponds simplement: OK" }],
        }),
      });

      const responseText = await response.text();
      diagnostics.checks.push({
        name: "Test API Claude",
        status: response.ok ? "✅ SUCCÈS" : "❌ ÉCHEC",
        httpStatus: response.status,
        details: response.ok
          ? "Claude a répondu avec succès"
          : `Erreur ${response.status}: ${responseText.substring(0, 300)}`,
      });

      if (response.ok) {
        const data = JSON.parse(responseText);
        diagnostics.claudeResponse = data.content?.[0]?.text || "Réponse reçue";
        diagnostics.summary = "✅ Connexion Claude fonctionnelle !";
      } else {
        diagnostics.summary = "❌ Erreur lors de l'appel à Claude";
      }
    } catch (error) {
      diagnostics.checks.push({
        name: "Test API Claude",
        status: "❌ ERREUR RÉSEAU",
        details: error instanceof Error ? error.message : String(error),
      });
      diagnostics.summary = "❌ Erreur réseau lors de la connexion à Claude";
    }

    return c.json(diagnostics);
  } catch (error) {
    return c.json({ summary: "❌ Erreur critique", error: String(error) }, 500);
  }
});

// ============================================================================
// CLAUDE PROXY — Prompt JSON Clariprint-compatible
// ============================================================================
app.post("/make-server-e3db71a4/claude-proxy", async (c) => {
  try {
    const { messages } = await c.req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return c.json({ error: "messages array is required" }, 400);
    }

    const userMessage = messages[messages.length - 1].content;
    const anthropicApiKey =
      Deno.env.get("ANTHROPIC_API_KEY") ||
      Deno.env.get("Magrit3") ||
      Deno.env.get("MAGRIT");

    // --- MODE DÉMO ---
    if (!anthropicApiKey) {
      console.log("⚠️ Mode démo activé - clé API absente");
      const demoConfigs = generateDemoConfigs(userMessage);
      const readableSummary = generateReadableSummary(demoConfigs);
      return c.json({
        content: [{ type: "text", text: readableSummary }],
        configs: demoConfigs,
        demoMode: true,
        message: "Mode démo activé (clé API non configurée)",
      });
    }

    // --- APPEL CLAUDE ---
    console.log("🤖 Appel Claude avec prompt JSON Clariprint...");
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: CLAUDE_SYSTEM_PROMPT,
          messages: messages,
        }),
      });

      // Erreur API → mode démo
      if (!response.ok) {
        const errorData = await response.text();
        console.error("❌ Erreur API Claude:", errorData);

        if (
          errorData.includes("credit") ||
          errorData.includes("billing") ||
          errorData.includes("authentication") ||
          errorData.includes("invalid")
        ) {
          const demoConfigs = generateDemoConfigs(userMessage);
          const readableSummary = generateReadableSummary(demoConfigs);
          return c.json({
            content: [{ type: "text", text: readableSummary }],
            configs: demoConfigs,
            demoMode: true,
            message: "Mode démo activé (crédits API insuffisants ou clé invalide)",
          });
        }

        return c.json(
          { error: "Failed to get response from Claude API", details: errorData },
          response.status as any,
        );
      }

      const data = await response.json();
      console.log("✅ Réponse Claude reçue");

      // --- PARSE JSON de Claude ---
      let rawText: string = data.content?.[0]?.text || "";
      // Nettoyer les éventuels blocs ```json ... ```
      rawText = rawText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```\s*$/i, "")
        .trim();

      let configs: any[] = [];
      try {
        const parsed = JSON.parse(rawText);
        configs = Array.isArray(parsed.products) ? parsed.products : [];
        console.log(`✅ JSON parsé : ${configs.length} produit(s)`);
      } catch (parseError) {
        console.error("❌ Impossible de parser le JSON de Claude:", parseError);
        console.error("Texte brut:", rawText.substring(0, 500));
        // Fallback démo si JSON invalide
        configs = generateDemoConfigs(userMessage);
      }

      // Générer le résumé lisible pour le chat
      const readableSummary = generateReadableSummary(configs);

      return c.json({
        content: [{ type: "text", text: readableSummary }],
        configs: configs,
        model: data.model,
        usage: data.usage,
        demoMode: false,
      });
    } catch (apiError) {
      console.error("❌ Erreur réseau Claude, mode démo:", apiError);
      const demoConfigs = generateDemoConfigs(userMessage);
      const readableSummary = generateReadableSummary(demoConfigs);
      return c.json({
        content: [{ type: "text", text: readableSummary }],
        configs: demoConfigs,
        demoMode: true,
        message: "Mode démo activé (erreur réseau)",
      });
    }
  } catch (error) {
    console.error("Error in claude-proxy:", error);
    return c.json(
      { error: "Internal server error", message: String(error) },
      500,
    );
  }
});

// ============================================================================
// CLARIPRINT QUOTE — Demande de prix via l'API Clariprint
// ============================================================================
app.post("/make-server-e3db71a4/clariprint-quote", async (c) => {
  try {
    const rawHost = Deno.env.get("CLARIPRINT_HOST") || "https://lrdp.clariprint.com";
    const login = Deno.env.get("CLARIPRINT_LOGIN");
    const password = Deno.env.get("CLARIPRINT_PASSWORD");

    // Construire l'URL de manière robuste, quel que soit le format du secret CLARIPRINT_HOST
    // Ex: "lrdp.clariprint.com", "https://lrdp.clariprint.com", "https://lrdp.clariprint.com/optimproject/json.wcl"
    let normalizedHost = rawHost.trim().replace(/\/$/, "");
    // Ajouter https:// si absent
    if (!normalizedHost.startsWith("http://") && !normalizedHost.startsWith("https://")) {
      normalizedHost = "https://" + normalizedHost;
    }
    // Construire l'URL finale — éviter la duplication du path
    const apiUrl = normalizedHost.includes("/optimproject/json.wcl")
      ? normalizedHost
      : `${normalizedHost}/optimproject/json.wcl`;

    console.log(`🌐 URL Clariprint construite: ${apiUrl}`);

    // Credentials manquants → réponse gracieuse (pas d'erreur bloquante)
    if (!login || !password) {
      console.log("⚠️ CLARIPRINT_LOGIN ou CLARIPRINT_PASSWORD non configurés");
      return c.json({
        success: false,
        credentialsMissing: true,
        message:
          "Configurez CLARIPRINT_LOGIN et CLARIPRINT_PASSWORD dans vos secrets Supabase pour obtenir les prix réels.",
      });
    }

    const body = await c.req.json();
    const clariprintProduct = body.clariprint;

    if (!clariprintProduct) {
      return c.json({ success: false, error: "Données produit Clariprint manquantes" }, 400);
    }

    // Forcer quantity en string (conformément à la doc Clariprint)
    if (typeof clariprintProduct.quantity === "number") {
      clariprintProduct.quantity = String(clariprintProduct.quantity);
    }

    // Ajouter deliveries par défaut si absent (obligatoire pour le calcul du coût de livraison)
    if (!clariprintProduct.deliveries) {
      clariprintProduct.deliveries = {
        d_livraison: {
          iso: "FR-75",
          address: "",
          quantity: clariprintProduct.quantity,
        },
      };
      console.log("📍 deliveries absent → ajout par défaut FR-75");
    }

    console.log(`🖨️ Demande de prix Clariprint pour: ${clariprintProduct.reference}`);
    console.log("📦 Config envoyée:", JSON.stringify(clariprintProduct));

    const datas = { clariprint_product: clariprintProduct };
    const params = new URLSearchParams();
    params.append("login", login);
    params.append("password", password);
    params.append("action", "QuoteRequest");
    params.append("datas", JSON.stringify(datas));

    const apiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error(`❌ Erreur HTTP Clariprint ${apiResponse.status}:`, errorText);
      return c.json({
        success: false,
        error: `Clariprint API HTTP ${apiResponse.status}`,
        details: errorText.substring(0, 500),
      });
    }

    const responseText = await apiResponse.text();
    console.log(`📩 Réponse Clariprint (status ${apiResponse.status}):`, responseText.substring(0, 800));

    let result: any;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error("❌ Réponse Clariprint non-JSON:", responseText.substring(0, 500));
      return c.json({
        success: false,
        error: "Réponse Clariprint invalide (non-JSON)",
        details: `URL appelée: ${apiUrl} | Status HTTP: ${apiResponse.status} | Réponse: ${responseText.substring(0, 300)}`,
        rawResponse: responseText.substring(0, 300),
      });
    }

    if (!result.success) {
      console.error("❌ Clariprint a renvoyé success=false:", result);
      return c.json({
        success: false,
        error: result.error || "Erreur de calcul Clariprint",
        faultyProcess: result.all_faulty_process,
        rawResponse: result,
      });
    }

    console.log(`✅ Prix Clariprint obtenu : ${result.response} € — Délai : ${result.delais}j`);

    return c.json({
      success: true,
      // Prix simplifié HT
      priceHT: result.response,
      // Détail des coûts (meilleure gamme)
      costs: result.costs,
      // Délai en jours
      delais: result.delais,
      // Poids en kg
      weight: result.weight,
      // Fournisseur sélectionné
      fournisseur: result.fournisseur,
      // Durée de fabrication (1/10e d'heure)
      processDuration: result.total_process_duration,
      // Toutes les gammes (multi-résultats)
      allResults: result.all_process || [],
      // Gammes en erreur
      faultyProcess: result.all_faulty_process || {},
    });
  } catch (error) {
    console.error("❌ Erreur dans clariprint-quote:", error);
    return c.json(
      { success: false, error: "Erreur serveur", message: String(error) },
      500,
    );
  }
});

// ============================================================================
// CLARIPRINT TEST — Vérification authentification (CheckAuth)
// ============================================================================
app.get("/make-server-e3db71a4/clariprint-test", async (c) => {
  const host = Deno.env.get("CLARIPRINT_HOST") || "https://lrdp.clariprint.com";
  const login = Deno.env.get("CLARIPRINT_LOGIN");
  const password = Deno.env.get("CLARIPRINT_PASSWORD");

  const result: any = {
    timestamp: new Date().toISOString(),
    environment: {
      CLARIPRINT_HOST: host,
      CLARIPRINT_LOGIN: login ? `✅ Configuré (${login.substring(0, 3)}***)` : "❌ Non configuré",
      CLARIPRINT_PASSWORD: password ? "✅ Configuré" : "❌ Non configuré",
    },
  };

  if (!login || !password) {
    result.success = false;
    result.error = "Credentials manquants dans les secrets Supabase.";
    return c.json(result);
  }

  try {
    console.log(`🔐 Test CheckAuth Clariprint vers ${host}...`);
    const params = new URLSearchParams();
    params.append("login", login);
    params.append("password", password);
    params.append("action", "CheckAuth");
    params.append("datas", "{}");

    const apiResponse = await fetch(`${host}/optimproject/json.wcl`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const httpStatus = apiResponse.status;
    const rawText = await apiResponse.text();
    console.log(`📩 Réponse Clariprint CheckAuth (HTTP ${httpStatus}):`, rawText.substring(0, 500));

    let parsed: any = null;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // réponse non-JSON
    }

    result.httpStatus = httpStatus;
    result.rawResponse = rawText.substring(0, 500);
    result.parsedResponse = parsed;
    result.success = apiResponse.ok && (parsed?.success !== false);
    result.message = result.success
      ? "✅ Authentification Clariprint réussie !"
      : `❌ Échec — HTTP ${httpStatus} — ${rawText.substring(0, 200)}`;

  } catch (err) {
    result.success = false;
    result.error = `Erreur réseau : ${String(err)}`;
    result.message = "❌ Impossible de joindre le serveur Clariprint.";
  }

  return c.json(result);
});

// ============================================================================
// SAVE PRODUCT — Persistance KV Store
// ============================================================================
app.post("/make-server-e3db71a4/save-product", async (c) => {
  try {
    const { product } = await c.req.json();

    if (!product || !product.id) {
      return c.json({ error: "Product data with id is required" }, 400);
    }

    console.log(`💾 Sauvegarde du produit ${product.id}...`);
    await kv.set(product.id, product);

    const listKey = `products_list`;
    const existingList = (await kv.get(listKey)) || { products: [] };
    const existingIndex = existingList.products.findIndex((p: any) => p.id === product.id);
    if (existingIndex >= 0) {
      existingList.products[existingIndex] = product;
    } else {
      existingList.products.push(product);
    }
    await kv.set(listKey, existingList);

    console.log(`✅ Produit ${product.id} sauvegardé`);
    return c.json({ success: true, productId: product.id });
  } catch (error) {
    console.error("❌ Erreur save-product:", error);
    return c.json({ error: "Failed to save product", message: String(error) }, 500);
  }
});

Deno.serve(app.fetch);