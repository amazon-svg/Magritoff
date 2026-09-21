---
id: E9.3
epic: E9 — Multi-tenant & gouvernance
source: notion
notion_url: https://app.notion.com/p/357d0131973c812c9746c69d54a1b2b3
---
# E9.3 — Droits granulaires : accès Magrit complet vs boutique uniquement

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E9.3 — Droits granulaires : accès Magrit complet vs boutique uniquement](https://app.notion.com/p/357d0131973c812c9746c69d54a1b2b3) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E9 — Multi-tenant & gouvernance | Sprint 1 | P0 | L | Terminé | Claude code | Toutes | Demande 05/05 | — |

### Description fonctionnelle (Notion)

**En tant qu'**admin d'un espace, **je veux** définir si un utilisateur a accès à Magrit front complet ou uniquement à une boutique spécifique, **afin de** distinguer les collaborateurs internes (Magrit complet) des clients B2B externes (boutique seule).

##### Contexte produit

Dans Beta 3, tout utilisateur ajouté au tenant a accès à l'ensemble du dashboard (Atelier, Équipe, Config, Admin PIM si superadmin). Or, beaucoup d'utilisateurs ne devraient voir qu'une boutique dédiée (ex : un acheteur chez un client B2B). Ce niveau de granularité est essentiel pour la cible Corporate.

##### Modèle de droits proposé

| Champ | Valeur |
| --- | --- |
| `access_scope` | `magrit_full` \\ ⚠️ *cellule arrivée tronquée à l’extraction — lire la page Notion* |
| `allowed_shop_ids[]` | Si `shop_only`, liste des boutiques accessibles |
| `can_quote` | bool — créer des devis |
| `can_order` | bool — passer commande |
| `can_invite` | bool — inviter d'autres utilisateurs |
| `can_manage_users` | bool — admin (cf. E9.2) |

##### Critères d'acceptation

- L'admin choisit le scope dans la modale de création/modification d'utilisateur (E9.2).
- Si `shop_only` : l'utilisateur s'authentifie sur `/shop/:slug`, pas d'accès aux routes `/t/:slug/dashboard/*`.
- Le router vérifie le scope à chaque navigation (guard React) + RLS DB applique le même filtre.
- Pour `shop_only`, la boutique unique = redirect direct vers `/shop/:allowed_shop_id`. Si plusieurs : selector minimal en header.
- `magrit_full` : comportement actuel Beta 3.

##### Spécifications techniques

- Migration SQL : ajouter colonnes à `tenant_memberships` : `access_scope text default 'magrit_full'`, `allowed_shop_ids uuid[] default '{}'`, `permissions jsonb`.
- Helper RLS `current_user_can_access_shop(shop_id)` à ajouter.
- Hook `useAccessGuard()` côté React qui short-circuit les routes interdites.

##### Dépendances

- E9.2 (CRUD users) qui consomme ce modèle

##### Red flag

Le scope côté client (React guard) n'est pas une sécurité — c'est de l'UX. La sécurité réelle vient de RLS. Tester systématiquement qu'un user `shop_only` ne peut pas requêter les tables hors de ses `allowed_shop_ids` (cf. E9.10).

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-7](https://app.notion.com/358d0131973c81d5b49feca4a615c1d8) | Premier login d'un user shop_only redirige vers /shop/:slug | Obsolète | P0 — Critique | P01 — Onboarding premier login | B4 | E9.1, E9.3 |
| [TF-8](https://app.notion.com/358d0131973c8116b8d8fd0483df61ca) | User shop_only ne peut pas atteindre le dashboard via URL directe | Obsolète | P0 — Critique | P01 — Onboarding premier login | B4 | E9.3, E9.10 |
| [TF-9](https://app.notion.com/358d0131973c81f9844ec438d49b4be9) | Inviter un utilisateur Magrit (profil utilisateur + option) et activer l invitation | OK | P0 — Critique | P02 — Gestion utilisateurs | B4 | E9.1, E9.2, E9.3 |
| [TF-14](https://app.notion.com/358d0131973c81cdb444d23928b5b3f9) | Modifier le scope d'un user de magrit_full vers shop_only | Obsolète | P0 — Critique | P03 — Droits granulaires | B4 | E9.3 |
| [TF-15](https://app.notion.com/358d0131973c81bd892ad788cfd62f60) | Activer / désactiver les options Boutiques et Commandes d un utilisateur indépendamment | OK | P1 — Importante | P03 — Droits granulaires | B4 | E9.3 |
| [TF-16](https://app.notion.com/358d0131973c81c6b5bdcf5f52d7fc99) | Un utilisateur (profil non admin) n accède ni à la page Utilisateurs ni à l API d invitation | KO | P0 — Critique | P03 — Droits granulaires | B4 | E9.3 |
| [TF-17](https://app.notion.com/358d0131973c81b6814dcbe7fd409641) | Shop_only avec plusieurs boutiques voit le selector au login | Obsolète | P1 — Importante | P03 — Droits granulaires | B4 | E9.3 |
| [TF-167](https://app.notion.com/3cad0131973c8148b38afb0c3a2c89c5) | GC — Étanchéité : un compte client boutique n'atteint pas le dashboard Magrit | À jouer | P0 — Critique | P12 — Comptes clients boutique | B6 | E10.5, E10.4, E9.3, E9.10 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E9.3

- `SPRINT_HANDOFF.md`
- `_bmad-output/implementation-artifacts/story-S-USERS-REFONTE-phase-a.md`
- `_bmad-output/implementation-artifacts/story-S1.4-order-entity-tenant.md`
- `_bmad-output/implementation-artifacts/story-S2.1-shop-layout-3col.md`
- `_bmad-output/implementation-artifacts/story-S3.2-residual-email-permission.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/prd.md`
- `docs/spec/STORY_DOCUMENT_STANDARD.md`
- `supabase/_bootstrap_b4.sql`
- `supabase/migrations/20260505000200_e9_user_permissions.sql`
- `supabase/migrations/20260509000100_e1_orders_v1_1.sql`
- `supabase/migrations/20260523000100_s3_2_can_create_order_helper.sql`
