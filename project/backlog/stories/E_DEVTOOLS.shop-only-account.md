---
id: E_DEVTOOLS.shop-only-account
title: E_DEVTOOLS.shop-only-account — Voie bypass auth Resend dev OU seed shop_only pré-activé
epic: EPIC-E7
feature: FEAT-E7-UNCLASSIFIED
specStatus: draft
deliveryStatus: not-started
owner: unassigned
source:
  system: notion
  pageId: 35dd0131973c81a898dcc6c547270712
  url: https://app.notion.com/35dd0131973c81a898dcc6c547270712
  originalStatus: "Pas commencé"
  originalSprint: "Sprint 4"
  originalPriority: "P1"
  originalEffort: "M"
  originalAssignee: "Arnaud"
  originalOffering: "Technique"
  originalOrder: ""
  originalSources: "Cas de test KO"
  createdAt: "2026-05-11 09:08:08Z"
  lastEditedAt: "2026-05-11T09:08:00.000Z"
  importedAt: 2026-10-03
  archive: _archives-notion/2026-10-03/pages/E_DEVTOOLS.shop-only-account.md
decisions: []
dependencies: []
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-E_DEVTOOLS.shop-only-account.md
---

# E_DEVTOOLS.shop-only-account — Voie bypass auth Resend dev OU seed shop_only pré-activé

## Provenance

Importée de Notion le 2026-10-03 depuis la base « 📋 Backlog Magrit — Sprint Board » ([page d'origine](https://app.notion.com/35dd0131973c81a898dcc6c547270712)). Le statut Notion `Pas commencé` est conservé comme provenance seule : il ne détermine pas `deliveryStatus`, établi plus bas à partir du dépôt. Le corps est repris de l'export sans reformulation.

## Besoin utilisateur

_Non formulé dans la source Notion._

## Origine

Campagne TF Sprint 3 du 11/05 — TF-56 Bloqué (dette héritée 10/05).
- Fiche TF : [TF-56](https://www.notion.so/35dd0131973c8138858ccb127ac7bb62)
- CR : [CR 11/05](https://www.notion.so/35dd0131973c8107bf9ad735ab8c5353)

## Contexte

L'access guard `shop_only` nécessite un compte authentifié avec `access_scope='shop_only'` + manip SQL `tenant_members.allowed_shop_ids`, précondition non remplie en local. Bloqué depuis 10/05 : Resend non opérant en dev, compte `amazon@ageservices.fr` resté pending. **Dette outillage récurrente** : tout futur scénario `Persona=Acheteur shop_only` bloqué. Premier ticket outillage prioritaire selon CR 11/05.
Périmètre : option 1 = endpoint dev-only bypass Resend (magic_link console-side `NODE_ENV=development`) ; option 2 = seed dev shop_only pré-activé (SQL idempotent) ; option 3 = staging Resend ouvert sur domaine vérifié.

## User story

En tant que Superadmin Magrit / Claude (IA Chrome) chargé des campagnes TF, je veux un compte test `shop_only` authentifiable en local sans Resend, afin de jouer TF-56 et tout scénario Persona=Acheteur shop_only sans blocage outillage récurrent.

## Critères d'acceptation

1. **Given** `localhost:5177` en `NODE_ENV=development`, **When** j'utilise la voie de bypass implémentée (1/2/3 à arbitrer), **Then** je peux me connecter en `access_scope='shop_only'` + `allowed_shop_ids` configurés, **sans email réel Resend**.
2. **Given** ce compte, **When** je navigue `/shop/<slug-NON-autorisé>`, **Then** rendu 403 `shop-forbidden-403` + absence `shop-portal` + lien retour `/tenants` (cf. TF-56).
3. **Given** voie implémentée, **When** je documente dans `SPRINT_HANDOFF.md` (section « Comptes test développement »), **Then** doc permet provisionner le compte en < 5 min sur machine vierge.
4. **Sécurité** : voie de bypass NON disponible en prod. Hard-guard `NODE_ENV !== 'production'` ou flag `ALLOW_DEV_LOGIN=true` jamais activé prod.
5. **0 régression** : flux auth standards (login, invitation, magic link prod via Resend) inchangés.
6. **Re-test TF-56** bascule Bloqué → OK.

## Spécifications

- **Option 1 — endpoint ****`dev-magic-link`** : `supabase/functions/dev-magic-link/index.ts` génère magic link Supabase + l'écrit console serveur. Garde-fou `if (Deno.env.get('ALLOW_DEV_LOGIN') !== 'true') return Response(403)`.
- **Option 2 — seed SQL dev** : `supabase/seeds/dev_shop_only_account.sql` idempotent ON CONFLICT crée user `acheteur-test@magrit.local` + session pré-générée + insert `tenant_members` avec `access_scope='shop_only'` + `allowed_shop_ids=ARRAY['<shop-id>']`. Password documenté dans `SPRINT_HANDOFF.md`.
- **Option 3 — staging Resend** : vérifier domaine `magrit.fr` sur Resend + activer `RESEND_API_KEY` staging + créer compte test réel.
- **Recommandation sprint planning** : option 2 (seed SQL) pour rapidité + zéro impact prod. 1 h.

## Dépendances

- **Arnaud** : décision option + accès admin Supabase.
- Pas de prérequis bloquant front.

## Estimation

**M (1-2 j)** selon option. Option 2 = 1 h. Option 1 = 0,5 j. Option 3 = 1-2 j (DNS + vérification Resend).

## Plan de test

- TF à re-jouer : [TF-56](https://www.notion.so/35dd0131973c8138858ccb127ac7bb62).
- TF nouveau : *"Compte test shop_only authentifiable en dev sans Resend"*, P00/P01, Superadmin Magrit, P0 outillage, Manuel + SQL DB.
- Smoke SQL : `select user_id, access_scope, allowed_shop_ids from tenant_members where user_id=<test-id>`.

## Définition de « terminé »

- Option implémentée (seed SQL OU edge function OU staging Resend).
- Doc dans `SPRINT_HANDOFF.md` section « Comptes test développement ».
- Re-test TF-56 OK.
- Pas de fuite voie de bypass en prod.
- CR campagne suivante mentionnant la levée de la dette.

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: not-started` — 1 story document BMAD sans signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-E_DEVTOOLS.shop-only-account.md`

## Questions ouvertes

- Relecture produit requise : contenu importé, non approuvé.
- Rattachement à une fonctionnalité produit à arbitrer.
