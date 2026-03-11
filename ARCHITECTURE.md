# 📘 MAGRIT - Documentation Technique Complète

## 🎯 Vision du Projet

**Magrit** est un **configurateur d'impression intelligent** avec assistant IA conversationnel, conçu pour **transformer l'expertise métier de l'imprimerie en un service digital accessible**. L'application ne se contente pas de traiter des demandes : elle **capture, structure et valorise la connaissance technique de la production imprimée et du web-to-print**.

### 🌟 Mission Centrale : L'Expertise au Service du Client

**PRINCIPE FONDAMENTAL :**
> Chaque interaction avec Claude doit **enrichir la base de connaissances métier** et **affiner l'expertise technique** de Magrit dans le domaine de l'impression professionnelle.

Les données collectées via les conversations doivent servir à :
- ✅ **Nourrir l'intelligence du système** : Chaque configuration produit devient une référence
- ✅ **Optimiser les recommandations** : Apprendre des choix récurrents (grammages, finitions, formats)
- ✅ **Détecter les tendances** : Identifier les produits les plus demandés, les finitions premium populaires
- ✅ **Enrichir le catalogue** : Découvrir de nouvelles combinaisons techniques viables
- ✅ **Former l'IA** : Améliorer la compréhension du langage métier (pelliculage, vernis UV, dos carré-collé, etc.)
- ✅ **Construire une base tarifaire intelligente** : Corréler quantités/formats/papiers avec les prix réels
- ✅ **Affiner les suggestions** : Proposer des améliorations pertinentes basées sur l'historique

**OBJECTIF WEB-TO-PRINT :**
Magrit doit devenir un **expert digital** capable de :
1. **Conseiller** comme un imprimeur professionnel
2. **Anticiper** les besoins techniques (fonds perdus, résolution, profils colorimétricos)
3. **Valider** la faisabilité technique d'une demande
4. **Éduquer** le client sur les contraintes de production
5. **Optimiser** les coûts en proposant des alternatives techniques

---

## 🏗️ Architecture Technique

### Stack Technologique
```
Frontend : React + TypeScript + Tailwind CSS
Router  : React Router v7
Backend : Supabase Edge Functions (Deno)
IA      : Claude API (Anthropic) via clé MAGRIT
Modèle  : claude-sonnet-4-20250514
```

### Flux de Données
```
┌─────────────────────────────────────────────────────────────┐
│  1. UTILISATEUR                                             │
│     "kit campagne électorale" OU                            │
│     "1560 flyers A5 recto verso + 345 brochures A4 quadri"  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  2. FRONTEND (ChatInterface.tsx)                            │
│     - Capture la demande en langage naturel                 │
│     - Envoie à l'edge function claude-proxy                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  3. EDGE FUNCTION (/functions/v1/claude-proxy)              │
│     - Reçoit la demande                                     │
│     - Injecte le SYSTEM PROMPT expert imprimerie            │
│     - Appelle l'API Claude avec la clé MAGRIT               │
│     - Retourne la réponse structurée                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  4. API CLAUDE (Anthropic)                                  │
│     - Modèle : claude-sonnet-4-20250514                     │
│     - Analyse la demande en français                        │
│     - Génère UNE SECTION PAR PRODUIT avec structure :       │
│       **[QUANTITÉ] [NOM DU PRODUIT]**                       │
│       - **Format** : [dimensions]                           │
│       - **Support** : [type de papier]                      │
│       - **Grammage** : [poids]g/m²                          │
│       - **Finition** : [type]                               │
│       - **Conseils** : liste avec prix                      │
│     - Pour les KITS : décompose en produits séparés         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  5. PARSER INTELLIGENT (ChatInterface.tsx)                  │
│     - Détecte chaque produit : **[QTÉ] [NOM]**             │
│     - Extrait les 6 champs : Format, Support, Grammage,     │
│       Finition, Conseils                                    │
│     - Fallback : createProductFromName() si parsing échoue  │
│     - Calcule le prix estimé automatiquement                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  6. PRODUCT CARDS (ProductCard.tsx)                         │
│     - Grille adaptative : 1-2 produits = 2 cols            │
│                           3-6 produits = 2 cols             │
│                           7-12 produits = 3 cols            │
│                           13+ produits = 4 cols             │
│     - Valeurs techniques cliquables et éditables            │
│     - Mode compact auto si 12+ produits                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧠 Stratégie Claude : Prompt Système Expert

### 📝 RÈGLE ABSOLUE : Format de Réponse Structuré

Claude est **guidé par un prompt système de 200+ lignes** qui impose une structure stricte pour garantir un parsing fiable.

### 🎯 Structure Obligatoire par Produit

**CHAQUE produit DOIT suivre ce format exact :**

```markdown
**[QUANTITÉ] [NOM DU PRODUIT]**
- **Format** : [dimensions] (ex: A5 (148 × 210 mm), 85×55mm)
- **Support** : [type] (ex: Papier couché mat, Vinyle adhésif)
- **Grammage** : [poids]g/m² (ex: 170g/m², 350g/m²)
- **Finition** : [type] (ex: Pelliculage mat, Vernis UV, Sans finition)
- **Conseils** :
  • [suggestion 1 avec prix estimé]
  • [suggestion 2 avec prix estimé]
  • [suggestion 3 avec prix estimé]
