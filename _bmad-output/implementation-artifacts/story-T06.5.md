---
id: T06.5
epic: T-06 — Parc & monétisation
source: notion
notion_url: https://app.notion.com/p/357d0131973c812fa334fae0a241f158
---
# T06.5 — Opt-in diffusion publicitaire Pro → Freemium

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T06.5 — Opt-in diffusion publicitaire Pro → Freemium](https://app.notion.com/p/357d0131973c812fa334fae0a241f158) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-06 — Parc & monétisation | Sprint 4 | P0 | M | Pas commencé | Claude code | Pro+ | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**imprimeur Pro+, **je veux** activer la diffusion de mes prix sur les devis Freemium contre commission, **afin de** capter des leads sans effort marketing.

##### Critères d'acceptation

- Page de paramétrage « Visibilité Magrit » dans l'espace Pro.
- Choix du périmètre : toutes familles produits / familles choisies.
- Choix des zones géographiques de diffusion (France entière / régions / départements / rayon km autour du siège).
- Choix du modèle économique (à définir selon bêta) :
  - **Option A** — CPL fixe : 3 € par lead qualifié
  - **Option B** — Revenue share : 15% du ticket du premier devis converti
  - **Option C** — Forfait mensuel de visibilité : 150 €/mois
- Plafond mensuel paramétrable.
- Tableau de bord performance (impressions, clics, leads, conversions, revenus).
- Activation / désactivation immédiate.

##### Dépendances

- E7.1 (token tracking) : l'infra de tracking est partagée
- T06.1 (parc machines) pour calculer le prix sponsor

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T06.5

_Aucun fichier du dépôt ne cite cet identifiant._
