---
story_id: S-CONSO-5
epic: Sprint 4 — PIM-Boutique-Commandes (Phase 2 Boutique consolidation)
title: Tri grille catalogue (Select déroulant prix/date)
status: livrée
delivered_at: 2026-05-18
final_result: "Select shadcn (4 options Pertinence/Prix asc/Prix desc/Nouveautés) à droite du compteur résultats. Bouton Réinitialiser visible si sortKey ≠ default. Persistance localStorage par slug (magrit.shop.{slug}.sort). Helper sortProductsBy + loadSortKey/saveSortKey extraits + testés (12 cas vitest)."
target_branch: beta/v5
agent: Dev (Claude Code) + UX consultation Sally validée
size: M (~1j)
depends_on: rien
ux_consultation: validée (Sally 18/05) — Select shadcn, persistance localStorage
prio_demo_23_05: Basse (post-démo, peut glisser Phase 3)
---

# Story S-CONSO-5 — Tri grille catalogue

## Story (As / I want / So that)

**As an** acheteur B2B qui consulte le catalogue d'une boutique
**I want** pouvoir trier les produits par prix croissant/décroissant ou par nouveauté
**So that** je trouve rapidement les produits dans la fourchette budgétaire qui m'intéresse, ou les dernières offres ajoutées par l'imprimeur.

## Contexte

[PortalCatalog.tsx](src/app/components/shop/portal/PortalCatalog.tsx) affiche actuellement les produits triés par `display_order` (curation atelier). Aucun contrôle utilisateur sur le tri.

Sally UX consult 18/05 a recommandé : **Select déroulant shadcn** (pas 3 boutons qui mangent la largeur mobile 375px), placement à droite de la barre de recherche, persistance localStorage par slug.

## Acceptance Criteria

**AC1** — Composant Select shadcn ajouté à droite de la barre de recherche (responsive : même ligne desktop ≥ 640px, sous en mobile).

**AC2** — 4 options de tri :
- "Pertinence (défaut)" → `display_order` ASC (curation atelier)
- "Prix croissant" → `price_ht` ASC
- "Prix décroissant" → `price_ht` DESC
- "Nouveautés" → `created_at` DESC

**AC3** — Persistance localStorage clé `magrit.shop.${slug}.sort` (par boutique, pas global tenant). L'acheteur retrouve son tri préféré au retour.

**AC4** — Tri par défaut = "Pertinence" (`display_order`) — respect curation atelier (important pour Magrit, l'imprimeur choisit l'ordre stratégique).

**AC5** — Tri appliqué **après** filter (recherche + tri composables, pas l'inverse).

**AC6** — Bouton discret "Réinitialiser" visible uniquement si tri ≠ défaut (microcopy `text-xs` lien à droite du Select).

**AC7** — A11y :
- `aria-label="Trier les produits"` sur le SelectTrigger
- `aria-live="polite"` sur compteur résultats (annonce du changement de tri)

**AC8** — Tests vitest sur le helper `sortProductsBy(products, sortKey)` extrait pour testabilité.

**AC9** — Test manuel : sélectionner chaque option de tri → vérifier ordre cohérent. Recharger la page → vérifier persistance.

## Décisions techniques

| Décision | Choix | Argument |
|---|---|---|
| Composant tri | Select shadcn (pas boutons) | Sally — viewport mobile 375px, 4-5 options futures |
| Position | À droite barre recherche, responsive | Sally — UX standard catalog |
| Persistance | localStorage par slug | Sally — par boutique, pas global tenant |
| Tri par défaut | display_order | Sally — respect curation atelier |
| Ordre opérations | filter → sort | Sally — composabilité |
| Reset visible | Si tri ≠ défaut | Pattern UX standard, pas un button toujours visible |

## Snippet Sally (référence)

```jsx
<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
  <SearchBar />
  <Select value={sort} onValueChange={setSort}>
    <SelectTrigger className="w-full sm:w-56" aria-label="Trier les produits">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="display_order">Pertinence (défaut)</SelectItem>
      <SelectItem value="price_asc">Prix croissant</SelectItem>
      <SelectItem value="price_desc">Prix décroissant</SelectItem>
      <SelectItem value="newest">Nouveautés</SelectItem>
    </SelectContent>
  </Select>
</div>
```

## Risques & mitigations

| Risque | Mitigation |
|---|---|
| Tri par created_at instable si `created_at` non-set sur certains produits | Helper `sortProductsBy` gère undefined gracefully (fallback display_order) |
| Localstorage corrompu (mauvais slug) | Try/catch + fallback default |
| Performance dégradée si > 100 produits | Acceptable. Pagination future S3.1. |

## Fichiers touchés

- `src/app/components/shop/portal/PortalCatalog.tsx` : ajout Select + persist + helper call
- `src/app/components/shop/portal/PortalCatalog.helpers.ts` : ajout `sortProductsBy` (peut partager fichier avec filter de S-CONSO-4)
- `tests/components/shop/portal/PortalCatalog.helpers.test.ts` : tests sort

## TF Notion à créer

- **TF "Tri grille catalogue par prix + nouveauté + persistance localStorage"** :
  - Parcours : P09 — Boutique portail B2B
  - Persona : Acheteur shop_only
  - Type : Manuel humain + IA Chrome

## Notes

Story bonus démo. Peut être livrée en parallèle de S-CONSO-4 (même fichier helpers).