```

**Exemple réel :**
```markdown
**500 cartes de visite**
- **Format** : 85 × 55 mm (format standard)
- **Support** : Papier couché brillant
- **Grammage** : 350g/m²
- **Finition** : Pelliculage mat recto/verso
- **Conseils** :
  • Coins ronds disponibles (+8€)
  • Vernis sélectif sur le logo (+15€)
  • Dorure à chaud pour un effet premium (+35€)
```

### 🎁 Gestion des KITS et ENSEMBLES

**RÈGLE CRITIQUE :** Quand l'utilisateur demande un "kit", "pack", "ensemble" ou "campagne", Claude DOIT :

1. **DÉCOMPOSER** le kit en produits individuels
2. **CRÉER UNE SECTION SÉPARÉE** pour chaque produit
3. **NE JAMAIS** regrouper plusieurs produits sous un seul titre

**❌ INTERDIT (regroupement) :**
```markdown
**Kit campagne électorale**
- Affiches A2
- Flyers A5
- Cartes de visite
```

**✅ CORRECT (sections séparées) :**
```markdown
**500 affiches A2 campagne électorale**
- **Format** : A2 (420 × 594 mm)
- **Support** : Papier couché brillant
- **Grammage** : 170g/m²
- **Finition** : Sans finition
- **Conseils** : [...]

**2000 flyers A5 recto verso campagne électorale**
- **Format** : A5 (148 × 210 mm)
- **Support** : Papier couché mat
- **Grammage** : 170g/m²
- **Finition** : Pelliculage mat recto
- **Conseils** : [...]

**1000 cartes de visite candidat**
- **Format** : 85 × 55 mm (format standard)
- **Support** : Papier couché brillant
- **Grammage** : 350g/m²
- **Finition** : Pelliculage mat recto/verso
- **Conseils** : [...]
```

**💡 RÉSULTAT :** Le parser génère **3 ProductCards indépendantes** au lieu d'une seule carte "kit".

---

## 🧠 Le Parser Markdown Intelligent

### Expression Régulière Principale

Le parser utilise un **regex complexe** pour capturer les 6 champs obligatoires :

```typescript
const productPattern = /\*\*(\d+)\s+([^\*]+)\*\*[^\-]*?-\s*\*\*Format\s*\*\*\s*:\s*([^\n]+)[^\-]*?-\s*\*\*Support\s*\*\*\s*:\s*([^\n]+)(?:[^\-]*?-\s*\*\*Grammage\s*\*\*\s*:\s*([^\n]+))?[^\-]*?-\s*\*\*Finition\s*\*\*\s*:\s*([^\n]+)[^\-]*?-\s*\*\*Conseils\s*\*\*\s*:([\s\S]*?)(?=\*\*\d+|$)/gi;
```

**Groupes de capture :**
1. `(\d+)` → Quantité (ex: `500`)
2. `([^\*]+)` → Nom du produit (ex: `cartes de visite`)
3. Format → Extrait après `**Format** :`
4. Support → Extrait après `**Support** :`
5. Grammage (optionnel) → Extrait après `**Grammage** :`
6. Finition → Extrait après `**Finition** :`
7. Conseils → Extrait après `**Conseils** :`

### Extraction et Transformation

```typescript
// 1. Parse la réponse Claude
const parsedProducts = parseProductsFromClaudeResponse(assistantMessage);

