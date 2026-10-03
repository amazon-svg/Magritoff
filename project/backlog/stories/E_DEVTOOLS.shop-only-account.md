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

> Visait à débloquer la recette en fournissant un compte d'acheteur à périmètre boutique restreint, connectable en local sans dépendre d'un service d'envoi de courriels.

**Story très probablement caduque — à passer en `deprecated` ou `cancelled`.** Sa raison d'être était un blocage précis : « Resend non opérant en dev, compte resté pending ». Ce blocage est levé, et son objet a changé de nature.

- **Le blocage de messagerie n'existe plus.** `ADR-2026-10-01-C2` installe Mailpit dans le socle local (`compose.dev.yml`, service `mail`, interface sur le port 58025). `src/server/node/main.ts` bascule sur l'envoi SMTP dès qu'une configuration SMTP est présente et ne retombe sur le prestataire externe qu'à défaut. En développement, un courriel d'invitation ou d'activation se relève donc localement, sans domaine vérifié ni clé d'API.
- **Deux des trois options proposées sont mortes.** L'option 1 reposait sur une fonction Edge `supabase/functions/dev-magic-link/index.ts` : `ADR-2026-10-01-C1` supprime les fonctions Edge et le dossier `supabase/` n'existe plus. L'option 3 — ouvrir un domaine vérifié chez le prestataire pour un environnement de pré-production — n'a plus d'objet puisque le besoin était de tester en local. Seule l'option 2, un jeu de données local, survit, et elle **est déjà le sujet de `E7.8`**.
- **L'objet lui-même a changé.** La story demande un compte Magrit porteur de `access_scope='shop_only'` et d'une liste de boutiques autorisées. Ces colonnes existent toujours (`infra/postgres/migrations/0026_tenant_members_administration.sql`, `0031_tenant_invitations.sql`), mais le modèle a bougé : un client de boutique dispose désormais d'une identité propre, distincte de l'identité Magrit (`0039_storefront_credentials_sessions.sql` et suivantes, jusqu'à `0044_storefront_delegation_revocation.sql`). Le dépôt traite explicitement l'ancien montage comme un héritage transitoire — `src/modules/tenants/ui/components/LegacyShopOnlyAccessNotice.tsx` : « Une identité Magrit historique ne constitue plus une session storefront ». **Provisionner un compte `shop_only` reviendrait aujourd'hui à outiller la recette d'un modèle en voie de retrait.**

**Ce qui survit.** Le besoin générique demeure : pouvoir se connecter en local, en moins de cinq minutes, avec un compte dont les droits sont restreints à une boutique, pour jouer les parcours d'acheteur. Ce besoin relève de `E7.8` (jeu de données de recette), sur le modèle d'identité **actuel** — un compte client de boutique, pas une adhésion Magrit restreinte.

## Valeur métier

Historique. La valeur recherchée — ne pas laisser une campagne de recette bloquée par une dette d'outillage — est réelle et reste valable, mais elle n'a plus besoin de cette story pour être servie.

## Besoin utilisateur

**En tant que** responsable des campagnes de recette, **je voulais** un compte de test à périmètre boutique restreint, connectable en local sans service de courriel externe, **afin de** jouer les parcours d'acheteur sans blocage récurrent. Le besoin subsiste ; sa formulation en termes de `shop_only` et de contournement d'un prestataire de messagerie ne subsiste pas.

## Comportement attendu

Sans objet sous cette forme. Le comportement équivalent aujourd'hui, si la décision est de couvrir le besoin : le jeu de recette crée un compte client de boutique déjà activé, utilisable immédiatement, et le courriel d'activation — s'il y en a un — se relève dans Mailpit.

## Expérience utilisateur

Story sans surface utilisateur : elle ne concerne que l'environnement de développement et de recette.

## Règles métier

- `RM-01` — *(survit)* Un compte de test à droits restreints doit être provisionnable en local sans dépendre d'un service externe.
- `RM-02` — *(survit, et c'est la règle essentielle)* Aucune voie de contournement d'authentification n'est disponible en production. Le garde-fou est dans le code, pas dans une consigne.
- `RM-03` — *(survit)* Les parcours d'authentification normaux restent inchangés : l'outillage de recette ne les modifie pas.
- `RM-04` — *(survit)* Le provisionnement est documenté et exécutable en moins de cinq minutes sur une machine vierge.
- `RM-05` — *(caduque)* Le compte porte `access_scope='shop_only'` et une liste de boutiques autorisées. Ce modèle est déclaré transitoire par le dépôt.

## Critères d'acceptation

_Les critères de la source portent sur une voie de contournement d'un prestataire de messagerie, sur une fonction Edge `dev-magic-link`, sur un jeu `supabase/seeds/dev_shop_only_account.sql`, sur le port 5177 et sur la reprise d'un cas de test hébergé dans Notion. **Aucun de ces objets n'existe plus** : ces critères ne sont pas vérifiables et ne sont pas réécrits ici, la story étant proposée au retrait._

Un seul critère de la source survit et mérite d'être transporté ailleurs, car il porte un risque de sécurité réel :

- `AC-01` — Étant donné une configuration de production, quand on cherche une voie d'authentification réservée au développement, alors il n'en existe aucune qui soit activable. **Constaté** : aucun indicateur de ce type dans le dépôt — pas de `ALLOW_DEV_LOGIN` ni d'équivalent. La règle est donc aujourd'hui respectée par absence, ce qui est le meilleur état possible : toute story d'outillage futur doit la préserver.

## Cas limites

- **Le garde-fou doit survivre au retrait de la story.** Si une voie de connexion simplifiée est un jour introduite pour la recette, `RM-02` redevient critique. La retirer avec la story ferait perdre la trace du risque.
- **Le cas de test d'origine reste pertinent.** La source vise un comportement précis : un acheteur restreint qui demande une boutique non autorisée doit obtenir un refus (identifiant `shop-forbidden-403`, toujours déclaré dans `src/shared/presentation/testIds.ts`, aux côtés de `shop-portal`). Ce contrôle de droits mérite d'être couvert, sur le modèle d'identité actuel, indépendamment du sort de cette story.
- **Le recouvrement avec `E7.8` est total.** L'option recommandée par la source — un jeu de données local idempotent — est exactement ce que décrit `E7.8`. Maintenir les deux stories reviendrait à écrire deux fois le même script.

## Hors périmètre

- Le jeu de données de recette dans son ensemble (`E7.8`).
- Le modèle d'identité des clients de boutique et son activation, portés par les migrations `0039` à `0044`.
- L'instrumentation de l'interface pour la recette (`E7.7`).
- La configuration de l'envoi de courriels en production.

## Dépendances et décisions

- `ADR-2026-10-01-C1` — plus de fonctions Edge : l'option 1 de la source est morte.
- `ADR-2026-10-01-C2` — Mailpit dans le socle local : la motivation principale de la story est levée.
- `ADR-2026-10-01-C5` — schéma regroupé, données historiques non reprises : le compte visé par la source n'existe plus et ne peut pas être « débloqué ».
- `E7.8` — jeu de données de recette. Absorbe le besoin résiduel. Non ajoutée en frontmatter : le rattachement doit accompagner la décision de retrait, pas la précéder.
- La source s'appuie sur des cas de test et des comptes rendus hébergés dans Notion, qui n'est plus source de vérité (`project/governance/source-of-truth.md`).

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: not-started` — 1 story document BMAD sans signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-E_DEVTOOLS.shop-only-account.md`

## Questions ouvertes

- **Question principale : cette story passe-t-elle en `deprecated` ou en `cancelled` ?** `deprecated` si l'on considère que son besoin est repris par `E7.8` ; `cancelled` si l'on considère que son objet — un compte `shop_only` contournant un prestataire de messagerie — n'a jamais existé et n'a plus lieu d'être. Le `specStatus` n'est pas modifié ici.
- Le besoin résiduel — un compte d'acheteur restreint, connectable en local — est-il explicitement versé dans `E7.8` ? Sans cela, le retrait fait perdre un besoin légitime.
- La règle « aucune voie de contournement d'authentification en production » est-elle transportée ailleurs — règle d'architecture, leçon, critère transverse ? Elle est aujourd'hui respectée par absence, ce qui ne la garantit pas pour demain.
- Le contrôle de droits visé par le cas de test d'origine (refus d'accès à une boutique non autorisée) est-il couvert par un test automatisé sur le modèle d'identité actuel ?
- Les anciennes adhésions `shop_only` sont-elles destinées à disparaître complètement, et à quelle échéance ? La réponse conditionne l'intérêt de tout outillage les concernant.
- Rattachement à une fonctionnalité produit à arbitrer (`FEAT-E7-UNCLASSIFIED` est un regroupement de migration).
- Relecture produit requise : contenu issu d'un import, non approuvé.
