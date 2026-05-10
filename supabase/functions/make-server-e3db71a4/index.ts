import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { streamSSE } from "npm:hono/streaming";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.ts";
import {
  anthropicComplete,
  anthropicStream,
  AnthropicClientError,
} from "../_shared/anthropicClient.ts";

// Detection des erreurs API qui justifient un fallback demo (cle absente,
// credits epuises, auth invalide). Cf. comportement historique avant S1.5.
function isClaudeBillingError(err: AnthropicClientError): boolean {
  if (err.kind !== "api_error") return false;
  const body = String(
    (err.details as { body?: string } | undefined)?.body ?? "",
  ).toLowerCase();
  return /credit|billing|authentication|invalid/.test(body);
}

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
// E2 — Modes Marguerite. Le system prompt commun definit le format JSON
// strict + les regles metier. Selon le mode (open/strict), on append a la
// fin un suffixe qui change le comportement d'extrapolation.

const CLAUDE_SYSTEM_PROMPT_BASE = `Tu es un expert en imprimerie professionnelle et web-to-print avec 20 ans d'expérience (imprimerie offset, numérique, grand format).

🚨 RÈGLE ABSOLUE : Réponds UNIQUEMENT avec du JSON valide. Zéro texte avant ou après. Zéro commentaire JavaScript. Pas de \`\`\`json ni de \`\`\`.

FORMAT DE RÉPONSE OBLIGATOIRE :
{
  "teachingNote": "OPTIONNEL — Commentaire pédagogique en markdown. Voir règles spéciales en bas du prompt. Laisse vide ou omet ce champ pour les demandes classiques.",
  "assumptions": ["OPTIONNEL — liste des hypothèses faites quand la demande est vague. Ex: 'Format A5 supposé', 'Quadrichromie recto-verso par défaut'. Vide [] ou omet si la demande est complète et explicite."],
  "clarification": "OPTIONNEL — utilisé en MODE STRICT uniquement, voir suffixe à la fin du prompt.",
  "clarificationOptions": ["OPTIONNEL — liste de 2-5 reponses cliquables proposees a l'utilisateur en mode STRICT. Vide [] si question ouverte."],
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
- Réponds UNIQUEMENT en JSON valide. Aucun texte hors JSON.

🎓 RÈGLES SPÉCIALES — QUESTIONS PÉDAGOGIQUES / COMPARATIVES :
Détecte les questions du type :
- "C'est quoi la différence entre X et Y ?"
- "Quel est le meilleur papier pour ... ?"
- "Comment choisir entre ... ?"
- "Pelliculage mat ou brillant ?"
- "Couché ou non couché ?"
- "Quel grammage pour ... ?"
- "Explique-moi X"
- "Conseille-moi entre..."

Pour ces questions tu DOIS :
1. Remplir le champ "teachingNote" au TOP du JSON (hors "products") avec une explication en markdown :
   - 1 paragraphe d'explication générale (2-4 phrases)
   - Une section "**En pratique**" avec 2-3 bullets type "- Couché : ..." / "- Non couché : ..."
   - Une section "**À retenir**" avec les points clés techniques
   - Ton professionnel mais accessible, tutoyer.
   - Pas de quantité ni prix dans teachingNote, uniquement du contenu métier éducatif.
2. Générer 2 ou 3 produits COMPARATIFS dans "products" pour illustrer concrètement la différence. Prends un produit typique (carte de visite, flyer A5) et décline-le en 2-3 variantes qui illustrent la question. Quantité raisonnable (500 ou 1000). Chaque variante doit être UNIQUE sur l'axe de la question posée.

Pour les demandes de CALCUL DE PRIX / CATALOGUE classiques, LAISSE teachingNote vide ou omet-le complètement.`;

// ─── E2.1 — Mode "open" (extrapolation libre, defaut Freemium+) ──────────────
const CLAUDE_MODE_OPEN_SUFFIX = `

🌿 MODE EXTRAPOLATION OUVERTE (defaut) :
- Si la demande est vague (ex: "kit PLV pour ouverture magasin", "campagne automne"),
  PROPOSE 3-5 produits coherents qui composent l'ensemble probable.
- Liste TES hypotheses dans le champ "assumptions" (1 phrase courte par hypothese).
  Ex : ["Format A5 suppose pour les flyers", "500 unites de chaque (zone de chalandise moyenne)", "Quadri recto-verso par defaut"]
- Reste fidele aux quelques specs explicites du user, n'invente pas a leur place.
- Le champ "clarification" reste vide en mode ouvert.`;