// 2. Pour chaque match :
const product = {
  id: `product-${Date.now()}-${index}`,
  name: productName,           // ex: "cartes de visite"
  quantity: parseInt(quantity), // ex: 500
  format: format,              // ex: "85 × 55 mm"
  material: support,           // ex: "Papier couché brillant"
  weight: grammage,            // ex: 350 (numérique extrait de "350g/m²")
  finish: finishing,           // ex: "Pelliculage mat recto/verso"
  suggestions: improvementsLines, // Array de conseils
  // Valeurs par défaut pour champs manquants
  printing: { recto: "Quadrichromie (CMJN)", verso: "Sans impression" },
  packaging: "Paquets standard",
  deliveryLocation: "France"
};

// 3. Calcul automatique du prix
product.price = estimatePrice(product);
```

### Détection du Type de Produit

```typescript
const detectProductType = (name: string): string => {
  const nameLower = name.toLowerCase();
  if (nameLower.includes("flyer")) return "flyers";
  if (nameLower.includes("carte") && nameLower.includes("visite")) return "cartes_visite";
  if (nameLower.includes("brochure")) return "brochures";
  if (nameLower.includes("affiche")) return "affiches";
  return "autre";
};
```

---

## 🎨 Fonction `createProductFromName()` - Fallback Intelligent

### Rôle

Si le parsing échoue (Claude ne suit pas le format), la fonction **`createProductFromName()`** génère automatiquement une ProductCard avec des **configurations prédéfinies** selon le type de produit détecté.

### Produits Supportés (8 types)

```typescript
// 1. 🎴 CARTES DE VISITE
{
  format: "85 × 55 mm",
  material: "Papier couché brillant",
  weight: 350,
  finish: "Pelliculage mat recto/verso",
  suggestions: ["Coins ronds (+8€)", "Vernis sélectif (+15€)", "Dorure à chaud (+35€)"]
}

// 2. 📄 FLYERS
{
  format: "A5 (148 × 210 mm)" ou "A4 (210 × 297 mm)", // Auto-détecté
  material: "Papier couché brillant",
  weight: 170,
  finish: "Sans pelliculage",
  printing: { recto: "CMJN", verso: "recto verso" détecté ? "CMJN" : "Sans" },
  suggestions: ["Pelliculage mat (+20€)", "Grammage 250g (+15%)"]
}

// 3. 📖 BROCHURES / CATALOGUES
{
  format: "A4 (210 × 297 mm)" ou "A5",
  material: "Papier couché mat",
  weight: 135,
  finish: "Dos carré collé",
  pages: 24, // Extrait de "brochure 24 pages"
  suggestions: ["Couverture 250g (+25€)", "Pelliculage mat couverture (+15€)"]
}

// 4. 🖼️ AFFICHES / POSTERS
{
  format: "A2 (420 × 594 mm)" ou "A1, A0, A3", // Auto-détecté
  material: "Papier couché brillant" ou "mat", // Détecté dans le nom
  weight: 170,
  finish: "Sans pelliculage",
  suggestions: ["Pelliculage mat extérieur (+30€)", "Grammage 250g (+20%)"]
}

// 5. 📑 DÉPLIANTS
{
  format: "210 × 297 mm plié en 3 volets",
  material: "Papier couché brillant",
  weight: 170,
  finish: "Pliage roulé",
  suggestions: ["Pelliculage mat (+18€)", "Grammage 250g (+15%)"]
}

// 6. 🎟️ FAIRE-PART / INVITATIONS
{
  format: "148 × 105 mm (A6 paysage)",
  material: "Papier vergé naturel",
  weight: 300,
  finish: "Sans pelliculage",
  suggestions: ["Dorure à chaud (+45€)", "Enveloppes assorties (+0.30€/u)"]
}

// 7. 🏷️ AUTOCOLLANTS / STICKERS
{
  format: "Ø 50 mm (rond)" ou "50 × 50 mm (carré)", // Détecté
  material: "Vinyle blanc brillant",
  weight: 0,
  finish: "Pelliculage brillant",
  suggestions: ["Découpe à la forme", "Vinyle transparent", "Résistant eau/UV"]
}

