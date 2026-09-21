---
id: T08.WM1
epic: T-08 — AO & Catalogues
source: notion
notion_url: https://app.notion.com/p/35fd0131973c81148123f585b6500e80
---
# Module AO — Création et envoi d'appels d'offres

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [Module AO — Création et envoi d'appels d'offres](https://app.notion.com/p/35fd0131973c81148123f585b6500e80) · extrait le 17/09/2026 · page modifiée le 13/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-08 — AO & Catalogues | Backlog | P0 | L | Pas commencé | Laurent | Enterprise | WM 12/05/2026 | — |

### Description fonctionnelle (Notion)

##### Description
Permettre la création d'un appel d'offres depuis Magrit (sélection produits, quantités, spécifications, délais). Envoi aux imprimeurs sélectionnés. Suivi du statut des réponses (reçu / en attente / relancé).
##### Critères d'acceptation
- AO créé depuis l'interface Magrit en moins de 5 minutes
- Envoi multi-imprimeurs en une action
- Statut des réponses visible dans le tableau de bord
- Historique des AO par client
##### Données de contexte — WM#120526
- Use case pilote : Gilles Aubin ([lemagasinduprint.fr](http://lemagasinduprint.fr)) — 32 AO reçus/mois = 4 M€ de CA
- Fonctionnalité identifiée comme priorité maximale lors des entretiens clients terrain
- Ref. transcription : Doc4 00:11:23 / 01:48:27 / 01:49:40
##### Dépendances
- T06.WM1 (prix marché) — pour T08.WM3 (affichage prix avant envoi)
- Base de données imprimeurs partenaires

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T08.WM1

_Aucun fichier du dépôt ne cite cet identifiant._
