---
id: AF26.15
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF26.14]
---
# AF26.15 — Composer la navigation workspace depuis le registre

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- suppression des recherches et constantes de navigation propres à chaque
  module dans `DashboardLayout` ;
- génération des quatre groupes à partir de `workspaceSurface.navigation` ;
- résolution générique des routes et des icônes par identifiant ;
- attributs déclaratifs `exact` et `nested` portés par les contributions ;
- conservation des test IDs, de l'ordre et des politiques de visibilité ;
- garde-fou empêchant le retour d'une liste de libellés codée dans le layout.

Le shell React reste volontairement propriétaire du mapping d'icônes et des
politiques dépendant de l'utilisateur courant (`isAdmin`, plan, tenant racine).
Les modules décrivent leur intention de navigation sans importer React ni
connaître les hooks d'authentification de l'hôte.
