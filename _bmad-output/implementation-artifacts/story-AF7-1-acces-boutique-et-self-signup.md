---
id: AF7.1
epic: EPIC-8-API-FIRST
priority: P0
status: done
branch: refactor/api-first-foundation
depends_on: [AF7, S7.11]
---

# AF7.1 — Accès boutique et commande self-signup

## Incident

Un compte créé hors du checkout pouvait consulter une boutique `invite_only`
sans invitation, puis obtenait `orders.permission_denied` à la commande. Le
garde historique assimilait toutes les boutiques à une surface publique et
acceptait les comptes sans membership.

## Règles livrées

- `invite_only` anonyme : écran privé générique, connexion uniquement ;
- `invite_only` authentifié : accès limité à la membership du tenant
  propriétaire (`magrit_full` ou `shop_only` incluant la boutique) ;
- une membership d'un autre tenant ne donne aucun accès ;
- aucune donnée de marque, produit, prix, PIM ou gamme n'est chargée avant la
  décision d'accès ;
- `self_signup` reste consultable publiquement et rattache atomiquement un
  compte authentifié lors de sa première commande ;
- la fonction SQL interne de création est exécutable uniquement par son
  propriétaire, le wrapper public uniquement par `authenticated`.

## Validation

- 9 tests unitaires du garde d'accès ;
- build Vite réussi ;
- smoke UX local : compte non membre refusé, anonyme redirigé vers une
  connexion sans action « Créer un compte » ;
- ACL locale vérifiée : wrapper `authenticated`, core `postgres` uniquement.
