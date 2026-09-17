---
id: E6.2
epic: E6 — Données & qualité
source: notion
notion_url: https://app.notion.com/p/357d0131973c81cda3e9f11b1d6f5c7d
---
# E6.2 — Saisie simplifiée données imprimeur (Freemium)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E6.2 — Saisie simplifiée données imprimeur (Freemium)](https://app.notion.com/p/357d0131973c81cda3e9f11b1d6f5c7d) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E6 — Données & qualité | Sprint 2 | P0 | M | Pas commencé | Claude code | Freemium+ | Vision Produit 15/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**imprimeur, **je veux** saisir mes données techniques et tarifaires via une interface simplifiée, **afin d'**apparaître dans les résultats sans paramétrer un parc complet.

##### Articulation forte

E6.2 = version Freemium/Starter (saisie légère), [T-06](https://www.notion.so/349d0131973c81398f17ff2c629d65be) = version Pro+ complète avec coûts et marges. Les deux UX héritent du même moteur de saisie guidée par Marguerite.

##### Périmètre Freemium

- Saisie d'informations de base : coordonnées, spécialités (familles produits pratiquées), zone géographique desservie.
- Saisie de quelques machines emblématiques (pas besoin d'exhaustivité).
- Grilles tarifaires indicatives (fourchettes, pas coûts détaillés).
- Durée cible : 15-20 minutes.
- Récompense immédiate : présence en résultats sponsorisés freemium.
- Taux de complétion cible : 60% à 30 jours post-inscription.

##### Red flag

Si 6.2 est trop léger, les prix sponsorisés freemium manquent de crédibilité. Calibrer avec retours bêta.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E6.2

- `SPRINT_HANDOFF.md`
- `docs/project-context.md`
