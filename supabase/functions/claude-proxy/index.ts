// Edge function Supabase : proxy Claude pour la home Magrit (parsing produit JSON).
// Story S1.5 (Epic 1, suite S1.3 partial, 2026-05-10) : refactor pour utiliser le
// wrapper unique _shared/anthropicClient (S1.1) au lieu de fetch direct.
// Mode démo (generateMultipleConfigs / generateDemoConfig) préservé : fallback
// quand pas de clé API, erreur billing/auth, ou réponse Claude non-conforme.

import { corsHeaders } from "../_shared/cors.ts";
import {
  anthropicCompleteStructured,
  AnthropicClientError,
  isAnthropicBillingError,
} from "../_shared/anthropicClient.ts";
import { ProductsResponseSchema } from "../_shared/productsSchema.ts";
import { extractAuthContext } from "./_auth.ts";

const MODEL = "claude-haiku-4-5-20251001";

// Story S-LLM-WRAPPER-ROBUSTNESS (AC2) : la detection billing est centralisee
// dans _shared/anthropicClient.ts via isAnthropicBillingError(). La regex locale
// /credit|billing|authentication/ a ete supprimee (trop permissive, matchait du
// texte arbitraire).
// Story S-LLM-WRAPPER-ROBUSTNESS (AC4) : extraction user/tenant JWT isolee
// dans ./_auth.ts pour testabilite (cf. _auth.test.ts).

// Fonction pour formater la réponse au format "Vous avez demandé"
function formatProductResponse(config: any): string {
  const quantity = config.quantity || 600;
  const productName = config.productName || "produit";
  const width = config.dimensions?.width || 85;
  const height = config.dimensions?.height || 55;
  const material = config.material || "Carte Graphique";
  const weight = config.weight || 350;
  const rectoStr = config.printing?.recto || "quadricouleur";
  const versoStr = config.printing?.verso || "quadricouleur";
  const finish = config.finish || "pelliculage polypropylène mat";
  const packaging = config.packaging || "en paquets scellés par ruban papier";
  const deliveryLocation = config.deliveryLocation || "France";

  let response = `Vous avez demandé :\n\n`;
  response += `**${quantity}** ${productName},\n`;
  response += `Format : **${width} mm×${height} mm**\n`;
  response += `impression **${rectoStr}** / **${versoStr}** sur papier **${material} ${weight} g**,\n`;
  response += `finition **${finish} (recto)** / **${finish} (verso)**.\n\n`;
  response += `Conditionnement : **${packaging}**, 1 carte(s) par paquet.\n\n`;
  response += `Livraison : destination **${deliveryLocation}**, adresse fournie : **aucune**.\n\n`;

  if (config.suggestions && config.suggestions.length > 0) {
    response += `Pour plus d'impact je vous propose :\n`;
    config.suggestions.forEach((suggestion: string) => {
      response += `${suggestion}\n`;
    });
  }

  return response;
}

