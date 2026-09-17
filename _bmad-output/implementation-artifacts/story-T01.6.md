---
id: T01.6
epic: T-01 — Corporate Portal
source: notion
notion_url: https://app.notion.com/p/357d0131973c814fb433d26ab7bdfac9
---
# T01.6 — Reporting et audit trail corporate

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T01.6 — Reporting et audit trail corporate](https://app.notion.com/p/357d0131973c814fb433d26ab7bdfac9) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-01 — Corporate Portal | Sprint 4 | P0 | L | Pas commencé | Claude code | Corporate | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant que** DAF ou responsable achats chez un annonceur, **je veux** accéder à des rapports structurés de consommation avec audit trail complet, **afin de** piloter le compte print global, justifier les dépenses, et préparer les clôtures.

##### Rapports pré-paramétrés

- Consommation par département / période / catégorie de produit
- Classement des gros commandeurs individuels
- Analyse panier moyen, fréquence, saisonnalité
- Taux de rejet et motifs
- Délais moyens validation → production → livraison
- Top 20 templates commandés
- Fuite hors-template (templates sur-mesure vs catalogue validé)

##### Audit trail

- Toute action utilisateur tracée (création, modification, validation, rejet, export).
- Conservation minimum 5 ans (ajustable selon cadre RGPD du client).
- Export immuable PDF signé numériquement pour production en cas d'audit.

##### Critères techniques

- Performance : tableau de bord avec 10 000 commandes historiques se charge en \< 2 s.
- Webhooks sortants : `order.submitted`, `order.approved`, `order.rejected`, `budget.threshold_reached` consommables par les ERP clients.
- Compatible Sapin II / LSF si client soumis.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T01.6

_Aucun fichier du dépôt ne cite cet identifiant._
