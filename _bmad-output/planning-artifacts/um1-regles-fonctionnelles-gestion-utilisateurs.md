---
id: UM1-REGLES-FONCTIONNELLES
title: UM1 — Règles fonctionnelles de la gestion des utilisateurs
date: 2026-08-14
revised: 2026-08-14 (v1.1 — profils + options)
status: validated
decision_owner: Arnaud (produit)
plan: instructions UM1→UM4 de Xavier Péchoultres (2026-08-13)
related: SPEC-IDENTITY-STORE-01 (séparation des populations — fait foi)
---

# UM1 — Règles fonctionnelles de la gestion des utilisateurs

Livrable de l'étape UM1 du plan de Xavier : la matrice profils × surfaces ×
actions et les règles qui l'accompagnent. Validé par Arnaud le 2026-08-14.

## 1. Principes

1. **Deux populations strictement séparées** (SPEC-IDENTITY-STORE-01) : les
   utilisateurs Magrit (équipe du tenant) et les utilisateurs boutique
   (clients). Aucun profil mixte. Un utilisateur Magrit qui doit agir dans une
   boutique passe par le **compte miroir** (« créer un utilisateur pour moi »)
   ou la **délégation** (« se connecter comme »), sans fusion d'identité.
2. **La surface visible est une conséquence des droits**, jamais un type de
   compte stocké.
3. **Côté Magrit, deux profils et deux options — pas de catalogue de rôles**
   (v1.1, décision 2026-08-14) :
   - **admin** : tout. La distinction owner/admin n'existe plus (migration
     `20260814000200`) ; le dernier admin d'un espace ne peut être ni
     rétrogradé ni retiré (contrôle serveur). Le profil `partner` est
     supprimé (migration `20260814000400`).
   - **utilisateur** : socle devis — créer, imprimer, gérer les statuts,
     transmettre — plus deux **options** activables par l'admin :
     · **Boutiques** — créer des boutiques et administrer les siennes ;
     · **Commandes** — administrer les commandes : valider, modifier, gérer
       les statuts, exporter, annuler (Validateur et Producteur absorbés).
   Les options sont des rôles système identifiés par une clé produit
   (`option_shops`, `option_orders`), jamais par leur nom. La restriction
   « commandes des seules boutiques auxquelles le commercial est associé »
   s'activera avec les comptes miroir (le lien commercial↔boutique n'a pas
   encore de support de données) ; d'ici là l'option couvre les commandes de
   l'espace.
4. **« Acheteur » est un rôle côté boutique** : un utilisateur client d'une
   boutique auquel ce rôle est assigné, avec pour prérogative de valider les
   achats quand un workflow de validation est actif. Ce n'est pas un profil
   interne Magrit.
5. Les rôles Magrit **se cumulent** : les capabilities effectives sont l'union
   de celles des rôles actifs.

## 2. Matrice profils × surfaces × actions

| Profil | Population | Surfaces | Boutiques | Actions |
|---|---|---|---|---|
| **Admin** (du tenant) | Magrit | workspace + backoffice | toutes (gestion) | toutes les capabilities |
| **Utilisateur** (profil `member`) | Magrit | workspace | aucune en propre | socle devis ; + option **Boutiques** et/ou **Commandes** selon les cases cochées par l'admin |
| **Client boutique** | Boutique | storefront + portail, une seule boutique | la sienne | acheter, panier, commandes, historique |
| **Client — rôle Acheteur** | Boutique | idem client | la sienne | en plus : valider les achats quand un workflow de validation est actif |
| **Compte miroir** (Magrit → boutique) | Boutique | storefront + portail, une boutique | celle du miroir | comme un client ; création explicite, idempotente |
| **Délégation** (« se connecter comme ») | session auditée | storefront, une boutique | celle du client joué | périmètre à arbitrer (SPEC-IDENTITY-STORE-01 §14) |

Règles transverses : une session boutique ne change jamais de boutique ; un
refus cross-tenant ne révèle rien ; toute action déléguée trace l'acteur Magrit
réel et le compte joué.

## 3. Pages d'arrivée (validées 2026-08-14)

| Profil | Arrivée après connexion / invitation |
|---|---|
| Admin | l'atelier de son espace (dernier espace ouvert si plusieurs — `last_tenant_id`) ; backoffice à un clic |
| Utilisateur | l'atelier ; les écrans hors de son socle et de ses options n'apparaissent pas |
| Client boutique | la page d'accueil de **sa** boutique, connecté |
| Client — rôle Acheteur | idem, avec compteur « commandes à valider » dès l'entrée du portail |
| Compte miroir / délégation | la boutique concernée ; bandeau permanent en délégation (acteur réel affiché) |
| Sans accès valide | écran explicatif avec un moyen de demander l'accès — jamais une page vide |

## 4. Cycle de vie d'une boutique (validé 2026-08-14)

- **Désactivée** : conservée tant qu'elle n'est pas supprimée, et ré-ouvrable à
  tout moment pendant cette période.
- **Supprimée** : tout son contenu est supprimé, **sauf les commandes déjà
  validées**. Des messages d'alerte à la suppression avertissent
  l'administrateur des implications. Une fois effective, la suppression est
  **définitive**.

## 5. Invitations : deux parcours distincts

1. **Invitation équipe Magrit** — crée ou rattache un utilisateur Magrit au
   tenant, avec un profil (admin ou collaborateur à rôles).
2. **Invitation utilisateur boutique** — crée un compte boutique
   `(boutique, email)`, sans appartenance au tenant ni rôle interne.

Contrats, emails et écrans séparés (SPEC-IDENTITY-STORE-01 §10). Le lien manuel
d'invitation est montré quand l'email n'est pas envoyé ; modification,
suspension et renvoi d'invitation sont possibles (UM3).

## 6. Déjà appliqué au moment de la rédaction

| Décision | Application |
|---|---|
| Droits admin dérivés de l'appartenance, plus de synchronisation par nom de rôle | migration `20260814000100`, en prod |
| Admin unique, owner inécrivable, dernier admin protégé | migration `20260814000200` + purge code (commit `f5fd9c2`), en prod |
| Rôle « Owner » archivé du catalogue | migration `20260814000300`, en prod |
| Profils + options (partner supprimé, options seedées dans 225 espaces, Validateur/Producteur repris) | migration `20260814000400`, en prod |

## 7. Points ouverts (hors périmètre UM1)

- Périmètre exact d'une délégation (navigation / panier / commande test) — §14
  de la spec de Xavier, arbitrage à venir.
- Migration des membres `shop_only` existants vers des comptes boutique — UM7
  du découpage de la spec.
- UM2 : unification `access_scope` + `allowed_shop_ids` + rôles, contrat
  `UserAccessProfile`, suppression des booléens dupliqués
  (`can_quote`/`can_order`/`can_invite` sur `tenant_members`).