// Fonction pour générer des configurations démo intelligentes
function generateDemoConfig(userMessage: string): any {
  const messageLower = userMessage.toLowerCase();
  
  // Détecter la quantité
  const quantityMatch = messageLower.match(/(\d+)/);
  const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 500;
  
  // Cartes de visite
  if (messageLower.includes("carte") || messageLower.includes("business card")) {
    return {
      productName: "Cartes de visite",
      name: "Cartes de visite",
      quantity: quantity,
      dimensions: { width: 85, height: 55, unit: "mm" },
      material: "Papier couché brillant",
      weight: 350,
      printing: { 
        recto: "Quadrichromie (CMJN)", 
        verso: messageLower.includes("recto verso") ? "Quadrichromie (CMJN)" : "Sans impression" 
      },
      finishRecto: messageLower.includes("pelliculage") || messageLower.includes("mat") 
        ? "Pelliculage mat" 
        : messageLower.includes("brillant")
        ? "Pelliculage brillant"
        : "Sans finition",
      finishVerso: messageLower.includes("pelliculage") || messageLower.includes("mat") 
        ? "Pelliculage mat" 
        : messageLower.includes("brillant")
        ? "Pelliculage brillant"
        : "Sans finition",
      finish: messageLower.includes("pelliculage") || messageLower.includes("mat") 
        ? "Pelliculage mat" 
        : messageLower.includes("brillant")
        ? "Pelliculage brillant"
        : "Sans finition",
      packaging: "Paquets de 25, scellés par ruban papier",
      deliveryLocation: "France",
      addressProvided: "Non fournie",
      suggestions: [
        "✦ Ajoutez un pelliculage mat pour un rendu premium (+12€)",
        "✦ Coins ronds disponibles (+8€)",
        "✦ Vernis sélectif sur le logo (+15€)"
      ],
      description: `Cartes de visite professionnelles de haute qualité, format standard 85x55mm. Impression ${messageLower.includes("recto verso") ? "recto-verso" : "recto seul"} en quadrichromie sur papier couché 350g/m². ${messageLower.includes("pelliculage") ? "Finition pelliculage pour une protection optimale." : ""}`,
      deliveryInfo: messageLower.includes("paris") ? "Livraison à Paris sous 3-5 jours ouvrés" : "Livraison standard sous 5-7 jours ouvrés"
    };
  }
  
  // Flyers
  if (messageLower.includes("flyer") || messageLower.includes("tract")) {
    const isA5 = messageLower.includes("a5");
    const isA4 = messageLower.includes("a4");
    
    return {
      productName: "Flyers publicitaires",
      name: "Flyers publicitaires",
      quantity: quantity,
      dimensions: isA5 
        ? { width: 148, height: 210, unit: "mm" }
        : isA4 
        ? { width: 210, height: 297, unit: "mm" }
        : { width: 148, height: 210, unit: "mm" }, // Par défaut A5
      material: "Offset Blanc",
      weight: 135,
      printing: { 
        recto: "Quadrichromie (CMJN)", 
        verso: messageLower.includes("recto verso") || messageLower.includes("verso") ? "Quadrichromie (CMJN)" : "Sans impression" 
      },
      finishRecto: messageLower.includes("brillant") ? "Vernis brillant" : "Sans finition",
      finishVerso: messageLower.includes("brillant") ? "Vernis brillant" : "Sans finition",
      finish: messageLower.includes("brillant") ? "Vernis brillant" : "Sans finition",
      packaging: "Paquets de 100, livrés à plat",
      deliveryLocation: "France",
      addressProvided: "Non fournie",
      suggestions: [
        "✦ Passez à 170g/m² pour plus de rigidité (+18€)",
        "✦ Ajoutez un vernis UV sélectif (+25€)",
        "✦ Format A4 pour plus d'impact visuel"
      ],
      description: `Flyers publicitaires format ${isA5 ? "A5" : isA4 ? "A4" : "A5"} (${isA5 ? "148x210mm" : isA4 ? "210x297mm" : "148x210mm"}). Impression ${messageLower.includes("recto verso") || messageLower.includes("verso") ? "recto-verso" : "recto seul"} en couleur sur papier offset blanc 135g/m². Idéal pour vos campagnes marketing.`,
      deliveryInfo: "Livraison express disponible sous 48h (+15€)"
    };
  }
  
  // Brochures
  if (messageLower.includes("brochure") || messageLower.includes("catalogue") || messageLower.includes("livret")) {
    const pagesMatch = messageLower.match(/(\d+)\s*pages?/);
    const pages = pagesMatch ? parseInt(pagesMatch[1]) : 16;
    
    return {
      productName: "Brochure agrafée",
      name: "Brochure agrafée",
      quantity: quantity,
      dimensions: { width: 210, height: 297, unit: "mm" },
      material: "Couverture: Couché brillant 250g | Intérieur: Offset 135g",
      weight: 250,
      printing: { 
        recto: "Quadrichromie (CMJN)", 
        verso: "Quadrichromie (CMJN)" 
      },
      finishRecto: "Piqûre à cheval (agrafage)",
      finishVerso: "Piqûre à cheval (agrafage)",
      finish: "Piqûre à cheval (agrafage)",
      packaging: "Livrées en cartons protégés",
      deliveryLocation: "France",
      addressProvided: "Non fournie",
      pages: pages,
      suggestions: [
        "✦ Dos carré collé pour un rendu livre (+45€)",
        "✦ Pelliculage soft-touch sur la couverture (+32€)",
        "✦ Vernis UV sélectif sur le titre (+28€)"
      ],
      description: `Brochure professionnelle de ${pages} pages au format A4. Couverture en papier couché brillant 250g/m² et intérieur en offset 135g/m². Assemblage par piqûre à cheval (agrafage central). Impression recto-verso en quadrichromie sur toutes les pages.`,
      deliveryInfo: "Livraison sous 7-10 jours ouvrés"
    };
  }
  
  // Affiches
  if (messageLower.includes("affiche") || messageLower.includes("poster")) {
    const isA2 = messageLower.includes("a2");
    const isA1 = messageLower.includes("a1");
    const isA0 = messageLower.includes("a0");
    
    return {
      productName: "Affiches grand format",
      name: "Affiches grand format",
      quantity: quantity,
      dimensions: isA0
        ? { width: 841, height: 1189, unit: "mm" }
        : isA1
        ? { width: 594, height: 841, unit: "mm" }
        : isA2 
        ? { width: 420, height: 594, unit: "mm" }
        : { width: 420, height: 594, unit: "mm" }, // Par défaut A2
      material: "Papier couché brillant",
      weight: 170,
      printing: { 
        recto: "Quadrichromie (CMJN) haute définition", 
        verso: "Sans impression" 
      },
      finishRecto: messageLower.includes("brillant") ? "Vernis brillant" : "Sans finition",
      finishVerso: "Sans finition",
      finish: messageLower.includes("brillant") ? "Vernis brillant" : "Sans finition",
      packaging: "Livrées en tube carton rigide",
      deliveryLocation: "France",
      addressProvided: "Non fournie",
      suggestions: [
        "✦ Papier blueback 135g pour affichage extérieur (+35€)",
        "✦ Pelliculage anti-UV pour durabilité extérieure (+42€)",
        "✦ Format A1 pour plus de visibilité"
      ],
      description: `Affiches grand format ${isA0 ? "A0" : isA1 ? "A1" : "A2"} pour vos événements et communications. Impression haute définition en quadrichromie sur papier couché brillant ${messageLower.includes("épais") ? "200" : "170"}g/m². Rendu professionnel avec couleurs éclatantes.`,
      deliveryInfo: "Livraison soignée en tube carton rigide sous 5-7 jours"
    };
  }
  
  // Configuration par défaut
  return {
    productName: "Impression personnalisée",
    name: "Impression personnalisée",
    quantity: quantity,
    dimensions: { width: 210, height: 297, unit: "mm" },
    material: "Offset Blanc",
    weight: 135,
    printing: { 
      recto: "Quadrichromie (CMJN)", 
      verso: "Sans impression" 
    },
    finishRecto: "Sans finition",
    finishVerso: "Sans finition",
    finish: "Sans finition",
    packaging: "Standard",
    deliveryLocation: "France",
    addressProvided: "Non fournie",
    suggestions: [
      "✦ Précisez le type de produit souhaité (cartes, flyers, brochures...)",
      "✦ Indiquez vos préférences de finition",
      "✦ Mentionnez vos contraintes de livraison"
    ],
    description: `Configuration d'impression personnalisée. N'hésitez pas à préciser vos besoins : type de produit, format souhaité, finitions spéciales, délais de livraison...`,
    deliveryInfo: "Délais variables selon la configuration finale"
  };
}

