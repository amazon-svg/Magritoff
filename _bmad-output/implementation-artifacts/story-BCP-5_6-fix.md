---
id: BCP-5/6-fix
epic: E10 — Gestion commerciale
source: notion
notion_url: https://app.notion.com/p/3ddd0131973c81bf8d29d0e6f7a9890e
---
# Correctif post-recette — conflits de commande et fiche produit

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [Correctif post-recette — conflits de commande et fiche produit](https://app.notion.com/p/3ddd0131973c81bf8d29d0e6f7a9890e) · extrait le 17/09/2026 · page modifiée le 16/09/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E10 — Gestion commerciale | Sprint 5 — Gestion commerciale | P1 | M | Terminé | Claude code | — | — | — |

### Description fonctionnelle (Notion)

Deux défauts relevés lors de la recette du 15/09, corrigés et vérifiés.

1. **Conflit entre deux écrans.** Si l'atelier valide une commande pendant que l'acheteur l'annule, un texte technique brut s'affichait. Le message est désormais choisi d'après le code d'erreur renvoyé par le serveur, et non d'après son texte : plus aucun identifiant ni code visible, quelle que soit l'erreur. La liste se recharge après un échec comme après un succès.
2. **Mise en page de la fiche produit** : hauteur de ligne du sous-titre rétablie.

**Relecture adversariale** : approuvée au round 2, après un rejet portant sur les erreurs 403 et 404, sur l'absence de test du rechargement, et sur un refus de type « conflit » appliqué trop largement.

**Contrôle navigateur du 16/09** : les deux sens du conflit sont conformes, avec une seule relecture de la liste après le refus et aucun message de succès trompeur.

Détail : sections « Correctif post-recette » de `story-BCP-5.md` et `story-BCP-6.md`.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent BCP-5/6-fix

_Aucun fichier du dépôt ne cite cet identifiant._
