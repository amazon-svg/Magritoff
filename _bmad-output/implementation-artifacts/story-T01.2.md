---
id: T01.2
epic: T-01 — Corporate Portal
source: notion
notion_url: https://app.notion.com/p/357d0131973c8159bc0ae8b43702c1fc
---
# T01.2 — Rôles et permissions granulaires corporate

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T01.2 — Rôles et permissions granulaires corporate](https://app.notion.com/p/357d0131973c8159bc0ae8b43702c1fc) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-01 — Corporate Portal | Sprint 2 | P0 | L | Pas commencé | Claude code | Corporate | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**administrateur corporate côté client, **je veux** définir au moins 5 rôles distincts (Commandeur, Valideur N1, Valideur N2, Brand Manager, Administrateur) avec des permissions fines, **afin que** chaque collaborateur ne voie et n'agisse que sur son périmètre légitime.

##### Permissions paramétrables par rôle

- Visualiser les commandes du département / de tous les départements
- Créer une commande
- Modifier une commande avant validation
- Valider une commande (seuil de montant paramétrable)
- Gérer le catalogue de templates
- Gérer le budget du département
- Exporter les rapports de consommation
- Ajouter / supprimer des utilisateurs

##### Articulation avec E9

Cette story étend le modèle E9.3 (droits granulaires : `magrit_full` vs `shop_only`) avec un troisième niveau **`corporate_role`** à 5 rôles prédéfinis. Le moteur de permissions générique (champs `permissions jsonb` sur `tenant_memberships`) reste le même, seules les UI et les presets diffèrent.

##### Dépendances

- E9.2, E9.3 (CRUD users + droits granulaires)

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T01.2

_Aucun fichier du dépôt ne cite cet identifiant._
