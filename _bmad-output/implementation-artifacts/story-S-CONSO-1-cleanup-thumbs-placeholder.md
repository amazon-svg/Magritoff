---
story_id: S-CONSO-1
epic: Sprint 4 — PIM-Boutique-Commandes (Phase 2 Boutique consolidation)
title: Cleanup 3 thumbs placeholder PortalProduct
status: livrée
delivered_at: 2026-05-18
final_result: "3 boutons thumbs placeholder retirés de PortalProduct.tsx (lignes 162-175). Aucune régression vitest. Story future S-PRODUCT-VIEWS-MULTI traçable."
target_branch: beta/v5
agent: Dev (Claude Code)
size: XS (~15min)
depends_on: rien
ux_consultation: NON requise (cleanup pur)
prio_demo_23_05: Basse (bonus si du temps)
---

# Story S-CONSO-1 — Cleanup thumbs placeholder

## Story (As / I want / So that)

**As an** acheteur B2B qui consulte la fiche détaillée d'un produit
**I want** ne plus voir 3 boutons vides "Thumbs placeholder — futures vues multiples" qui ne font rien quand on clique
**So that** l'UI ne suggère pas de fonctionnalités fantômes et reste propre / professionnelle pour la démo client.

## Contexte

[PortalProduct.tsx:162-163](src/app/components/shop/portal/PortalProduct.tsx#L162-L163) contient un commentaire explicite :
```jsx
{/* Thumbs placeholder — futures vues multiples */}
<div className="flex gap-2 mt-3">
  ...
```
→ 3 boutons vides hover-able mais sans onClick. Identifié par audit Winston (consultation boutique 17/05) comme **anomalie UX visible**.

## Acceptance Criteria

**AC1** — Le commentaire + le `<div className="flex gap-2 mt-3">` contenant les 3 boutons placeholder sont **retirés** de `PortalProduct.tsx`.

**AC2** — Aucune régression visuelle sur le reste de la fiche produit (image principale + configurateur + prix HT/TTC).

**AC3** — Aucun nouveau test vitest requis (cleanup pur, pas de logique).

**AC4** — Test manuel : naviguer sur `/shop/imprimerie-ipa` → cliquer sur un produit → vérifier qu'il n'y a plus les 3 boutons placeholder sous l'image.

## Notes

Story XS pure (cleanup). Aucune décision UX nécessaire. Story future post-MVP : vraies vues multiples (recto/verso/3D) → spec via S-PRODUCT-VIEWS-MULTI (hors scope v1.1).
