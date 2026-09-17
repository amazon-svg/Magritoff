---
id: E9.10
epic: E9 — Multi-tenant & gouvernance
source: notion
notion_url: https://app.notion.com/p/357d0131973c81c8b9c5eea61860e927
---
# E9.10 — Tests RLS d'étanchéité multi-tenant automatisés

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E9.10 — Tests RLS d'étanchéité multi-tenant automatisés](https://app.notion.com/p/357d0131973c81c8b9c5eea61860e927) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E9 — Multi-tenant & gouvernance | Sprint 2 | P1 | M | Terminé | Claude code | Technique | Beta 3 livraison | — |

### Description fonctionnelle (Notion)

**En tant que** ops/sécurité, **je veux** une suite de tests automatisés qui vérifient qu'un tenant ne peut pas lire ou modifier les données d'un autre tenant, **afin de** garantir l'étanchéité multi-tenant en continu.

##### Contexte

Les politiques RLS Supabase ont été posées sur Beta 3 (migration 01) avec helpers `current_user_tenant_ids()`, `is_super_admin()`. Il manque une suite de tests automatisés pour prévenir les régressions.

##### Critères d'acceptation

- Tests vitest dans `Magritoff-v3/tests/rls/` qui simulent 3 utilisateurs : tenant A (member), tenant B (member), superadmin.
- Pour chaque table tenant-scopée : vérifier que tenant A ne peut pas SELECT/UPDATE/DELETE sur des lignes tenant B.
- Tests pour les helpers `current_user_can_access_shop`, `is_super_admin`, etc.
- Test scope `shop_only` (E9.3) : vérifier que l'utilisateur ne peut accéder qu'à ses `allowed_shop_ids`.
- Tests sur les RPC : `create_tenant_with_owner`, `accept_tenant_invitation`.
- Intégration CI : la suite RLS bloque tout merge sur `beta/v3` ou `main` en cas d'échec.

##### Dépendances

- E9.3 livré (sinon les tests scope `shop_only` n'ont rien à valider)

##### Spécifications techniques

- Supabase local (`supabase start`) avec seed multi-tenants pour les tests.
- Helper `loginAs(userId)` qui swap le JWT du client de test.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-8](https://app.notion.com/358d0131973c8116b8d8fd0483df61ca) | User shop_only ne peut pas atteindre le dashboard via URL directe | Obsolète | P0 — Critique | P01 — Onboarding premier login | B4 | E9.3, E9.10 |
| [TF-12](https://app.notion.com/358d0131973c816195a8f32d7217d96e) | Le dernier admin d un espace ne peut être ni retiré ni rétrogradé | OK | P0 — Critique | P02 — Gestion utilisateurs | B4 | E9.2, E9.10 |
| [TF-13](https://app.notion.com/358d0131973c81c28c2cc76a2c60c51a) | Un admin ne peut PAS se promouvoir superadmin Magrit | À jouer | P0 — Critique | P02 — Gestion utilisateurs | B4 | E9.2, E9.10 |
| [TF-167](https://app.notion.com/3cad0131973c8148b38afb0c3a2c89c5) | GC — Étanchéité : un compte client boutique n'atteint pas le dashboard Magrit | À jouer | P0 — Critique | P12 — Comptes clients boutique | B6 | E10.5, E10.4, E9.3, E9.10 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E9.10

- `SPRINT_HANDOFF.md`
- `_bmad-output/implementation-artifacts/story-S4.1a-bucket-storage-product-mockups.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/implementation-readiness-report-2026-05-09.md`
- `_bmad-output/planning-artifacts/prd.md`
- `supabase/migrations/20260509000100_e1_orders_v1_1.sql`
- `tests/README.md`
- `tests/rls/orders_isolation.test.ts`
- `tests/rls/tenant_isolation.test.ts`
- `tests/storage/product_mockups_isolation.test.ts`
