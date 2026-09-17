---
id: AF18.2
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF18.1]
---

# AF18.2 — Isoler le CRUD des devis éditables

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- extension du module Quotes pour la liste, la lecture avec lignes, la
  création panier, la sauvegarde, le statut, la suppression et la duplication ;
- migration complète de `QuotesContext` vers `QuotesApiClient` ;
- repository Supabase confiné dans la composition serveur ;
- routes tenant-scoped documentées dans OpenAPI ;
- contrôle serveur du scope `all`, auparavant limité à l’affichage UI.

## Invariants

- l’auteur des créations et duplications vient du bearer token ;
- chaque accès à un devis inclut le tenant dans la requête serveur ;
- le scope `mine` filtre sur l’acteur courant ;
- le scope `all` exige owner, admin ou superadmin côté serveur ;
- les lignes restent ordonnées et les totaux continuent d’être recalculés par
  les règles existantes du contexte avant sauvegarde ;
- la suppression des lignes reste assurée par la cascade du devis parent.

## Mesures

- `QuotesContext` : **13 → 0** références Supabase ;
- baseline globale : **51 → 38** références directes ;
- fichiers UI important Supabase : **10 → 9**.

## Validation UX attendue

Créer un devis depuis le panier, l’ouvrir, modifier ses lignes et son client,
changer son statut, le dupliquer puis supprimer la copie. Vérifier que « Tous »
fonctionne pour owner/admin et qu’une requête directe avec `scope=all` est
refusée pour un acheteur.
