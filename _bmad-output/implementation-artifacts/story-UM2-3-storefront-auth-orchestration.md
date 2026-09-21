---
id: UM2.3
epic: EPIC-UM-STORE-IDENTITY
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [UM2.2]
---
# UM2.3 — Orchestrer l’authentification storefront

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- service métier indépendant du fournisseur d’authentification ;
- résolution obligatoire par slug de boutique puis email normalisé ;
- aucune recherche globale par email ;
- vérification factice lorsque boutique ou compte sont absents ;
- erreur identique pour compte absent, secret incorrect, verrouillage ou statut
  non actif ;
- compteur d’échec piloté par un port et remise à zéro après succès ;
- session directe de huit heures, plafonnée contractuellement à vingt-quatre ;
- validation défensive du compte, de la boutique, de l’expiration et du jeton
  opaque retournés par l’infrastructure.

## Non livré dans cette story

La route publique, l’adaptateur SQL et le cookie ne sont pas encore assemblés.
Le checkout reste sur le parcours transitoire afin de ne pas exposer une
authentification partielle.
