📐 Page principale — Sections à mettre à jour
Remplace les sections suivantes dans https://www.notion.so/326d0131973c8124a698c234942b5579

🔁 Remplacer la section "2️⃣ Interface Conversationnelle (ChatInterface)"
## 2️⃣ Interface Conversationnelle (ChatInterface)
**Fichier** : `/src/app/components/ChatInterface.tsx`

### Rôle
Composant central pour l'interaction utilisateur ↔ IA Claude

### Fonctionnalités principales
✅ **Chat conversationnel** avec Claude (messages bidirectionnels)
✅ **Gestion de l'historique** (localStorage)
   - Sauvegarde automatique des conversations
   - Restauration des sessions précédentes
   - Suppression sélective
✅ **Mode démo** (fallback si pas de clé API)
✅ **Affichage dynamique des ProductCards** issues de Claude
✅ **Intégration du panier** (CartButton)

### États principaux
```typescript
messages: Array<{role: string, content: string}> // Historique du chat
products: any[]                                  // Produits générés par Claude
conversationHistory: ConversationHistory[]        // Multi-sessions
isDemoMode: boolean                              // Mode demo si Claude indisponible
currentConversationId: string | null             // Conversation active
Méthodes clés
	•	saveCurrentConversation() : Sauvegarde dans localStorage
	•	loadConversation() : Restaure une session passée
	•	deleteConversation() : Supprime de l'historique
	•	startNewConversation() : Réinitialise l'interface
⭐ parseConfigsToProducts() — Traduction JSON Clariprint → ProductCard
Fonction critique qui mappe le JSON double-couche retourné par Claude/serveur vers les objets affichés dans les ProductCards :
const parseConfigsToProducts = (configs: any[]): any[] => {
  return configs.map((config, index) => {
    const d = config.display || {};   // Champs affichage
    const c = config.clariprint || {}; // Champs API Clariprint

    return {
      id: `product-${Date.now()}-${index}`,
      name: d.productName || c.reference,
      quantity: d.quantity || c.quantity,
      format: d.format || `${c.width} × ${c.height} cm`,
      material: d.support,
      weight: d.grammage,
      printing: { recto: d.impression?.recto, verso: d.impression?.verso },
      finish: d.finitionRecto,
      finishRecto: d.finitionRecto,
      finishVerso: d.finitionVerso,
      suggestions: d.suggestions,
      pages: c.pages,
      clariprintData: c, // Données brutes conservées pour l'API Clariprint
    };
  });
};

---

### 🔁 Remplacer la section "3️⃣ Affichage Produits (ProductCard)"

```markdown
## 3️⃣ Affichage Produits (ProductCard)
**Fichier** : `/src/app/components/ProductCard.tsx`

### Structure en 4 onglets
**1. Fiche Produit**
- Informations techniques (Format, Papier, Grammage, Impression, Finition)
- Type Clariprint (`kind`)
- Détail JSON brut Clariprint (accordéon masqué)

**2. Prix et devis**
- Prix estimé HT (fallback `estimatePrice()`)
- **Section Clariprint** : bouton "Obtenir le prix réel Clariprint"
- Détail des coûts (Papier, Impression, Calage, Conditionnement, Livraison)
- Délai, Poids, Imprimeur sélectionné
- Total TTC cliquable → QuoteModal

**3. Mockup**
- Aperçu visuel (placeholder actuel)

**4. Formulaire éditable**
- Modification en temps réel des specs
- Mise à jour automatique du prix
- Callback `onProductUpdate`

### Données affichées (depuis `display` de Claude)
| Champ | Source |
|---|---|
| Quantité | `display.quantity` |
| Nom produit | `display.productName` |
| Format | `display.format` |
| Support | `display.support` |
| Grammage | `display.grammage` |
| Impression R/V | `display.impression.recto/verso` |
| Finition R/V | `display.finitionRecto/Verso` |
| Suggestions | `display.suggestions[]` |

