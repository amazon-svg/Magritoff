# UX Design Spec — Extension boutique e-commerce standard

> **Auteur :** Sally 🎨 (UX Designer BMAD) — **Date :** 2026-07-07
> **Périmètre :** composants user-facing de l extension Epic 2 (S2.11-S2.31, FR-ECOM-01..20).
> **Ancrage réel :** composants livrés `src/app/components/shop/portal/*` (`PortalHome`, `PortalCatalog`, `PortalProduct`, `PortalCart`, `PortalOrders`), `ShopProductCard`, `ShopGammesSidebar`, `ShopLayout` ; tokens `.design-handoff/tokens/tokens.css`.
> **DoD :** principe 5 (passage Sally obligatoire) + principe 10 (a11y axe-core sur toute route acheteur).
> **Principe directeur :** intelligence dans la donnée — **aucun écran de paramétrage manuel**, tous les états sont dérivés (PIM / bibliothèques / historique).

---

## 0. Principes UX transverses (valent pour tous les composants)

1. **Réutiliser les tokens, pas réinventer.** Couleurs de famille, badges, prix : tout passe par les tokens existants (`--shop-primary`, `--ok-*`, `--warn-*`, `--radius-*`, `--shadow-*`). Le theming tenant (A4 palette/fonts) reste la couche de marque ; les repères e-commerce sont une **couche sémantique neutre par-dessus** (sinon un badge « Éco » vert jurerait avec une boutique à palette rouge).
2. **Trois états obligatoires par composant data-driven** : `chargement` (skeleton), `vide` (repli propre, jamais de section béante), `erreur` (message clair, jamais de spinner infini — NFR28). Le principe « intelligence dans la donnée » implique que **le vide est un état fréquent au démarrage** (boutique jeune, secteur sous seuil) → il doit être soigné, pas subi.
3. **Magrit est un fil rouge, pas un widget.** Chaque cul-de-sac (recherche 0 résultat, indécision, question produit) offre un pont vers Magrit, visuellement cohérent (même pastille marguerite partout).
4. **Densité maîtrisée.** Persona = pro pressé. On privilégie le scan (repères visuels) à la lecture. Pas de carrousel auto-play, pas d animation gratuite.
5. **A11y non-négociable** : focus visible, navigation clavier complète, contraste AA, `alt` sur tout mockup, `aria-live` sur les zones qui se rechargent (recherche, recalcul prix).

---

## 1. Lisibilité ProductCard — S2.11 + S2.12 + S2.13

**Besoin utilisateur** _(« En tant qu acheteur qui scanne une grille de 30 produits, je dois savoir en une seconde à quelle famille appartient un produit, s il est nouveau ou best-seller, et ses 3 specs clés — sans cliquer. »)_

Card enrichie (ordre de lecture haut→bas), sur la base de `ShopProductCard.tsx` existant :

```
┌─────────────────────────────┐
│▎ [picto] CARTES              │ ← S2.11 bandeau famille : liseré couleur (4px, à gauche)
│                             │          + picto + libellé famille (mono, uppercase, --mute-2)
│      ┌───────────────┐      │
│      │  mockup       │  ●Nouveau  ← S2.12 badges : coin haut-droit, empilables max 2 visibles
│      │  signature    │      │          (Nouveau=info · Best-seller=accent · Éco=ok · 24h=warn)
│      └───────────────┘      │
│                             │
│  Carte de visite premium    │ ← titre (--font-ui, --ink)
│   REF-CV-350                 │ ← réf (mono, --mute-2)
│                             │
│  ▪ 85×55mm  ▪ 350g  ▪ Mat    │ ← S2.13 puces PIM : max 3, chips discrets (--radius-sm)
│                             │
│  dès 0,12 €/u ⚠️Prix marché  │ ← prix + badge source (existant)
│                             │
│  [ Configurer & ajouter ]   │ ← CTA existant (product-card-order-btn)
└─────────────────────────────┘
```

**Décisions UX :**
- **Liseré famille = couleur, pictogramme = forme.** Jamais la couleur seule (a11y daltonisme) — toujours couleur **+** picto **+** libellé.
- **Badges plafonnés à 2 visibles** ; au-delà, priorité `Express 24h > Nouveau > Best-seller > Éco` (le délai est l info la plus actionnable en B2B). Pas de « sapin de Noël ».
- **Puces PIM = 3 max, tronquées proprement** ; si < 3 attributs, on n affiche que ceux présents (pas de puce vide).
- **États :** mockup en chargement → skeleton ≤ 300ms (NFR2, déjà géré S4.3) ; famille inconnue → liseré neutre `--line-2` + picto générique ; aucun badge → rien (silence visuel).