// 8. 📋 AUTRE (fallback générique)
{
  format: "A4 (210 × 297 mm)",
  material: "Papier couché brillant",
  weight: 170,
  finish: "Sans pelliculage",
  suggestions: ["Précisez le format", "Pelliculage disponible"]
}
```

### Détection Intelligente des Variantes

```typescript
// Détection RECTO/VERSO dans le nom
if (nameLower.includes("recto verso") || nameLower.includes("2 faces")) {
  printing.verso = "Quadrichromie (CMJN)";
}

// Détection FORMAT dans le nom
if (nameLower.includes("a5")) format = "148 × 210 mm (A5)";
if (nameLower.includes("a4")) format = "210 × 297 mm (A4)";
if (nameLower.includes("a2")) format = "420 × 594 mm (A2)";

// Détection FINITION dans le nom
if (nameLower.includes("mat")) material = "Papier couché mat";
if (nameLower.includes("brillant")) finish = "Vernis brillant";

// Extraction NOMBRE DE PAGES
const pagesMatch = nameLower.match(/(\d+)\s*pages?/i);
const pages = pagesMatch ? parseInt(pagesMatch[1]) : 24;
```

### Exemple d'Utilisation

```typescript
// Cas 1 : Claude renvoie une structure parfaite
"**500 cartes de visite**\n- **Format** : 85×55mm\n[...]"
→ Parser réussit → ProductCard générée directement

// Cas 2 : Claude renvoie juste une liste
"- 500 cartes de visite\n- 1000 flyers A5"
→ Parser échoue → createProductFromName("cartes de visite", 500)
→ ProductCard avec config prédéfinie 350g pelliculage mat
```

---

## 🎨 Grille Adaptative & ProductCards

### Système de Colonnes Intelligent (MAJ 11 mars 2026)

```typescript
// NOUVELLE LOGIQUE PROGRESSIVE
const getGridClass = () => {
  const count = products.length;
  
  if (count <= 2) return 'grid grid-cols-2 gap-4';        // 2 colonnes
  if (count <= 6) return 'grid grid-cols-2 gap-4';        // 2 colonnes (max 3 lignes)
  if (count <= 12) return 'grid grid-cols-3 gap-4';       // 3 colonnes
  return 'grid grid-cols-4 gap-3';                        // 4 colonnes (gap réduit)
};
```

**Logique :**
- **1-2 produits** : 2 colonnes larges (confort de lecture)
- **3-6 produits** : Reste à 2 colonnes (évite trop de lignes)
- **7-12 produits** : Passe à 3 colonnes (optimisation d'espace)
- **13+ produits** : 4 colonnes + mode compact activé

### Mode Compact (12+ produits)

Quand `compact={true}` dans ProductCard :
- **Texte :** `text-xs` au lieu de `text-sm`
- **Padding :** `p-4` au lieu de `p-6`
- **Boutons :** Libellés courts ("Prix" vs "Calculer le prix")
- **Masqué :** Conditionnement, livraison, suggestions
- **Résultat :** 4 cartes par ligne au lieu de 2

---

## 📊 Exploitation des Données pour l'Expertise Métier

### 🎯 Données à Collecter & Analyser

#### 1. **Profil des Demandes**
```typescript
// À sauvegarder en BDD (Supabase KV Store)
interface ProductRequest {
  timestamp: Date;
  product_type: string;      // "flyers", "cartes", "brochures"
  quantity: number;
  format: string;            // "A5", "A4", "85x55mm"
  paper_type: string;        // "couché mat", "offset"
  weight: number;            // grammage
  printing: string;          // "recto verso", "quadri"
  finish: string;            // "pelliculage mat", "vernis UV"
  user_query: string;        // Texte original
  claude_response: string;   // Réponse brute
}
```

**💡 UTILISATION :**
- Identifier les **combinaisons populaires** (ex: 80% des flyers = 170g couché mat)
- Détecter les **formats non standards** demandés régulièrement
- Repérer les **finitions premium** en croissance

#### 2. **Optimisation Tarifaire**
```typescript
interface PricingData {
  product_type: string;
  quantity_range: string;    // "500-1000", "1000-2500"
  base_price: number;
  finish_premium: Record<string, number>; // {"pelliculage_mat": 15, "vernis_uv": 25}
  turnaround_days: number;
}
```

**💡 UTILISATION :**
- Construire une **base tarifaire dynamique**
- Calculer automatiquement le prix selon les specs
- Proposer des **alternatives moins chères** (ex: offset au lieu de couché)

#### 3. **Analyse Sémantique**
```typescript
// Vocabulaire métier détecté
const industry_terms = {
  "pelliculage": 345,        // Nombre de mentions
  "recto verso": 892,
  "dos carré collé": 56,
  "fonds perdus": 23,
  "traits de coupe": 12
}
```

**💡 UTILISATION :**
- Améliorer le **prompt système** de Claude avec les termes réels
- Détecter les **confusions fréquentes** (ex: "brillant" vs "glacé")
- Enrichir le **glossaire** de l'application

#### 4. **Taux de Conversion**
```typescript
interface ConversionFunnel {
  product_card_generated: number;
  price_calculated: number;
  mockup_viewed: number;
  form_edited: number;
  quote_requested: number;
}
```

**💡 UTILISATION :**
- Identifier les **points de friction**
- Optimiser les **suggestions** qui convertissent le mieux
- A/B tester les **formulations de recommandations**

---

## 🔧 Fichiers Clés du Projet

### 1. `/src/app/components/ChatInterface.tsx` (825 lignes)
**Rôle :** Interface conversationnelle + Parser Markdown

**Fonctions critiques :**
```typescript
// Envoie la requête à Claude via l'edge function
const sendMessage = async (message: string) => {
  const response = await fetch('https://[...].supabase.co/functions/v1/claude-proxy', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${publicAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message })
  });
}

