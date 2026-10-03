---
id: E_OVERLAY.fix-TF59
title: E_OVERLAY.fix-TF59 — Réinitialisation overlay boutique + premier POST clariprint-quote
epic: EPIC-E1
feature: FEAT-E1-UNCLASSIFIED
specStatus: draft
deliveryStatus: not-started
owner: unassigned
source:
  system: notion
  pageId: 35dd0131973c8173b80ddae083c04f1c
  url: https://app.notion.com/35dd0131973c8173b80ddae083c04f1c
  originalStatus: "Pas commencé"
  originalSprint: "Sprint 4"
  originalPriority: "P0"
  originalEffort: "M"
  originalAssignee: "Claude code"
  originalOffering: "Toutes"
  originalOrder: ""
  originalSources: "Cas de test KO"
  createdAt: "2026-05-11 09:01:45Z"
  lastEditedAt: "2026-05-11T09:01:00.000Z"
  importedAt: 2026-10-03
  archive: _archives-notion/2026-10-03/pages/E_OVERLAY.fix-TF59.md
decisions:
  - PD-2026-10-01-B3
dependencies:
  - E_ROOT.fix-PublicShop-hooks
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-E_OVERLAY.fix-TF59.md
---

# E_OVERLAY.fix-TF59 — Réinitialisation overlay boutique + premier POST clariprint-quote

## Provenance

