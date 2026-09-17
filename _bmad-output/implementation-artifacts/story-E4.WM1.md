---
id: E4.WM1
epic: E4 — Mini-shop
source: notion
notion_url: https://app.notion.com/p/35fd0131973c81c7b6abd4f6889cc843
---
# Storefront — Magasin centralisé multi-clients

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [Storefront — Magasin centralisé multi-clients](https://app.notion.com/p/35fd0131973c81c7b6abd4f6889cc843) · extrait le 17/09/2026 · page modifiée le 13/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E4 — Mini-shop | Backlog | P1 | L | Pas commencé | Laurent | Pro+ | WM 12/05/2026 | — |

### Description fonctionnelle (Notion)

##### Description

Magasin centralisé où les accès client-spécifiques sont gérés par identifiant — chaque utilisateur voit ses propres devis, commandes et produits depuis la même URL boutique.

##### Critères d'acceptation

- 2 utilisateurs distincts voient des données isolées depuis la même URL boutique
- Historique de devis et commandes par client correctement cloisonné
- Quota de storefronts inclus affiché dans l'espace abonnement
- Unité supplémentaire facturable à \~50 €

##### Données de contexte — WM#120526

- Arnaud : différenciation entre (1) magasin centralisé multi-clients avec identifiants et (2) URL dédiée par client
- Fourchette storefront : 50 à 150 €/mois — tendance vers 50 € pour maximiser l'adoption
- Ref. transcription : Doc4 02:05:41 / 02:04:53

##### Dépendances

- E4 (Mini-shop) — s'appuie sur le socle mini-shop existant
- Système d'authentification multi-tenant

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E4.WM1

_Aucun fichier du dépôt ne cite cet identifiant._