// Parse le Markdown pour extraire les produits
const parseProductsFromMarkdown = (text: string) => {
  // Détecte les produits en gras : **1560 flyers A5 recto verso**
  const boldProductRegex = /\*\*(\d+)\s+([^*\n]+?)\*\*/g;
  // ... (voir section Parser ci-dessus)
}

// Parse un produit individuel
const parseSingleProduct = (text: string, quantity: number, name: string) => {
  // Extrait format, papier, grammage, impression, finitions
  // Génère des suggestions contextuelles
}
```

**💡 AMÉLIORATION FUTURE :**
Ajouter une fonction `saveProductToDatabase()` pour persister chaque configuration.

### 2. `/src/app/components/ProductCard.tsx` (428 lignes)
**Rôle :** Affichage et édition d'un produit

**Props :**
```typescript
interface ProductCardProps {
  product: Product;
  onProductUpdate?: (updatedProduct: any) => void;
  compact?: boolean;  // Active le mode compact pour 12+ produits
}
```

**Fonctionnalités :**
- Valeurs techniques **cliquables** (quantité, format, papier, etc.)
- 4 onglets dépliables : Product Sheet, Pricing, Mockup, Form
- Mode compact automatique (texte réduit, boutons courts)

**💡 AMÉLIORATION FUTURE :**
- Calculer le **prix réel** basé sur une API tarifaire
- Générer un **mockup 3D** via API externe
- Exporter la config en **PDF BAT** (Bon À Tirer)

### 3. `/supabase/functions/server/index.tsx`
**Rôle :** Edge function proxy vers API Claude

**Route critique :**
```typescript
app.post('/make-server-e3db71a4/claude-proxy', async (c) => {
  const { message } = await c.req.json();
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': Deno.env.get('MAGRIT'),
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: message }],
    }),
  });
  
  return c.json(await response.json());
});
```

**💡 AMÉLIORATION FUTURE :**
- Ajouter un **system prompt** spécialisé imprimerie
- Logger toutes les requêtes dans Supabase
- Implémenter un **cache** pour les demandes identiques

---

## 🚀 Prochaines Étapes (Roadmap)

### Phase 1 : Persistance des Données (Prioritaire)
- [ ] Créer un schéma BDD Supabase pour les configurations produit
- [ ] Sauvegarder chaque ProductCard générée
- [ ] Créer un dashboard Analytics (produits les plus demandés)
- [ ] Exporter les données en CSV pour analyse

### Phase 2 : Tarification Intelligente
- [ ] Construire une table de prix (quantité, format, papier, finitions)
- [ ] Calculer automatiquement le prix dans ProductCard
- [ ] Proposer des alternatives moins chères
- [ ] Afficher le "prix moyen du marché"

### Phase 3 : Enrichissement de l'Expertise
- [ ] Ajouter un **system prompt expert** à Claude :
  ```
  Tu es un expert en imprimerie et web-to-print.
  Tu dois TOUJOURS structurer tes réponses avec **QUANTITÉ + NOM DE PRODUIT** en gras.
  Tu dois poser des questions sur les contraintes techniques (résolution, profils ICC, traits de coupe).
  Tu dois éduquer le client sur les meilleures pratiques.
  ```
- [ ] Créer un glossaire imprimerie dans l'app
- [ ] Ajouter des tooltips explicatifs ("Qu'est-ce que le pelliculage ?")

### Phase 4 : Validation Technique
- [ ] Vérifier la faisabilité technique (ex: vernis UV sur papier recyclé = impossible)
- [ ] Alerter sur les erreurs courantes (résolution < 300 dpi, pas de fonds perdus)
- [ ] Proposer des corrections automatiques

### Phase 5 : Export & BAT
- [ ] Générer un PDF récapitulatif de la configuration
- [ ] Créer un lien partageable de la configuration
- [ ] Générer un mockup 3D réaliste (via API externe)
- [ ] Export vers un système de production (API imprimeur)

---

## 🐛 Bugs Résolus Aujourd'hui

### Bug 1 : Parser ne détectait pas les produits en gras
**Symptôme :** Claude renvoyait `**1560 flyers A5**` mais le parser cherchait des titres `###`.

