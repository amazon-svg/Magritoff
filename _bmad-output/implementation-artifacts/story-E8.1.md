---
id: E8.1
epic: E8 — Catalogue & visu
source: notion
notion_url: https://app.notion.com/p/357d0131973c8186b8d2e57dfa241ecd
---
# E8.1 — Catalogue standard 38 produits print

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E8.1 — Catalogue standard 38 produits print](https://app.notion.com/p/357d0131973c8186b8d2e57dfa241ecd) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E8 — Catalogue & visu | Sprint 1 | P0 | L | En cours | Claude code | Freemium+ | Vision Produit 15/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**utilisateur, **je veux** accéder au catalogue standard des 38 produits print avec leurs configurations, **afin d'**utiliser Magrit dès la V1.

##### Périmètre V1 (ordre de priorité)

- Cartes de visite (multi-formats)
- Flyers A4, A5, A6
- Dépliants 2, 3, 4 volets
- Brochures agrafées, collées
- Affiches standard (A4 à A0)
- Roll-ups, bannières grand format
- Stickers, étiquettes
- Chemises, pochettes, classeurs
- Têtes de lettre, enveloppes
- PLV de base (kakemonos, comptoirs pliés, présentoirs)
- Packaging simple (étuis pliés basiques)

##### Critères d'acceptation

- Chaque produit caractérisé par : nom, SKU, famille, configurations possibles (format, papier, finitions, quantités, options de façonnage), description standard, visuel représentatif.
- Accès via API `GET /products`, recherche par nom/famille, filtrage.
- Synchronisation avec Clariprint via E1.
- Documentation produit traduisible (FR / EN démarrage).

##### Red flag

38 produits = 38 configurations à tenir à jour. Gouvernance produit à définir.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E8.1

_Aucun fichier du dépôt ne cite cet identifiant._