// Nouvelle fonction pour détecter et générer PLUSIEURS produits dans une seule requête
function generateMultipleConfigs(userMessage: string): any[] {
  const configs: any[] = [];
  const messageLower = userMessage.toLowerCase();
  
  // Parser les segments de produits séparés par "et"
  const segments = messageLower.split(/\s+et\s+/);
  
  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    
    // Extraire la quantité spécifique pour ce segment (au début, avant le nom du produit)
    // Ignore les nombres qui sont des pages ("24 pages") ou des formats ("A4", "A5")
    const quantityMatch = trimmed.match(/^(\d+)\s+/);
    const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 500;
    
    // Cartes de visite
    if (trimmed.includes("carte")) {
      configs.push({
        productName: "Cartes de visite",
        name: "Cartes de visite",
        quantity: quantity,
        dimensions: { width: 85, height: 55, unit: "mm" },
        material: "Papier couché brillant",
        weight: 350,
        printing: { 
          recto: "Quadrichromie (CMJN)", 
          verso: trimmed.includes("recto verso") ? "Quadrichromie (CMJN)" : "Sans impression" 
        },
        finishRecto: trimmed.includes("pelliculage") || trimmed.includes("mat") 
          ? "Pelliculage mat" 
          : "Sans finition",
        finishVerso: trimmed.includes("pelliculage") || trimmed.includes("mat") 
          ? "Pelliculage mat" 
          : "Sans finition",
        finish: trimmed.includes("pelliculage") || trimmed.includes("mat") 
          ? "Pelliculage mat" 
          : "Sans finition",
        packaging: "Paquets de 25, scellés par ruban papier",
        deliveryLocation: "France",
        addressProvided: "Non fournie",
        suggestions: [
          "✦ Coins ronds pour un rendu moderne (+8€)",
          "✦ Vernis sélectif sur le logo (+15€)",
          "✦ Papier texturé pour plus de cachet (+12€)"
        ]
      });
      continue;
    }
    
    // Flyers
    if (trimmed.includes("flyer") || trimmed.includes("tract")) {
      const isA5 = trimmed.includes("a5");
      const isA4 = trimmed.includes("a4");
      
      configs.push({
        productName: "Flyers publicitaires",
        name: "Flyers publicitaires",
        quantity: quantity,
        dimensions: isA5 
          ? { width: 148, height: 210, unit: "mm" }
          : isA4 
          ? { width: 210, height: 297, unit: "mm" }
          : { width: 148, height: 210, unit: "mm" },
        material: "Offset Blanc",
        weight: 135,
        printing: { 
          recto: "Quadrichromie (CMJN)", 
          verso: trimmed.includes("recto verso") || trimmed.includes("verso") ? "Quadrichromie (CMJN)" : "Sans impression" 
        },
        finishRecto: "Sans finition",
        finishVerso: "Sans finition",
        finish: "Sans finition",
        packaging: "Paquets de 100, livrés à plat",
        deliveryLocation: "France",
        addressProvided: "Non fournie",
        suggestions: [
          "✦ Passez à 170g/m² pour plus de rigidité (+18€)",
          "✦ Ajoutez un vernis UV sélectif (+25€)",
          "✦ Format A4 pour plus d'impact visuel"
        ]
      });
      continue;
    }
    
    // Brochures
    if (trimmed.includes("brochure") || trimmed.includes("catalogue") || trimmed.includes("livret")) {
      const pagesMatch = trimmed.match(/(\d+)\s*pages?/);
      const pages = pagesMatch ? parseInt(pagesMatch[1]) : 16;
      
      configs.push({
        productName: "Brochure agrafée",
        name: "Brochure agrafée",
        quantity: quantity,
        dimensions: { width: 210, height: 297, unit: "mm" },
        material: "Couverture: Couché brillant 250g | Intérieur: Offset 135g",
        weight: 250,
        printing: { 
          recto: "Quadrichromie (CMJN)", 
          verso: "Quadrichromie (CMJN)" 
        },
        finishRecto: "Piqûre à cheval (agrafage)",
        finishVerso: "Piqûre à cheval (agrafage)",
        finish: "Piqûre à cheval (agrafage)",
        packaging: "Livrées en cartons protégés",
        deliveryLocation: "France",
        addressProvided: "Non fournie",
        pages: pages,
        suggestions: [
          "✦ Dos carré collé pour un rendu livre (+45€)",
          "✦ Pelliculage soft-touch sur la couverture (+32€)",
          "✦ Vernis UV sélectif sur le titre (+28€)"
        ]
      });
      continue;
    }
    
    // Affiches
    if (trimmed.includes("affiche") || trimmed.includes("poster")) {
      const isA2 = trimmed.includes("a2");
      const isA1 = trimmed.includes("a1");
      const isA0 = trimmed.includes("a0");
      
      configs.push({
        productName: "Affiches grand format",
        name: "Affiches grand format",
        quantity: quantity,
        dimensions: isA0
          ? { width: 841, height: 1189, unit: "mm" }
          : isA1
          ? { width: 594, height: 841, unit: "mm" }
          : isA2 
          ? { width: 420, height: 594, unit: "mm" }
          : { width: 420, height: 594, unit: "mm" },
        material: "Papier couché brillant",
        weight: 170,
        printing: { 
          recto: "Quadrichromie (CMJN) haute définition", 
          verso: "Sans impression" 
        },
        finishRecto: "Sans finition",
        finishVerso: "Sans finition",
        finish: "Sans finition",
        packaging: "Livrées en tube carton rigide",
        deliveryLocation: "France",
        addressProvided: "Non fournie",
        suggestions: [
          "✦ Papier blueback 135g pour affichage extérieur (+35€)",
          "✦ Pelliculage anti-UV pour durabilité extérieure (+42€)",
          "✦ Format A1 pour plus de visibilité"
        ]
      });
      continue;
    }
  }
  
  // Si aucun produit détecté, utiliser generateDemoConfig comme fallback
  if (configs.length === 0) {
    configs.push(generateDemoConfig(userMessage));
  }
  
  return configs;
}

