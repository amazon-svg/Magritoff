---
story_id: S0.1
epic: 0 — Pré-sprint Démo Readiness
title: Hotfix régression Fiche home Magrit
status: livrée
delivered_at: 2026-05-09
target_branch: beta/v4
agent: Dev (rétrofit document 2026-05-10)
size: S
commit: f925eba
---

# Story S0.1 — Hotfix régression Fiche home Magrit

## Story (Given/When/Then)

**As an** imprimeur Pro qui prépare une démo client
**I want** que l'onglet "Fiche" depuis une ProductCard sur la home Magrit affiche correctement les informations commerciales,
**So that** je puisse présenter les détails d'un devis à un prospect sans page blanche.

## Contexte

Régression silencieuse introduite après Sprint 2 (mai 2026). Sur la home Magrit, cliquer sur une ProductCard puis l'onglet "Fiche" affichait une page blanche. Bloquant pour la démo client cible 2026-05-23 (Vincent Gillier, Imprimerie du Roi).

**Investigation préalable :** subagent Explore — cause identifiée à confiance haute :
- `src/app/components/ProductCard.tsx` lignes 106-112 et 670
- `enrichProduct()` peut retourner `null` si `PIMContext` n'a pas chargé `gammes`/`definitions` au moment du rendu
- La condition `{enriched?.definition && (...)}` ligne 670 cachait silencieusement le bloc Fiche
- Probable trigger : commit `fa44682` (activation streaming chat) ou refactoring PIM Context post-Sprint 2

## Acceptance Criteria validés

**AC1** — Fallback UI explicite ✅
> **Given** un tenant avec ≥ 1 devis sauvegardé
> **When** l'utilisateur clique ProductCard → onglet Fiche
> **Then** soit la "Fiche commerciale" s'affiche (titre, descriptif, conditions, marge, délai), soit le message *« Fiche commerciale non disponible pour ce produit »* (italique, gris) — **plus de page blanche**

**AC2** — Logging diagnostique ✅
> **Given** PIMContext incomplet au rendu (`gammes` ou `definitions` manquants)
> **When** ProductCard rend
> **Then** `console.warn` avec détails (`{gammesLoaded, definitionsLoaded}`) — diagnostique facile si bug réapparaît
> **And** `console.error` si `enrichProduct` throw (capturé)

**AC3** — Démo client OK ✅ (validation visuelle Arnaud requise)
> **Given** le fix mergé sur `beta/v4`
> **When** Bruno (persona) joue son scénario démo
> **Then** parcours fluide, sans incident démo-killer

## Décisions techniques prises

| Décision | Pourquoi |
|---|---|
| **Fix 1 (fallback UI ternaire)** retenu | Plus sûr que Fix 2 (PIM eager load) qui ajoutait complexité de timing. Fallback UI = UX explicite plutôt qu'invisible. |
| **Fix 3 (logging) ajouté en complément** | Diagnostique automatique si la régression revient — le warn `[ProductCard] PIMContext incomplet au rendu` apparaîtra en console DevTools |
| **Pas de Fix 2 (PIM eager load)** | Fix 1 + Fix 3 suffisent. Refactor du PIMContext = scope creep, hors urgence démo |

## Fichiers touchés

| Fichier | Modification |
|---|---|
| `src/app/components/ProductCard.tsx` | +18 lignes / -2 lignes : guard sur PIM context (lignes 106-122), ternaire avec fallback UI (lignes 670-755) |

## Tests à ajouter (cahiers Notion)

⏳ **À créer dans Notion** (Action 2 BMAD rétrofit 2026-05-10) :
- TF S0.1-1 : ProductCard → Fiche affiche infos commerciales
- TF S0.1-2 : ProductCard → Fiche avec PIM gammes match → section enrichie + FAQ
- TF S0.1-3 : ProductCard → Fiche sans gamme match → fallback message lisible
- TF S0.1-4 : Onglet Fiche charge les 8 champs minimum (Produit, Qté, Format, etc.)

## Écarts vs PRD/Architecture

Aucun. La story ne modifie pas le scope v1.1 — c'est un hotfix sur `beta/v4` qui ne touche pas `beta/v5`.

## Commits

- `f925eba` (sur `beta/v4`) : `fix(v4): fallback UI Fiche commerciale et logging PIM (S0.1)`

## Statut

✅ **Livrée et pushée sur `beta/v4`** (2026-05-09).
✅ **Dev server local** : `http://localhost:5176/` — testable.
⏳ **Validation manuelle Arnaud** : à confirmer en démo répétition avant 2026-05-23.
⏳ **Cas TF Notion** : à créer (cf. Action 2).
