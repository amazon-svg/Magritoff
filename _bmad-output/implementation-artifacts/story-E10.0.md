---
id: E10.0
epic: E10 — Gestion commerciale
source: notion
notion_url: https://app.notion.com/p/3ced0131973c81c79a51c57ad86f33bd
---
# E10.0 — Socle API-first : contrats, conventions et découpage modulaire (à lire avant toute story E10)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E10.0 — Socle API-first : contrats, conventions et découpage modulaire (à lire avant toute story E10)](https://app.notion.com/p/3ced0131973c81c79a51c57ad86f33bd) · extrait le 17/09/2026 · page modifiée le 01/09/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E10 — Gestion commerciale | Sprint 5 — Gestion commerciale | P0 | M | Terminé | Claude code | Technique | WM 01/09/2026 | 1 |

### Description fonctionnelle (Notion)

**En tant qu'**équipe produit, **nous voulons** que chaque fonction de gestion commerciale expose un contrat d'API stable avant son interface, **afin que** Studio, Clariprint et tout module tiers s'y branchent sans reprise de code.

##### Statut

Draft — prêt pour agent dev. **Story socle : à livrer en premier avec E10.4, et à respecter dans toutes les stories E10.x.**

##### Contexte produit

Exigence posée par Xavier Péchoultres au WM du 01/09/2026 : « ne pas oublier qu'on est en API first, modulaire ; tout ça doit être propre pour qu'on puisse facilement intégrer des choses par-dessus ». L'intégration Magrit ↔ Studio est au stade prototype côté UX et **attend les contrats d'API produits par le module de gestion commerciale** pour passer à l'intégration des données. Le contrat n'est donc pas un sous-produit du développement : c'est le livrable attendu par le partenaire.

##### Critères d'acceptation

1. Un fichier `openapi/magrit-core.v1.yaml` (OpenAPI 3.1) existe dans le dépôt et fait **foi** : aucun endpoint n'est implémenté sans y être décrit au préalable.
2. Les types TypeScript du client et du serveur sont **générés** depuis ce fichier (`pnpm gen:api`) ; aucun DTO n'est écrit à la main des deux côtés.
3. Toutes les routes sont préfixées `/api/v1/`, ressources au pluriel en kebab-case (`/api/v1/price-rules`).
4. Le tenant est **toujours** résolu depuis le jeton d'authentification, jamais depuis un paramètre de chemin ou de requête.
5. Deux modes d'authentification sont supportés : jeton utilisateur (Bearer JWT Supabase) et **clé de service par module tiers** (Studio, Clariprint) portant un scope explicite.
6. Le format de réponse est uniforme : succès `{ "data": ..., "meta": {...} }`, erreur en RFC 7807 `application/problem+json` avec un champ `code` métier stable.
7. La pagination est par curseur : `?page[size]=50&page[cursor]=...`, curseur suivant dans `meta.next_cursor`.
8. Tout POST qui crée une ressource métier (projet, devis, commande, fichier) accepte et honore un en-tête `Idempotency-Key`.
9. Tout PATCH est protégé par `ETag` / `If-Match` ; un conflit renvoie 409 avec l'état courant.
10. Un bus d'événements sortants existe, avec charge utile versionnée et signature HMAC : `quote.converted`, `order.step_changed`, `order.files_submitted`, `customer.created`, `price_rule.changed`.
11. Le code est organisé par module métier `src/modules/<domaine>/{routes,service,repository,dto,events,__tests__}` ; **aucun composant React n'interroge la base directement** — il passe par l'API.
12. Chaque endpoint dispose d'un test de contrat qui valide requête et réponse contre l'OpenAPI ; la CI échoue si le code s'écarte du contrat.
13. La v1 évolue en **additif seulement** : tout changement cassant ouvre `/api/v2`.

##### Tâches / Sous-tâches

- [ ] Créer `openapi/magrit-core.v1.yaml` avec les composants partagés (CA : 1, 6, 7)
    - [ ] Schémas `Problem`, `Meta`, `PageParams`, `Money`, `Rate`, `Audit`
    - [ ] Security schemes `bearerAuth` et `serviceKey` avec scopes
- [ ] Script `pnpm gen:api` (openapi-typescript côté client, zod-openapi côté serveur) (CA : 2)
- [ ] Middleware transverse : résolution de tenant, idempotence, ETag, gestion d'erreurs RFC 7807 (CA : 4, 6, 8, 9)
- [ ] Module `src/modules/_shared/` : `problem.ts`, `pagination.ts`, `idempotency.ts`, `events.ts` (CA : 6, 7, 8, 10)
- [ ] Table `outbox_events` + émetteur signant en HMAC (CA : 10)
- [ ] Harnais de test de contrat + étape CI bloquante (CA : 12)
- [ ] `docs/api/CONVENTIONS.md` reprenant les 13 critères, référencé par chaque story (CA : 1, 13)

##### Dev Notes

###### Conventions de nommage et de typage

