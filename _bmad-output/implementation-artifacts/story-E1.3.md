---
id: E1.3
epic: E1 — Clariprint
source: notion
notion_url: https://app.notion.com/p/357d0131973c81aa9ed7c7c72d94dbe4
---
# E1.3 — Validation sortie LLM par schéma JSON strict

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E1.3 — Validation sortie LLM par schéma JSON strict](https://app.notion.com/p/357d0131973c81aa9ed7c7c72d94dbe4) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E1 — Clariprint | Sprint 3 | P0 | M | En cours | Laurent | Technique | Vision Produit 15/04 | — |

### Description fonctionnelle (Notion)

**En tant que** système, **je veux** valider chaque sortie LLM via un schéma JSON strict, **afin de** garantir la cohérence métier et empêcher les hallucinations de structures.

##### Critères d'acceptation

- Schéma JSON Schema (draft 2020-12) versionné, par type de réponse (devis, description, gabarit).
- Validation systématique à la réception du LLM, avant tout traitement aval.
- En cas d'échec : retry automatique (max 2), puis fallback dégradé avec alerte monitoring.
- Taux d'échec cible ≤ 0,5% des requêtes.
- Métriques exposées : taux retry, taux fallback, temps de validation.

##### Red flags

- Calibrage continu : schéma trop rigide = faux rejets sur cas légitimes.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-32](https://app.notion.com/358d0131973c819bba69cd20e2e22a8f) | Devis textuel simple génère un prix Clariprint cohérent | KO | P0 — Critique | P08 — Devis textuel vers prix Clariprint | B4 | E1.1, E1.3 |
| [TF-33](https://app.notion.com/358d0131973c81d4a45af37ca0c20857) | Détection et masquage d'un prix négatif retourné par Clariprint | À jouer | P0 — Critique | P08 — Devis textuel vers prix Clariprint | B4 | E1.1, E1.3 |
| [TF-34](https://app.notion.com/358d0131973c815d883cc9f59cecb160) | Aucune valeur undefined n'est affichée dans l'UI | À jouer | P0 — Critique | P08 — Devis textuel vers prix Clariprint | B4 | E1.1, E1.3 |
| [TF-35](https://app.notion.com/358d0131973c81808767efb219ddd260) | Détection d'un produit légalement requis manquant (ours d'imprimeur) | À jouer | P1 — Importante | P08 — Devis textuel vers prix Clariprint | B4 | E1.1, E1.3 |
| [TF-36](https://app.notion.com/358d0131973c81b4954fda20a70bfdfc) | Sortie LLM non conforme au schéma JSON est rejetée avant affichage | À jouer | P0 — Critique | P08 — Devis textuel vers prix Clariprint | B4 | E1.3 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E1.3

- `_bmad-output/planning-artifacts/prd.md`
