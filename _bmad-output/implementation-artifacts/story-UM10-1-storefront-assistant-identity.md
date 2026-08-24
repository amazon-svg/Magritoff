---
id: UM10.1
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM8.4, UM2.11]
---
# UM10.1 — Séparer l’identité de l’assistant storefront

## Résultat

- le catalogue boutique n’importe plus `AuthContext` et ne transmet plus le
  bearer Supabase de l’utilisateur Magrit à la recherche IA ;
- la commande assistant porte seulement le slug demandé ; le BFF résout le
  cookie `HttpOnly`, vérifie que la session appartient exactement à cette
  boutique, puis dérive côté serveur le compte client et le tenant de suivi ;
- le chat Magrit conserve son propre parcours par bearer et membership tenant ;
- une session boutique utilisée sur un autre slug est refusée avant tout appel
  au fournisseur IA ;
- les suggestions générées dans le storefront restent éphémères et
  commandables. Le client boutique ne reçoit plus le droit Magrit historique
  de publier ces produits dans le catalogue partagé.

## Validation

- tests du proxy : contexte Magrit, contexte boutique, mauvais slug et contrat
  invalide ;
- test de l’adaptateur navigateur sans en-tête `Authorization` ;
- garde-fou d’architecture interdisant `useAuth` et `useShopsApi` dans le
  catalogue storefront ;
- test HTTP local : cookie de la bonne boutique → `200`, mauvais slug → `403` ;
- suite Vitest, typecheck modulaire et build Vite.