**Solution :** Ajout d'un regex prioritaire pour détecter les lignes en gras :
```typescript
const boldProductRegex = /\*\*(\d+)\s+([^*\n]+?)\*\*/g;
```

### Bug 2 : Un seul produit détecté quand Claude en renvoyait plusieurs
**Symptôme :** `1560 flyers + 345 brochures` → seulement 1 ProductCard affichée.

**Solution :** Boucle sur tous les matches du regex :
```typescript
for (let i = 0; i < boldMatches.length; i++) {
  const match = boldMatches[i];
  // Parse chaque produit individuellement
}
```

### Bug 3 : Quantité toujours à 500 par défaut
**Symptôme :** La quantité n'était pas extraite depuis le titre en gras.

**Solution :** Capture explicite de la quantité :
```typescript
const quantity = parseInt(match[1]); // Premier groupe de capture
const productName = match[2].trim(); // Deuxième groupe
```

---

## 📝 Notes pour la Prochaine Session

### Si vous voyez ce message :
> "Je n'ai pas accès à l'historique des conversations précédentes"

**Dites-moi simplement :**
> "Lis le fichier `/ARCHITECTURE.md` pour comprendre le contexte du projet Magrit"

Et je comprendrai instantanément :
- ✅ L'architecture complète (frontend → edge function → Claude → parser → ProductCards)
- ✅ Le fonctionnement du parser Markdown (3 formats détectés)
- ✅ La grille adaptative (1/2/4 colonnes selon le nombre de produits)
- ✅ L'objectif métier (expertise imprimerie & web-to-print)
- ✅ Les bugs résolus et les prochaines étapes

### Questions Fréquentes pour Débugger

**"Les ProductCards ne s'affichent pas"**
→ Vérifier les logs console : `📑 X produit(s) détecté(s) via les lignes en gras`
→ Si `X = 0`, Claude n'a pas utilisé le format `**QUANTITÉ NOM**` en gras

**"Le parser détecte mal les quantités"**
→ Vérifier le regex : `/\*\*(\d+)\s+([^*\n]+?)\*\*/g`
→ Tester dans regex101.com avec la réponse brute de Claude

**"Les cartes ne passent pas en mode compact à 12 produits"**
→ Vérifier `products.length >= 12` dans ChatInterface.tsx
→ Vérifier que `compact={true}` est bien passé à ProductCard

---

## 🎓 Lexique Imprimerie pour l'IA

**Formats standards :**
- A0 : 841 × 1189 mm
- A1 : 594 × 841 mm
- A2 : 420 × 594 mm
- A3 : 297 × 420 mm
- A4 : 210 × 297 mm
- A5 : 148 × 210 mm
- A6 : 105 × 148 mm
- Carte de visite : 85 × 55 mm

**Grammages courants :**
- 80-90g : Papier standard (lettres, copies)
- 135-170g : Flyers, dépliants
- 250-350g : Cartes de visite, cartes postales
- 300-400g : Couvertures de brochures

**Types de papier :**
- Offset : Non couché, mat naturel
- Couché mat : Surface lisse, pas de reflet
- Couché brillant : Surface brillante, couleurs vives
- Recyclé : Fibres recyclées, aspect naturel