**a11y :** liseré famille via `aria-label` sur la card (« Famille Cartes ») ; badges = `<span>` avec texte lisible (pas d icône seule) ; contraste des chips vérifié AA.

**testIds à déclarer** (`testIds.ts`, scope `shop`) : `card-category-badge`, `card-commercial-badge` (avec `data-badge-kind`), `card-attr-chip`.

---

## 2. Méga-menu 2 niveaux illustré — S2.18

**Besoin** _(« Je veux voir toute l offre d une famille sans jouer à cliquer-revenir-cliquer. »)_

Le méga-menu **complète** `ShopGammesSidebar` (il ne le remplace pas : sidebar = navigation persistante de travail ; méga-menu = découverte rapide depuis le header).

```
Header boutique ─────────────────────────────────────────────
 [Logo]  Cartes ▾   Flyers ▾   Grand format ▾   PLV ▾   [🔍 recherche]
         └────────────────────────────────────────────┐
         │ CARTES                    ┌──────────────┐  │
         │  › Cartes de visite       │  [mockup]    │  │ ← vignette-signature
         │  › Cartes de correspond.  │   vedette    │  │   famille (S2.14)
         │  › Cartes de vœux         │  Best-seller │  │
         │  › Sur-mesure             └──────────────┘  │
         │  ─────────────────────────────────────────  │
         │  Voir toute la famille Cartes →              │ ← mène à landing (S2.20)
         └──────────────────────────────────────────────┘
```

**Décisions UX :**
- **Ouverture au survol (desktop) ET au clic/focus (clavier+tactile).** Le survol seul exclut le clavier et le mobile — inacceptable a11y.
- **Colonnes de sous-catégories dérivées du PIM** ; la vignette vedette = best-seller de la famille (donnée), pas un choix éditorial manuel.
- **Toujours un lien « Voir toute la famille »** → jamais de cul-de-sac, pont vers la landing.
- **Mobile :** le méga-menu devient un **drawer plein écran** en accordéon (pas de survol). La sidebar gammes reste la nav primaire.

**a11y :** pattern ARIA `menubar`/`menu`, `aria-expanded`, piège de focus géré, `Échap` referme, première sous-catégorie focus à l ouverture.

**testIds** : `nav-megamenu`, `nav-megamenu-family` (`data-family`), `nav-megamenu-subcat`, `nav-megamenu-viewall`.

---

## 3. Landing catégorie éditorialisée — S2.20

**Besoin** _(« Quand j ouvre “Grand format”, je veux comprendre l offre et trouver ma sous-catégorie, pas être noyé dans 60 vignettes. »)_

```
[fil d Ariane]  Accueil › Grand format
────────────────────────────────────────────────
 GRAND FORMAT                                     ← H1 (titre PIM ou auto S2.25)
 Kakémonos, affiches, banderoles pour vos         ← intro courte (PIM ou auto-générée)
 événements et points de vente.
────────────────────────────────────────────────
 [tuile sous-cat]  [tuile]  [tuile]  [tuile]      ← sous-catégories en tuiles illustrées
   Kakémonos       Affiches  Banderoles  Roll-up
────────────────────────────────────────────────
 ★ Best-sellers Grand format                       ← rangée best-sellers (donnée)
 [card] [card] [card] [card]
────────────────────────────────────────────────
 [fil Ariane + facettes légères]   Grille complète ← S2.19 filtres + grille produits
```

**Décisions UX :**
- **Contenu éditorial jamais vide** : si le PIM n a ni intro ni SEO, on affiche le fallback **auto-généré par Magrit (S2.25)** — mais **sans badge “généré par IA” visible côté acheteur** (ça n apporte rien à l acheteur ; l info d override reste côté admin).
- **Hiérarchie de lecture** : comprendre (titre+intro) → s orienter (tuiles) → être rassuré (best-sellers) → explorer (grille). C est l ordre d Exaprint/Onlineprinters, éprouvé.
- **État secteur/best-sellers vide** (boutique jeune) : la rangée best-sellers se **replie** et laisse place à la grille — pas de « aucun best-seller » affiché.

**a11y :** un seul `<h1>` par landing, hiérarchie Hn correcte, tuiles = liens avec libellé explicite.

