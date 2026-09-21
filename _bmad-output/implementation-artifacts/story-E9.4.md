---
id: E9.4
epic: E9 — Multi-tenant & gouvernance
source: notion
notion_url: https://app.notion.com/p/357d0131973c814b88fad3ab8d308b66
---
# E9.4 — Renommer un espace actif (admin + superadmin)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E9.4 — Renommer un espace actif (admin + superadmin)](https://app.notion.com/p/357d0131973c814b88fad3ab8d308b66) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E9 — Multi-tenant & gouvernance | Sprint 1 | P0 | S | Terminé | Claude code | Toutes | Demande 05/05 | — |

### Description fonctionnelle (Notion)

**En tant qu'**admin de mon espace ou superadmin Magrit, **je veux** pouvoir renommer un espace actif, **afin de** corriger une erreur de nommage ou refléter une réorganisation interne sans recréer l'espace.

##### Critères d'acceptation

- Section « Paramètres de l'espace » dans `dashboard/profile` (ou nouvelle page dédiée).
- Champ « Nom de l'espace » éditable par owner/admin du tenant.
- Champ « Slug » éditable uniquement par superadmin Magrit (impact URLs `/t/:slug/...` et SEO).
- Sur changement de slug : redirection 301 sur l'ancien slug pendant 90 jours minimum.
- Logo, couleurs primaires également éditables (option, prolongation logique).
- Audit trail : tracé dans `tenant_events`.

##### Spécifications techniques

- RPC : `update_tenant(tenant_id, name?, slug?, branding?)`.
- Vérification SQL d'unicité du slug.
- Trigger pour copier l'ancien slug dans `tenant_slug_history` au moment du changement.
- Front : route guard ou middleware Vite qui matche le slug courant + l'historique.

##### Dépendances

Aucune. Story autonome.

##### Red flag

Changer le slug a un impact SEO et liens partagés (boutiques publiques, devis). Bandeau d'avertissement avant validation : « Le changement de slug invalide les anciens liens. Ils redirigeront pendant 90 jours puis seront cassés. »

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-18](https://app.notion.com/358d0131973c8172afe5e7a90e244a15) | Renommer le nom d'un espace par un admin tenant | OK | P1 — Importante | P04 — Renommer espace | B4 | E9.4 |
| [TF-19](https://app.notion.com/358d0131973c81d48ba3c4e0df7e9325) | Renommer le slug par superadmin avec redirection 90j | À jouer | P0 — Critique | P04 — Renommer espace | B4 | E9.4 |
| [TF-20](https://app.notion.com/358d0131973c81f6a2ebfb794b248c99) | Un admin tenant ne peut PAS modifier le slug | OK | P0 — Critique | P04 — Renommer espace | B4 | E9.4 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E9.4

- `SPRINT_HANDOFF.md`
- `_bmad-output/implementation-artifacts/story-S-SUBTENANT-SCOPE-sous-espace.md`
- `_bmad-output/planning-artifacts/prd.md`
- `src/app/layouts/TenantAwareLayout.tsx`
- `src/modules/tenants/ui/components/LegacySlugRedirect.tsx`
- `src/modules/tenants/ui/workspace/TenantSettingsPage.tsx`
- `supabase/_bootstrap_b4.sql`
- `supabase/migrations/20260505000300_e9_tenant_rename.sql`
