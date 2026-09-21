---
id: E2.2
epic: E2 — Marguerite
source: notion
notion_url: https://app.notion.com/p/357d0131973c816a8460fd349ad647b6
---
# E2.2 — Mode interprétation stricte (Pro+)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E2.2 — Mode interprétation stricte (Pro+)](https://app.notion.com/p/357d0131973c816a8460fd349ad647b6) · extrait le 17/09/2026 · page modifiée le 06/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E2 — Marguerite | Sprint 1 | P0 | M | Terminé | Claude code | Pro+ | Vision Produit 15/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**utilisateur Pro, **je veux** un mode d'interprétation stricte où l'IA exécute fidèlement ma commande précise, **afin de** ne pas voir mes spécifications réécrites quand je sais ce que je veux.

##### Critères d'acceptation

- Requête précise (ex : « 5 000 plaquettes A4 quadri recto verso sur 135g couché mat plié en deux ») exécutée littéralement, sans ajouts ni reformulation.
- Si paramètre ambigu ou manquant : l'IA demande clarification (cf. E2.3) au lieu d'extrapoler.
- Bascule UI explicite pour changer de mode à tout moment.
- Marqueur visuel distinctif entre les deux modes.

##### Différenciateur commercial

L'accès au mode strict est un différenciateur Pro+ (justification du tier payant).

##### Avancement Sprint 1 / B4 (livré 05/05/2026)

**Livré :**

- Toggle 🌿 Ouvert / 🎯 Strict dans la barre d'envoi (préférence persistée par utilisateur).
- En mode strict, Marguerite exécute fidèlement la commande sans variantes ajoutées.
- Si un paramètre critique manque (kind, quantité, format), Marguerite pose **une seule question ciblée** affichée comme une bulle « ❓… » dans le chat (recoupe E2.3).
- ✅ Edge function déployée sur B4 le 06/05/2026 — mode pleinement actif côté serveur.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-25](https://app.notion.com/358d0131973c81639f75f67d1962105d) | Demande précise en mode Strict est exécutée littéralement (1 ligne) | À jouer | P0 — Critique | P06 — Marguerite Mode Strict | B4 | E2.2 |
| [TF-26](https://app.notion.com/358d0131973c817d99fee3c10c7dc8bc) | Demande ambiguë en mode Strict déclenche une question de clarification ciblée | À jouer | P0 — Critique | P06 — Marguerite Mode Strict | B4 | E2.2, E2.3 |
| [TF-27](https://app.notion.com/358d0131973c818ab113c9bfb80ec98e) | Toggle Ouvert/Strict est persisté entre sessions et devices | À jouer | P1 — Importante | P06 — Marguerite Mode Strict | B4 | E2.2 |
| [TF-28](https://app.notion.com/358d0131973c814bb2f2d4fe440f5a39) | Mode Strict est verrouillé pour Freemium avec invitation à upgrade | À jouer | P0 — Critique | P06 — Marguerite Mode Strict | B4 | E2.2 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E2.2

- `SPRINT_HANDOFF.md`
- `src/modules/conversations/ui/components/ChatInterface.tsx`
- `supabase/functions/make-server-e3db71a4/index.ts`
