---
id: AF13.3a
epic: EPIC-8-API-FIRST
priority: P0
status: done
branch: refactor/api-first-foundation
depends_on: [AF13.2]
---

# AF13.3a — Isoler les prix négociés de l’éditeur de boutique

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- contrats de lecture des overrides par boutique ;
- commande unique pour définir ou supprimer un prix négocié ;
- validation des identifiants tenant, boutique et produit bibliothèque ;
- tenant et horodatage dérivés côté serveur ;
- migration de `DashboardShopEditor` vers `ShopsApiClient` pour ce périmètre.

## Mesures

- références directes dans l’éditeur : **5 → 2** ;
- baseline globale : **95 → 92** références ;
- les deux références restantes concernent exclusivement Storage pour le logo
  et le hero.

## Suite

AF13.3b doit définir un transport binaire API adapté aux fichiers jusqu’à 5 Mo,
sans encoder les images en JSON ni exposer directement le fournisseur Storage.
