---
id: UM10.29
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.28]
---
# UM10.29 — Révoquer visuellement une session boutique expirée

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Problème

La session storefront était lue uniquement au montage. Une expiration, une
révocation serveur ou une fermeture depuis un autre onglet laissait donc le
compte et le catalogue privé affichés jusqu'au rechargement manuel de la page.

## Résultat

- la session est revalidée silencieusement au retour du focus navigateur ;
- une session active est aussi contrôlée toutes les quinze secondes lorsque la
  page est visible ;
- un 401 retire immédiatement l'identité boutique et réactive la garde privée ;
- une panne technique bascule vers l'état fail-closed livré en UM10.28 ;
- un compteur de version empêche une ancienne réponse réseau d'écraser une
  authentification ou une déconnexion plus récente ;
- la fermeture de session ne peut pas entrer en concurrence avec une
  revalidation de focus.

## Validation

- garde-fous d'architecture sur le focus, la visibilité et la façade anonyme ;
- tests de classification des erreurs de session ;
- recette normale du profil boutique conservée ;
- suite Vitest complète, typecheck et build.