Importée de Notion le 2026-10-03 depuis la base « 📋 Backlog Magrit — Sprint Board » ([page d'origine](https://app.notion.com/35dd0131973c8173b80ddae083c04f1c)). Le statut Notion `Pas commencé` est conservé comme provenance seule : il ne détermine pas `deliveryStatus`, établi plus bas à partir du dépôt. Le corps est repris de l'export sans reformulation.

## Besoin utilisateur

_Non formulé dans la source Notion._

## Origine

Story de correctif issue de la **Campagne TF Sprint 3 du 11/05/2026** — cas TF-59 ❌ KO P0 ferme.
- Fiche TF source : [TF-59 — ProductOverlay boutique recalcul Clariprint](https://www.notion.so/35dd0131973c8182a413ee4fe934006c)
- CR campagne : [CR Campagne TF — Sprint 3 — 11/05/2026](https://www.notion.so/35dd0131973c8107bf9ad735ab8c5353)

## Contexte

Sur `/shop/xyfjjo-q6kekm` (ERAM) vue Catalogue, click `product-card-configure-btn` → l'overlay ouvre, structure OK. **Mais** : (1) 6 options présentes sur 7 attendues — `shop-overlay-option-finishing-verso` ABSENT ; (2) tous les `<select>` ont `value=""` et leur textContent concatène toutes les options ; (3) `price-display` = `"0,00 € HT / 0,00 € TTC"` ; (4) `error-banner` visible dès l'ouverture avec texte `"Erreur réseau — réessayez"` ; (5) Network : 1 seule requête `OPTIONS /functions/v1/make-server-e3db71a4/clariprint-quote` (HTTP 204), **aucune POST suivante**.
Cause racine : violation Rules of Hooks dans `PublicShop.tsx:323` (cf. story prérequis `E_ROOT.fix-PublicShop-hooks`). Possible que S-FIX-5 ait déjà résolu — re-test TF-59 sur HEAD est la première action.
Périmètre : [src/app/components/shop/ProductOverlay.tsx](src/app/components/shop/ProductOverlay.tsx) (608 lignes), [src/app/components/shop/ProductOverlay.helpers.ts](src/app/components/shop/ProductOverlay.helpers.ts) (254 lignes), [src/app/lib/featureFlags.ts](src/app/lib/featureFlags.ts), endpoint `make-server-e3db71a4/clariprint-quote`.

## User story

En tant que **Acheteur shop_only**, je veux que l'overlay boutique ouvre avec ses 7 selects pré-remplis depuis `clariprintData` et déclenche immédiatement un premier POST `clariprint-quote`, afin de voir le prix HT/TTC dès l'ouverture sans erreur réseau bidon.

## Critères d'acceptation

1. **Given** TF-59 re-test post-`E_ROOT` sur HEAD, **When** je clique `product-card-configure-btn`, **Then** l'overlay ouvre et **les 7 selects sont pré-remplis** depuis `product.config.clariprintData`.
2. **Given** overlay ouvert, **When** j'observe le Network panel, **Then** une POST `/functions/v1/make-server-e3db71a4/clariprint-quote` est visible avec body contenant les 7 options, en moins de **300 ms** après mount.
3. **Given** POST renvoyé payload Clariprint valide, **When** je regarde `shop-overlay-price-display`, **Then** prix HT et TTC strictement positifs (`> 0 €`) cohérents avec le payload sanitisé.
4. **Given** le bug absence `shop-overlay-option-finishing-verso`, **When** je sélectionne `printing=recto-verso`, **Then** le select `finishing-verso` apparaît. Documenter en commit message si conditionnel volontaire vs régression.
5. **Given** offline (DevTools Network), **When** je change papier 135 g → 250 g, **Then** error-banner + retry-btn présents + **prix précédent conservé** (NFR28).
6. **Given** je clique retry-btn réseau revenu, **When** POST aboutit, **Then** banner disparaît + price-display met à jour.
7. **Given** `featureFlags.ENABLE_OVERLAY_LIVE_RECALC=true`, **When** je vérifie le code, **Then** l'effet d'init + debounce 300 ms ne sont déclenchés que si flag true.
8. **0 régression** : vitest 162/162 verts. TF-60 (overlay atelier) reste OK.
9. **Re-test TF-59** bascule en OK sur prochaine campagne.

## Spécifications API / data

- **Endpoint** : `POST /functions/v1/make-server-e3db71a4/clariprint-quote`, payload `buildClariprintPayload(options)`, retour validé par `validateClariprintResponse()` (S0.2).
- **Pattern obligatoire** : passer par `ClariprintAdapter` ([src/server/clariprint/ClariprintAdapter.ts](src/server/clariprint/ClariprintAdapter.ts)), pas de `fetch` direct (project-context §3.6).
- **Featureflag** : `ENABLE_OVERLAY_LIVE_RECALC` ([src/app/lib/featureFlags.ts](src/app/lib/featureFlags.ts)).
- **data-testid** : aucun ajout (déjà dans [src/app/lib/testIds.ts](src/app/lib/testIds.ts)).
- **Helpers** : `extractInitialOptions(product.config.clariprintData)` + `buildClariprintPayload(options)` à auditer.
- Pas de table SQL modifiée.

## Dépendances

- **Prérequis indispensable** : `E_ROOT.fix-PublicShop-hooks` mergée + TF-59 re-joué. Si TF-59 passe OK après E_ROOT seul → cette story réduite à : test unitaire `extractInitialOptions` + investigation finishing-verso.
- Pas de dépendance Clariprint (endpoint opérationnel selon TF-60 atelier OK).

## Estimation

**M (1-2 j)**, à ré-arbitrer en J3 selon le résultat du re-test TF-59 post-E_ROOT. Pessimiste : 2 j. Optimiste : 0,5 j si E_ROOT suffit.

## Plan de test

- **TF existant à re-jouer** : [TF-59](https://www.notion.so/35dd0131973c8182a413ee4fe934006c) — re-test complet 8 étapes.
- **TF nouveau à créer** : *"ProductOverlay — finishing-verso présence conditionnelle printing recto-verso"*, P08, Acheteur shop_only, P1, IA Chrome.
- **Smoke API** : cURL POST `clariprint-quote` avec payload ERAM réel.
- **Test vitest** : cas dans `ProductOverlay.helpers.test.ts` couvrant `extractInitialOptions`.

## Définition de « terminé »

- Code mergé sur `beta/v5`.
- vitest 162/162+ verts.
- Re-test TF-59 OK + TF-60 atelier OK (non-régression).
- CR campagne suivante mentionnant KO → OK.

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: not-started` — 1 story document BMAD sans signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-E_OVERLAY.fix-TF59.md`

## Questions ouvertes

- Relecture produit requise : contenu importé, non approuvé.
- Story touchée par une décision du 1er octobre 2026 (PD-2026-10-01-B3) : propagation à faire, non appliquée ici.
- Rattachement à une fonctionnalité produit à arbitrer.
