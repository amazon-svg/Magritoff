---
id: E_DEVTOOLS.shop-only-account
epic: E7 — Perf & infra
source: notion
notion_url: https://app.notion.com/p/35dd0131973c81a898dcc6c547270712
---
# E_DEVTOOLS.shop-only-account — Voie bypass auth Resend dev OU seed shop_only pré-activé

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E_DEVTOOLS.shop-only-account — Voie bypass auth Resend dev OU seed shop_only pré-activé](https://app.notion.com/p/35dd0131973c81a898dcc6c547270712) · extrait le 17/09/2026 · page modifiée le 11/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E7 — Perf & infra | Sprint 4 | P1 | M | Pas commencé | Arnaud | Technique | Cas de test KO | — |

### Description fonctionnelle (Notion)

##### Origine

Campagne TF Sprint 3 du 11/05 — TF-56 Bloqué (dette héritée 10/05).

- Fiche TF : [TF-56](https://www.notion.so/35dd0131973c8138858ccb127ac7bb62)
- CR : [CR 11/05](https://www.notion.so/35dd0131973c8107bf9ad735ab8c5353)

##### Contexte

L'access guard `shop_only` nécessite un compte authentifié avec `access_scope='shop_only'` + manip SQL `tenant_members.allowed_shop_ids`, précondition non remplie en local. Bloqué depuis 10/05 : Resend non opérant en dev, compte `amazon@ageservices.fr` resté pending. **Dette outillage récurrente** : tout futur scénario `Persona=Acheteur shop_only` bloqué. Premier ticket outillage prioritaire selon CR 11/05.

Périmètre : option 1 = endpoint dev-only bypass Resend (magic_link console-side `NODE_ENV=development`) ; option 2 = seed dev shop_only pré-activé (SQL idempotent) ; option 3 = staging Resend ouvert sur domaine vérifié.

##### User story

En tant que Superadmin Magrit / Claude (IA Chrome) chargé des campagnes TF, je veux un compte test `shop_only` authentifiable en local sans Resend, afin de jouer TF-56 et tout scénario Persona=Acheteur shop_only sans blocage outillage récurrent.

##### Critères d'acceptation

1. **Given** `localhost:5177` en `NODE_ENV=development`, **When** j'utilise la voie de bypass implémentée (1/2/3 à arbitrer), **Then** je peux me connecter en `access_scope='shop_only'` + `allowed_shop_ids` configurés, **sans email réel Resend**.
2. **Given** ce compte, **When** je navigue `/shop/<slug-NON-autorisé>`, **Then** rendu 403 `shop-forbidden-403` + absence `shop-portal` + lien retour `/tenants` (cf. TF-56).
3. **Given** voie implémentée, **When** je documente dans `SPRINT_HANDOFF.md` (section « Comptes test développement »), **Then** doc permet provisionner le compte en \< 5 min sur machine vierge.
4. **Sécurité** : voie de bypass NON disponible en prod. Hard-guard `NODE_ENV !== 'production'` ou flag `ALLOW_DEV_LOGIN=true` jamais activé prod.
5. **0 régression** : flux auth standards (login, invitation, magic link prod via Resend) inchangés.
6. **Re-test TF-56** bascule Bloqué → OK.

##### Spécifications

- **Option 1 — endpoint `dev-magic-link`** : `supabase/functions/dev-magic-link/index.ts` génère magic link Supabase + l'écrit console serveur. Garde-fou `if (Deno.env.get('ALLOW_DEV_LOGIN') !== 'true') return Response(403)`.
- **Option 2 — seed SQL dev** : `supabase/seeds/dev_shop_only_account.sql` idempotent ON CONFLICT crée user `acheteur-test@magrit.local` + session pré-générée + insert `tenant_members` avec `access_scope='shop_only'` + `allowed_shop_ids=ARRAY['<shop-id>']`. Password documenté dans `SPRINT_HANDOFF.md`.
- **Option 3 — staging Resend** : vérifier domaine `magrit.fr` sur Resend + activer `RESEND_API_KEY` staging + créer compte test réel.
- **Recommandation sprint planning** : option 2 (seed SQL) pour rapidité + zéro impact prod. 1 h.

##### Dépendances

- **Arnaud** : décision option + accès admin Supabase.
- Pas de prérequis bloquant front.

##### Estimation

**M (1-2 j)** selon option. Option 2 = 1 h. Option 1 = 0,5 j. Option 3 = 1-2 j (DNS + vérification Resend).

##### Plan de test

- TF à re-jouer : [TF-56](https://www.notion.so/35dd0131973c8138858ccb127ac7bb62).
- TF nouveau : *"Compte test shop_only authentifiable en dev sans Resend"*, P00/P01, Superadmin Magrit, P0 outillage, Manuel + SQL DB.
- Smoke SQL : `select user_id, access_scope, allowed_shop_ids from tenant_members where user_id=<test-id>`.

##### Définition de « terminé »

- Option implémentée (seed SQL OU edge function OU staging Resend).
- Doc dans `SPRINT_HANDOFF.md` section « Comptes test développement ».
- Re-test TF-56 OK.
- Pas de fuite voie de bypass en prod.
- CR campagne suivante mentionnant la levée de la dette.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E_DEVTOOLS.shop-only-account

_Aucun fichier du dépôt ne cite cet identifiant._