// ─── E2.2 — Mode "strict" (interpretation litterale, Pro+) ───────────────────
const CLAUDE_MODE_STRICT_SUFFIX = `

🎯 MODE INTERPRETATION STRICTE (Pro+) — REGLE NON NEGOCIABLE :
- N'EXTRAPOLE JAMAIS. Tu n'as PAS le droit d'utiliser un format, un grammage,
  une finition ou un papier par defaut. Aucune valeur "standard" implicite.
- Tu n'es PAS un assistant qui devine. Tu es un calculateur litteral.

PARAMETRES OBLIGATOIRES par famille produit :
  * Cartes de visite : quantite + format precis (85x55, 85x85, 100x70…)
                       + recto/recto-verso + papier
  * Flyers / affiches : quantite + format (A4, A5, A6, A3, A2…)
                        + recto/recto-verso + grammage + papier
  * Depliants : quantite + format ouvert/ferme + nombre de plis + papier
  * Brochures : quantite + format + nombre de pages + reliure + papier int/cover

REGLE D'ARRET — si UN SEUL de ces parametres obligatoires manque pour la famille
visee, tu DOIS :
  1. Mettre "products": []
  2. Mettre "assumptions": []
  3. Remplir "clarification" avec UNE question ciblee sur le parametre LE PLUS
     bloquant. Format de la question : COURTE, factuelle. SANS lister les
     options dans le texte (les options sont dans le champ separe ci-dessous).
     Ex BON : "Quel format pour vos cartes de visite ?"
              "Impression recto seul ou recto-verso ?"
              "Quel grammage de papier ?"
     Ex MAUVAIS : "Quel format pour les cartes (85x55, 85x85, 100x70) ?"
                  (les options ne vont PAS dans la question — elles vont dans
                  le champ "clarificationOptions")
  4. Remplir "clarificationOptions" : liste de 2-5 chaines de caracteres COURTES
     que l'utilisateur peut cliquer pour repondre directement. Chaque option
     doit etre auto-suffisante (l'user clique = il repond).
     Ex pour "Quel format pour vos cartes de visite ?" :
        ["85 x 55 mm (standard)", "85 x 85 mm (carre)", "100 x 70 mm (large)"]
     Ex pour "Impression recto seul ou recto-verso ?" :
        ["Recto seul", "Recto-verso"]
     Ex pour "Quel grammage ?" :
        ["300 g/m²", "350 g/m²", "400 g/m²"]
     Si la question est vraiment ouverte (ex: nom d'un evenement), met [].
  5. NE GENERE AUCUN produit, meme pas un "exemple" ou un "produit type".

Si plusieurs parametres manquent, pose la question UNIQUEMENT sur le plus
bloquant. Les autres viendront aux echanges suivants.

Quand tous les parametres obligatoires sont fournis : retourne 1 produit
exact, "clarification": null, "assumptions": [].`;

export function buildSystemPrompt(mode: "open" | "strict"): string {
  return mode === "strict"
    ? CLAUDE_SYSTEM_PROMPT_BASE + CLAUDE_MODE_STRICT_SUFFIX
    : CLAUDE_SYSTEM_PROMPT_BASE + CLAUDE_MODE_OPEN_SUFFIX;
}

