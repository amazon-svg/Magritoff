---
id: E1.1
epic: E1 — Clariprint
source: notion
notion_url: https://app.notion.com/p/357d0131973c81c0b40bdeb3e5bc9829
---
# E1.1 — Devis textuel simple → calcul de prix

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E1.1 — Devis textuel simple → calcul de prix](https://app.notion.com/p/357d0131973c81c0b40bdeb3e5bc9829) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E1 — Clariprint | Sprint 3 | P0 | L | En cours | Laurent | Freemium+ | Vision Produit 15/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**utilisateur, **je veux** soumettre une demande textuelle simple et obtenir un calcul de prix pour un produit print, **afin d'**accéder au cœur de la valeur Magrit dès le premier usage.

##### Critères d'acceptation

- Une requête textuelle libre (ex : « 2 000 cartes de visite 85x55 quadri recto verso pelliculé mat ») retourne un devis composé d'un prix, d'un délai et d'une description produit structurée.
- Temps de réponse P95 \< 5 s en mode prix seul, \< 8 s en mode prix + description streaming (cf. E3).
- Format normalisé : identifiant devis, lignes produits (SKU, configuration, quantité, prix unitaire, total), métadonnées (source panel, fraîcheur donnée, marge applicable).
- Erreur structurée avec code explicite si produit inconnu ou configuration incohérente.
- Logs traçables par identifiant de session.

##### Spécifications techniques

- Endpoint : `POST /api/v1/quote`
- Body : `{text: string, user_id, panel_id?, mode: 'open'|'strict'}`
- Retour : `{quote_id, products: [...], metadata}`

##### Dépendances

- Moteur Clariprint (Expert Solutions)
- E2 Marguerite pour l'interprétation
- E3 streaming pour la perception perf

##### Red flags

- Le contrat d'interface Clariprint impose un point de synchro mensuel Expert Solutions / AGE Dvt avant production.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-32](https://app.notion.com/358d0131973c819bba69cd20e2e22a8f) | Devis textuel simple génère un prix Clariprint cohérent | KO | P0 — Critique | P08 — Devis textuel vers prix Clariprint | B4 | E1.1, E1.3 |
| [TF-33](https://app.notion.com/358d0131973c81d4a45af37ca0c20857) | Détection et masquage d'un prix négatif retourné par Clariprint | À jouer | P0 — Critique | P08 — Devis textuel vers prix Clariprint | B4 | E1.1, E1.3 |
| [TF-34](https://app.notion.com/358d0131973c815d883cc9f59cecb160) | Aucune valeur undefined n'est affichée dans l'UI | À jouer | P0 — Critique | P08 — Devis textuel vers prix Clariprint | B4 | E1.1, E1.3 |
| [TF-35](https://app.notion.com/358d0131973c81808767efb219ddd260) | Détection d'un produit légalement requis manquant (ours d'imprimeur) | À jouer | P1 — Importante | P08 — Devis textuel vers prix Clariprint | B4 | E1.1, E1.3 |
| [TF-38](https://app.notion.com/358d0131973c81188970ceb2b00f2399) | ProductCard affiche le prix calculé sur le parc du tenant | KO | P0 — Critique | P09 — Boutique portail B2B | B4 | E9.13, E1.1 |
| [TF-39](https://app.notion.com/358d0131973c8122ba0df43d9b0cff6e) | Demande de devis depuis ProductCard d'une boutique B2B | KO | P1 — Importante | P13 — Devis et gestion commerciale | B4 | E9.13, E1.1 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E1.1

_Aucun fichier du dépôt ne cite cet identifiant._
