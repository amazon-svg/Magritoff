import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
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
// HELPER FUNCTIONS (Must be defined before endpoints that use them)
// ============================================================================

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
      quantity: quantity,
      dimensions: { width: 85, height: 55, unit: "mm" },
      material: "Papier couché brillant",
      weight: 350,
      printing: { 
        recto: "Quadrichromie (CMJN)", 
        verso: messageLower.includes("recto verso") ? "Quadrichromie (CMJN)" : "Sans impression" 
      },
      finish: messageLower.includes("pelliculage") || messageLower.includes("mat") 
        ? "Pelliculage mat" 
        : messageLower.includes("brillant")
        ? "Pelliculage brillant"
        : "Sans finition",
      suggestions: [
        "Ajoutez un pelliculage mat pour un rendu premium (+12€)",
        "Coins ronds disponibles (+8€)",
        "Vernis sélectif sur le logo (+15€)"
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
      finish: messageLower.includes("brillant") ? "Vernis brillant" : "Sans finition",
      suggestions: [
        "Passez à 170g/m² pour plus de rigidité (+18€)",
        "Ajoutez un vernis UV sélectif (+25€)",
        "Format A4 pour plus d'impact visuel"
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
      quantity: quantity,
      dimensions: { width: 210, height: 297, unit: "mm" },
      material: "Couverture: Couché brillant 250g | Intérieur: Offset 135g",
      weight: 250,
      printing: { 
        recto: "Quadrichromie (CMJN)", 
        verso: "Quadrichromie (CMJN)" 
      },
      finish: "Piqûre à cheval (agrafage)",
      pages: pages,
      suggestions: [
        "Dos carré collé pour un rendu livre (+45€)",
        "Pelliculage soft-touch sur la couverture (+32€)",
        "Vernis UV sélectif sur le titre (+28€)"
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
      finish: messageLower.includes("brillant") ? "Vernis brillant" : "Sans finition",
      suggestions: [
        "Papier blueback 135g pour affichage extérieur (+35€)",
        "Pelliculage anti-UV pour durabilité extérieure (+42€)",
        "Format A1 pour plus de visibilité"
      ],
      description: `Affiches grand format ${isA0 ? "A0" : isA1 ? "A1" : "A2"} pour vos événements et communications. Impression haute définition en quadrichromie sur papier couché brillant ${messageLower.includes("épais") ? "200" : "170"}g/m². Rendu professionnel avec couleurs éclatantes.`,
      deliveryInfo: "Livraison soignée en tube carton rigide sous 5-7 jours"
    };
  }
  
  // Configuration par défaut
  return {
    productName: "Impression personnalisée",
    quantity: quantity,
    dimensions: { width: 210, height: 297, unit: "mm" },
    material: "Offset Blanc",
    weight: 135,
    printing: { 
      recto: "Quadrichromie (CMJN)", 
      verso: "Sans impression" 
    },
    finish: "Sans finition",
    suggestions: [
      "Précisez le type de produit souhaité (cartes, flyers, brochures...)",
      "Indiquez vos préférences de finition",
      "Mentionnez vos contraintes de livraison"
    ],
    description: `Configuration d'impression personnalisée. N'hésitez pas à préciser vos besoins : type de produit, format souhaité, finitions spéciales, délais de livraison...`,
    deliveryInfo: "Délais variables selon la configuration finale"
  };
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

// Health check endpoint
app.get("/make-server-e3db71a4/health", (c) => {
  return c.json({ status: "ok" });
});

// Test endpoint pour vérifier la connexion Claude
app.get("/make-server-e3db71a4/claude-test", async (c) => {
  try {
    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      checks: [],
      environment: {}
    };

    // Check 1: Vérifier toutes les variables d'environnement liées à Claude/Anthropic
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    const magrit3Key = Deno.env.get("Magrit3");
    
    diagnostics.environment = {
      ANTHROPIC_API_KEY: anthropicApiKey ? "✅ Configurée" : "❌ Non configurée",
      Magrit3: magrit3Key ? "✅ Configurée" : "❌ Non configurée"
    };

    // Utiliser la clé qui est disponible
    const apiKey = anthropicApiKey || magrit3Key;

    diagnostics.checks.push({
      name: "API Key présente",
      status: apiKey ? "✅ OK" : "❌ MANQUANTE",
      details: apiKey 
        ? `Clé trouvée (${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)})` 
        : "Aucune clé API Claude trouvée dans ANTHROPIC_API_KEY ou Magrit3"
    });

    if (!apiKey) {
      diagnostics.summary = "❌ Configuration incomplète - Clé API manquante";
      return c.json(diagnostics);
    }

    // Check 2: Tester l'appel à Claude
    try {
      console.log("🧪 Test de connexion à l'API Claude...");
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
          messages: [
            {
              role: "user",
              content: "Réponds simplement: OK",
            },
          ],
        }),
      });

      const responseText = await response.text();
      console.log("📝 Réponse Claude:", responseText.substring(0, 500));
      
      diagnostics.checks.push({
        name: "Test API Claude",
        status: response.ok ? "✅ SUCCÈS" : "❌ ÉCHEC",
        httpStatus: response.status,
        details: response.ok 
          ? "Claude a répondu avec succès" 
          : `Erreur ${response.status}: ${responseText.substring(0, 300)}`
      });

      if (response.ok) {
        try {
          const data = JSON.parse(responseText);
          diagnostics.claudeResponse = data.content?.[0]?.text || "Réponse reçue";
          diagnostics.summary = "✅ Connexion Claude fonctionnelle !";
          diagnostics.model = "claude-3-haiku-20240307";
        } catch (parseError) {
          diagnostics.summary = "⚠️ Réponse reçue mais format inattendu";
          diagnostics.rawResponse = responseText.substring(0, 500);
        }
      } else {
        diagnostics.summary = "❌ Erreur lors de l'appel à Claude";
        diagnostics.errorDetails = responseText;
        
        // Suggestions basées sur l'erreur
        if (responseText.includes("not_found_error")) {
          diagnostics.suggestion = "Le modèle claude-3-haiku-20240307 n'est pas disponible pour votre clé API. Vérifiez votre plan sur console.anthropic.com";
        } else if (responseText.includes("authentication") || responseText.includes("invalid")) {
          diagnostics.suggestion = "Clé API invalide. Vérifiez votre clé sur console.anthropic.com/settings/keys";
        } else if (responseText.includes("credit") || responseText.includes("billing")) {
          diagnostics.suggestion = "Crédits insuffisants. Ajoutez des crédits sur console.anthropic.com/settings/plans";
        } else if (responseText.includes("overloaded")) {
          diagnostics.suggestion = "Les serveurs Claude sont surchargés. Réessayez dans quelques instants.";
        }
      }

    } catch (error) {
      console.error("❌ Erreur lors du test Claude:", error);
      diagnostics.checks.push({
        name: "Test API Claude",
        status: "❌ ERREUR RÉSEAU",
        details: error instanceof Error ? error.message : String(error)
      });
      diagnostics.summary = "❌ Erreur réseau lors de la connexion à Claude";
    }

    return c.json(diagnostics);
  } catch (error) {
    console.error("❌ Erreur critique dans l'endpoint de test:", error);
    return c.json({
      summary: "❌ Erreur critique",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, 500);
  }
});

