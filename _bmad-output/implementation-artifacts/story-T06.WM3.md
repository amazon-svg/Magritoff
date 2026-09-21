---
id: T06.WM3
epic: T-06 — Parc & monétisation
source: notion
notion_url: https://app.notion.com/p/35fd0131973c815c9a32ce3d64732dd7
---
# Comparaison simultanée 3 prix — parc perso / marché / panel

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [Comparaison simultanée 3 prix — parc perso / marché / panel](https://app.notion.com/p/35fd0131973c815c9a32ce3d64732dd7) · extrait le 17/09/2026 · page modifiée le 13/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-06 — Parc & monétisation | Backlog | P1 | L | Pas commencé | Laurent | Business+ | WM 12/05/2026 | — |

### Description fonctionnelle (Notion)

##### Description

Afficher en parallèle trois sources de prix pour un même produit : (1) prix calculé sur le parc machines propre de l'imprimeur, (2) prix marché Magrit agrégé, (3) prix d'un panel sélectionné par l'utilisateur (ex. Royal Canin sélectionne son panel monde). Disponible à partir du tier Business.

##### Critères d'acceptation

- 3 prix affichés simultanément avec labels clairs distincts
- Système d'autorisation d'accès aux données de parcs tiers fonctionnel
- Accord bilatéral formalisé avant accès aux données d'un parc externe
- Disponibilité conditionnée au tier Business (~1 000 €/mois)

##### Données de contexte — WM#120526

- Use case : Royal Canin sélectionne son panel d'imprimeurs monde
- Ref. transcription : Doc4 01:39:18 / 01:41:42

##### Dépendances

- T06.WM1 (prix marché) — prérequis
- Formalisation juridique des accords d'accès aux parcs tiers

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T06.WM3

_Aucun fichier du dépôt ne cite cet identifiant._
