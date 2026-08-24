---
id: UM10.33
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.32]
---
# UM10.33 — Isoler le reçu de commande storefront

## Résultat

- `useStorefrontOrderReceipt` porte la lecture du détail de commande ;
- toute requête est annulée au changement de reçu ou au démontage ;
- les états vide, chargement et erreur sont centralisés ;
- `PortalThankYou` ne connaît plus le client Orders et conserve uniquement le
  focus accessible, les calculs d'affichage et le rendu du reçu.

## Validation

- garde-fou d'architecture sur la façade Orders anonyme ;
- tests ciblés du portail et du format de confirmation ;
- suite Vitest complète, typecheck et build de production.
