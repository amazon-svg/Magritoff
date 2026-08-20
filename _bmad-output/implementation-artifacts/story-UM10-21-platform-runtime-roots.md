---
id: UM10.21
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.20]
---
# UM10.21 — Séparer les racines de runtime navigateur

## Problème

La frontière de route storefront ne montait plus l'authentification Magrit,
mais elle importait encore le runtime navigateur commun. Ce module chargeait
statiquement l'adaptateur Supabase Auth du workspace. La séparation des
providers était donc correcte à l'exécution sans être complète dans le graphe
de dépendances.

## Résultat

- le runtime workspace conserve Auth Magrit, assistant interne, mockups et
  tarification ;
- un runtime storefront distinct ne contient que l'assistant boutique et la
  passerelle de tarification publique ;
- la frontière `/shop/...` ne référence plus le runtime workspace ;
- le contexte de services storefront exige désormais le type minimal
  `StorefrontBrowserRuntime` ;
- aucun import Supabase Auth ou `AuthenticationGateway` n'est autorisé dans la
  racine de runtime storefront.

## Validation

- garde-fou sur l'absence de l'adaptateur Supabase Auth dans le runtime
  storefront ;
- garde-fou sur le runtime explicitement injecté dans la frontière boutique ;
- typecheck, suite Vitest complète et build de production.
