---
id: UM10.3
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM8.1, UM8.3]
---
# UM10.3 — Retirer l’ancienne UI de profil mixte

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat

- suppression du formulaire mort `EditPermissionsModal` et de son sélecteur
  `magrit_full / shop_only` dans `DashboardUsers` ;
- suppression de la commande morte qui pouvait encore tenter d’écrire un
  `shop_only` depuis la surface utilisateurs Magrit ;
- conservation de la lecture des lignes historiques et de leur unique action
  autorisée : promotion vers `magrit_full` ;
- garde-fou d’architecture empêchant le retour du formulaire, de la valeur
  `shop_only` ou d’une branche d’écriture équivalente dans le dashboard.

## Validation

- typecheck modulaire ;
- 60 tests d’architecture ciblés.