// Claude AI endpoint for print configuration
app.post("/make-server-e3db71a4/claude-request", async (c) => {
  try {
    const { userMessage } = await c.req.json();
    
    if (!userMessage) {
      return c.json({ error: "userMessage is required" }, 400);
    }

    // Vérifier les deux variables d'environnement possibles
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("Magrit3") || Deno.env.get("MAGRIT");
    
    if (!anthropicApiKey) {
      console.log("⚠️ Aucune clé API Claude trouvée - Mode démo activé");
      const demoConfig = generateDemoConfig(userMessage);
      
      // Format de réponse avec "Vous avez demandé"
      const formattedResponse = formatProductResponse(demoConfig);
      
      return c.json({
        success: true,
        content: [{ text: formattedResponse }],
        config: demoConfig,
        rawResponse: formattedResponse,
        demoMode: true,
        message: "Mode démo activé (clé API non configurée)",
      });
    }

    // System prompt pour structurer les réponses de Claude avec le format "Vous avez demandé"
    const systemPrompt = `Tu es un assistant spécialisé dans le web-to-print et l'imprimerie française (comme Vistaprint, Mixam, Exaprint).

IMPORTANT : Tu dois répondre UNIQUEMENT avec un objet JSON valide contenant un tableau "products". Pas de texte avant ou après.

Format de réponse OBLIGATOIRE :
{
  "products": [
    {
      "productName": "Nom du produit",
      "name": "Nom du produit",
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

RÈGLES :
- Si l'utilisateur demande plusieurs produits (ex: "500 cartes ET 1000 flyers"), crée PLUSIEURS objets dans le tableau "products"
- Utilise les termes techniques français d'imprimerie
- Sois précis sur les finitions (pelliculage, vernis, etc.)
- Chaque produit doit avoir des suggestions pertinentes
- Pour les brochures, ajoute le champ "pages"
- Pour les formats, utilise A4 (210×297mm), A5 (148×210mm), A2 (420×594mm), etc.
- Cartes de visite standard : 85×55mm`;

    // Appel à l'API Claude
    console.log("🤖 Appel à l'API Claude en cours...");
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 2048,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: userMessage,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        
        // Si erreur de crédits ou de clé, basculer en mode démo
        if (errorData.includes("credit") || errorData.includes("billing") || errorData.includes("authentication")) {
          console.log("💳 Crédits insuffisants détectés - Basculement automatique en mode démo");
          console.log("ℹ️  Pour activer Claude AI, ajoutez des crédits sur https://console.anthropic.com/settings/plans");
          const demoConfig = generateDemoConfig(userMessage);
          const formattedResponse = formatProductResponse(demoConfig);
          return c.json({
            success: true,
            content: [{ text: formattedResponse }],
            config: demoConfig,
            rawResponse: formattedResponse,
            demoMode: true,
            message: "Mode démo activé (crédits API insuffisants)",
          });
        }
        
        console.error("❌ Erreur API Claude:", errorData);
        return c.json({ error: "Failed to get response from Claude API", details: errorData }, response.status);
      }

      const data = await response.json();
      console.log("✅ Réponse Claude reçue avec succès");
      const assistantMessage = data.content[0].text;

      return c.json({
        success: true,
        content: data.content,
        rawResponse: assistantMessage,
        demoMode: false,
      });
      
    } catch (apiError) {
      console.error("❌ Erreur lors de l'appel API, basculement en mode démo:", apiError);
      const demoConfig = generateDemoConfig(userMessage);
      const formattedResponse = formatProductResponse(demoConfig);
      return c.json({
        success: true,
        content: [{ text: formattedResponse }],
        config: demoConfig,
        rawResponse: formattedResponse,
        demoMode: true,
        message: "Mode démo activé (erreur réseau)",
      });
    }

  } catch (error) {
    console.error("Error in claude-request endpoint:", error);
    return c.json({ 
      error: "Internal server error", 
      message: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// 🗄️ PERSISTANCE : Endpoint pour sauvegarder les produits en BDD
app.post("/make-server-e3db71a4/save-product", async (c) => {
  try {
    const { product } = await c.req.json();
    
    if (!product || !product.id) {
      return c.json({ error: "Product data with id is required" }, 400);
    }

    console.log(`💾 Sauvegarde du produit ${product.id} en BDD...`);
    
    // Sauvegarder dans le KV Store
    await kv.set(product.id, product);
    
    // Également sauvegarder dans une liste globale pour analytics
    const listKey = `products_list`;
    const existingList = await kv.get(listKey) || { products: [] };
    
    // Ajouter le produit à la liste (si pas déjà présent)
    const existingIndex = existingList.products.findIndex((p: any) => p.id === product.id);
    if (existingIndex >= 0) {
      existingList.products[existingIndex] = product;
    } else {
      existingList.products.push(product);
    }
    
    await kv.set(listKey, existingList);
    
    console.log(`✅ Produit ${product.id} sauvegardé avec succès`);
    
    return c.json({ 
      success: true, 
      message: "Product saved successfully",
      productId: product.id
    });
    
  } catch (error) {
    console.error("❌ Erreur lors de la sauvegarde du produit:", error);
    return c.json({ 
      error: "Failed to save product", 
      message: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// Endpoint proxy Claude pour ChatInterface (compatible avec le format attendu par le frontend)
app.post("/make-server-e3db71a4/claude-proxy", async (c) => {
  try {
    const { messages } = await c.req.json();
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return c.json({ error: "messages array is required" }, 400);
    }

    const userMessage = messages[messages.length - 1].content;
    
    // Vérifier les deux variables d'environnement possibles
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("Magrit3") || Deno.env.get("MAGRIT");
    
    if (!anthropicApiKey) {
      console.log("⚠️ Aucune clé API Claude trouvée - Mode démo activé");
      const demoConfig = generateDemoConfig(userMessage);
      const formattedResponse = formatProductResponse(demoConfig);
      
      return c.json({
        success: true,
        content: [{ text: formattedResponse }],
        config: demoConfig,
        rawResponse: formattedResponse,
        demoMode: true,
      });
    }

    // NOUVEAU SYSTEM PROMPT EXPERT EN IMPRIMERIE
    const systemPrompt = `Tu es un EXPERT en imprimerie professionnelle et web-to-print avec 20 ans d'expérience.

🚨 RÈGLE ABSOLUE #1 : FORMAT OBLIGATOIRE 🚨

CHAQUE produit DOIT commencer par une ligne en gras avec QUANTITÉ + NOM :
**[QUANTITÉ] [NOM DU PRODUIT]**

❌ INTERDIT :
- ## Dimensions A0
- ## Affiches A0
- Titre sans quantité

✅ CORRECT :
- **200 affiches A0**
- **1000 flyers A5**
- **500 cartes de visite**

🎁 KITS ET ENSEMBLES (TRÈS IMPORTANT !) :

Quand l'utilisateur demande un "KIT", "ENSEMBLE", "PACK" ou "CAMPAGNE" (ex: "kit campagne électorale", "pack communication", "ensemble événementiel"), tu DOIS :

1. **DÉCOMPOSER** le kit en produits individuels
2. **CRÉER UNE SECTION SÉPARÉE** pour chaque produit avec **[QUANTITÉ] [NOM]**
3. **NE JAMAIS** regrouper plusieurs produits sous un seul titre

❌ MAUVAIS (INTERDIT) :
**Kit campagne électorale**
- Affiches A2
- Flyers A5
- Cartes de visite

✅ CORRECT :
**500 affiches A2 campagne électorale**
- **Format** : A2 (420 × 594 mm)
- **Support** : Papier couché brillant
- **Grammage** : 170g/m²
- **Finition** : Sans finition
- **Conseils** :
  • Pelliculage anti-UV pour affichage extérieur (+30€)
  • Format A1 pour plus de visibilité (+40€)
  • Grammage 250g/m² pour résistance au vent (+25%)

**2000 flyers A5 recto verso campagne électorale**
- **Format** : A5 (148 × 210 mm)
- **Support** : Papier couché mat
- **Grammage** : 170g/m²
- **Finition** : Pelliculage mat recto
- **Conseils** :
  • Grammage 250g/m² pour distribution intensive (+20%)
  • Pelliculage mat/brillant recto/verso (+35€)
  • Format A4 pour plus d'informations

**1000 cartes de visite candidat**
- **Format** : 85 × 55 mm (format standard)
- **Support** : Papier couché brillant
- **Grammage** : 350g/m²
- **Finition** : Pelliculage mat recto/verso
- **Conseils** :
  • Coins ronds pour un look moderne (+8€)
  • Vernis sélectif sur le logo (+15€)
  • Dorure à chaud pour prestige (+35€)

📋 STRUCTURE COMPLÈTE POUR CHAQUE PRODUIT (6 CHAMPS OBLIGATOIRES) :

**[QUANTITÉ] [NOM DU PRODUIT]**
- **Format** : [dimensions précises] (ex: A5 (148 × 210 mm), 85×55mm)
- **Support** : [type de support] (ex: Papier couché mat, Textile coton, Vinyle adhésif)
- **Grammage** : [grammage]g/m² (ex: 170g/m², 350g/m²)
- **Finition** : [type] (ex: Pelliculage mat, Vernis UV, Découpe forme, Sans finition)
- **Conseils** : 
  • [suggestion 1 avec prix]
  • [suggestion 2 avec prix]
  • [suggestion 3 avec prix]

🎯 EXEMPLES PARFAITS :

Demande utilisateur : "kit campagne électorale"
TA RÉPONSE (3 PRODUITS SÉPARÉS) :

**500 affiches A2 campagne électorale**
- **Format** : A2 (420 × 594 mm)
- **Support** : Papier couché brillant
- **Grammage** : 170g/m²
- **Finition** : Sans finition
- **Conseils** :
  • Pelliculage anti-UV pour affichage extérieur (+30€)
  • Format A1 pour plus de visibilité (+40€)
  • Grammage 250g/m² pour résistance au vent (+25%)

**2000 flyers A5 recto verso campagne électorale**
- **Format** : A5 (148 × 210 mm)
- **Support** : Papier couché mat
- **Grammage** : 170g/m²
- **Finition** : Pelliculage mat recto
- **Conseils** :
  • Grammage 250g/m² pour distribution intensive (+20%)
  • Pelliculage mat/brillant recto/verso (+35€)
  • Format A4 pour plus d'informations

**1000 cartes de visite candidat**
- **Format** : 85 × 55 mm (format standard)
- **Support** : Papier couché brillant
- **Grammage** : 350g/m²
- **Finition** : Pelliculage mat recto/verso
- **Conseils** :
  • Coins ronds pour un look moderne (+8€)
  • Vernis sélectif sur le logo (+15€)
  • Dorure à chaud pour prestige (+35€)

---

Demande utilisateur : "200 affiches A0"
TA RÉPONSE :

**200 affiches A0**
- **Format** : A0 (841 × 1189 mm)
- **Support** : Papier couché brillant
- **Grammage** : 170g/m²
- **Finition** : Sans finition
- **Conseils** :
  • Papier blueback 135g pour affichage extérieur (+35€)
  • Pelliculage anti-UV pour durabilité extérieure (+42€)
  • Format A1 si vous avez des contraintes d'espace

---

Demande utilisateur : "1000 flyers A5 recto verso et 500 cartes"
TA RÉPONSE :

**1000 flyers A5 recto verso**
- **Format** : A5 (148 × 210 mm)
- **Support** : Papier couché mat
- **Grammage** : 170g/m²
- **Finition** : Pelliculage mat recto
- **Conseils** :
  • Passez à 170g/m² pour plus de rigidité (+18€)
  • Ajoutez un vernis UV sélectif (+25€)
  • Format A4 pour plus d'impact visuel

**500 cartes de visite**
- **Format** : 85 × 55 mm (format standard)
- **Support** : Papier couché brillant
- **Grammage** : 350g/m²
- **Finition** : Pelliculage mat recto/verso
- **Conseils** :
  • Coins ronds disponibles (+8€)
  • Vernis sélectif sur le logo (+15€)
  • Dorure à chaud pour un effet premium (+35€)

---

Demande utilisateur : "250 affiches A2 brillant et Brochure 24 pages format A4"
TA RÉPONSE (ATTENTION : 2 PRODUITS SÉPARÉS !) :

**250 affiches A2 brillant**
- **Format** : A2 (420 × 594 mm)
- **Support** : Papier couché brillant
- **Grammage** : 170g/m²
- **Finition** : Vernis brillant
- **Conseils** :
  • Papier 200g/m² pour affichage extérieur (+22€)
  • Pelliculage brillant pour protection maximale (+28€)
  • Format A1 pour plus de visibilité

**1 brochure 24 pages A4**
- **Format** : A4 (210 × 297 mm) - 24 pages
- **Support** : Couverture papier couché brillant 250g | Intérieur offset 135g
- **Grammage** : Couverture 250g/m² | Intérieur 135g/m²
- **Finition** : Piqûre à cheval (agrafage central)
- **Conseils** :
  • Dos carré collé pour un rendu livre (+45€)
  • Pelliculage soft-touch sur la couverture (+32€)
  • Vernis UV sélectif sur le titre (+28€)

🚨 TRÈS IMPORTANT : 
- Quand l'utilisateur demande PLUSIEURS produits (ex: "X et Y") ou un KIT/ENSEMBLE, tu DOIS créer UNE SECTION **QUANTITÉ NOM** EN GRAS POUR CHAQUE PRODUIT ! Ne les groupe JAMAIS dans une seule section !
- TOUJOURS respecter les 6 champs : Format, Support, Grammage, Finition, Conseils
- Les conseils doivent TOUJOURS inclure un prix estimé entre parenthèses

🎓 EXPERTISE TECHNIQUE :

**Formats standards** : 
- A0 (841×1189mm), A1 (594×841mm), A2 (420×594mm)
- A3 (297×420mm), A4 (210×297mm), A5 (148×210mm), A6 (105×148mm)
- Cartes de visite : 85×54mm ou 85×55mm
- Flyers : A5, A6, DL (99×210mm)

**Supports courants** :
- **Papier** : Offset, Couché mat, Couché brillant, Recyclé, Kraft
- **Textile** : Coton, Polyester, Textile technique
- **Vinyle** : Adhésif, Magnétique
- **Supports rigides** : PVC, Dibond, Forex
- **Autres** : Bâche, Toile canvas

**Grammages par type** :
- Flyers/dépliants : 135-170g/m²
- Cartes de visite : 300-350g/m²
- Affiches : 170-200g/m²
- Brochures couverture : 250-300g/m²
- Brochures intérieur : 90-135g/m²

**Finitions populaires** :
- Pelliculage mat : haut de gamme, anti-reflet
- Pelliculage brillant : couleurs vives, protection
- Vernis UV : effet premium localisé
- Découpe forme : contours personnalisés
- Dorure à chaud : finition luxe
- Gaufrage : relief élégant
- Sans finition : économique

🎨 TON :
- Professionnel mais accessible
- Pédagogue (explique les termes si nécessaire)
- Proactif (pose des questions pour affiner si besoin)
- Précis sur les conseils avec prix

🚨 RAPPEL FINAL 🚨
TOUJOURS commencer chaque produit par **[QUANTITÉ] [NOM]** en gras !
TOUJOURS inclure les 6 champs obligatoires : Format, Support, Grammage, Finition, Conseils
PAS de titres avec ## pour les produits !
Pour les KITS : DÉCOMPOSER en sections séparées, une par produit !
Réponds UNIQUEMENT en français.`;

    // Appel à l'API Claude
    console.log("🤖 Appel à l'API Claude via proxy...");
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",  // Utiliser le meilleur modèle
          max_tokens: 4096,
          system: systemPrompt,
          messages: messages,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        
        // Si erreur de crédits ou de clé, basculer en mode démo
        if (errorData.includes("credit") || errorData.includes("billing") || errorData.includes("authentication")) {
          console.log("💳 Crédits insuffisants - Mode démo activé");
          const demoConfig = generateDemoConfig(userMessage);
          const formattedResponse = formatProductResponse(demoConfig);
          return c.json({
            success: true,
            content: [{ text: formattedResponse }],
            config: demoConfig,
            rawResponse: formattedResponse,
            demoMode: true,
          });
        }
        
        console.error("❌ Erreur API Claude:", errorData);
        return c.json({ error: "Failed to get response from Claude API", details: errorData }, response.status);
      }

      const data = await response.json();
      console.log("✅ Réponse Claude reçue avec succès via proxy");

      // Retourner directement la rponse brute de Claude (format Anthropic standard)
      // Le parser Markdown du frontend va extraire les produits
      return c.json({
        model: data.model,
        id: data.id,
        type: data.type,
        role: data.role,
        content: data.content,
        stop_reason: data.stop_reason,
        stop_sequence: data.stop_sequence,
        usage: data.usage
      });
      
    } catch (apiError) {
      console.error("❌ Erreur lors de l'appel API, basculement en mode démo:", apiError);
      const demoConfig = generateDemoConfig(userMessage);
      const formattedResponse = formatProductResponse(demoConfig);
      return c.json({
        success: true,
        content: [{ text: formattedResponse }],
        config: demoConfig,
        rawResponse: formattedResponse,
        demoMode: true,
      });
    }

  } catch (error) {
    console.error("Error in claude-proxy endpoint:", error);
    return c.json({ 
      error: "Internal server error", 
      message: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

Deno.serve(app.fetch);