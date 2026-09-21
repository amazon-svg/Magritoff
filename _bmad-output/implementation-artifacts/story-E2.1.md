---
id: E2.1
epic: E2 — Marguerite
source: notion
notion_url: https://app.notion.com/p/357d0131973c818fb36bcb991e633dc1
---
# E2.1 — Mode extrapolation ouverte (Freemium+)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E2.1 — Mode extrapolation ouverte (Freemium+)](https://app.notion.com/p/357d0131973c818fb36bcb991e633dc1) · extrait le 17/09/2026 · page modifiée le 06/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E2 — Marguerite | Sprint 1 | P0 | L | Terminé | Claude code | Freemium+ | Vision Produit 15/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**utilisateur, **je veux** que l'IA génère des propositions même quand ma demande est vague, **afin de** ne jamais être bloqué par un formulaire à champs précis.

##### Critères d'acceptation

- Requête « j'ai besoin d'un kit de PLV pour une ouverture de magasin » retourne 3-5 produits print associés et leurs configurations par défaut.
- L'utilisateur peut ajuster chaque ligne proposée.
- Bandeau de transparence : « Marguerite a fait les hypothèses suivantes : \[liste\]. Corrigez si besoin. »
- Temps de génération P95 \< 8 s en streaming (cf. E3).
- Équivalent du cas d'usage « kit campagne » mentionné dans les emails clients tests (20/04/2026).

##### Dépendances

- E1 (moteur Clariprint)
- E3 (streaming)
- E2.4 (limite 25 paramètres)

##### Avancement Sprint 1 / B4 (livré 05/05/2026)

**Livré :**

- Mode « Ouvert » activé par défaut sur Freemium+ : Marguerite propose 3-5 produits cohérents pour une demande vague.
- Bandeau d'hypothèses visible au-dessus des résultats : « 🌿 Hypothèses de Marguerite : Format A5 supposé / Quadri recto-verso par défaut / 500 unités… »
- Ajustement indépendant de chaque ligne par l'utilisateur.
- ✅ Edge function déployée sur B4 le 06/05/2026 — mode pleinement actif côté serveur.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-21](https://app.notion.com/358d0131973c81be8076fe12eb550e5a) | Demande vague « kit PLV ouverture magasin » génère 3-5 produits avec hypothèses | À jouer | P0 — Critique | P05 — Marguerite Mode Ouvert | B4 | E2.1 |
| [TF-22](https://app.notion.com/358d0131973c8181b430c45efb05e992) | Bandeau d'hypothèses Marguerite est lisible, cohérent et utilise la terminologie print FR | À jouer | P1 — Importante | P05 — Marguerite Mode Ouvert | B4 | E2.1 |
| [TF-23](https://app.notion.com/358d0131973c810e9af7d1f4edb64637) | Ajustement d'une ligne de devis ne casse pas les autres | À jouer | P1 — Importante | P05 — Marguerite Mode Ouvert | B4 | E2.1 |
| [TF-24](https://app.notion.com/358d0131973c8111a3c2f80b12ad1118) | Mode Ouvert est le défaut Freemium+ | OK | P0 — Critique | P05 — Marguerite Mode Ouvert | B4 | E2.1 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E2.1

- `SPRINT_HANDOFF.md`
- `src/modules/conversations/ui/components/ChatInterface.tsx`
- `supabase/functions/make-server-e3db71a4/index.ts`
