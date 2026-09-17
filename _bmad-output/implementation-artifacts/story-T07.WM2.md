---
id: T07.WM2
epic: T-07 — Canva
source: notion
notion_url: https://app.notion.com/p/35fd0131973c8173bc6afd0c031bec3a
---
# Intégration Canva — ouverture gabarits Clariprint (si GO)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [Intégration Canva — ouverture gabarits Clariprint (si GO)](https://app.notion.com/p/35fd0131973c8173bc6afd0c031bec3a) · extrait le 17/09/2026 · page modifiée le 13/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-07 — Canva | Backlog | P1 | L | Pas commencé | Laurent | Pro+ | WM 12/05/2026 | — |

### Description fonctionnelle (Notion)

##### Description

Permettre l'ouverture directe d'un gabarit Clariprint dans Canva depuis l'interface Magrit. Récupérer le design retourné par Canva (export) et le stocker dans Magrit. L'aller-retour complet Magrit → Canva → Magrit doit fonctionner de bout en bout.

##### Critères d'acceptation

- Gabarit Clariprint ouvert dans Canva en < 3 secondes depuis Magrit
- Design retourné par Canva récupéré et stocké dans Magrit
- Preview du design visible dans la fiche produit Magrit
- Aller-retour complet sans perte de données

##### Données de contexte — WM#120526

- Ouverture directe des gabarits dans Canva jugée stratégique par Arnaud
- Ref. transcription : Doc4 01:43:00

##### Dépendances

- ⚠️ T07.WM1 validé GO — prérequis absolu
- API Canva accessible (compte partenaire à négocier ?)

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T07.WM2

_Aucun fichier du dépôt ne cite cet identifiant._
