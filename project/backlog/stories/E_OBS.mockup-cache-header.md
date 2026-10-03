---
id: E_OBS.mockup-cache-header
title: E_OBS.mockup-cache-header — X-Mockup-Cache CORS-expose ou tracing
epic: EPIC-E7
feature: FEAT-E7-UNCLASSIFIED
specStatus: draft
deliveryStatus: not-started
owner: unassigned
source:
  system: notion
  pageId: 35dd0131973c81bab635cb10028825be
  url: https://app.notion.com/35dd0131973c81bab635cb10028825be
  originalStatus: "Pas commencé"
  originalSprint: "Backlog"
  originalPriority: "P2"
  originalEffort: "S"
  originalAssignee: "Claude code"
  originalOffering: "Technique"
  originalOrder: ""
  originalSources: "Cas de test KO"
  createdAt: "2026-05-11 09:07:36Z"
  lastEditedAt: "2026-05-11T09:07:00.000Z"
  importedAt: 2026-10-03
  archive: _archives-notion/2026-10-03/pages/E_OBS.mockup-cache-header.md
decisions: []
dependencies: []
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-E_OBS.mockup-cache-header.md
---

# E_OBS.mockup-cache-header — X-Mockup-Cache CORS-expose ou tracing

## Provenance

Importée de Notion le 2026-10-03 depuis la base « 📋 Backlog Magrit — Sprint Board » ([page d'origine](https://app.notion.com/35dd0131973c81bab635cb10028825be)). Le statut Notion `Pas commencé` est conservé comme provenance seule : il ne détermine pas `deliveryStatus`, établi plus bas à partir du dépôt. Le corps est repris de l'export sans reformulation.

## Besoin utilisateur

_Non formulé dans la source Notion._

## Origine

Campagne TF Sprint 3 du 11/05 — obs P2 sur TF-64 OK (5 templates OK mais header CORS-exposé manquant).
- Fiche TF : [TF-64](https://www.notion.so/35dd0131973c8187a4afcf919526fcb7)
- CR : [CR 11/05](https://www.notion.so/35dd0131973c8107bf9ad735ab8c5353)

## Contexte

Le header `X-Mockup-Cache` (valeurs `MISS|HIT|MISS-NO-CACHE|FALLBACK`) absent de `response.headers` côté browser. Seuls `cache-control`, `content-length`, `content-type` exposés. Soit edge ne l'émet pas, soit `Access-Control-Expose-Headers` ne le liste pas. Utile SLO observabilité prod (NFR2 cache HIT < 50 ms). Pas bloquant démo.
Périmètre : [supabase/functions/mockup-generator/index.ts](supabase/functions/mockup-generator/index.ts).

## User story

En tant que Superadmin Magrit, je veux voir le header `X-Mockup-Cache` dans `response.headers` navigateur, afin de mesurer le ratio HIT/MISS sans canal cURL séparé.

## Critères d'acceptation

1. **Given** GET `/functions/v1/mockup-generator?...&template=flyer` depuis navigateur, **When** response arrive, **Then** `response.headers.get('X-Mockup-Cache')` retourne une valeur dans `["MISS", "HIT", "MISS-NO-CACHE", "FALLBACK"]`.
2. **Given** diagnostic cURL, **When** compare `curl -I` vs `fetch().headers`, **Then** diff nul.
3. **Given** fix appliqué, **When** rafraîchis 2×, **Then** 1re `MISS`/`FALLBACK`, 2e `HIT`.
4. **0 régression** : TF-64 5 templates OK.
5. **TF nouveau couvrant CORS** créé et OK.

## Spécifications

- Fichier : [mockup-generator/index.ts](supabase/functions/mockup-generator/index.ts).
- Étape 1 diagnostic cURL pour distinguer émission vs CORS-expose.
- Étape 2a si émis : ajouter à `Access-Control-Expose-Headers`.
- Étape 2b si non émis : implémenter tracing HEAD HIT/MISS/FALLBACK.
- Hors scope P2 : table `mockup_cache_events`.

## Dépendances

- Aucun prérequis. Candidat Sprint 5.

## Estimation

**S (< 1 j)**. 1 h diagnostic + fix CORS, ou 2-3 h fix émission + tests Deno + redéploiement.

## Plan de test

- TF à re-jouer : [TF-64](https://www.notion.so/35dd0131973c8187a4afcf919526fcb7).
- TF nouveau : *"mockup-generator — X-Mockup-Cache exposé navigateur"*, P09, Superadmin Magrit, P2, API directe + IA Chrome.
- Smoke API : cURL + fetch JS.
- Tests Deno : cas dans `index.test.ts`.

## Définition de « terminé »

- Code mergé sur `beta/v5`.
- Edge redéployée.
- TF nouveau OK.
- CR campagne suivante.

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: not-started` — 1 story document BMAD sans signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-E_OBS.mockup-cache-header.md`

## Questions ouvertes

- Relecture produit requise : contenu importé, non approuvé.
- Rattachement à une fonctionnalité produit à arbitrer.