### Interface ClariprintQuoteResult
```typescript
interface ClariprintQuoteResult {
  success: boolean;
  credentialsMissing?: boolean; // true si CLARIPRINT_LOGIN/PASSWORD absents
  priceHT?: number;             // Prix HT simplifié (field "response" Clariprint)
  costs?: {
    paper?: number;
    print?: number;
    makeready?: number;
    packaging?: number;
    delivery?: number;
    total?: number;
  };
  delais?: number;       // Délai en jours
  weight?: number;       // Poids en kg
  fournisseur?: string;  // Imprimeur sélectionné
}
Système de prix (priorité)
	1	Clariprint réel (si credentials configurés et appel réussi) ✅
	2	estimatePrice() (fallback local, toujours disponible)
	•	Détection type produit par nom
	•	Prix de base × quantité
	•	Coefficients grammage (>300g : +30%, >200g : +15%)
	•	Impression verso (+40%)
	•	Finitions pelliculage (+5%/unité)
	•	Dégressif quantité (>5000 : -30%, >2000 : -20%, >1000 : -10%)
États du bouton Clariprint
	•	Initial : Bouton "Obtenir le prix réel Clariprint" (indigo)
	•	Loading : Spinner "Calcul en cours auprès des imprimeurs..."
	•	Credentials manquants : Alerte amber avec instructions
	•	Succès : Détail des coûts + Total TTC vert + infos délai/poids/imprimeur
	•	Erreur : Message rouge avec bouton "Réessayer"
---

### 🔁 Remplacer la section "5️⃣ Backend - Serveur Hono"

```markdown
## 5️⃣ Backend - Serveur Hono
**Fichier** : `/supabase/functions/server/index.tsx`

### Configuration serveur
- **Runtime** : Deno
- **Framework** : Hono
- **CORS** : Ouvert (`origin: "*"`)
- **Logging** : Console.log via middleware
- **Préfixe routes** : `/make-server-e3db71a4/`

### Endpoints API
| Route | Méthode | Description |
|---|---|---|
| `/health` | GET | Health check |
| `/claude-test` | GET | Diagnostic connexion Claude + Clariprint |
| `/claude-proxy` | POST | Proxy principal (JSON double-couche) |
| `/clariprint-quote` | POST | Demande de prix réel auprès de Clariprint |
| `/save-product` | POST | Persistance produit en KV Store |

### Modèle Claude utilisé
claude-sonnet-4-20250514
(max_tokens: 4096)

### Fonctions utilitaires critiques
**`generateReadableSummary(configs)`**
Génère le texte Markdown lisible affiché dans le fil de conversation à partir des configs double-couche :
```javascript
"**500 Flyers A5**\n- **Format** : A5 (148 × 210 mm)\n- **Support** : Papier couché brillant\n..."
generateDemoConfigs(userMessage) ⭐ Génère des configs intelligentes en mode démo (même format double-couche que Claude) :
	•	Détection par mots-clés : cartes de visite, flyer, brochure, affiche, dépliant
	•	Extraction de la quantité par regex
	•	Retourne Array<{clariprint: {...}, display: {...}}>
	•	Types couverts : leaflet, folded, book
Format JSON obligatoire de Claude (double-couche)
{
  "products": [
    {
      "clariprint": {
        "reference": "Flyers A5",
        "kind": "leaflet",
        "quantity": 1000,
        "width": "14.8",
        "height": "21.0",
        "with_bleeds": "1",
        "front_colors": ["4-color"],
        "back_colors": ["4-color"],
        "papers": {
          "custom": { "quality": "Couché Brillant PEFC", "weight": "170" }
        },
        "finishing_front": "PELLIC_ACETATE_MAT",
        "finishing_back": ""
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
Règles critiques du prompt :
	•	clariprint.quantity → entier (sans guillemets)
	•	display.grammage → entier (sans guillemets, sans "g/m²")
	•	back_colors → [] si recto seul, ["4-color"] si recto-verso
	•	Kit/ensemble → plusieurs objets dans products[]
	•	Toujours 3 suggestions minimum avec prix indicatifs
	•	Suggestions commencent par "•"
	•	Réponse uniquement JSON valide (zéro texte hors JSON)
Endpoint /clariprint-quote
Entrée :
{ "clariprint": { ...clariprintData } }
Sortie (succès) :
{
  "success": true,
  "priceHT": 178,
  "costs": { "paper": 8.10, "print": 129.49, "makeready": 37.36, "packaging": 4.0, "delivery": 0.0, "total": 178.95 },
  "delais": 5,
  "weight": 7.37,
  "fournisseur": "Nom imprimeur",
  "processDuration": 30,
  "allResults": [...],
  "faultyProcess": {}
}
Sortie (credentials manquants) :
{ "success": false, "credentialsMissing": true, "message": "Configurez CLARIPRINT_LOGIN..." }
Gestion erreurs API Claude
	1	Pas de clé API → Mode démo automatique
	2	Crédits insuffisants / clé invalide → Basculement mode démo
	3	Erreur réseau → Fallback generateDemoConfigs()
	4	JSON invalide → Fallback generateDemoConfigs()
---

### 🔁 Remplacer la section "6️⃣ Proxy Claude Dédié"

```markdown
## 6️⃣ Proxy Claude — Fichier legacy
**Fichier** : `/supabase/functions/claude-proxy/index.tsx`