// System prompt pour structurer les réponses de Claude.
const SYSTEM_PROMPT = `Tu es un assistant spécialisé dans le web-to-print et l'imprimerie française (comme Vistaprint, Mixam, Exaprint).

IMPORTANT : Tu dois répondre UNIQUEMENT avec un objet JSON valide. Pas de texte avant ou après.

Format de réponse OBLIGATOIRE :
{
  "teachingNote": "Commentaire pédagogique en markdown (OPTIONNEL — vide ou absent pour les demandes classiques). À remplir UNIQUEMENT pour les questions de COMPARAISON, PÉDAGOGIE ou CONSEIL. Voir règles plus bas.",
  "products": [
    {
      "productName": "Nom du produit (inclure la variation, ex: 'Carte de visite coins ronds recto/verso')",
      "name": "Nom du produit (identique à productName)",
      "gamme": "slug de la famille produit (OBLIGATOIRE) — une valeur EXACTE parmi la liste GAMMES ci-dessous",
      "quantity": 500,
      "dimensions": { "width": 85, "height": 55, "unit": "mm" },
      "material": "Type de papier",
      "weight": 350,
      "printing": {
        "recto": "Quadrichromie (CMJN)",
        "verso": "Sans impression"
      },
      "finishRecto": "Pelliculage mat",
      "finishVerso": "Sans finition",
      "finish": "Pelliculage mat",
      "packaging": "Paquets de 25",
      "deliveryLocation": "France",
      "addressProvided": "Non fournie",
      "pages": 24,
      "suggestions": [
        "✦ Suggestion 1",
        "✦ Suggestion 2"
      ],
      "description": "Description détaillée",
      "deliveryInfo": "Délais de livraison"
    }
  ]
}

GAMMES (familles produit — décision Arnaud 2026-07-07, ADR-4.17) :
Pour CHAQUE produit, tu DOIS renseigner le champ "gamme" avec le slug EXACT de sa
famille. C'est la CATÉGORIE qui détermine ce qu'est le produit — JAMAIS le format
(une affiche A2 et une affiche A1 sont toutes deux "affiche"). Valeurs autorisées :
- "carterie" — cartes de visite, cartes de correspondance, cartes de vœux
- "flyer" — flyers, tracts, prospectus (feuilles plates non pliées)
- "affiche" — affiches, posters (tous formats A3→A0)
- "depliant" — dépliants, plaquettes pliées (2/3 volets)
- "brochure" — brochures, catalogues, livrets, magazines (multi-pages reliés)
- "etiquette" — étiquettes, stickers, autocollants, adhésifs (tous formats)
- "kakemono" — kakémonos, roll-ups
- "banderole" — banderoles, bâches, oriflammes
- "packaging" — packaging, emballage, boîtes, étuis, coffrets, pochettes (carton et matériaux d'emballage)
Choisis la gamme d'après la NATURE du produit (nom/usage), pas d'après ses dimensions.

RÈGLES GÉNÉRALES :
- Si l'utilisateur demande plusieurs produits hétérogènes (ex: "500 cartes ET 1000 flyers"), crée PLUSIEURS objets dans le tableau "products".
- Utilise les termes techniques français d'imprimerie.
- Sois précis sur les finitions (pelliculage, vernis, coins ronds, etc.).
- Chaque produit a des suggestions pertinentes.
- Pour les brochures, ajoute le champ "pages".
- Formats : A4 (210×297mm), A5 (148×210mm), A6 (105×148mm), A2 (420×594mm), A3 (297×420mm).
- Cartes de visite standard : 85×55mm.

RÈGLES POUR LES QUESTIONS PÉDAGOGIQUES / COMPARATIVES :
Détecte les questions du type :
- "C'est quoi la différence entre X et Y ?"
- "Quel est le meilleur papier pour... ?"
- "Comment choisir entre... ?"
- "Quelle différence entre pelliculage mat et brillant ?"
- "Couché ou non couché ?"
- "Explique-moi X"
- "Conseille-moi entre..."

Pour ces questions tu DOIS :
1. Remplir \`teachingNote\` avec une explication pédagogique en markdown :
   - Un paragraphe d'explication générale (2-4 phrases)
   - Une section "**En pratique**" avec 2-3 bullets ("- Couché : ..." / "- Non couché : ...")
   - Une section "**À retenir**" avec les points clés techniques
   - Ton professionnel mais accessible, tutoyer.
   - Pas de quantité ni prix dans le teachingNote, uniquement du contenu métier.
2. Générer 2 ou 3 produits comparatifs dans \`products\` pour illustrer la différence. Prends un produit typique (ex: carte de visite, flyer A5) et décline-le en 2-3 variantes qui illustrent la question posée. Chaque produit a une quantité raisonnable (500 ou 1000) pour montrer un prix comparable.

Pour les demandes de CALCUL DE PRIX classiques (ex: "500 flyers A5 130g"), LAISSE teachingNote vide ou absent.

RÈGLES POUR LES DEMANDES EN NOMBRE / CATALOGUE (CMS e-commerce) :
Si l'utilisateur demande plusieurs produits DIFFÉRENTS d'une même gamme ou famille (ex: "15 produits de la gamme carterie", "10 variantes de flyers", "8 modèles de cartes"), tu dois générer AUTANT D'ENTRÉES DISTINCTES dans le tableau "products" que demandé, chacune étant une VARIATION UNIQUE basée sur :
- La forme et découpe (coins carrés, coins ronds, forme spéciale, découpe créative)
- Le type d'impression (recto seul, recto/verso, recto quadri + verso noir, etc.)
- Le papier et le grammage (couché mat, couché brillant, offset, recyclé ; 250 / 300 / 350 / 400 g)
- Les finitions (sans finition, pelliculage mat, pelliculage brillant, pelliculage soft touch, vernis sélectif, dorure à chaud, gaufrage, marquage à chaud, tranche colorée)
- Les quantités (50, 100, 250, 500, 1000, 2500, 5000)
- Le format (standard 85×55, carré 55×55, mini 55×85, maxi 90×54, pliée/dépliante, etc.)

OBJECTIF : produire un catalogue riche et varié qui peut alimenter un CMS e-commerce. Chaque produit doit être UNIQUE par sa combinaison de caractéristiques.

NOMMAGE : chaque \`productName\` inclut la variation pour distinguer les produits (ex: "Carte de visite 85×55 pelliculage mat recto/verso", "Carte de visite coins ronds vernis sélectif", "Carte de visite carrée 55×55 couché brillant", etc.).

IMPORTANT : si l'utilisateur demande 15 produits, le tableau "products" DOIT contenir exactement 15 entrées distinctes. Tu peux en générer jusqu'à 30 sur une seule demande.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Story S-LLM-WRAPPER-ROBUSTNESS (AC4) : extraction user/tenant pour
    // tracking llm_usage_events (NFR23). Best-effort : null/null si JWT absent.
    const { userId, tenantId } = await extractAuthContext(req);

    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const userMessage = messages[messages.length - 1].content;

    // Helper : reponse mode demo (preserve API contract historique).
    const respondDemo = (reason: string) => {
      const demoConfigs = generateMultipleConfigs(userMessage);
      console.log(
        `✅ Mode démo (${reason}) : ${demoConfigs.length} produit(s) :`,
        demoConfigs.map((c: any) => c.productName),
      );
      return new Response(
        JSON.stringify({
          success: true,
          configs: demoConfigs,
          demoMode: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    };

    console.log("🤖 Appel à Claude via wrapper AnthropicClient...");
    let result;
    try {
      result = await anthropicCompleteStructured({
        model: MODEL,
        messages,
        system: SYSTEM_PROMPT,
        maxTokens: 8192,
        schema: ProductsResponseSchema,
        endpoint: "claude-proxy",
        // S-LLM-WRAPPER-ROBUSTNESS AC4 : attribution user/tenant extraite du JWT.
        // null/null si JWT absent (back-compat appels anonymes legacy).
        userId,
        tenantId,
        metadata: { message_count: messages.length },
      });
    } catch (err) {
      if (err instanceof AnthropicClientError) {
        // Cas 1 : aucune cle API → mode demo (preservation comportement S0).
        if (err.kind === "missing_api_key") {
          return respondDemo("aucune cle API configuree");
        }
        // Cas 2 : credits / billing / auth invalide → mode demo (helper canonique).
        if (isAnthropicBillingError(err)) {
          return respondDemo("credits insuffisants ou auth invalide");
        }
        // Cas 3 : reponse Claude non-conforme JSON ou hors schema → mode demo.
        // Preserve le comportement historique `parsedConfigs = generateMultipleConfigs(...)`.
        if (err.kind === "json_parse" || err.kind === "schema_validation") {
          console.error(`🔄 Reponse Claude non-conforme (${err.kind})`, err.details);
          return respondDemo(`reponse Claude non-conforme (${err.kind})`);
        }
        // Cas 4 : limite 25 parametres → 400 explicite (FR43).
        if (err.kind === "param_limit_exceeded") {
          return new Response(
            JSON.stringify({ error: err.message, kind: err.kind, details: err.details }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
        // Cas 5 : autre erreur API (5xx, timeout, etc.) → status d'origine + details.
        if (err.kind === "api_error") {
          const details = err.details as { status?: number; body?: string } | undefined;
          console.error("❌ Erreur API Claude:", details);
          return new Response(
            JSON.stringify({
              error: "Failed to get response from Claude API",
              details: details?.body ?? err.message,
            }),
            {
              status: details?.status ?? 502,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          );
        }
        // Filet de securite : kind inconnu → demo plutot que 500.
        console.error("❌ AnthropicClientError non geree:", err.kind, err.message);
        return respondDemo(`erreur ${err.kind}`);
      }
      // Erreur reseau / hors AnthropicClientError → demo (preservation comportement).
      console.error("❌ Erreur lors de l'appel wrapper, basculement en mode démo:", err);
      return respondDemo("exception inattendue");
    }

    console.log(
      `✅ Réponse Claude validée : ${result.data.products.length} produit(s)` +
        (result.data.teachingNote ? ` + teachingNote (${result.data.teachingNote.length} chars)` : ''),
    );

    return new Response(
      JSON.stringify({
        success: true,
        configs: result.data.products,
        teachingNote: result.data.teachingNote ?? null,
        content: (result.raw as { content?: unknown })?.content,
        rawResponse: result.text,
        demoMode: false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error("Error in claude-proxy endpoint:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});