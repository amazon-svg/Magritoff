---
id: T05.1
epic: T-05 — Help System
source: notion
notion_url: https://app.notion.com/p/357d0131973c8153a502e01b69f0f294
---
# T05.1 — Icônes d'aide contextuelles sur champs et boutons

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T05.1 — Icônes d'aide contextuelles sur champs et boutons](https://app.notion.com/p/357d0131973c8153a502e01b69f0f294) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-05 — Help System | Sprint 3 | P1 | S | Pas commencé | Claude code | Toutes | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**utilisateur Magrit, **je veux** voir une petite icône d'aide à côté des champs complexes ou des boutons à effet fort, **afin de** comprendre la fonction sans quitter mon écran.

##### Critères d'acceptation

- Icône discrète (gris clair, 14-16px) à côté des labels de champs complexes.
- Hover (desktop) : tooltip avec 1-3 phrases factuelles + lien « en savoir plus » si applicable.
- Clic (mobile / desktop) : popover avec contenu enrichi (texte + vidéo courte optionnelle + lien doc).
- Accessibilité : aria-describedby, navigation clavier OK.

##### Philosophie produit

- **Pas de tutoriel first-run imposé** : on est un outil pro, pas une app mobile grand public.
- **Pas de messages de bienvenue répétés**, pas de « Le saviez-vous ? ».
- **Aide discrète mais omniprésente**.
- **Raccourci clavier universel** : `?` ou `F1` ouvre l'aide contextuelle (cf. T05.2).

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T05.1

_Aucun fichier du dépôt ne cite cet identifiant._
