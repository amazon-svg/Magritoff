---
id: UM10.36
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.35]
---
# UM10.36 — Isoler le formulaire d'identité storefront

## Résultat

- `useStorefrontIdentityForm` pilote connexion, inscription et récupération ;
- chaque commande conserve obligatoirement le `shopSlug` courant ;
- les modes et messages d'erreur restent propres au compte boutique ;
- `StorefrontLoginForm` devient une vue sans accès au client identité ;
- aucun lien, bearer ou mécanisme Supabase Auth de Magrit n'est réutilisé.

## Validation

- garde-fous checkout et API-first adaptés à la nouvelle frontière ;
- suite Vitest complète, typecheck et build de production.
