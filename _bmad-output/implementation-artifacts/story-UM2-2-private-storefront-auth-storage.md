---
id: UM2.2
epic: EPIC-UM-STORE-IDENTITY
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [UM2.1]
---
# UM2.2 — Isoler le stockage d’authentification storefront

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- schéma PostgreSQL `private`, non exposé à PostgREST ;
- credentials par compte boutique avec schéma versionné `bcrypt-sha256-v1` ;
- compteur d’échecs et verrouillage temporel prévus dans le modèle ;
- sessions par compte et boutique avec hash SHA-256 du jeton opaque ;
- contrainte composite empêchant une session de changer de boutique ;
- modèle direct/délégué conservant l’acteur Magrit pour la suite UM5 ;
- RLS default-deny et absence de grants `anon`/`authenticated` ;
- aucune clé `service_role` ajoutée à `magrit-api`.

## Non livré dans cette story

Les fonctions d’activation, de vérification et d’émission de session restent
fermées. Elles devront être exposées par des primitives étroites, avec limitation
des tentatives, messages neutres et rotation du jeton dans UM2.3. Le SHA-256
préalable évite la limite de longueur bcrypt tout en conservant le hash final dans
le schéma privé.