**testIds** : `category-landing`, `category-intro`, `category-subcat-tile`, `category-bestsellers`.

---

## 4. Home boutique — blocs S2.15 / S2.16 / S2.17 / S2.23

**Besoin** _(« Ma home doit m aider à AGIR — reprendre mes affaires, re-commander, découvrir — pas être une affiche. »)_

Refonte de `PortalHome.tsx`. **Ordre = priorité d action décroissante** (le plus actionnable en haut) :

```
[hero tenant existant — A4]
──────────────────────────────────────────────
▶ REPRENDRE                         (S2.16 + S2.7 existant)
  [Devis en attente ×2]  [Panier non finalisé]   ← n apparaît que si applicable
──────────────────────────────────────────────
▶ RECOMMANDER                       (S3.3 existant, remonté sur la home)
  Vos dernières commandes  [Renouveler] [Renouveler]
──────────────────────────────────────────────
✦ MAGRIT VOUS SUGGÈRE               (S2.23 cross-sell IA)
  « Vous avez commandé des flyers salon en avril —
    des kakémonos assortis ? »       [Voir]  [Non merci]
──────────────────────────────────────────────
◆ NOUVEAUTÉS                        (S2.15)
  [card] [card] [card] [card]  →
──────────────────────────────────────────────
★ BEST-SELLERS DE VOTRE SECTEUR     (S2.17)
  [card] [card] [card]              (ou repli → « Populaires » intra-boutique)
```

**Décisions UX (les plus importantes de la spec) :**
- **La home est adaptative, pas configurable.** Chaque bloc **apparaît si et seulement si** il a de la donnée. Un acheteur neuf sans historique voit : hero → Nouveautés → (fallback Populaires). Un acheteur récurrent voit d abord Reprendre/Recommander. **Zéro réglage** : l ordre est fixe, la présence est dérivée.
- **Bloc Magrit = suggestion, pas intrusion.** Toujours refusable (`Non merci` → le bloc disparaît pour la session). Ton conversationnel, pastille marguerite. Une seule suggestion à la fois (pas un mur d IA).
- **Home unique loggé/non-loggé** (décision archi 3) : le visiteur non-loggé voit hero + Nouveautés + Best-sellers (vitrine SEO) ; les blocs personnels (Reprendre/Recommander/Suggestion) n apparaissent qu authentifié. Même page, contenu dérivé du contexte.
- **Cartes cross-sell/best-seller réutilisent la ProductCard enrichie** (§1) — cohérence totale, zéro nouveau composant de card.

**a11y :** chaque bloc = `<section aria-labelledby>` ; bloc Magrit en `aria-live="polite"` ; `Non merci` = vrai `<button>` focctable.

**testIds** : `home-resume`, `home-reorder`, `home-magrit-suggestion`, `home-suggestion-dismiss`, `home-new-products`, `home-sector-bestsellers`.

---

## 5. Recherche + fallback Magrit — S2.21

**Besoin** _(« Je tape "carte 350g", et si tu n as pas, ne me montre pas une page blanche — demande à Magrit. »)_

```
[🔍 carte 350g………………………]
 ┌───────────────────────────────┐
 │ PRODUITS                       │
 │  ▪ Carte de visite 350g        │ ← autocomplétion (pg_trgm, §4.15)
 │  ▪ Carte pelliculée 350g       │
 │ CATÉGORIES                     │
 │  › Cartes                      │
 └───────────────────────────────┘

   ── si 0 résultat ──
 ┌───────────────────────────────┐
 │ Aucun produit pour « xyz ».    │
 │ ✦ Demander à Magrit →          │ ← ouvre le chat pré-rempli de la requête
 └───────────────────────────────┘
```

**Décisions UX :**
- **Débounce ~200ms**, minimum 2 caractères, résultats groupés Produits / Catégories.
- **Le 0-résultat n est pas une erreur, c est une porte** : message neutre + CTA Magrit proéminent (la marguerite). C est le moment où Magrit brille.
- **Clavier-first** : ↑↓ pour naviguer, `Entrée` pour sélectionner, `Échap` pour fermer.

**a11y :** pattern `combobox` ARIA (`aria-expanded`, `aria-activedescendant`), `role="listbox"`, `aria-live` sur le compteur de résultats.

**testIds** : `search-input`, `search-suggestion` (`data-kind=product|category`), `search-empty-magrit`.

---