>
 ⚠️ **Ce fichier est l'ancienne implémentation** (format JSON mono-couche, sans double-couche clariprint/display). Il n'est plus utilisé par le frontend.

**Le proxy actif** est l'endpoint `/make-server-e3db71a4/claude-proxy` dans le **serveur principal** (`/supabase/functions/server/index.tsx`).

### Flow de données actuel (serveur principal)
ChatInterface ↓ POST {messages: [...]} /make-server-e3db71a4/claude-proxy ↓ API Claude (claude-sonnet-4-20250514) ↓ Parse JSON double-couche {products: [{clariprint, display}]} ↓ (si échec JSON) generateDemoConfigs() [même format double-couche] ↓ generateReadableSummary() → texte chat lisible ↓ Return {content: [{text: "...résumé..."}], configs: [...], demoMode: false}


🔁 Remplacer la section "🔄 Flux de Données Principal"
# 🔄 Flux de Données Principal
## Scénario : Demande utilisateur → ProductCards → Prix Clariprint

	1	👤 Utilisateur tape "500 cartes + 1000 flyers" dans ChatInterface ↓
	2	📤 Envoi POST à /make-server-e3db71a4/claude-proxy Body: {messages: [{role: "user", content: "500 cartes + 1000 flyers"}]} ↓
	3	🤖 Serveur Hono appelle API Claude Model: claude-sonnet-4-20250514 System: [Prompt expert imprimerie — format JSON double-couche strict] ↓
	4	🧠 Claude génère JSON double-couche { "products": [ { "clariprint": { "kind": "leaflet", "quantity": 500, "width": "8.5", ... }, "display": { "productName": "Cartes de visite", "quantity": 500, ... } }, { "clariprint": { "kind": "leaflet", "quantity": 1000, "width": "14.8", ... }, "display": { "productName": "Flyers A5", "quantity": 1000, ... } } ] } ↓
	5	✅ Parsing + Validation serveur - JSON.parse() direct - Fallback generateDemoConfigs() si JSON invalide - generateReadableSummary() → texte Markdown pour le chat ↓
	6	📥 Retour au frontend {content: [{text: "500 Cartes de visite\n..."}], configs: [...], demoMode: false} ↓
	7	🔄 ChatInterface traite la réponse - setMessages([...messages, {role:"assistant", content: résumé lisible}]) - parseConfigsToProducts(data.configs) → objets ProductCard - setProducts([...prev, ...parsedProducts]) - saveCurrentConversation() ↓
	8	🎨 Rendu de 2 ProductCard (1 par produit) - Données display → affichage texte - clariprintData conservé pour l'API - Prix estimé via estimatePrice() ↓
	9	💰 Utilisateur ouvre onglet "Prix & Devis" → Bouton "Obtenir le prix réel Clariprint" ↓
	10	🖨️ POST /make-server-e3db71a4/clariprint-quote Body: {clariprint: clariprintData} → Appel API Clariprint (si credentials configurés) → Affichage : prix HT, détail coûts, délai, poids, imprimeur ↓
	11	💰 Clic "Total TTC" → QuoteModal → Imprimer (window.print()) OU Ajouter au panier (CartContext)


