---
id: UM6.6
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM6.5]
---
# UM6.6 — Connecter le checkout avec le compte boutique

- façade storefront exposant la création de session BFF existante ;
- formulaire de connexion boutique partagé entre la garde privée et le
  checkout ;
- boutique `invite_only` toujours protégée avant le chargement du catalogue ;
- suppression de `signIn`, `signUp` et de l'inscription `shop_only` héritée du
  parcours storefront ;
- aucune création ou réutilisation implicite d'un utilisateur Magrit ;
- activation du bouton Commander uniquement si la session appartient à la
  boutique exacte ;
- coexistence possible avec une session Magrit du navigateur sans assimilation
  des deux identités ;
- auto-inscription storefront retirée tant que sa primitive compte boutique
  dédiée n'est pas livrée.

La récupération de mot de passe et l'auto-inscription `self_signup` devront
utiliser le même domaine boutique, sans réintroduire Supabase Auth dans le
navigateur.
