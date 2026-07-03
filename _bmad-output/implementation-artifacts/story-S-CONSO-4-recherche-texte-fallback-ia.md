---
story_id: S-CONSO-4
epic: Sprint 4 — PIM-Boutique-Commandes (Phase 2 Boutique consolidation)
title: Recherche texte fallback automatique si claude-proxy down (PortalCatalog)
status: livrée
delivered_at: 2026-05-18
final_result: "Timeout 3s sur claude-proxy via Promise.race. Fallback automatique sur filterProductsByTextQuery (name + description + gamme.name). Badge 'Mode IA' / 'Mode texte' discret + aria-live. Log console [claude_proxy_fallback] timestamp + query. Helper extrait testé (6 cas vitest)."
target_branch: beta/v5
agent: Dev (Claude Code) + UX consultation Sally validée
size: M (~1j)
depends_on: rien
ux_consultation: validée (Sally 18/05) — fallback transparent, pas de 2e barre
prio_demo_23_05: Basse (post-démo, peut glisser Phase 3)
---

# Story S-CONSO-4 — Recherche fallback IA → texte

## Story (As / I want / So that)

**As an** acheteur B2B qui cherche un produit dans le catalogue de la boutique
**I want** que la recherche fonctionne même si l'IA Magrit est indisponible (panne claude-proxy, billing Anthropic suspendu, etc.)
**So that** je puisse continuer à naviguer et trouver mes produits sans dépendance critique au service LLM externe.

## Contexte

[PortalCatalog.tsx](src/app/components/shop/portal/PortalCatalog.tsx) propose actuellement une recherche conversationnelle IA via le bouton "Magrit" qui appelle `claude-proxy` (Sonnet 4.5). Si l'endpoint échoue (réseau, billing Anthropic, timeout), l'acheteur n'a plus de recherche fonctionnelle — un placeholder vide ou une alerte erreur.

Le code a déjà un `filtered = products.filter((p) => ...)` ligne 143 avec un `query` lower côté front, mais il n'est pas exposé comme fallback automatique.

Sally UX consult 18/05 a recommandé : **fallback transparent automatique**, pas de 2e barre dédiée (pas de cognitive load "quelle barre choisir").

## Acceptance Criteria

**AC1** — Timeout claude-proxy à 3s. Au-delà, fallback automatique sur filter local.

**AC2** — Algorithme fallback : filter case-insensitive substring sur :
- `product.name` (toujours)
- `product.description` (si présent)
- `gamme.name` (via productEnrichment.resolveGamme déjà disponible côté Catalog)
- ❌ Pas `kind` (jargon technique B2B, hors persona)

**AC3** — Badge mode discret sous la barre :
- "Mode IA" (vert) si claude-proxy répond < 3s
- "Mode texte" (gris) si fallback déclenché
- Pas un bandeau intrusif, juste un petit tag font-mono

**AC4** — Réessai IA automatique au prochain submit (`pas de sticky session`). L'acheteur n'a pas à recharger pour réessayer.

**AC5** — Logging instrumentation : événement console (placeholder posthog) `claude_proxy_fallback` avec timestamp + query → visibilité résilience pour ops futurs.

**AC6** — A11y :
- `aria-live="polite"` sur le badge mode (annonce du changement)
- `aria-busy="true"` sur la barre pendant la requête IA

**AC7** — Tests vitest sur le helper `filterProductsByTextQuery(products, query, gammes)` extrait pour testabilité.

**AC8** — Test manuel : couper claude-proxy (renommer secret Magrit3 temporairement) → vérifier que la recherche bascule en mode texte + le badge passe en gris. Restaurer secret post-test.

## Décisions techniques

| Décision | Choix | Argument |
|---|---|---|
| Timeout IA | 3s | Sally — équilibre UX (pas trop court pour ne pas spam fallback, pas trop long pour réactivité) |
| Champs filtrés | name + description + gamme.name | Sally — pas kind (jargon) |
| Persistance mode | Non | Sally — pas sticky session, retry à chaque submit |
| Logger | console.info préfixe `[claude_proxy_fallback]` | Pas de posthog actif, simple log identifiable pour grep |
| Helper extrait | `filterProductsByTextQuery` dans PortalCatalog.helpers.ts | Testabilité vitest (pattern PortalOrders.helpers) |

## Risques & mitigations

| Risque | Mitigation |
|---|---|
| Faux positifs IA (claude-proxy répond mais 4s) → fallback déclenché à tort | Acceptable. Le mode texte reste fonctionnel. |
| Filter local trop pauvre vs IA | Acceptable MVP. Si patterns récurrents identifiés, étendre `filterProductsByTextQuery` ultérieurement. |
| 3s = trop court pour requêtes IA complexes | Acceptable. L'IA répond en général < 1s sur Sonnet 4.5. |

## Fichiers touchés

- `src/app/components/shop/portal/PortalCatalog.tsx` : ajout fallback logic + badge mode
- `src/app/components/shop/portal/PortalCatalog.helpers.ts` : nouveau, `filterProductsByTextQuery` extrait
- `tests/components/shop/portal/PortalCatalog.helpers.test.ts` : nouveau, tests filter

## TF Notion à créer

- **TF "Recherche boutique fallback texte si IA down"** :
  - Parcours : P09 — Boutique portail B2B
  - Persona : Acheteur shop_only
  - Type : Manuel humain
  - Étapes : couper claude-proxy → recherche texte → vérifier mode badge + résultats

## Notes

Story résilience. Bonus démo 23/05 mais pas critique. Peut glisser Phase 3 si charge.
