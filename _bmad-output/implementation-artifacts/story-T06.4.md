---
id: T06.4
epic: T-06 — Parc & monétisation
source: notion
notion_url: https://app.notion.com/p/357d0131973c813f84d5e2e2bd07fa25
---
# T06.4 — Comparateur multi-prix (mon prix / prix marché / prix panel)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T06.4 — Comparateur multi-prix (mon prix / prix marché / prix panel)](https://app.notion.com/p/357d0131973c813f84d5e2e2bd07fa25) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-06 — Parc & monétisation | Sprint 4 | P0 | M | Pas commencé | Claude code | Pro+ | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**utilisateur Pro+, **je veux** voir 3 colonnes de prix simultanées pour chaque devis, **afin de** positionner mon offre face au marché et à mon panel.

##### Affichage attendu

| Colonne | Source | Accès |
| --- | --- | --- |
| **Mon prix** | Calculé sur parc personnel (T06.1) | Pro+ avec parc renseigné |
| **Prix marché Magrit** | Panel général anonymisé (T06.2) | Tous |
| **Prix panel** | Panel défini par l'utilisateur (T06.3) | Pro+ |

##### Critères d'acceptation

- Drill-down sur chaque prix : composition de coût pour le prix personnel, nombre de répondants pour le prix marché, répartition des prix dans le panel.
- Export CSV du comparatif.
- Performance : calcul d'un devis avec 3 prix simultanés reste sous 3 s en P95.

##### Red flag

**Conflit d'intérêts** : un imprimeur Pro voyant ses concurrents dans son propre panel = risque de perception négative. À cadrer : un imprimeur ne voit que son prix personnel + prix marché + prix panel agrégé, jamais les prix individuels.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T06.4

_Aucun fichier du dépôt ne cite cet identifiant._
