---
id: AF16.3
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF16.2]
---

# AF16.3 — Isoler l’identité checkout et le rattachement self-signup

## Résultat livré

- connexion et création de compte du checkout via `AuthContext` ;
- extension non cassante du contrat Auth pour retourner la session obtenue et
  transmettre la société dans les métadonnées d’inscription ;
- commande authentifiée
  `POST /api/v1/shops/{shopId}/buyer-registration` ;
- confinement de `self_register_shop_buyer` dans le repository Shops ;
- retrait complet de Supabase de `CheckoutPage`.

## Invariants

- l’acheteur est dérivé exclusivement du bearer token ;
- aucun identifiant tenant, rôle ou scope n’est accepté depuis le formulaire ;
- la fonction SQL continue d’imposer `active + self_signup`, `shop_only`, une
  allow-list limitée à la boutique et le rôle Acheteur en best-effort ;
- le rattachement reste idempotent ;
- une boutique `invite_only` ne propose toujours aucune création de compte.

## Mesures

- `CheckoutPage` : **4 → 0** références Supabase ;
- baseline globale : **60 → 56** références ;
- fichiers UI important Supabase : **15 → 14**.

## Validation UX attendue

Sur une boutique `self_signup`, créer un compte au checkout puis vérifier le
rattachement et la possibilité de commander. Se déconnecter, se reconnecter
avec ce compte et vérifier que l’appel est idempotent. Sur une boutique
`invite_only`, vérifier que seule la connexion est proposée et qu’un compte
non invité reste refusé.
