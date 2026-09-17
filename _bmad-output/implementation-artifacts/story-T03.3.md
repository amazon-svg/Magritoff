---
id: T03.3
epic: T-03 — Sync eCommerce
source: notion
notion_url: https://app.notion.com/p/357d0131973c819486e5e8059f1d9daa
---
# T03.3 — Synchronisation bidirectionnelle des statuts de commande

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T03.3 — Synchronisation bidirectionnelle des statuts de commande](https://app.notion.com/p/357d0131973c819486e5e8059f1d9daa) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-03 — Sync eCommerce | Sprint 3 | P0 | L | Pas commencé | Claude code | Pro+ | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant que** gestionnaire de production (côté imprimeur), **je veux** que les statuts de commande soient synchronisés dans les deux sens entre Magrit et le storefront eCommerce, **afin que** mon client final voie toujours le bon statut sans que j'aie à mettre à jour manuellement à deux endroits.

##### Critères d'acceptation

- **eCommerce → Magrit** : tout changement de statut sur la plateforme capturé via webhook ou polling et répercuté sur la commande Magrit.
- **Magrit → eCommerce** : tout changement de statut de production dans Magrit (imprimé, façonné, expédié, livré) renvoyé à la plateforme.
- **Préservation stricte des valeurs natives** : pas de conversion de casse, pas de remplacement d'espaces par underscores, pas de renommage. « on-hold » reste « on-hold », « Awaiting Shipment » reste « Awaiting Shipment ».
- **Statuts inconnus** : si un nouveau statut apparaît côté plateforme, créé automatiquement dans Magrit sans bloquer la synchro.
- **Mapping configurable** par client.
- **Exclusions configurables** : certains statuts marqués comme « non propagés » (typiquement les refunds).

##### Webhook security

Signature HMAC vérifiée systématiquement, timing-safe comparison.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T03.3

_Aucun fichier du dépôt ne cite cet identifiant._
