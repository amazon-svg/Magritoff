---
id: E_OBS.mockup-cache-header
epic: E7 — Perf & infra
source: notion
notion_url: https://app.notion.com/p/35dd0131973c81bab635cb10028825be
---
# E_OBS.mockup-cache-header — X-Mockup-Cache CORS-expose ou tracing

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E_OBS.mockup-cache-header — X-Mockup-Cache CORS-expose ou tracing](https://app.notion.com/p/35dd0131973c81bab635cb10028825be) · extrait le 17/09/2026 · page modifiée le 11/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E7 — Perf & infra | Backlog | P2 | S | Pas commencé | Claude code | Technique | Cas de test KO | — |

### Description fonctionnelle (Notion)

##### Origine

Campagne TF Sprint 3 du 11/05 — obs P2 sur TF-64 OK (5 templates OK mais header CORS-exposé manquant).

- Fiche TF : [TF-64](https://www.notion.so/35dd0131973c8187a4afcf919526fcb7)
- CR : [CR 11/05](https://www.notion.so/35dd0131973c8107bf9ad735ab8c5353)

##### Contexte

Le header `X-Mockup-Cache` (valeurs `MISS|HIT|MISS-NO-CACHE|FALLBACK`) absent de `response.headers` côté browser. Seuls `cache-control`, `content-length`, `content-type` exposés. Soit edge ne l'émet pas, soit `Access-Control-Expose-Headers` ne le liste pas. Utile SLO observabilité prod (NFR2 cache HIT \< 50 ms). Pas bloquant démo.

Périmètre : [supabase/functions/mockup-generator/index.ts](supabase/functions/mockup-generator/index.ts).

##### User story

En tant que Superadmin Magrit, je veux voir le header `X-Mockup-Cache` dans `response.headers` navigateur, afin de mesurer le ratio HIT/MISS sans canal cURL séparé.

##### Critères d'acceptation

1. **Given** GET `/functions/v1/mockup-generator?...&template=flyer` depuis navigateur, **When** response arrive, **Then** `response.headers.get('X-Mockup-Cache')` retourne une valeur dans `["MISS", "HIT", "MISS-NO-CACHE", "FALLBACK"]`.
2. **Given** diagnostic cURL, **When** compare `curl -I` vs `fetch().headers`, **Then** diff nul.
3. **Given** fix appliqué, **When** rafraîchis 2×, **Then** 1re `MISS`/`FALLBACK`, 2e `HIT`.
4. **0 régression** : TF-64 5 templates OK.
5. **TF nouveau couvrant CORS** créé et OK.

##### Spécifications

- Fichier : [mockup-generator/index.ts](supabase/functions/mockup-generator/index.ts).
- Étape 1 diagnostic cURL pour distinguer émission vs CORS-expose.
- Étape 2a si émis : ajouter à `Access-Control-Expose-Headers`.
- Étape 2b si non émis : implémenter tracing HEAD HIT/MISS/FALLBACK.
- Hors scope P2 : table `mockup_cache_events`.

##### Dépendances

- Aucun prérequis. Candidat Sprint 5.

##### Estimation

**S (\< 1 j)**. 1 h diagnostic + fix CORS, ou 2-3 h fix émission + tests Deno + redéploiement.

##### Plan de test

- TF à re-jouer : [TF-64](https://www.notion.so/35dd0131973c8187a4afcf919526fcb7).
- TF nouveau : *"mockup-generator — X-Mockup-Cache exposé navigateur"*, P09, Superadmin Magrit, P2, API directe + IA Chrome.
- Smoke API : cURL + fetch JS.
- Tests Deno : cas dans `index.test.ts`.

##### Définition de « terminé »

- Code mergé sur `beta/v5`.
- Edge redéployée.
- TF nouveau OK.
- CR campagne suivante.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E_OBS.mockup-cache-header

_Aucun fichier du dépôt ne cite cet identifiant._
