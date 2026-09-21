---
id: E10.7
epic: E10 — Gestion commerciale
source: notion
notion_url: https://app.notion.com/p/3cad0131973c81e0a1c9f35bde0eb6c5
---
# E10.7 — Règles de prix concurrentes : arbitrage par la règle la plus récente

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E10.7 — Règles de prix concurrentes : arbitrage par la règle la plus récente](https://app.notion.com/p/3cad0131973c81e0a1c9f35bde0eb6c5) · extrait le 17/09/2026 · page modifiée le 02/09/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E10 — Gestion commerciale | Sprint 5 — Gestion commerciale | P0 | M | Terminé | Claude code | Pro+ | RP 28/08/2026, WM 01/09/2026 | 8 |

### Description fonctionnelle (Notion)

**En tant qu'**administrateur, **je veux** qu'en cas de chevauchement de dates entre deux règles de même portée, ce soit la plus récemment créée qui s'applique, **afin de** garder une tarification prévisible sans multiplier les règles.

##### Statut

Draft — prêt pour agent dev. **Réécriture complète. La spécification du 28/08/2026 (découpage temporel automatique) est abrogée.**

##### Contexte produit

Décision WM du 01/09/2026, sur proposition de Xavier Péchoultres, retour d'expérience Clariprint : « quand il y a un arbitrage à faire entre deux règles, on prend la plus récente. Ça marche très bien depuis des années, tout le monde comprend très bien ce que ça fait. »

Le mécanisme de découpage arrêté le 28/08 est explicitement retiré : « découper, c'est trop compliqué, ça duplique les règles, si le mec décale les dates ensuite, comment on fait ? C'est une usine à gaz qui crée plus de problèmes qu'autre chose. »

Cas d'usage type : une marge générale court sur toute l'année 2026 ; l'administrateur ajoute en cours d'année une règle pour le mois de septembre. Cette règle étant créée après, elle l'emporte sur sa période, sans que la règle annuelle soit modifiée ni dupliquée. En octobre, il désactive la règle de septembre et la règle annuelle reprend seule.

##### Critères d'acceptation

1. Aucune règle n'est modifiée, découpée ou dupliquée à la création d'une autre règle. **Aucune écriture sur les règles existantes.**
2. Lorsque plusieurs règles de même portée et même cible sont applicables à la date de calcul, le moteur retient celle dont `created_at` est la plus récente **parmi les règles actives**.
3. L'ordre de résolution complet est : (a) filtrer les règles actives dont la période couvre la date de calcul, (b) retenir la portée la plus spécifique (client + gamme \> client \> gamme \> globale), (c) à spécificité égale, retenir la plus récente par `created_at`.
4. Une règle de portée différente ne concourt jamais : la spécificité prime toujours sur la récence.
5. Une règle porte un **nom** libre, obligatoire, qui la rend identifiable dans la liste et dans le détail de calcul d'une ligne de devis.
6. Une règle est **active ou désactivée** ; elle n'est jamais supprimée par le parcours normal, ce qui conserve l'historique tarifaire.
7. La liste des règles affiche une pastille de statut (vert actif, gris désactivé), se filtre par statut, se recherche par nom, et se trie par date de création et par date de début de validité.
8. Le détail de calcul d'une ligne de devis affiche le nom et l'identifiant de la règle retenue, ainsi que la mention « règle la plus récente » lorsque l'arbitrage s'est joué sur la récence.
9. Aucune contrainte d'exclusion sur les périodes : le chevauchement est un état **normal** du référentiel, pas une anomalie.
10. Le changement d'état actif/désactivé est journalisé (auteur, horodatage, état avant et après).

##### Contrat API

| Méthode | Route | Objet |
|---|---|---|
| GET | `/api/v1/price-rules` | Liste ; \`?status=active ⚠️ *cellule arrivée tronquée à l’extraction — lire la page Notion* |
| POST | `/api/v1/price-rules` | Crée une règle ; **ne modifie jamais les règles existantes** ; `Idempotency-Key` honoré |
| PATCH | `/api/v1/price-rules/{id}` | Modifie nom, valeur, période, état actif (`If-Match`) |
| POST | `/api/v1/price-rules/resolve` | Résout la règle applicable pour un contexte donné : `{ customer_id, product_range_id, at }` → règle retenue + motif de sélection (`specificity` ou `recency`) |

Événement émis : `price_rule.changed` (`{ rule_id, action: 'created'|'updated'|'activated'|'deactivated' }`).

L'endpoint `resolve` est exposé aux modules tiers par clé de service : Clariprint et Studio doivent pouvoir interroger la règle applicable sans rejouer la logique.

##### Tâches / Sous-tâches

- [ ] **Supprimer** la fonction `split_price_rule`, la colonne `split_from_rule_id` et la contrainte d'exclusion GiST prévues le 28/08 (CA : 1, 9)
- [ ] Ajouter `name text not null` et confirmer `is_active boolean not null default true` sur `price_rules` (CA : 5, 6)
- [ ] Index `(tenant_id, scope, customer_id, product_range_id, is_active, valid_from desc, created_at desc)` (CA : 2, 3)
- [ ] Fonction de résolution `resolve_price_rule(context, at)` en base, retournant la règle et le motif (CA : 2, 3, 4)
- [ ] Endpoint `POST /price-rules/resolve` + description OpenAPI (CA : contrat)
- [ ] Liste : pastille, filtre de statut, recherche par nom, tri (CA : 7)
- [ ] Affichage du motif de sélection dans le détail de calcul de ligne (CA : 8)
- [ ] Table d'audit des changements d'état (CA : 10)

##### Dev Notes

###### Algorithme de résolution

```sql
select * from price_rules
where tenant_id = :tenant
  and is_active
  and valid_from <= :at
  and (valid_to is null or valid_to >= :at)
  and (scope = 'global'
       or (scope = 'range'          and product_range_id = :range)
       or (scope = 'customer'       and customer_id = :customer)
       or (scope = 'customer_range' and customer_id = :customer and product_range_id = :range))
order by specificity_rank desc, created_at desc
limit 1;
```

`specificity_rank` : global = 0, range = 1, customer = 2, customer_range = 3.

###### Contraintes techniques

- La résolution est **déterministe** à une date donnée : deux appels identiques renvoient la même règle. C'est ce qui rend le prix d'un devis reproductible et auditable.
- `created_at` est la clé d'arbitrage : ne jamais la réécrire lors d'une modification de règle. Une modification substantielle de valeur se fait par création d'une nouvelle règle, pas par édition silencieuse — l'audit du CA 10 le rend visible.
- Ne pas réintroduire de « niveau de priorité » manuel : la séance du 28/08 l'avait déjà écarté, et la récence le remplace.

###### data-testid

`pricing-rules-page`, `pricing-rule-row` (+ `data-rule-id`, `data-status="active"|"disabled"`), `pricing-rule-status-pill`, `pricing-rules-status-filter`, `pricing-rules-search-input`, `pricing-rules-sort-select`, `pricing-rule-create-btn`, `pricing-rule-modal`, `pricing-rule-name-input`, `pricing-rule-toggle-active-btn`, `quote-line-applied-rule-name`, `quote-line-applied-rule-reason`

###### Dépendances

- Bloquée par : E10.0, E10.6
- Bloque : E10.21, E10.8

##### Tests

Parcours P13 — règle annuelle puis règle de septembre créée après : contrôle que la règle de septembre s'applique sur sa période, que la règle annuelle est **inchangée en base**, et qu'aucune règle n'a été dupliquée. Cas limite : désactivation de la règle de septembre, la règle annuelle reprend immédiatement.

##### Change Log

- 2026-09-02 — v2.1 — Livraison du Lot 3 E10 — 4 passes qa-review (Docker absent, défauts découverts par relecture statique), tous les critères d'acceptation vérifiés, déterminisme garanti
- 2026-08-28 — v1 — Création (découpage temporel automatique) — Arnaud Mazon / Claude
- 2026-09-01 — v2 — **Réécriture complète** suite au WM du 01/09/2026 : abandon du découpage, arbitrage par la règle la plus récente, règles nommées et activables — Arnaud Mazon / Claude

##### Dev Agent Record

###### Agent Model Used

Agent `dev-story` (Claude Sonnet) pour l'implémentation ; agent `qa-review` (Claude Opus) pour la revue et validation. Quatre cycles de correction, la plus lourde du sprint : Docker absent tout le sprint, les fichiers SQL n'ont jamais pu être exécutés, chaque round découvert par relecture attentive plutôt que par exécution.

###### Debug Log References

Aucun fourni par le dev-story. Les anomalies ont été trouvées par analyse statique de fichier SQL et par reconstruction mentale du comportement.

###### Completion Notes

**CA1** (aucune règle modifiée, dupliquée à la création) : tenu. Vérification que la boucle de création n'impacte aucune règle existante.

**CA2** (filtre règles actives, période couvre date calcul) : tenu. Clause WHERE en base et index GiST retirés en faveur d'index composite complet.

**CA3** (ordre de résolution : (a) actives + période (b) spécificité (c) récence) : tenu. Fonction `resolve_price_rule` implémente l'ordre exact, tri sur `specificity_rank desc, created_at desc`.

**CA4** (CA3 retient la plus récente à spécificité égale) : tenu après correction round 1. Test initial non discriminant entre spécificité et récence, refonte avec cas de mutation explicite.

**CA5** (règle porte un nom obligatoire) : tenu. Champ `name` ajouté en CA6, exposé en UI avec recherche et affichage dans la liste.

**CA6** (règle active ou désactivée, jamais supprimée) : tenu. Colonne `is_active` confirmée `not null default true`, pastille UI, filtre et bascule depuis la liste.

**CA7** (liste : pastille, filtre statut, recherche nom, tri) : tenu après correction. Filtre par `is_active`, tri par `created_at desc` et `valid_from desc`.

**CA8** (affichage du motif : « règle la plus récente ») : tenu. Endpoint `resolve` retourne `{ rule_id, name, reason: 'specificity'|'recency' }`, affichage du motif sur les lignes de devis (rattaché à E10.21, pas d'écran orphelin).

**CA9** (aucune contrainte d'exclusion, chevauchement normal) : tenu. Index GiST retiré, contrainte d'exclusion supprimée, index B-tree pour sélection additionné.

**CA10** (audit changements d'état actif/désactivé) : tenu. Trigger sur `is_active`, enregistrement auteur/horodatage dans `price_rules_audit`.

**Défauts trouvés et corrigés** :

- **Round 1** : test CA4 non discriminant (les deux règles avaient `created_at` à `now()`) → corrigé par mutation explicite d'une règle pour forcer un delta `created_at` mesurable.
- **Round 2** : Docker absent, fichier SQL `gescom-e10-7-price-rules-resolve.sql` découvert après interprétation avec reproduction mentale → deux règles créées dans une même transaction PostgreSQL partagent `now()` comme `created_at`, rendant le départage non déterministe. Assertion écrite en dur, fausse.
- **Round 3** : correction du point round 2 (ajout de délai explicit ou ID secondaire) → casse l'assertion voisine `updated_at = created_at` qui devient fausse après que `updated_at` ait été modifié lors de l'activation/désactivation.
- **Round 4** : introduction d'un tri secondaire `(created_at desc, id desc)` pour garantir déterminisme même quand deux règles partagent `created_at`.

**Note structurante** : les trois manquements des rounds 2-3 n'auraient jamais atteint la production (Docker aurait cassé le déploiement), mais la qa-review a trouvé tous les défauts sans exécution en relisant le fichier ligne à ligne.

###### File List

**Créés** : `supabase/migrations/20260902000300_gescom_e10_7_resolve_price_rule.sql`, `tests/sql/gescom-e10-7-price-rules-resolve.sql`, `src/modules/pricing/application/resolve-price-rule.ts`, `tests/contract/pricing-rules-resolve.contract.test.ts`.

**Modifiés** : `src/modules/pricing/application/price-rules-service.ts` (endpoint `resolve` intégré), `src/modules/pricing/ui/PriceRulesPage.tsx` (affichage statut actif/désactivé, filtre, recherche par nom), `openapi/magrit-core.v1.yaml`, `docs/api/CONVENTIONS.md`.

##### QA Results

**Verdict** : Accepté après quatre cycles de correction.

**Manquements découverts et corrigés** :

- **Round 1** : test CA4 non discriminant entre spécificité et récence → refonte du test avec mutation explicite d'une règle et vérification de `created_at` distinct
- **Round 2** : Docker absent, fichier SQL jamais exécuté → deux règles créées dans la même transaction PostgreSQL partagent `now()`, assertion initiale fausse, tri non déterministe
- **Round 3** : correction round 2 casse assertion voisine `updated_at = created_at` → introduction d'un tri secondaire sur `id` pour garantir déterminisme
- **Round 4** (final) : tous les défauts corrigés, déterminisme garanti, audit structuré

**Vérifications menées** : analyse statique du fichier SQL sans Docker ; relecture ligne à ligne des assertions de test ; garantie de déterminisme en cas de `created_at` identiques (tri secondaire sur `id`).

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-169](https://app.notion.com/3cad0131973c819abe03da90909bcd08) | GC — Une règle client surcharge la règle générale sans déclencher de conflit | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.6, E10.7 |
| [TF-170](https://app.notion.com/3cad0131973c81e895a1e5eee5688390) | GC — Conflit tarifaire : la règle la plus récente l'emporte, sans modifier l'existante | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.7, E10.6 |
| [TF-171](https://app.notion.com/3cad0131973c81369548ecd0747e4654) | GC — Désactiver une règle : la règle précédente reprend, l'historique est conservé | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.7, E10.6 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E10.7

- `_bmad-output/implementation-artifacts/story-E10-13-etapes-production.md`
- `_bmad-output/implementation-artifacts/story-E10-9-remises-granulaires.md`
- `docs/api/CONVENTIONS.md`
- `docs/spec/STORY_DOCUMENT_STANDARD.md`
- `docs/spec/backlog.md`
- `openapi/magrit-core.v1.yaml`
- `src/adapters/supabase/price-rules-repository.ts`
- `src/modules/commercial-quotes/application/commercial-quotes-service.ts`
- `src/modules/notifications/ui/hooks/useNotificationLogsManagement.ts`
- `src/modules/pricing/api/contracts.ts`
- `src/modules/pricing/application/price-rules-repository.ts`
- `src/modules/pricing/application/price-rules-service.ts`
- `src/modules/pricing/application/pricing-engine.ts`
- `src/modules/pricing/application/single-cost-pricing-engine.ts`
- `src/modules/pricing/ui/hooks/usePriceRulesManagement.ts`
- `src/modules/pricing/ui/workspace/PriceRuleFormModal.tsx`
- `src/modules/pricing/ui/workspace/PricingRulesPage.tsx`
- `src/platform/api/generated/magrit-core.v1.ts`
- `src/server/api/price-rules-routes.ts`
- `src/shared/presentation/testIds.ts`
- `supabase/migrations/20260902000200_gescom_e10_6_price_rules.sql`
- `supabase/migrations/20260902000300_gescom_e10_7_resolve_price_rule.sql`
- `supabase/migrations/20260904000100_gescom_e10_9_quote_line_discounts.sql`
- `supabase/migrations/20260908020000_gescom_e10_13_production_steps.sql`
- `tests/contract/_fakes/price-rules-repository.fake.ts`
- `tests/contract/price-rules.contract.test.ts`
- `tests/modules/pricing/price-rules-service.test.ts`
- `tests/sql/gescom-e10-10a-quote-send-duplicate.sql`
- `tests/sql/gescom-e10-7-price-rules-resolve.sql`
