---
id: UM10.12
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.8, UM10.11]
---
# UM10.12 — Autoriser l’éditorial IA par session boutique

## Problème

UM10.8 avait supprimé l’emprunt du bearer Magrit, au prix d’un fallback
déterministe systématique : la route éditoriale existante exigeait un membre du
tenant. Il fallait restaurer l’enrichissement sans réintroduire de profil mixte.

## Résultat

- nouvelle route publique
  `POST /api/v1/public/shops/:slug/assistant/category-editorial` ;
- le navigateur transmet uniquement le slug et le contenu éditorial demandé ;
- le BFF lit le cookie HttpOnly, résout la session, charge le probe boutique et
  exige la correspondance exacte des identifiants boutique ;
- le tenant nécessaire au suivi reste dérivé côté serveur ;
- le service réutilise la même génération et le même fallback déterministe que
  l’éditorial workspace.

## Validation

- test de succès avec slug autorisé ;
- test de refus avant fournisseur IA pour une session absente ou inadéquate ;
- tests du proxy conversationnel, garde-fou storefront, typecheck, suite Vitest
  et build de production.
