---
id: UM2.6
epic: EPIC-UM-STORE-IDENTITY
priority: P1
status: done
branch: feat/storefront-identity-um2
depends_on: [UM2.5]
---
# UM2.6 — Résoudre et révoquer une session storefront

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- résolution d’une session depuis le hash SHA-256 du cookie opaque ;
- contrôle conjoint compte, boutique, expiration, révocation et type de session ;
- actualisation atomique de `last_seen_at` ;
- prise en charge future des délégations `delegated_only` sans autoriser une
  connexion directe sur ces comptes ;
- révocation idempotente sans révéler l’existence du jeton ;
- primitives accessibles au seul rôle d’infrastructure minimal `anon`.

Les routes GET/DELETE et l’extraction stricte du cookie seront assemblées dans
la story suivante.
