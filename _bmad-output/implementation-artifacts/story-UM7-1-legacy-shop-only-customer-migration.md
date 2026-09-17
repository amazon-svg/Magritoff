---
id: UM7.1
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM6.8]
---
# UM7.1 — Migrer les anciens utilisateurs `shop_only`

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-149](https://app.notion.com/3c6d0131973c81e2abadd93317bda387) | UM — Connexion d un ancien accès shop_only : écran Activation boutique nécessaire, plus de redirection boutique | OK | P0 — Critique | P01 — Onboarding premier login | B5 | UM7-1, UM8-1, UM8-2, AF30-5, AF30-7 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Décision fonctionnelle

Un compte client appartient à une seule boutique. Un ancien utilisateur Magrit
autorisé sur plusieurs boutiques devient donc plusieurs comptes boutique, même
si l'adresse email est identique.

Son identifiant Supabase Auth historique n'est affecté à aucun de ces comptes :
une identité technique unique ne doit pas recréer un profil transverse. Les
comptes migrés sont `delegated_only` et devront être activés séparément dans
chaque boutique.

## Résultat

- plan de migration consultable sans écriture ;
- réutilisation explicite d'un compte `(boutique, email)` déjà présent ;
- création idempotente des autres comptes boutique ;
- rattachement des commandes historiques au compte de leur boutique ;
- conservation temporaire du membre `shop_only`, de l'auteur historique et de
  l'utilisateur Auth pour permettre contrôle et rollback opérationnel ;
- journal privé par utilisateur et boutique, incluant les lignes ignorées et le
  nombre de commandes rattachées ;
- rapport accessible aux seuls utilisateurs ayant `can_manage_shop_customers`.

## Hors périmètre

La suppression du modèle `shop_only`, des invitations legacy et des branches UI
associées appartient à UM8, après validation des rapports de migration.

## Validation

- test d'architecture de la frontière d'identité ;
- scénario SQL transactionnel avec deux boutiques, collision, commandes
  historiques et rejeu idempotent ;
- aucun effacement de `tenant_members` ou `auth.users`.
