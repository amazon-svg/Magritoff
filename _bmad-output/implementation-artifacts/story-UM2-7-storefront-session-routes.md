---
id: UM2.7
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM2.6]
---
# UM2.7 — Lire et fermer la session storefront

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

- extraction stricte du cookie selon la politique locale ou sécurisée ;
- `GET /api/v1/storefront/session/current` avec réponse sans cache ;
- `DELETE /api/v1/storefront/session/current` idempotent ;
- révocation serveur avant effacement systématique du cookie ;
- adaptateur Supabase des primitives UM2.6 ;
- support contractuel des sessions directes et déléguées.

Le checkout reste inchangé jusqu’à la livraison du parcours d’activation.