// Constante back-compat (anciens appels qui ne specifient pas le mode).
const CLAUDE_SYSTEM_PROMPT = buildSystemPrompt("open");

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
          model: "claude-haiku-4-5-20251001",
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
    // E7.1 — userId / tenantId sont passes par le client pour pouvoir tracer
    // la conso LLM (cf. lib/llm_usage). Optionnels (ex: shop public anonyme).
    // E2 — mode 'open' (extrapolation libre, defaut) ou 'strict' (interpretation
    // litterale, Pro+). Le system prompt est compose en consequence.
    const body = await c.req.json();
    const { userId, tenantId } = body;
    let { messages } = body;
    const mode: "open" | "strict" = body.mode === "strict" ? "strict" : "open";

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return c.json({ error: "messages array is required" }, 400);
    }

    // E2.4 — Limite a 25 messages dans le contexte envoye a Claude. On garde
    // les 25 plus recents (le dernier user message est toujours preserve).
    // Au-dela, on logge ce qu'on a tronque pour audit.
    const MAX_CONTEXT_MESSAGES = 25;
    let truncatedCount = 0;
    if (messages.length > MAX_CONTEXT_MESSAGES) {
      truncatedCount = messages.length - MAX_CONTEXT_MESSAGES;
      console.log(
        `[claude-proxy] context truncated: ${truncatedCount} messages drop (kept last ${MAX_CONTEXT_MESSAGES})`
      );
      messages = messages.slice(-MAX_CONTEXT_MESSAGES);
    }

    const userMessage = messages[messages.length - 1].content;

    // Helper : reponse mode demo (preserve API contract historique).
    const respondDemo = (message: string) => {
      const demoConfigs = generateDemoConfigs(userMessage);
      const readableSummary = generateReadableSummary(demoConfigs);
      return c.json({
        content: [{ type: "text", text: readableSummary }],
        configs: demoConfigs,
        demoMode: true,
        message,
      });
    };

    // --- APPEL CLAUDE via wrapper AnthropicClient (S1.5) ---
    // Le wrapper gere automatiquement : recherche cle API multi-secrets, limite 25 params (FR43),
    // tracking llm_usage_events (NFR23). Pas de logLlmUsage manuel.
    console.log(`🤖 Appel Claude via wrapper (mode=${mode}, ctx=${messages.length} msgs)...`);
    const MODEL = "claude-sonnet-4-5-20250929";
    let result;
    try {
      result = await anthropicComplete({
        model: MODEL,
        messages,
        system: buildSystemPrompt(mode),
        maxTokens: 4096,
        endpoint: "claude-proxy",
        userId,
        tenantId,
        metadata: {
          mode,
          messages_count: messages.length,
          truncated_count: truncatedCount,
        },
      });
    } catch (err) {
      if (err instanceof AnthropicClientError) {
        if (err.kind === "missing_api_key") {
          console.log("⚠️ Mode démo activé - clé API absente");
          return respondDemo("Mode démo activé (clé API non configurée)");
        }
        if (isClaudeBillingError(err)) {
          console.error("❌ Erreur API Claude (billing/auth):", err.details);
          return respondDemo("Mode démo activé (crédits API insuffisants ou clé invalide)");
        }
        if (err.kind === "param_limit_exceeded") {
          return c.json(
            { error: err.message, kind: err.kind, details: err.details },
            400,
          );
        }
        if (err.kind === "api_error") {
          const details = err.details as { status?: number; body?: string } | undefined;
          console.error("❌ Erreur API Claude:", details);
          return c.json(
            { error: "Failed to get response from Claude API", details: details?.body ?? err.message },
            (details?.status ?? 502) as any,
          );
        }
      }
      console.error("❌ Erreur réseau Claude, mode démo:", err);
      return respondDemo("Mode démo activé (erreur réseau)");
    }

    console.log("✅ Réponse Claude reçue");

    // --- PARSE JSON de Claude ---
    // Nettoyer les eventuels blocs ```json ... ```
    const rawText: string = result.text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    let configs: any[] = [];
    let teachingNote: string | null = null;
    let assumptions: string[] = [];
    let clarification: string | null = null;
    let clarificationOptions: string[] = [];
    try {
      const parsed = JSON.parse(rawText);
      configs = Array.isArray(parsed.products) ? parsed.products : [];
      if (typeof parsed.teachingNote === "string" && parsed.teachingNote.trim()) {
        teachingNote = parsed.teachingNote.trim();
      }
      // E2.1 — assumptions emises par Magrit quand demande vague
      if (Array.isArray(parsed.assumptions)) {
        assumptions = parsed.assumptions
          .filter((a: unknown) => typeof a === "string" && a.trim().length > 0)
          .map((a: string) => a.trim());
      }
      // E2.2 — clarification demandee par Claude en mode strict
      if (typeof parsed.clarification === "string" && parsed.clarification.trim()) {
        clarification = parsed.clarification.trim();
      }
      // E2.2 — options cliquables associees a la clarification
      if (Array.isArray(parsed.clarificationOptions)) {
        clarificationOptions = parsed.clarificationOptions
          .filter((o: unknown) => typeof o === "string" && o.trim().length > 0)
          .map((o: string) => o.trim())
          .slice(0, 5); // safety : max 5 options pour eviter UI surchargee
      }
      console.log(
        `✅ JSON parsé : ${configs.length} produit(s)` +
          (teachingNote ? ` + teachingNote` : "") +
          (assumptions.length ? ` + ${assumptions.length} assumption(s)` : "") +
          (clarification ? ` + clarification` : "") +
          (clarificationOptions.length ? ` + ${clarificationOptions.length} option(s)` : "")
      );
    } catch (parseError) {
      console.error("❌ Impossible de parser le JSON de Claude:", parseError);
      console.error("Texte brut:", rawText.substring(0, 500));
      // Fallback démo si JSON invalide
      configs = generateDemoConfigs(userMessage);
    }

    // Générer le résumé lisible pour le chat (utilisé si pas de teachingNote)
    const readableSummary = generateReadableSummary(configs);

    return c.json({
      content: [{ type: "text", text: readableSummary }],
      configs: configs,
      teachingNote,
      assumptions,
      clarification,
      clarificationOptions,
      mode,
      truncatedCount,
      model: MODEL,
      usage: {
        input_tokens: result.usage.input_tokens,
        output_tokens: result.usage.output_tokens,
      },
      demoMode: false,
    });
  } catch (error) {
    console.error("Error in claude-proxy:", error);
    return c.json(
      { error: "Internal server error", message: String(error) },
      500,
    );
  }
});

