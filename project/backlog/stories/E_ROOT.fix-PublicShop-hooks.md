---
id: E_ROOT.fix-PublicShop-hooks
title: E_ROOT.fix-PublicShop-hooks — Vérifier régression Rules of Hooks dans PublicShop (post S-FIX-5)
epic: EPIC-E4
feature: FEAT-E4-UNCLASSIFIED
specStatus: draft
deliveryStatus: not-started
owner: unassigned
source:
  system: notion
  pageId: 35dd0131973c8106818ecd8d900138cb
  url: https://app.notion.com/35dd0131973c8106818ecd8d900138cb
  originalStatus: "Pas commencé"
  originalSprint: "Sprint 4"
  originalPriority: "P0"
  originalEffort: "S"
  originalAssignee: "Claude code"
  originalOffering: "Toutes"
  originalOrder: ""
  originalSources: "Cas de test KO"
  createdAt: "2026-05-11 09:01:45Z"
  lastEditedAt: "2026-05-11T09:01:00.000Z"
  importedAt: 2026-10-03
  archive: _archives-notion/2026-10-03/pages/E_ROOT.fix-PublicShop-hooks.md
decisions: []
dependencies:
  - E_OVERLAY.fix-TF59
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-E_ROOT.fix-PublicShop-hooks.md
---

# E_ROOT.fix-PublicShop-hooks — Vérifier régression Rules of Hooks dans PublicShop (post S-FIX-5)

## Provenance

Importée de Notion le 2026-10-03 depuis la base « 📋 Backlog Magrit — Sprint Board » ([page d'origine](https://app.notion.com/35dd0131973c8106818ecd8d900138cb)). Le statut Notion `Pas commencé` est conservé comme provenance seule : il ne détermine pas `deliveryStatus`, établi plus bas à partir du dépôt. Le corps est repris de l'export sans reformulation.

## Besoin utilisateur

_Non formulé dans la source Notion._

## Origine

Story issue de la **Campagne TF Sprint 3 du 11/05/2026** — cause racine identifiée du cas TF-59 ❌ KO + symptôme jumeau HMR cassé `ProductPimMarketingTab.tsx`.
- CR campagne : [CR Campagne TF — Sprint 3 — 11/05/2026 (e-shop v1.1)](https://www.notion.so/35dd0131973c8107bf9ad735ab8c5353)
- Fiche TF source (cause racine) : [TF-59 — ProductOverlay boutique recalcul Clariprint](https://www.notion.so/35dd0131973c8182a413ee4fe934006c)

## Contexte

Campagne TF du 11/05 jouée sur **v0.5.2-beta.5**. Console : **155 erreurs React** dont `Error: Rendered more hooks than during the previous render` + `Warning: React has detected a change in the order of Hooks called by PublicShop`. Stack pointait `PublicShop.tsx:323` (useMemo conditionnel). Cascade `DefaultErrorBoundary` React Router → remount → état d'init overlay corrompu, premier POST `clariprint-quote` jamais envoyé. Vite log `Failed to reload PublicShop.tsx + ProductPimMarketingTab.tsx` (HMR cassé).
**HEAD actuel (v0.5.3-beta.5, commit ****`2f43f66`**** S-FIX-5)** : le code [PublicShop.tsx:347-359](src/app/components/shop/PublicShop.tsx#L347-L359) atteste que `gammePills useMemo` a été remonté AVANT les early returns — *"Bug initialement introduit ligne 382 fixé 2026-05-11"*. **Plausible que S-FIX-5 ait résolu la cause racine.** À valider impérativement avant tout autre fix overlay.
Périmètre : `src/app/components/shop/PublicShop.tsx` (493 lignes), `src/app/components/ProductPimMarketingTab*` (audit miroir).

## User story

En tant que **Acheteur shop_only**, je veux que la page boutique B2B charge sans erreur React en cascade, afin de pouvoir configurer mes produits sans corruption du state d'init de l'overlay.

## Critères d'acceptation

1. **Given** HEAD v0.5.3-beta.5+, **When** je navigue `/shop/xyfjjo-q6kekm` en session 3-5 min, **Then** la console doit afficher **0 occurrence de ****`Rendered more hooks`** et **0 occurrence de ****`React has detected a change in the order of Hooks`**.
2. **Given** la même session, **When** je toggle 2 pills + change nav, **Then** `PublicShop` n'est pas remounté (React DevTools profiler).
3. **Given** Vite `pnpm dev` port 5177, **When** je sauvegarde `PublicShop.tsx` et `ProductPimMarketingTab.tsx`, **Then** HMR réussit sans `Failed to reload`.
4. **Given** l'audit chirurgical de `PublicShop.tsx`, **When** je liste tous les hooks (useState/useEffect/useMemo/useRef + custom) avec leur position relative aux early returns, **Then** **tous** sont déclarés AVANT le premier early return.
5. **Given** l'audit miroir de `ProductPimMarketingTab.tsx`, **When** je vérifie ses hooks, **Then** soit aucune violation, soit fix appliqué par le même pattern.
6. **0 régression mesurable** : `vitest run` 162/162 verts. Build Vite OK.
7. **Re-test TF-59 sur HEAD v0.5.3+** : si TF-59 passe en OK, `E_OVERLAY.fix-TF59` est de facto résolue.

## Spécifications API / data

- **Fichiers cibles** : [src/app/components/shop/PublicShop.tsx](src/app/components/shop/PublicShop.tsx), [src/app/components/ProductPimMarketingTab.tsx](src/app/components/ProductPimMarketingTab.tsx) si présent.
- Pas d'endpoint, pas de table SQL, pas de featureFlag.
- Conserver les data-testid déclarés dans [src/app/lib/testIds.ts](src/app/lib/testIds.ts).
- Outil recommandé : `grep -n 'useState\|useMemo\|useEffect\|useRef\|use[A-Z]' src/app/components/shop/PublicShop.tsx`.

## Dépendances

- **Prérequis indispensable de** `E_OVERLAY.fix-TF59`. Si TF-59 passe au re-test post-merge E_ROOT, E_OVERLAY = de facto résolue.
- Pas de dépendance externe.

## Estimation

**S (< 1 j)**. Probable que la cause racine soit déjà résolue par S-FIX-5. Effort = audit + re-test TF-59 + audit miroir. Si le re-test échoue, monter en M.

## Plan de test

- **TF existant à re-jouer** : [TF-59](https://www.notion.so/35dd0131973c8182a413ee4fe934006c) — re-test immédiat post-merge.
- **TF nouveau à créer** : *"Non-régression Rules of Hooks dans PublicShop — session 3 min sans erreur React"*, P09, Visiteur non authentifié, P0, IA Chrome.
- Smoke vitest : test unitaire sur différents states (no shop / shop loaded / access denied).

## Définition de « terminé »

- Code mergé sur `beta/v5`.
- vitest 162/162 verts.
- Re-test TF-59 tracé (OK ou KO résiduel argumenté).
- Commit ESLint-clean (`react-hooks/rules-of-hooks` actif).
- CR campagne suivante mentionnant la résolution.

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: not-started` — 1 story document BMAD sans signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-E_ROOT.fix-PublicShop-hooks.md`

## Questions ouvertes

- Relecture produit requise : contenu importé, non approuvé.
- Rattachement à une fonctionnalité produit à arbitrer.
