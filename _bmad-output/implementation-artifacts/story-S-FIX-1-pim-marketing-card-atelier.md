---
story_id: S-FIX-1
epic: 2 — Boutique B2B Premium Experience (correctif PIM marketing card atelier)
title: ProductCard atelier — onglet Marketing PIM (commercial + SEO + GEO)
status: ready-for-dev
created_at: 2026-05-10
target_branch: beta/v5
agent: Dev (Amelia)
size: M
prd_ref: _bmad-output/planning-artifacts/prd.md (PIM enrichment + persona pure player W2P)
predecessors: [S2.4b overlay atelier livré (réduit le ProductCard à 4 onglets fonctionnels actifs : Fiche/Prix/3D/Debug)]
successors: []
---

# Story S-FIX-1 — ProductCard atelier : onglet Marketing PIM

## Contexte

Correctif manquement signalé **2 fois** par Arnaud (sessions distinctes, dont 2026-05-10). La `ProductCard.tsx` atelier ne consomme **pas** les données PIM marketing/commercial/SEO via `enrichProduct()` — pourtant nécessaires pour permettre aux pure players W2P (persona tertiaire Marc Tessier) de vendre le produit en ligne avec SEO/GEO complet.

Mémoire BMAD créée : [feedback_pim_marketing_card](~/.claude/projects/-Users-arnaudmazon-Documents-Claude-BMAD-Magrit/memory/feedback_pim_marketing_card.md) pour capitaliser ce signalement et empêcher la régression.

**Scope précisé Arnaud 2026-05-10** : *"Uniquement pour la productcard atelier et pour le PIM. Les informations attendues sont toutes les informations commerciales et marketing propres à permettre aux pure players d'avoir toutes les données pour vendre ce produit en ligne, et disposer de tout ce qu'il faut d'un point de vue SEO/GEO."*

## Story

**As an** imprimeur Pro deviseur (atelier) ou pure player W2P consumer (futur API),
**I want** voir/exposer toutes les données PIM marketing, commerciales et SEO/GEO d'un produit configuré,
**So that** je peux vendre ce produit en ligne avec un contenu éditorial riche et bien indexé.

## Acceptance Criteria

### AC1 — Nouvel onglet "Marketing" dans la tools bar

**Given** un produit avec `enrichProduct(config, gammes, definitions)` retournant un `EnrichedProduct` non-null
**When** la `ProductCard` atelier rend
**Then** la tools bar (5 onglets actuels : Fiche / Prix / 3D / Éditer / Debug) gagne un **6e onglet "Marketing"** (icône `Megaphone` ou `Tag` lucide-react, key="marketing")
**And** le clic sur "Marketing" ouvre un panneau inline (pattern existant des autres onglets) qui affiche les données PIM
**And** si `enriched === null` (pas de gamme matchée pour ce produit), l'onglet Marketing affiche un message clair "Pas de données PIM pour ce produit (kind/dimensions non reconnus par les gammes souscrites)"

### AC2 — Affichage 9 champs PIM

**Given** l'onglet Marketing ouvert avec un `EnrichedProduct.resolved` complet
**When** le panneau rend
**Then** les 9 sections suivantes sont rendues, chacune avec un label mono uppercase et son contenu :
1. **Titre commercial** (`resolved.title`) — display large, font 18px, weight 600
2. **Accroche commerciale** (`resolved.short_description`) — paragraphe italique
3. **Description longue** (`resolved.description`) — bloc HTML rendu (avec `dangerouslySetInnerHTML` après vérification du PIM, OU rendu en text plain si HTML absent)
4. **H1 SEO** (`resolved.h1`) — bloc avec préfixe `<h1>` mono pour signaler l'usage SEO
5. **Meta SEO** (`resolved.seo_title` + `resolved.seo_description`) — 2 champs avec label `<title>` et `<meta name="description">`
6. **Mots-clés (keywords)** (`resolved.keywords: string[]`) — chips tags inline
7. **Cas d'usage** (`resolved.usage_examples: Array<{title, description}>`) — cards expandable (réutiliser `<details>` HTML natif si pas d'animation Framer Motion lourde)
8. **FAQ** (`resolved.faq: Array<{question, answer}>`) — accordéon (idem `<details>` HTML)
9. **Schema.org type** (`definition?.schema_org_type`) + **quality_score** (`definition?.quality_score`) + **validated_by** (`definition?.validated_by`) — badges mono rangés en haut du panneau

### AC3 — Bouton "Copier en JSON" pour API consumers

**Given** l'onglet Marketing ouvert
**When** un imprimeur clique sur un bouton "Copier" en haut du panneau
**Then** l'intégralité de `EnrichedProduct.resolved` + `definition` est copié dans le presse-papier au format JSON formaté (2 espaces)
**And** un toast/feedback visuel confirme la copie (réutiliser pattern existant `libraryState='saved'` brièvement)

