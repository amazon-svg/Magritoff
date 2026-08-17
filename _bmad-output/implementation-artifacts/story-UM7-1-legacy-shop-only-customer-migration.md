---
id: UM7.1
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM6.8]
---
# UM7.1 — Migrer les anciens utilisateurs `shop_only`

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
