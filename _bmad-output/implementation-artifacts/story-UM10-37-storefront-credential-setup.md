---
id: UM10.37
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.36]
---
# UM10.37 — Isoler les parcours de mot de passe storefront

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat

- `useStorefrontCredentialSetup` pilote l'activation d'une invitation et la
  récupération du mot de passe boutique ;
- le jeton éphémère et la nature du parcours sont fournis explicitement au hook ;
- validation, attente, succès et erreurs neutralisées sont centralisés ;
- les pages d'activation et de récupération ne connaissent plus le client identité ;
- aucun compte, bearer ou mécanisme d'authentification Magrit n'est réutilisé.

## Validation

- garde-fous d'architecture adaptés à la nouvelle frontière ;
- suite Vitest complète, typecheck et build de production.