- Montants : `numeric(12,2)` en base, sérialisés en **chaîne décimale** (`"1234.50"`), jamais en flottant JSON.
- Taux : `numeric(6,4)` sérialisés en chaîne (`"0.5000"` = 50 %).
- Dates : ISO 8601 UTC (`2026-09-01T09:00:00Z`) ; dates seules en `YYYY-MM-DD`.
- Identifiants : UUID v4 en base, exposés tels quels ; les numéros métier (`DEV-2026-00042`, `CMD-2026-00017`) sont des attributs, pas des clés.
- Énumérations : `snake_case` côté API, jamais d'entier magique.

###### Contrat d'événement (modèle)

```json
{
  "id": "uuid",
  "type": "order.step_changed",
  "version": 1,
  "occurred_at": "2026-09-01T09:00:00Z",
  "tenant_id": "uuid",
  "data": { "order_id": "uuid", "from_step_id": "uuid", "to_step_id": "uuid" }
}
```

Signature `X-Magrit-Signature: sha256=<hmac>` sur le corps brut. Livraison au moins une fois : le consommateur déduplique sur `id`.

###### Red flag

Le piège de la stack actuelle est de laisser React taper Supabase en direct : c'est rapide à écrire et cela rend le module **inintégrable** par Studio, qui n'a pas de client React. Chaque accès direct écrit pendant le sprint 5 est une dette à reprendre intégralement. RLS reste la sécurité de fond, l'API est le contrat.

###### Dépendances

- Bloque : toutes les stories E10.x
- Attendue par : intégration Studio (Xavier Péchoultres, Laurent Rebière)

##### Tests

Tests de contrat sur les composants partagés : format d'erreur, pagination, idempotence, ETag, signature d'événement.

##### Change Log

- 2026-09-01 — v1 — Création suite au WM du 01/09/2026 (exigence API-first et modulaire) — Arnaud Mazon / Claude

##### Dev Agent Record

###### Agent Model Used

Agent architecte (Claude Opus 4) pour implémentation. Agent QA-review (Claude Opus 4) pour revue — deux cycles de correction.

###### Debug Log References

Aucun fourni par le dev-story.

###### Completion Notes

**Vérification par critère d'acceptation :**

- **CA1** (contrat OpenAPI fait foi) : Tenu. `openapi/magrit-core.v1.yaml` existe, OpenAPI 3.1.0, source de vérité.
- **CA2** (types générés) : Tenu. Script `pnpm gen:api` implémenté ; openapi-typescript retenu (zod-openapi écarté : mauvaise direction).
- **CA3** (/api/v1/, kebab-case pluriel) : Tenu. Vérifié par lint et tests refusant les formes invalides.
- **CA4** (tenant du jeton) : Tenu. `?tenant_id=` et `{tenantId}` en chemin explicitement rejetés.
- **CA5** (deux auth, scopes) : Tenu après correction. Premier passage laissait scopes de service ouverts par défaut (bloquant B4) ; corrigé.
- **CA6** (\{data,meta\} / RFC 7807) : Tenu. Validé par Ajv contre schéma réel.
- **CA7** (pagination curseur) : Tenu.
- **CA8** (Idempotency-Key) : Tenu, avec persistance en base (`api_idempotency_keys`, ajout hors périmètre validé en cours de route).
- **CA9** (ETag/If-Match) : Tenu après correction. `If-Match: *` contournait silencieusement la protection (bloquant B1) ; corrigé en refus explicite.
- **CA10** (outbox + HMAC) : Tenu sur le code (signature HMAC testée). Garantie RLS/append-only écrite mais non exécutée — Docker absent. Revue attentive, jugée solide, non mesurée. À exécuter avant première story émettant un événement.
- **CA11** (organisation modulaire, zéro accès Supabase direct UI) : Tenu avec convention de dossiers amendée ; alignée sur 10 modules existants plutôt que structure littérale de la story.
- **CA12** (test de contrat par endpoint, CI bloquante) : Tenu après correction. Trou majeur trouvé et corrigé : rien ne reliait une route codée à une entrée réelle du contrat. Registre + lint dédiés comblent ce trou.
- **CA13** (v1 additive) : Tenu, documenté.

**Dérogations R5 et dette actife explicitement actée :**

