---
id: E5.2
epic: E5 — API & intégrations
source: notion
notion_url: https://app.notion.com/p/357d0131973c810ca86ecdfcf065c2f2
---
# E5.2 — Connecteurs ERP/MIS (Tharstern, EFI Pace, Cegid, Sage)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E5.2 — Connecteurs ERP/MIS (Tharstern, EFI Pace, Cegid, Sage)](https://app.notion.com/p/357d0131973c810ca86ecdfcf065c2f2) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E5 — API & intégrations | Backlog | P2 | XL | Pas commencé | Claude code | Pro+ | Vision Produit 15/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**imprimeur, **je veux** connecter mon ERP/MIS existant pour synchroniser données produits et prix, **afin de** ne pas changer ma stack technique pour adopter Magrit.

##### Contexte

Les imprimeurs industriels ont déjà un ERP (Tharstern, EFI Pace, Cegid, Sage, Dolibarr ou un MIS maison). Magrit doit s'y connecter sans leur demander de changer.

##### Cibles V1/V2

- **Tharstern** (leader MIS print FR)
- **EFI Pace** (leader MIS print international)
- **Cegid** (ERP standard FR)
- **Sage** (ERP standard FR)
- **Dolibarr** (open source fréquent chez PME)
- **MIS maison** : API générique REST ou webhook

##### Critères d'acceptation génériques

- Synchronisation catalogue produits Magrit → ERP (ou inverse selon configuration).
- Synchronisation devis et commandes Magrit → ERP.
- Gestion des erreurs avec queue de retry, alerte admin si échec persistant.
- Mapping des références configurables par client.
- Mode sandbox + mode production.

##### Articulation

Les connecteurs eCommerce Shopify/Woo/Magento/BigC sont un sous-ensemble de cette epic, traités en priorité V1 dans [T-03](https://www.notion.so/349d0131973c81c1aa05d7b07ae41512).

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E5.2

_Aucun fichier du dépôt ne cite cet identifiant._
