---
id: T06.1
epic: T-06 — Parc & monétisation
source: notion
notion_url: https://app.notion.com/p/357d0131973c81d38083e79e7de3362d
---
# T06.1 — Paramétrage du parc machines (Pro+)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T06.1 — Paramétrage du parc machines (Pro+)](https://app.notion.com/p/357d0131973c81d38083e79e7de3362d) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-06 — Parc & monétisation | Sprint 2 | P0 | XL | Pas commencé | Laurent | Pro+ | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**imprimeur Pro, **je veux** paramétrer mon parc machines et mes coûts, **afin que** mes devis Magrit soient calculés à mon coût réel avec ma marge.

##### Cas d'usage ciblé

Richard Petit (imprimeur Groupe ICI) souscrit à Pro. Il accède à un assistant de paramétrage guidé par Marguerite : presses, façonnage, grand format, numérique, coûts horaires, frais généraux. Durée attendue : 2-3h avec l'aide du responsable production.

##### Fonctionnalités

- Interface de saisie guidée par Marguerite (wizard conversationnel, pas formulaire de 200 champs).
- Catégories : feuille offset, rotative offset, numérique, grand format, façonnage, packaging, reliure.
- Saisie des **coûts de production** : TH machine, TH opérateur, taux de charge, gaspillage type, frais généraux.
- Saisie des **marges commerciales** par famille produit.
- Possibilité d'import CSV pour les parcs complexes.
- Mode « brouillon » : devis utilisent le prix marché tant que la machine concernée n'est pas paramétrée.
- Audit trail complet : toute modification tracée.
- Contrôles de cohérence automatiques (alertes si valeurs aberrantes vs panel).

##### Dépendances

- Moteur Clariprint (E1) — API paramétrage parc
- E3.4 (UX simplifiée Freemium) complémentaire

##### Red flag

Durée de paramétrage : objectif 80% des Pro avec parc complété sous 30 jours après souscription. Assistance CSM incluse si nécessaire.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T06.1

_Aucun fichier du dépôt ne cite cet identifiant._