// ============================================================================
// E3.1 + E3.2 — CLAUDE PROXY STREAM (SSE)
// ============================================================================
// Variante streaming de claude-proxy. Pipe les SSE chunks d Anthropic
// directement vers le client (event=delta, data={text}) puis emet un event
// final (event=done, data={content, configs, ...}) avec le resultat
// structure et logge la conso LLM.
//
// Activation cote front : feature flag ENABLE_STREAMING_CHAT (off par defaut).
// Si false, le client utilise toujours l ancienne route synchrone.

interface ParsedClaudeJson {
  configs: any[];
  teachingNote: string | null;
  assumptions: string[];
  clarification: string | null;
  clarificationOptions: string[];
}

function parseClaudeJson(rawText: string): ParsedClaudeJson {
  const cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  const result: ParsedClaudeJson = {
    configs: [],
    teachingNote: null,
    assumptions: [],
    clarification: null,
    clarificationOptions: [],
  };
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed.products)) result.configs = parsed.products;
    if (typeof parsed.teachingNote === "string" && parsed.teachingNote.trim()) {
      result.teachingNote = parsed.teachingNote.trim();
    }
    if (Array.isArray(parsed.assumptions)) {
      result.assumptions = parsed.assumptions
        .filter((a: unknown) => typeof a === "string" && a.trim().length > 0)
        .map((a: string) => a.trim());
    }
    if (typeof parsed.clarification === "string" && parsed.clarification.trim()) {
      result.clarification = parsed.clarification.trim();
    }
    if (Array.isArray(parsed.clarificationOptions)) {
      result.clarificationOptions = parsed.clarificationOptions
        .filter((o: unknown) => typeof o === "string" && o.trim().length > 0)
        .map((o: string) => o.trim())
        .slice(0, 5);
    }
  } catch (e) {
    console.error("[claude-proxy-stream] JSON parse failed:", e);
  }
  return result;
}

