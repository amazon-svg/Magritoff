---
id: E7.2
epic: E7 — Perf & infra
source: notion
notion_url: https://app.notion.com/p/357d0131973c81fd88a3e5b723fb4d0f
---
# E7.2 — Scalabilité serverless AO Enterprise

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E7.2 — Scalabilité serverless AO Enterprise](https://app.notion.com/p/357d0131973c81fd88a3e5b723fb4d0f) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E7 — Perf & infra | Backlog | P2 | XL | Pas commencé | Claude code | Enterprise | Vision Produit 15/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**ops, **je veux** une scalabilité serverless pour absorber les pics d'usage des gros AO, **afin de** servir les Enterprise sans sur-dimensionner l'infra de base.

##### Contexte

Les AO Enterprise peuvent impliquer 40 000 à 100 000 calculs de prix simultanés. Architecture serverless nécessaire pour absorber ces pics.

##### Orientation technique

- Fonctions serverless (AWS Lambda / GCP Cloud Functions / Azure Functions) pour le traitement des lots AO.
- Queue de tâches (SQS / Pub/Sub / Azure Service Bus) avec priorités.
- Traitement asynchrone : utilisateur soumet l'AO, reçoit notification quand le résultat est prêt (peut prendre plusieurs heures pour 100k lignes).
- Estimation coût proposée à l'utilisateur avant lancement (dry-run).
- Articulation avec [T-08](https://www.notion.so/349d0131973c81738671e9e3e7808dfe).

##### Red flag

Serverless cold start : la latence d'activation peut dégrader l'expérience. Warm-up stratégique nécessaire.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E7.2

_Aucun fichier du dépôt ne cite cet identifiant._
