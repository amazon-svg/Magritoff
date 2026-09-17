---
id: UM2.8
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM2.7]
---
# UM2.8 — Activer un credential boutique par jeton

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

- jeton aléatoire 256 bits, seul son SHA-256 est conservé ;
- émission réservée aux utilisateurs Magrit avec `can_manage_shop_customers` ;
- durée bornée entre quinze minutes et sept jours ;
- un seul jeton actif par compte ;
- activation publique neutre, à usage unique et protégée par vérification factice ;
- mot de passe `bcrypt-sha256-v1`, versionné et remplaçable ;
- passage atomique du compte à `active` et révocation des anciennes sessions.

UM3 branchera l’envoi email et le lien d’activation sur ces primitives.