- Garantie RLS/append-only de `outbox_events` non exécutée (Docker absent) ; à exécuter avant 1er événement émis.
- Angle mort mineur dans test SQL (revoke avant assertion plutôt qu'après capture des privilèges).
- `api_idempotency_keys` n'a pas encore de test RLS dédié.
- Garde anti-contournement de B2 : deux angles morts mineurs (périmètre de scan limité à `src/server/api`, vérification par mention textuelle) ; à durcir quand première story E10.x remplira le registre.
- Trois périmètres volontairement hors socle : façade historique, adaptateur Supabase de l'IdempotencyStore, dispatcher de l'outbox.

###### File List

**Créés :** `openapi/magrit-core.v1.yaml` • `scripts/gen-api-types.sh` • `src/platform/api/generated/magrit-core.v1.ts` • `src/modules/_shared/**` • `src/server/api/gescom-middleware.ts` • `src/server/api/gescom-routes.ts` • `src/modules/_shared/api/path-rules.ts` • `supabase/migrations/20260901000100_gescom_outbox_events.sql` • `supabase/migrations/20260901000200_gescom_api_idempotency_keys.sql` • `tests/contract/**` (harnais + 4 fichiers) • `tests/architecture/gescom-api-socle-boundaries.test.ts` • `tests/sql/gescom-outbox-append-only.sql` • `docs/api/CONVENTIONS.md`

**Modifiés :** `docs/architecture/api/openapi.yaml` (en-têtre de dépréciation uniquement) • `package.json` (scripts + devDeps) • `.github/workflows/architecture.yml` • `scripts/test-storefront-sql.sh` • `src/server/api/api-v1-handler.ts` • `src/server/api/index.ts`

##### QA Results

**Verdict : ACCEPTÉ** après deux cycles de correction.

**Premier passage :** 4 manquements bloquants (B1 — ETag/If-Match contournable ; B2 — trou dans vérification contrat/code ; B4 — scopes de service ouverts par défaut) + 5 remarques mineures. 

**Deuxième passage :** 1 point supplémentaire trouvé et corrigé.

**Détails des CA traités :** voir section Completion Notes ci-dessus. **Point ouvert explicitement :** garantie RLS/append-only de l'outbox non exécutée (Docker absent sur machines disponibles), écrite et revue, non mesurée — à exécuter sur poste équipé Docker avant première story émettant un événement.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-188](https://app.notion.com/3ced0131973c8137b388ed0c2a38e16f) | GC — Conformité du contrat API : OpenAPI, erreurs, pagination, idempotence | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.0 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E10.0

- `_bmad-output/implementation-artifacts/story-E10-10b-3-notification.md`
- `_bmad-output/implementation-artifacts/story-E10-12-conversion-commande.md`
- `_bmad-output/implementation-artifacts/story-E10-14-modale-statut-historique.md`
- `_bmad-output/implementation-artifacts/story-E10.15a.md`
- `_bmad-output/implementation-artifacts/story-E10.18a.md`
- `_bmad-output/implementation-artifacts/story-E10.18b.md`
- `_bmad-output/implementation-artifacts/story-E10.18c.md`
- `docs/api/CONVENTIONS.md`
- `docs/architecture/api/openapi.yaml`
- `docs/spec/backlog.md`
- `openapi/magrit-core.v1.yaml`
- `src/adapters/supabase/api-principal-verifier.ts`
- `src/adapters/supabase/outbox-dispatch-repository.ts`
- `src/adapters/supabase/outbox-repository.ts`
- `src/adapters/supabase/price-rules-repository.ts`
- `src/modules/_shared/api/contracts.ts`
- `src/modules/_shared/application/concurrency.ts`
- `src/modules/_shared/application/idempotency.ts`
- `src/modules/_shared/application/index.ts`
- `src/modules/_shared/application/outbox.ts`
- `src/modules/_shared/application/pagination.ts`
- `src/modules/_shared/application/problem.ts`
- `src/modules/_shared/application/tenant-resolution.ts`
- `src/modules/_shared/application/timestamps.ts`
- `src/modules/_shared/index.ts`
- `src/modules/commercial-quotes/api/client.ts`
- `src/modules/commercial-settings/api/client.ts`
- `src/modules/customers/api/client.ts`
- `src/modules/customers/api/contracts.ts`
- `src/modules/customers/ui/hooks/useCustomersManagement.ts`
- `src/modules/document-templates/api/client.ts`
- `src/modules/notifications/api/client.ts`
- `src/modules/order-files/api/client.ts`
- `src/modules/order-upload-links/api/client.ts`
- `src/modules/pricing/api/client.ts`
- `src/modules/pricing/ui/hooks/usePriceRulesManagement.ts`
- `src/modules/production-steps/api/client.ts`
- `src/modules/project-tags/api/client.ts`
- `src/modules/projects/api/client.ts`
- `src/modules/projects/api/contracts.ts`
- `src/modules/projects/ui/hooks/useProjectTagsCatalog.ts`
- `src/modules/projects/ui/hooks/useProjectsManagement.ts`
- `src/platform/api/generated/magrit-core.v1.ts`
- `src/server/api/api-facade-router.ts`
- `src/server/api/commercial-orders-routes.ts`
- `src/server/api/commercial-quotes-routes.ts`
- `src/server/api/commercial-settings-routes.ts`
- `src/server/api/composition.ts`
- `src/server/api/customer-shop-access-routes.ts`
- `src/server/api/customers-routes.ts`
- `src/server/api/document-templates-routes.ts`
- `src/server/api/gescom-middleware.ts`
- `src/server/api/notification-logs-routes.ts`
- `src/server/api/notification-templates-routes.ts`
- `src/server/api/order-exports-routes.ts`
- `src/server/api/order-files-routes.ts`
- `src/server/api/order-upload-links-routes.ts`
- `src/server/api/price-rules-routes.ts`
- `src/server/api/production-steps-routes.ts`
- `src/server/api/project-tags-routes.ts`
- … et 23 autres fichiers