app.post("/make-server-e3db71a4/claude-proxy-stream", async (c) => {
  const body = await c.req.json();
  const { userId, tenantId } = body;
  let { messages } = body;
  const mode: "open" | "strict" = body.mode === "strict" ? "strict" : "open";

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return c.json({ error: "messages array is required" }, 400);
  }

  const MAX_CONTEXT_MESSAGES = 25;
  let truncatedCount = 0;
  if (messages.length > MAX_CONTEXT_MESSAGES) {
    truncatedCount = messages.length - MAX_CONTEXT_MESSAGES;
    messages = messages.slice(-MAX_CONTEXT_MESSAGES);
  }

  const userMessage = messages[messages.length - 1].content;

  // S1.5 review fix P4 : modele partage entre call site et fallback finalPromise.catch.
  const STREAM_MODEL = "claude-sonnet-4-5-20250929";

  return streamSSE(c, async (stream) => {
    // Helper : emet un event "done" en mode demo (preserve le contrat client SSE).
    // S1.5 review fix P11 : ajout du champ `error: string | null` (compromis D2)
    // pour distinguer les paths d'erreur des completions normales tout en
    // preservant l'event "done" (backwards-compat client). Le client peut
    // tester `error !== null` pour afficher un toast/banner.
    const writeDemoDone = async (
      message: string,
      demoMode = true,
      error: string | null = null,
    ) => {
      const demoConfigs = demoMode ? generateDemoConfigs(userMessage) : [];
      const readableSummary = generateReadableSummary(demoConfigs);
      await stream.writeSSE({
        event: "done",
        data: JSON.stringify({
          content: [{ type: "text", text: readableSummary }],
          configs: demoConfigs,
          teachingNote: null,
          assumptions: [],
          clarification: null,
          clarificationOptions: [],
          mode,
          truncatedCount,
          demoMode,
          message,
          error,
        }),
      });
    };

    // --- APPEL CLAUDE STREAM via wrapper (S1.5) ---
    let textChunks: AsyncIterable<string>;
    let finalPromise: Promise<{ fullText: string; usage: { input_tokens: number; output_tokens: number }; model: string }>;
    try {
      const result = await anthropicStream({
        model: STREAM_MODEL,
        messages,
        system: buildSystemPrompt(mode),
        maxTokens: 4096,
        endpoint: "claude-proxy-stream",
        userId,
        tenantId,
        metadata: {
          mode,
          messages_count: messages.length,
          truncated_count: truncatedCount,
        },
      });
      textChunks = result.textChunks;
      finalPromise = result.finalPromise;
    } catch (err) {
      if (err instanceof AnthropicClientError) {
        if (err.kind === "missing_api_key") {
          await writeDemoDone("Mode démo (clé API absente)", true, null);
          return;
        }
        if (isClaudeBillingError(err)) {
          await writeDemoDone(
            "Mode démo (crédits API insuffisants ou clé invalide)",
            true,
            "billing_or_auth",
          );
          return;
        }
        if (err.kind === "param_limit_exceeded") {
          await writeDemoDone(`Erreur : ${err.message}`, false, "param_limit_exceeded");
          return;
        }
        if (err.kind === "api_error") {
          const details = err.details as { status?: number } | undefined;
          console.error("[claude-proxy-stream] Anthropic error:", details?.status, err.message);
          await writeDemoDone(
            `Anthropic ${details?.status ?? "error"}`,
            false,
            `api_error_${details?.status ?? "unknown"}`,
          );
          return;
        }
      }
      console.error("[claude-proxy-stream] network error:", err);
      await writeDemoDone("Mode démo (erreur réseau)", true, "network_error");
      return;
    }

    // Streaming : relai les deltas vers le client en SSE Hono.
    let fullText = "";
    try {
      for await (const text of textChunks) {
        fullText += text;
        await stream.writeSSE({
          event: "delta",
          data: JSON.stringify({ text }),
        });
      }
    } catch (streamErr) {
      console.error("[claude-proxy-stream] iteration error:", streamErr);
      await writeDemoDone("Erreur pendant le streaming Claude", false, "stream_iteration_error");
      return;
    }

    // Final : recupere usage + model du wrapper (logLlmUsage deja fait).
    const final = await finalPromise.catch((e) => {
      console.error("[claude-proxy-stream] finalPromise rejected:", e);
      // S1.5 review fix P4 : utilise STREAM_MODEL au lieu d'une string hardcodee.
      return { fullText, usage: { input_tokens: 0, output_tokens: 0 }, model: STREAM_MODEL };
    });

    const parsed = parseClaudeJson(final.fullText || fullText);
    const configs = parsed.configs.length > 0 ? parsed.configs : [];
    const readableSummary = generateReadableSummary(configs);

    await stream.writeSSE({
      event: "done",
      data: JSON.stringify({
        content: [{ type: "text", text: readableSummary }],
        configs,
        teachingNote: parsed.teachingNote,
        assumptions: parsed.assumptions,
        clarification: parsed.clarification,
        clarificationOptions: parsed.clarificationOptions,
        mode,
        truncatedCount,
        model: final.model,
        usage: final.usage,
        demoMode: false,
        error: null,
      }),
    });
  });
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

    // Sanitization défensive (S0.2 / Décision Arnaud 2026-05-09) :
    // les anomalies Clariprint connues (-1,2 €, undefined, NaN) ne doivent
    // jamais arriver au front. On retourne success=false avec un message
    // explicite pour que le front puisse retomber sur estimatedPrice + badge.
    const priceHT = result.response;
    const isInvalidPrice =
      priceHT == null ||
      typeof priceHT !== "number" ||
      !Number.isFinite(priceHT) ||
      priceHT < 0;

    if (isInvalidPrice) {
      console.error(
        `❌ Anomalie prix Clariprint détectée — priceHT=${JSON.stringify(priceHT)}. Bloqué côté serveur.`,
      );
      return c.json({
        success: false,
        error:
          priceHT < 0
            ? "Prix Clariprint invalide (négatif)"
            : "Prix Clariprint invalide (absent, NaN ou non-numérique)",
        details: `priceHT brut reçu: ${JSON.stringify(priceHT)}`,
        rawResponse: result,
      });
    }

    // costs.total : si présent et invalide, on le masque sans bloquer la réponse
    let costs = result.costs;
    if (costs && costs.total !== undefined) {
      const totalInvalid =
        typeof costs.total !== "number" ||
        !Number.isFinite(costs.total) ||
        costs.total < 0;
      if (totalInvalid) {
        console.warn(
          `⚠️ costs.total Clariprint invalide (${JSON.stringify(costs.total)}), masqué.`,
        );
        costs = { ...costs, total: undefined };
      }
    }

    return c.json({
      success: true,
      // Prix simplifié HT (validé)
      priceHT,
      // Détail des coûts (meilleure gamme, costs.total éventuellement masqué)
      costs,
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

// ============================================================================
// E9.5 — SEND-INVITATION-EMAIL
// ============================================================================
// Envoie l'email d'invitation a rejoindre un espace via Resend.
//
// Contrat front: POST { invitationId, baseUrl } ou baseUrl = window.location.origin.
// L'email + tenant + token + expires sont relus en service_role depuis la DB
// pour eviter qu'un appelant puisse envoyer des mails arbitraires.
//
// Reponse:
//   { ok: true,  sent: true,  link }              -> email envoye
//   { ok: true,  sent: false, link, reason }      -> Resend non configure ou
//                                                    echec, le client doit
//                                                    afficher le lien manuel
//   { ok: false, error }                          -> erreur cote server (400/500)

const ROLE_LABELS_FR: Record<string, string> = {
  owner: "Propriétaire",
  admin: "Administrateur",
  member: "Membre",
  partner: "Partenaire",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

app.post("/make-server-e3db71a4/send-invitation-email", async (c) => {
  try {
    const { invitationId, baseUrl } = await c.req.json();
    if (!invitationId || !baseUrl) {
      return c.json({ ok: false, error: "invitationId et baseUrl requis" }, 400);
    }

    const supa = getServiceClient();
    if (!supa) {
      return c.json(
        { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY non configuree" },
        500,
      );
    }

    const { data: inv, error: invErr } = await supa
      .from("tenant_invitations")
      .select("id, email, role, token, expires_at, tenant_id, invited_by")
      .eq("id", invitationId)
      .maybeSingle();

    if (invErr || !inv) {
      return c.json(
        { ok: false, error: invErr?.message || "Invitation introuvable" },
        404,
      );
    }

    const { data: tenant } = await supa
      .from("tenants")
      .select("name, slug")
      .eq("id", inv.tenant_id)
      .maybeSingle();

    let inviterEmail: string | null = null;
    if (inv.invited_by) {
      const { data: inviter } = await supa.auth.admin.getUserById(inv.invited_by);
      inviterEmail = inviter?.user?.email ?? null;
    }

    const cleanBase = String(baseUrl).replace(/\/+$/, "");
    const link = `${cleanBase}/invitations/${inv.token}`;

    const tenantName = tenant?.name || "votre espace Magrit";
    const roleLabel = ROLE_LABELS_FR[inv.role] || inv.role;
    const expiresFr = new Date(inv.expires_at).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      return c.json({
        ok: true,
        sent: false,
        link,
        reason: "RESEND_API_KEY non configuree — affichez le lien manuellement",
      });
    }

    const fromAddr =
      Deno.env.get("MAGRIT_FROM_EMAIL") || "Magrit <onboarding@resend.dev>";
    const subject = inviterEmail
      ? `${inviterEmail} vous invite a rejoindre ${tenantName} sur Magrit`
      : `Invitation a rejoindre ${tenantName} sur Magrit`;

    const intro = inviterEmail
      ? `${escapeHtml(inviterEmail)} vous a invite(e) a rejoindre l'espace <strong>${escapeHtml(tenantName)}</strong> sur Magrit.`
      : `Vous avez ete invite(e) a rejoindre l'espace <strong>${escapeHtml(tenantName)}</strong> sur Magrit.`;

    const html = `<!DOCTYPE html>
<html lang="fr">
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px;">
  <p style="font-size: 15px; line-height: 1.5;">Bonjour,</p>
  <p style="font-size: 15px; line-height: 1.5;">${intro}</p>
  <p style="font-size: 14px; line-height: 1.5; color: #555;">
    Role : <strong>${escapeHtml(roleLabel)}</strong><br/>
    Cette invitation expire le ${escapeHtml(expiresFr)}.
  </p>
  <p style="margin: 28px 0;">
    <a href="${escapeHtml(link)}" style="display: inline-block; background: #1a1a1a; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-size: 14px; font-weight: 500;">
      Accepter l'invitation
    </a>
  </p>
  <p style="font-size: 12px; color: #888; line-height: 1.5;">
    Ou copiez ce lien : <br/>
    <a href="${escapeHtml(link)}" style="color: #555; word-break: break-all;">${escapeHtml(link)}</a>
  </p>
  <p style="font-size: 12px; color: #888; line-height: 1.5; margin-top: 32px;">
    Si vous n'attendiez pas cette invitation, ignorez simplement ce message.
  </p>
  <p style="font-size: 11px; color: #aaa; margin-top: 32px;">Magrit — copilote IA web-to-print</p>
</body>
</html>`;

    const text = [
      "Bonjour,",
      "",
      inviterEmail
        ? `${inviterEmail} vous a invite(e) a rejoindre l'espace "${tenantName}" sur Magrit.`
        : `Vous avez ete invite(e) a rejoindre l'espace "${tenantName}" sur Magrit.`,
      "",
      `Role : ${roleLabel}`,
      `Cette invitation expire le ${expiresFr}.`,
      "",
      "Pour l'accepter, ouvrez ce lien :",
      link,
      "",
      "Si vous n'attendiez pas cette invitation, ignorez simplement ce message.",
      "",
      "— Magrit, copilote IA web-to-print",
    ].join("\n");

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddr,
        to: [inv.email],
        subject,
        html,
        text,
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      console.error("[send-invitation-email] Resend error:", resp.status, detail);
      return c.json({
        ok: true,
        sent: false,
        link,
        reason: `Resend ${resp.status}: ${detail.slice(0, 200)}`,
      });
    }

    return c.json({ ok: true, sent: true, link });
  } catch (error) {
    console.error("❌ Erreur send-invitation-email:", error);
    return c.json(
      { ok: false, error: "Erreur serveur", message: String(error) },
      500,
    );
  }
});

Deno.serve(app.fetch);