## 6. Fiche produit — rassurance B2B S2.26 + paliers prix S2.27 + Magrit vendeur S2.28

**Besoin** _(« Avant de commander 5000 flyers, je veux être sûr du délai, voir l effet volume sur le prix, et pouvoir poser UNE question sans quitter la page. »)_

Enrichissement de `PortalProduct.tsx` (colonne droite, sous le configurateur) :

```
┌ Configurateur (overlay S2.4 existant) ┐
│ …options…                             │
│                                       │
│ PALIERS (S2.27)                       │
│  100 u ...... 0,18 €/u                │ ← mini-tableau quantité→PU (resolvePrice)
│  500 u ...... 0,13 €/u                │    palier courant surligné
│ 1000 u ...... 0,11 €/u  ⚠️Prix marché │ ← badge source de prix
├───────────────────────────────────────┤
│ RASSURANCE (S2.26)                    │
│  🚚 Livré sous 5 j ouvrés             │ ← délais Clariprint (masqué si indispo)
│  ✎ BAT / échantillon dispo            │
│  ✓ Garantie conformité                │
│  ✆ Contact atelier                    │
├───────────────────────────────────────┤
│  ✦ Poser une question sur ce produit  │ ← S2.28 : ouvre Magrit pré-chargé du contexte
└───────────────────────────────────────┘
```

**Décisions UX :**
- **Rassurance = uniquement des faits présents.** Un item sans donnée (ex : délai indispo) est **masqué**, jamais « N/A » (le « N/A » inquiète au lieu de rassurer).
- **Paliers : le palier de la quantité courante est surligné** → l acheteur voit immédiatement « où il en est » et l intérêt de monter.
- **Magrit vendeur = bouton discret mais toujours visible**, contexte produit pré-chargé (délais, options, prix). Les réponses restent cadrées au produit.
- **Prix zéro** (aucune source) : pas de tableau paliers → CTA « Demander un devis » (cohérent hiérarchie prix).

**a11y :** tableau paliers = vrai `<table>` avec en-têtes ; palier courant marqué `aria-current` ; bouton Magrit avec `aria-label` explicite.

**testIds** : `product-price-tiers`, `product-reassurance`, `product-ask-magrit`.

---

## 7. Product finder guidé — S2.24 (bonus, sprint E4)

Wizard 3 questions (usage → quantité → délai), full-screen léger, une question par écran, barre de progression 3 points. Résultat = 1-3 cards (ProductCard §1) + justification courte Magrit + CTA config. Échappable à tout moment (« je préfère parcourir »). Pattern `dialog` ARIA.
**testIds** : `finder-open`, `finder-step` (`data-step`), `finder-result-card`.

---

## Décisions UX — arbitrées par Arnaud 2026-07-07

| # | Sujet | Décision actée |
|---|---|---|
| A | **Dark mode vs light** | ✅ **Token-agnostic** : conception sémantique fonctionnant light ET dark, le thème tenant décide. On n impose PAS le dark (éviterait de jurer avec les palettes claires A4). |
| B | **Repères e-commerce (badges/famille)** | ✅ **Neutres/sémantiques** : couche constante (Éco=vert `--ok`, Express=orange `--warn`, Nouveau=bleu `--info`), identique dans toutes les boutiques. Lisibilité + cohérence garanties. |
| C | **Mention « généré par IA »** sur contenu auto (S2.25) | ✅ **Ne pas afficher** côté acheteur (info d override reste côté admin). _(reco Sally, non contestée)_ |
| D | **Bloc Magrit home** | ✅ **Une seule suggestion à la fois**, refusable. _(reco Sally, non contestée)_ |

## Handoff

- **Vers Amelia (Dev)** : tous les testIds ci-dessus à **déclarer dans `src/app/lib/testIds.ts`** avant usage (jamais inventés à la volée). Composants à enrichir (pas recréer) : `ShopProductCard`, `PortalHome`, `PortalProduct`, `ShopLayout` (header méga-menu). Nouveaux : landing catégorie, recherche, méga-menu, finder.
- **Vers Winston** : RAS de nouveau schéma au-delà des ADR §4.13-§4.15 déjà posés ; la recherche (§4.15) et best-sellers (§4.14) alimentent directement §2/§4 de cette spec.
- **a11y (DoD #10)** : toute nouvelle route acheteur (`/shop/:slug/category/*`, landing, finder) ajoutée à `pnpm a11y:scan`.