**Why** : facilite le copier-coller vers Shopify / WooCommerce / autres CMS pure players sans devoir construire une API dédiée pour MVP.

### AC4 — testIds + a11y

**Given** l'onglet Marketing rendu
**When** Claude in Chrome inspecte
**Then** testids présents :
- `product-card-marketing-tab-btn` (bouton onglet)
- `product-card-marketing-panel` (panneau)
- `product-card-marketing-copy-json-btn` (bouton copier)
- `product-card-marketing-section-{name}` pour chaque section (title, short_description, description, h1, seo, keywords, usage_examples, faq, badges)

**Given** navigation clavier
**When** Tab dans le panneau
**Then** chaque `<details>` est focusable + `aria-expanded`, le bouton copier a un `aria-label` clair

## Tasks

- [ ] **Task 1 — Composant `ProductPimMarketingTab.tsx`** (AC1, AC2, AC4)
  - Créer `src/app/components/ProductPimMarketingTab.tsx`
  - Props : `enriched: EnrichedProduct | null`, `productName: string`
  - Render conditionnel : null → empty state ; sinon 9 sections avec testids
  - Utiliser `<details>` HTML natifs pour usage_examples + faq (a11y native, pas de dep externe)
  - Layout 2 colonnes desktop / 1 col mobile pour SEO meta + Schema.org
  - Wrapper bg-paper border-2 border-line rounded-xl p-6 mb-3 cohérent avec les autres onglets atelier

- [ ] **Task 2 — Helper `buildPimJsonExport`** (AC3)
  - Créer `src/app/components/ProductPimMarketingTab.helpers.ts`
  - Helper `buildPimJsonExport(enriched: EnrichedProduct | null): string` qui sérialise en JSON 2-espaces avec `definition` + `resolved` (et omet les valeurs vides pour cohérence)
  - Tests vitest ≥ 4 cas (enriched null / résolu complet / champs vides filtrés / format pretty 2-espaces)

- [ ] **Task 3 — Étendre `ProductCard.tsx` atelier** (AC1)
  - Ajouter `"marketing"` à `TabType`
  - Ajouter le 6e onglet dans la tools bar (`Megaphone` icon, key="marketing", label="Marketing")
  - Render conditionnel `{activeTab === "marketing" && <ProductPimMarketingTab enriched={enriched} productName={localProduct.name ?? ''} />}`

- [ ] **Task 4 — Étendre `testIds.ts`** (AC4)
  - Nouveau scope `pim` (ou étendre `shop`) avec :
    - `marketingTabBtn: 'product-card-marketing-tab-btn'`
    - `marketingPanel: 'product-card-marketing-panel'`
    - `marketingCopyJsonBtn: 'product-card-marketing-copy-json-btn'`
    - `marketingSection: 'product-card-marketing-section'` (data-section-name pour chaque section)

- [ ] **Task 5 — Validation full**
  - vitest 152 baseline + ~5 nouveaux tests buildPimJsonExport ≥ 157/157
  - Vite build OK
  - Smoke visuel atelier : ouvrir une ProductCard avec produit `kind=flyer` reconnu par PIM → cliquer Marketing → vérifier 9 sections + bouton Copier → coller dans un éditeur → JSON valide

## Dev Notes

### Files NEW

- `src/app/components/ProductPimMarketingTab.tsx` — composant onglet Marketing PIM
- `src/app/components/ProductPimMarketingTab.helpers.ts` — `buildPimJsonExport`
- `tests/components/ProductPimMarketingTab.helpers.test.ts` — ≥ 4 cas vitest

### Files UPDATE

- `src/app/components/ProductCard.tsx` — `TabType` + 6e onglet + render conditionnel
- `src/app/lib/testIds.ts` — testids `marketing*`

### Snippets clés

**Enriched déjà disponible** dans ProductCard.tsx ligne 106 (`const enriched = enrichProduct(...)`) — pas de refetch nécessaire, juste le passer au nouveau composant.

**HTML natif details/summary** (a11y de base) :
```tsx
<details className="border border-line rounded-md p-3">
  <summary className="cursor-pointer text-[13px] font-medium text-ink">
    {usage.title}
  </summary>
  <p className="text-[12.5px] text-ink-muted mt-2">{usage.description}</p>
</details>
```

**Bouton Copier avec navigator.clipboard** :
```tsx
const [copied, setCopied] = useState(false);
const handleCopy = async () => {
  const json = buildPimJsonExport(enriched);
  await navigator.clipboard.writeText(json);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
};
```

### Why pas un onglet "PIM" séparé qui mélange tout ?

Choix terminologique : "Marketing" est plus parlant pour le persona imprimeur Pro qui doit vendre. "PIM" est jargon interne. L'onglet expose donc tout ce qui est marketing/commercial/SEO/GEO — l'imprimeur s'en fiche du nom du système source.
