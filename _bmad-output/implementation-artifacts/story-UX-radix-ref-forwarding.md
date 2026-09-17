---
id: UX-RADIX-REF
status: done
branch: feat/storefront-identity-um2
---
# UX — Supprimer les warnings de ref des modales Radix

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

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
