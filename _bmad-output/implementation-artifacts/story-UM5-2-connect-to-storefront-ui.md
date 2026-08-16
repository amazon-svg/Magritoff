---
id: UM5.2
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM5.1]
---
# UM5.2 — Se connecter à la boutique depuis Magrit

- action principale « Se connecter à la boutique » dans la gestion des comptes
  de la boutique ;
- appel unique composant la garantie du compte miroir et la délégation ;
- ouverture anticipée d’un nouvel onglet afin d’éviter le blocage popup ;
- suppression immédiate de `window.opener` avant navigation ;
- aucun jeton lu, stocké ou transmis par le composant ;
- façade storefront anonyme pour lire et fermer le cookie de session ;
- bandeau sticky permanent indiquant le compte joué et rappelant que les
  actions restent attribuées à l’utilisateur Magrit ;
- action « Quitter ce mode » révoquant session et audit, puis rechargeant la
  boutique sans délégation ;
- erreurs d’ouverture et de sortie visibles pour l’utilisateur.

Cette UX conserve deux identités distinctes : la session Magrit demeure active
dans son propre contexte, tandis que le cookie storefront porte uniquement la
délégation courte. UM6 devra migrer les commandes et autres écritures métier
pour enregistrer simultanément le compte boutique et l’acteur Magrit réel.
