---
id: T03.6
epic: T-03 — Sync eCommerce
source: notion
notion_url: https://app.notion.com/p/357d0131973c81308875cb96fac50d6d
---
# T03.6 — Observabilité et alerting connecteur eCommerce

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T03.6 — Observabilité et alerting connecteur eCommerce](https://app.notion.com/p/357d0131973c81308875cb96fac50d6d) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-03 — Sync eCommerce | Sprint 4 | P0 | M | Pas commencé | Claude code | Pro+ | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**administrateur Magrit (client imprimeur), **je veux** savoir en temps réel si ma synchronisation eCommerce fonctionne correctement, **afin de** ne pas découvrir 3 jours plus tard qu'aucune commande n'est remontée.

##### Critères d'acceptation

- Dashboard « santé du connecteur » par plateforme : nb webhooks reçus dernière heure/jour, nb erreurs, temps de réponse moyen, dernière synchro réussie.
- Alerting email / webhook si taux d'erreur \> seuil (configurable, défaut 5%).
- Alerting immédiat si connecteur déconnecté (auth expirée, API key révoquée).
- Logs détaillés accessibles 90 jours minimum.

##### Différenciateur IA

Marguerite peut signaler une dérive statistique (ex : « ce connecteur reçoit 70% moins de commandes que la moyenne des 30 derniers jours »).

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T03.6

_Aucun fichier du dépôt ne cite cet identifiant._
