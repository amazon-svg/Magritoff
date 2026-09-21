---
id: E6.3
epic: E6 — Données & qualité
source: notion
notion_url: https://app.notion.com/p/357d0131973c81169c95c28b82a281af
---
# E6.3 — Outil AO gratuit (Freemium acquisition annonceurs)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E6.3 — Outil AO gratuit (Freemium acquisition annonceurs)](https://app.notion.com/p/357d0131973c81169c95c28b82a281af) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E6 — Données & qualité | Sprint 4 | P1 | M | Pas commencé | Claude code | Freemium+ | Vision Produit 15/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**acheteur entreprise, **je veux** un outil gratuit pour générer un AO structuré et l'exporter en format Clariprint, **afin de** lancer une consultation rapide sans m'engager.

##### Contexte stratégique

C'est le **cheval de Troie vers les annonceurs**. Un acheteur crée un AO gratuit, l'exporte en format Clariprint et l'envoie à ses fournisseurs. Une fois habitué à l'outil, il est candidat naturel à l'offre Enterprise (T-08).

##### Critères d'acceptation

- Création d'un AO structuré : description, quantités, critères, délais.
- Génération d'un fichier export format Clariprint (JSON ou Excel structuré).
- Envoi par email aux fournisseurs sélectionnés avec lien de réponse.
- Limité à X AO/mois en freemium, illimité en Enterprise.
- Upgrade path naturel vers [T-08](https://www.notion.so/349d0131973c81738671e9e3e7808dfe) (Module AO Enterprise complet).

##### Red flag

AO gratuit = potentiel abus. Limiter le nombre d'AO freemium, surveiller les comportements atypiques.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E6.3

_Aucun fichier du dépôt ne cite cet identifiant._
