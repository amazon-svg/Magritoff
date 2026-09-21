---
id: T06.WM4
epic: T-06 — Parc & monétisation
source: notion
notion_url: https://app.notion.com/p/35fd0131973c817cad64cccedadc6256
---
# Liens sponsorisés imprimeurs géolocalisés — Freemium monetization

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [Liens sponsorisés imprimeurs géolocalisés — Freemium monetization](https://app.notion.com/p/35fd0131973c817cad64cccedadc6256) · extrait le 17/09/2026 · page modifiée le 13/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-06 — Parc & monétisation | Backlog | P0 | M | Pas commencé | Laurent | Freemium+ | WM 12/05/2026 | — |

### Description fonctionnelle (Notion)

##### Description

Afficher les imprimeurs Pro opt-in (~5 maximum) en bas des résultats de devis avec leurs prix calculés. Filtrage géographique basé sur la proximité de livraison ou la ville sélectionnée.

##### Critères d'acceptation

- Maximum 5 imprimeurs affichés simultanément (contrainte performance)
- Géolocalisation opérationnelle (proximité livraison ou ville saisie)
- Inscription imprimeur Pro + consentement opt-in gérés en back-office
- Prix calculés sur le parc réel de l'imprimeur
- Positionnement en bas des résultats (non intrusif)

##### Données de contexte — WM#120526

- Xavier : maintenir ~5 imprimeurs max pour ne pas dégrader les temps de calcul
- Concept évoqué : « printing spot comme [booking.com](http://booking.com) » avec filtrage géographique
- Ref. transcription : Doc4 00:52:08 / 00:53:36 / 00:54:53 / 00:56:40

##### Dépendances

- T06.WM1 (parc imprimeurs préqualifiés) — prérequis
- Système d'authentification imprimeur Pro

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T06.WM4

_Aucun fichier du dépôt ne cite cet identifiant._
