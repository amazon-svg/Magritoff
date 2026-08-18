---
id: UM2.11
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM2.10, UM8.4]
---
# UM2.11 — Ouvrir la session boutique pendant l’activation

## Résultat

- le lien d’activation reste public, neutre, limité dans le temps et à usage
  unique ;
- la validation du mot de passe active le compte, consomme le lien, révoque les
  anciennes sessions et émet une session directe dans une seule transaction
  SQL ;
- le BFF place le jeton opaque dans le cookie storefront `HttpOnly` et ne
  renvoie au navigateur que l’identité publique de session ;
- l’écran d’activation redirige immédiatement vers la boutique, sans second
  formulaire de connexion ;
- la session créée est strictement celle du compte de cette boutique : aucune
  session Magrit n’est convertie ou partagée.

## Validation

- tests du contrat HTTP, du cookie et du refus neutre ;
- test SQL transactionnel couvrant l’émission de session et la non-réutilisation
  du lien ;
- intégration du scénario d’activation dans la suite SQL storefront ;
- tests Vitest ciblés, typecheck modulaire, suite complète et build Vite.
