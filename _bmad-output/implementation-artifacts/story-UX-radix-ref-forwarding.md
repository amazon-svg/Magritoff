---
id: UX-RADIX-REF
status: done
branch: feat/storefront-identity-um2
---
# UX — Supprimer les warnings de ref des modales Radix

## Problème

Sous React 18, `DialogOverlay` et les wrappers associés recevaient une `ref`
injectée par Radix `Slot`, mais la perdaient car ils étaient déclarés comme de
simples fonctions. Chaque ouverture de certaines modales produisait le warning
« Function components cannot be given refs ».

## Correction

- `forwardRef` sur les triggers, overlays, contenus, titres et descriptions de
  `Dialog` et `AlertDialog` ;
- `forwardRef` sur les actions de confirmation ;
- `forwardRef` sur `Button` pour les compositions Radix `asChild` ;
- `displayName` conservé pour React DevTools.

## Validation

- aucun warning de ref après ouverture réelle des panneaux sur localhost ;
- test d’architecture dédié ;
- typecheck, suite applicative et build de production.
