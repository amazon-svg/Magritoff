---
id: E7.4
epic: E7 — Perf & infra
source: notion
notion_url: https://app.notion.com/p/358d0131973c81b3a7bedba621fec171
---
# E7.4 — Bootstrap Beta 4 isolée + correctifs hérités Beta 3

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E7.4 — Bootstrap Beta 4 isolée + correctifs hérités Beta 3](https://app.notion.com/p/358d0131973c81b3a7bedba621fec171) · extrait le 17/09/2026 · page modifiée le 06/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E7 — Perf & infra | Sprint 1 | P0 | M | Terminé | Claude code | Technique | Demande 05/05 | — |

### Description fonctionnelle (Notion)

**En tant qu'**ops, **je veux** une nouvelle Beta 4 isolée du reste avec un bootstrap SQL propre et les correctifs des bugs latents Beta 3, **afin de** travailler sur une base saine pour les sprints à venir et éviter les régressions héritées.

##### Contexte

Les betas précédentes (B1, B2, B3) ont accumulé des migrations et des dépendances historiques. Plusieurs bugs latents sont apparus en clean install lors de la mise en place de B4 : policies RLS référençant des colonnes inexistantes, index partiels refusés par Postgres, ordre de migrations cassé. B4 sert de référence pour les sprints à venir.

##### Critères d'acceptation

- Dossier `Magritoff-v4/` créé dans le repo `amazon-svg/Magritoff`.
- Branche Git dédiée : `beta/v4`.
- Port dev : 5176 (en parallèle de B1/5173, B2/5174 ; l'ancien B3/5175 est arrêté).
- Projet Supabase dédié : `ightkxebexuzfjdbpsdg` (`magrit-b4`).
- Toutes les migrations B3 historiques + nouvelles (E9.1–9.4, E2.1–2.2, E2.4, E6.1, E7.1) regroupées dans `supabase/_bootstrap_b4.sql` pour réinstallation propre.

##### Correctifs hérités Beta 3 (livrés sur B4)

- Policy RLS qui référençait `shops.status` (colonne inexistante — vraie colonne = `active boolean`).
- Index partiel `WHERE expires_at > now()` refusé par Postgres (`now()` non IMMUTABLE).
- Ordre des migrations cassé (`library_client.sql` exécuté avant `shop_module.sql` qui crée la table).

##### Dépendances d'activation

Edge function à redéployer sur B4 pour activer les fonctionnalités serveur :

- E2.1 / E2.2 (modes Marguerite Ouvert / Strict).
- E2.4 (plafond 25 messages + tracking troncature).
- E7.1 (tracking consommation LLM).

##### Références

- 11 commits pushés sur `beta/v4`.
- Migrations SQL dans `Magritoff-v4/supabase/migrations/`.
- 3 feature flags actifs en beta : `REQUIRE_PRO_EMAIL`, `REQUIRE_VERIFIED_SIREN` + mock INSEE (à inverser pour la prod — cf. E6.1).

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E7.4

_Aucun fichier du dépôt ne cite cet identifiant._
