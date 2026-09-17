---
id: AF25.3
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF25.2]
---
# AF25.3 — Injecter le runtime API dans storefront et portail client

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- `PublicShop`, catalogue, commandes, éditeur, confirmation et historique de
  commande utilisent le transport commun ;
- panier et modale de devis utilisent le même runtime ;
- acceptation d’invitation et redirections tenant/boutique sont migrées ;
- le helper d’audit reçoit désormais un `OrdersApiClient` au lieu de connaître
  le transport HTTP et le jeton ;
- les composants qui n’avaient besoin d’Auth que pour construire un client ne
  dépendent plus du contexte Auth.

## Exceptions restantes

Deux parcours construisent encore un transport avec un jeton explicitement
retourné par une opération Auth dans la même promesse :

1. inscription/connexion au checkout puis rattachement à la boutique ;
2. renouvellement de session puis envoi d’une invitation.

Avec le composition root, ces deux fichiers et `ApiRuntimeContext` sont les
trois seules occurrences de `new FetchApiClient` autorisées dans `src/app`.
La CI vérifie cette liste fermée.
