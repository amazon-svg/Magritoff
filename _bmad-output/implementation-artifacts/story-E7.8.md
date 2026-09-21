---
id: E7.8
epic: E7 — Perf & infra
source: notion
notion_url: https://app.notion.com/p/358d0131973c817399cccff5d7acb844
---
# E7.8 — Seed SQL pour les cahiers de tests fonctionnels

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E7.8 — Seed SQL pour les cahiers de tests fonctionnels](https://app.notion.com/p/358d0131973c817399cccff5d7acb844) · extrait le 17/09/2026 · page modifiée le 06/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E7 — Perf & infra | Sprint 2 | P0 | S | Pas commencé | Claude code | Technique | Demande 05/05 | — |

### Description fonctionnelle (Notion)

**En tant que** testeur (Arnaud, Claude in Chrome ou client test à venir), **je veux** un script SQL de seed qui peuple l'environnement Beta 4 avec un jeu de données de référence en une commande, **afin de** pouvoir rejouer les cahiers de tests fonctionnels sans préparation manuelle et garantir que tous les testeurs partent du même état initial.

##### Contexte

Les cahiers de tests fonctionnels (P00 à P11) reposent sur un jeu de données de référence : deux tenants (`acme-print`, `studio-aubin`), une boutique (`studio-aubin-main`), des utilisateurs aux rôles variés, et quelques invitations en attente. Aujourd'hui, ces états doivent être constitués manuellement avant chaque session de test — c'est consommateur en temps et source d'incohérences entre testeurs.

##### Critères d'acceptation

- Fichier `supabase/seeds/test_fixtures.sql` créé dans `Magritoff-v4/`.
- Commande npm dédiée : `npm run seed:test` qui exécute le script via le CLI Supabase.
- Le script est **idempotent** : exécuté deux fois, il ne crée pas de doublons (utilisation de `ON CONFLICT DO NOTHING` ou de `DELETE` préalable scopé aux fixtures).
- Le script peuple :
  - Tenants : `acme-print` (Acme Print, SIREN 552120222) et `studio-aubin` (Studio Aubin, SIREN 632012100).
  - Boutique : `studio-aubin-main` rattachée au tenant `studio-aubin`.
  - Utilisateurs (avec mots de passe `Test1234!` ou `Admin1234!` selon le rôle) :
    - `owner@acme.fr` (owner d'acme-print)
    - `admin@acme.fr` (admin d'acme-print, scope magrit_full)
    - `admin2@acme.fr` (admin d'acme-print, pour les tests de cumul d'admins)
    - `member@acme.fr` (member d'acme-print)
    - `owner@studio.fr` (owner de studio-aubin)
    - `acheteur@studio.fr` (member shop_only de studio-aubin, allowed_shop = studio-aubin-main)
  - Invitations en attente : 1 invitation `pending` créée par `owner@acme.fr` pour un email fictif (utile pour les tests de révocation et renvoi).
- Commande npm de **reset** : `npm run seed:test:reset` qui purge toutes les fixtures (tenants, users, invitations, memberships, events) avant d'appeler le seed.
- Documentation dans `Magritoff-v4/docs/SEED_TEST_FIXTURES.md` listant les utilisateurs, mots de passe, IDs et leur usage dans quels parcours de tests.

##### Spécifications techniques

- Le seed crée les utilisateurs via les API `auth.admin.createUser()` du service Supabase (nécessite la `service_role_key`), pas via signup public (pour bypass de la validation SIREN qui n'a pas lieu d'être dans le seed).
- Les mots de passe sont en clair dans le script (acceptable car environnement local de test uniquement — ne pas commit la `service_role_key` du projet B4 dans le code, l'extraire d'un `.env.local` git-ignoré).
- La création des memberships et permissions passe directement par INSERT SQL (cf. RPC `create_tenant_member` ou table `tenant_memberships`).

##### Dépendances

- Beta 4 opérationnelle (E7.4 — livrée).
- Tables `tenant_memberships`, `tenant_invitations`, `tenant_member_events`, `shops` opérationnelles (E9.1 à E9.4 — livrées).

##### Articulation avec les cahiers de tests

Une fois cette story livrée, le champ « Précondition » des cas de test peut être simplifié : remplacer les longues descriptions d'état par une simple référence du type « État initial : seed `npm run seed:test:reset && npm run seed:test` exécuté ». À mettre à jour en masse dans Notion une fois le seed disponible.

##### Red flag

Ne pas inclure de données de production dans le seed. Le script doit explicitement vérifier qu'il s'exécute sur l'environnement local (URL `localhost:54321` ou nom de projet `magrit-b4`) et refuser sinon — garde-fou contre une exécution accidentelle sur un environnement non local.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E7.8

- `_bmad-output/planning-artifacts/prd.md`
