import { corsHeaders } from "../_shared/cors.ts";

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

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const userMessage = messages[messages.length - 1].content;
    
    // Vérifier les clés API disponibles
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("Magrit3") || Deno.env.get("MAGRIT");
    
    if (!anthropicApiKey) {
      console.log("⚠️ Aucune clé API Claude trouvée - Mode démo activé");
      const demoConfigs = generateMultipleConfigs(userMessage);
      console.log(`✅ Mode démo : ${demoConfigs.length} produit(s) généré(s) :`, demoConfigs.map(c => c.productName));
      
      return new Response(
        JSON.stringify({
          success: true,
          configs: demoConfigs, // Retourner un TABLEAU de configs
          demoMode: true,
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // System prompt pour structurer les réponses de Claude
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
          model: "claude-3-haiku-20240307",
          max_tokens: 2048,
          system: systemPrompt,
          messages: messages,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        
        // Si erreur de crédits ou de clé, basculer en mode démo
        if (errorData.includes("credit") || errorData.includes("billing") || errorData.includes("authentication")) {
          console.log("💳 Crédits insuffisants - Mode démo activé");
          const demoConfigs = generateMultipleConfigs(userMessage);
          return new Response(
            JSON.stringify({
              success: true,
              configs: demoConfigs,
              demoMode: true,
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
        
        console.error("❌ Erreur API Claude:", errorData);
        return new Response(
          JSON.stringify({ error: "Failed to get response from Claude API", details: errorData }),
          { 
            status: response.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      const data = await response.json();
      console.log("✅ Réponse Claude reçue avec succès via proxy");
      
      // Parser la réponse JSON de Claude pour extraire les produits
      const responseText = data.content[0].text;
      console.log("📝 Réponse brute de Claude:", responseText);
      
      let parsedConfigs = [];
      try {
        // D'abord essayer de parser directement comme JSON
        try {
          const directJson = JSON.parse(responseText);
          if (directJson.products && Array.isArray(directJson.products)) {
            parsedConfigs = directJson.products;
            console.log(`✅ JSON parsé directement : ${parsedConfigs.length} produit(s)`);
          }
        } catch (directParseError) {
          console.log("⚠️ Parsing JSON direct échoué, tentative d'extraction via regex...");
          
          // Sinon, extraire le JSON de la réponse (au cas où Claude ajoute du texte avant/après)
          // Rechercher le pattern { ... "products": [...] ... }
          const jsonMatch = responseText.match(/\{[\s\S]*?"products"[\s\S]*?\[[^\]]*\][\s\S]*?\}/);
          if (jsonMatch) {
            console.log("📄 JSON extrait via regex:", jsonMatch[0].substring(0, 200));
            const jsonResponse = JSON.parse(jsonMatch[0]);
            parsedConfigs = jsonResponse.products || [];
            console.log(`✅ ${parsedConfigs.length} produit(s) parsé(s) depuis la réponse Claude via regex`);
          } else {
            console.log("⚠️ Pas de JSON trouvé dans la réponse, fallback au mode démo");
            parsedConfigs = generateMultipleConfigs(userMessage);
          }
        }
      } catch (parseError) {
        console.error("❌ Erreur de parsing JSON:", parseError);
        console.log("🔄 Fallback au parsing intelligent local");
        parsedConfigs = generateMultipleConfigs(userMessage);
      }

      console.log("🎯 Configs finales à envoyer:", parsedConfigs.map(c => `${c.productName} (${c.quantity})`));

      return new Response(
        JSON.stringify({
          success: true,
          configs: parsedConfigs, // Retourner le tableau de configs
          content: data.content,
          rawResponse: responseText,
          demoMode: false,
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
      
    } catch (apiError) {
      console.error("❌ Erreur lors de l'appel API, basculement en mode démo:", apiError);
      const demoConfigs = generateMultipleConfigs(userMessage);
      return new Response(
        JSON.stringify({
          success: true,
          configs: demoConfigs,
          demoMode: true,
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

  } catch (error) {
    console.error("Error in claude-proxy endpoint:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error", 
        message: error instanceof Error ? error.message : String(error) 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});