🔁 Remplacer la section "🔐 Environnement & Secrets"
# 🔐 Environnement & Secrets
## Secrets Supabase configurés
✅ `SUPABASE_URL`
✅ `SUPABASE_ANON_KEY`
✅ `SUPABASE_SERVICE_ROLE_KEY`
✅ `SUPABASE_DB_URL`
✅ `MAGRIT` (clé API Claude)
✅ `CLARIPRINT_HOST`
✅ `CLARIPRINT_LOGIN`
✅ `CLARIPRINT_PASSWORD`

## Variables d'environnement lues côté serveur
- **Claude** : `ANTHROPIC_API_KEY` || `Magrit3` || `MAGRIT`
- **Clariprint** : `CLARIPRINT_HOST` || `"http://lrdp.clariprint.com"` (défaut)

```typescript
// Lecture clé Claude (3 fallbacks)
const apiKey = Deno.env.get("ANTHROPIC_API_KEY")
            || Deno.env.get("Magrit3")
            || Deno.env.get("MAGRIT");

// Lecture credentials Clariprint
const host     = Deno.env.get("CLARIPRINT_HOST") || "http://lrdp.clariprint.com";
const login    = Deno.env.get("CLARIPRINT_LOGIN");
const password = Deno.env.get("CLARIPRINT_PASSWORD");

Si CLARIPRINT_LOGIN ou CLARIPRINT_PASSWORD sont absents, le bouton "Obtenir le prix réel Clariprint" retourne une réponse gracieuse (credentialsMissing: true) sans bloquer l'application.
---

## 🖨️ Sous-page Clariprint — Section à mettre à jour

Dans https://www.notion.so/326d0131973c81fbbc19d6081cbc5a12, **remplacer la section "🔗 Intégration Magrit → Clariprint" / "Endpoint à créer"** par :

```markdown
## Endpoint implémenté dans Magrit
**Fichier** : `/supabase/functions/server/index.tsx`

```typescript
// Route Hono — IMPLÉMENTÉE ✅
POST /make-server-e3db71a4/clariprint-quote

// Entrée
Body: { "clariprint": { ...clariprintData } }

// Sortie succès
{
  "success": true,
  "priceHT": number,      // field "response" Clariprint (prix HT simplifié)
  "costs": {
    "paper": number,
    "print": number,
    "makeready": number,
    "packaging": number,
    "delivery": number,
    "total": number
  },
  "delais": number,       // délai livraison en jours
  "weight": number,       // poids en kg
  "fournisseur": string,  // nom imprimeur sélectionné
  "processDuration": number, // durée fab en 1/10e d'heure
  "allResults": [...],    // toutes les gammes (all_process)
  "faultyProcess": {}     // gammes en erreur
}

// Sortie si credentials manquants
{ "success": false, "credentialsMissing": true, "message": "..." }
Intégration dans ProductCard
L'appel est déclenché depuis l'onglet "Prix & Devis" de ProductCard.tsx :
	•	Les données clariprintData sont stockées dans chaque produit par parseConfigsToProducts()
	•	Le bouton "Obtenir le prix réel Clariprint" appelle fetchClariprintQuote()
	•	Le prix affiché bascule automatiquement sur le prix Clariprint si l'appel réussit
	•	Fallback : estimatePrice() si Clariprint indisponible
Variables d'environnement configurées ✅
CLARIPRINT_HOST=http://lrdp.clariprint.com    # configuré dans Supabase
CLARIPRINT_LOGIN=***                           # configuré dans Supabase
CLARIPRINT_PASSWORD=***                        # configuré dans Supabase

---

**C'est tout.** Ces 6 blocs pour la page principale + 1 bloc pour la sous-page suffisent à mettre la doc parfaitement à jour avec l'état réel du code au 17 mars 2026. Les autres sections (Base de données, Composants UI, Dépendances, Structure des fichiers) sont toujours exactes.
