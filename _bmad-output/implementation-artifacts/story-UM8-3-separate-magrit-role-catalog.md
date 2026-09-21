---
id: UM8.3
epic: EPIC-UM-STORE-IDENTITY
status: done-code
branch: feat/storefront-identity-um2
depends_on: [UM8.1]
---
# UM8.3 — Séparer le catalogue de rôles Magrit

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Objectif

Empêcher qu'un compte Magrit reçoive encore le rôle historique « Acheteur »,
désormais remplacé par un compte propre à chaque boutique.

## Résultat

- les rôles portent un contexte d'identité explicite ;
- les rôles équipe sont `magrit` ;
- le rôle Acheteur existant devient `storefront_legacy` et reste conservé pour
  l'audit et la migration ;
- les listes de rôles, invitations et écrans d'assignation Magrit n'exposent
  que le contexte `magrit` ;
- PostgreSQL bloque une nouvelle assignation ou propagation d'un rôle
  storefront vers un membre Magrit ;
- les assignations historiques restent lisibles et révocables.

## Validation

- scénario SQL avec invitation Magrit autorisée et rôle Acheteur refusé ;
- tests des frontières de repository ;
- typecheck, suite applicative et build.
