---
id: T06.6
epic: T-06 — Parc & monétisation
source: notion
notion_url: https://app.notion.com/p/357d0131973c81419a51f3f992822718
---
# T06.6 — Affichage sponsor dans l'UX Freemium (CNIL-compliant)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T06.6 — Affichage sponsor dans l'UX Freemium (CNIL-compliant)](https://app.notion.com/p/357d0131973c81419a51f3f992822718) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-06 — Parc & monétisation | Sprint 4 | P0 | M | Pas commencé | Claude code | Freemium+ | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**utilisateur Freemium, **je veux** voir des offres d'imprimeurs Pro consentants en bas de mes devis, **afin de** comparer et potentiellement commander chez l'un d'eux.

##### Critères d'acceptation

- En bas de chaque devis Freemium, bloc « Imprimeurs recommandés » avec 1-3 offres sponsor.
- Tri par pertinence : géolocalisation + adéquation produit + enchère (ou score à définir).
- Signalement visuel **« Annonceur »** conforme aux recommandations CNIL et à la Loi pour une République Numérique.
- Lien de prise de contact direct avec l'imprimeur sponsor (email ou formulaire intégré).
- Tracking complet de la performance de chaque affichage.

##### Red flags

- **Régulation publicité** : affichage sponsor doit respecter CNIL, DGCCRF, ARPP. Validation juridique requise avant déploiement.
- **Équilibre pub / expérience** : un Freemium sur-saturé d'offres sponsor perd son utilité. **Plafond strict : max 3 sponsors par devis, clairement délimités visuellement.**

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T06.6

_Aucun fichier du dépôt ne cite cet identifiant._