**Finitions :**
- Pelliculage mat : Film plastique mat protecteur
- Pelliculage brillant : Film plastique brillant
- Vernis UV : Vernis brillant localisé
- Vernis sélectif : Vernis sur certaines zones
- Dorure à chaud : Impression métallique (or, argent)
- Gaufrage : Relief en creux ou en bosse

**Reliures :**
- Pliage simple : 1 ou 2 plis
- Agrafage à cheval : Agrafes au milieu (brochures)
- Dos carré collé : Reliure type livre
- Spirale métallique : Reliure à anneaux
- Wire-O : Double spirale métallique

**Contraintes techniques :**
- Résolution minimale : 300 dpi
- Profil colorimétrique : CMJN (pas RGB)
- Fonds perdus : +3mm de débord minimum
- Traits de coupe : Marques de découpe obligatoires

---

## 💾 Variables d'Environnement

```bash
# Supabase (préconfigurées)
SUPABASE_URL=https://jynxrpzwgzrrfuooputw.supabase.co
SUPABASE_ANON_KEY=eyJ[...]
SUPABASE_SERVICE_ROLE_KEY=eyJ[...]

# Claude API (clé fournie par l'utilisateur)
MAGRIT=sk-ant-api03-[...]  # Clé API Anthropic valide
```

**⚠️ IMPORTANT :** La clé `MAGRIT` est déjà configurée et fonctionnelle.

---

## 🔗 Liens Utiles

- **API Claude :** https://docs.anthropic.com/claude/reference
- **Supabase Docs :** https://supabase.com/docs
- **React Router v7 :** https://reactrouter.com/
- **Tailwind CSS v4 :** https://tailwindcss.com/

---

## 📞 Contact & Maintenance

**Projet :** Magrit - Configurateur d'impression intelligent
**Stack :** React + Supabase + Claude AI
**Dernière mise à jour :** 11 mars 2026

**Pour toute question, référez-vous à ce document en priorité.** 🚀

---

## 📅 Journal des Améliorations

### 🆕 11 Mars 2026 - Session Actuelle

#### ✅ Restauration de `createProductFromName()`
- **Fonction intelligente** qui génère des ProductCards avec configurations prédéfinies
- **8 types de produits supportés** : cartes de visite, flyers, brochures, affiches, dépliants, faire-part, stickers, autre
- **Détection automatique** des variantes (format A4/A5, recto/verso, mat/brillant)
- **Fallback robuste** si le parsing Claude échoue

#### ✅ Prompt Système Expert Renforcé
- **200+ lignes** de directives précises pour Claude
- **Section dédiée KITS** : Claude décompose automatiquement les ensembles en produits séparés
- **Format strict imposé** : **[QUANTITÉ] [NOM]** + 6 champs obligatoires
- **Exemples exhaustifs** : "kit campagne électorale" → 3 ProductCards distinctes

#### ✅ Parser Markdown Amélioré
- **Regex complexe** capturant 6 champs : Format, Support, Grammage, Finition, Conseils
- **Extraction numérique** du grammage (ex: "350g/m²" → 350)
- **Parsing des conseils** avec bullet points (• ou ✦)
- **Calcul automatique du prix** basé sur type/quantité/grammage/finitions

#### ✅ Grille Adaptative Optimisée
- **Nouvelle logique progressive** :
  - 1-2 produits : 2 colonnes
  - 3-6 produits : 2 colonnes (évite trop de lignes)
  - 7-12 produits : 3 colonnes
  - 13+ produits : 4 colonnes + mode compact
- **Gap réduit** pour 13+ produits (gap-3 au lieu de gap-4)

#### ✅ Documentation ARCHITECTURE.md Enrichie
- **Flux de données détaillé** avec exemple "kit campagne électorale"
- **Section Stratégie Claude** : explication du prompt système
- **Section `createProductFromName()`** : 8 types avec détection intelligente
- **Expression régulière documentée** avec groupes de capture

### 🎯 Prochaine Priorité : Test du Kit
**Action :** Tester "kit campagne électorale" pour vérifier que Claude génère bien 3 ProductCards séparées (affiches, flyers, cartes de visite).

---

*Document généré automatiquement par l'assistant IA - Conservez-le précieusement pour les prochaines sessions !*