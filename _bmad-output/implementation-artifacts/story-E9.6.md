---
id: E9.6
epic: E9 — Multi-tenant & gouvernance
source: notion
notion_url: https://app.notion.com/p/357d0131973c8146b6dcd8634bd52c0f
---
# E9.6 — Wizard souscription gammes à la création tenant

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E9.6 — Wizard souscription gammes à la création tenant](https://app.notion.com/p/357d0131973c8146b6dcd8634bd52c0f) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E9 — Multi-tenant & gouvernance | Sprint 2 | P1 | M | Terminé | Claude code | Toutes | Beta 3 livraison | — |

### Description fonctionnelle (Notion)

**En tant qu'**utilisateur créant un nouveau tenant, **je veux** un wizard qui me propose de souscrire aux gammes PIM pertinentes pour mon métier, **afin que** mon catalogue soit utilisable dès la première connexion.

##### Contexte

Dans Beta 3, la création d'un tenant via `/tenants/new` crée l'espace mais **sans souscription à aucune gamme PIM**. Conséquence : le tenant n'a aucun produit visible tant qu'il n'est pas passé manuellement par Admin PIM → Gammes actives.

##### Critères d'acceptation

- Étape supplémentaire dans `OnboardingWizard.tsx` : « Quelles gammes proposez-vous ? »
- Présentation des 22 gammes seed groupées par kind Clariprint (leaflet, folded, book, cover/section).
- Multi-sélection avec presets : « Imprimerie généraliste » (toutes), « Imprimerie commercial » (cartes + flyers + brochures), « PLV / grand format », « Packaging ».
- Sur validé : insertion en bulk dans `tenant_gamme_subscriptions`.
- Skip possible : « Configurer plus tard ».

##### Dépendances

Aucune (données PIM déjà en place sur B3).

##### Spécifications techniques

- Modifier `OnboardingWizard.tsx` (ajouter step 3).
- RPC `subscribe_tenant_to_gammes(tenant_id, gamme_ids[])`.
- Pour le superadmin Magrit : possibilité d'ajouter/retirer des gammes après coup depuis l'UI Admin PIM existante.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-5](https://app.notion.com/358d0131973c8198afcdc351f91c0166) | Premier login admin et arrivée sur l espace (chat Magrit, sidebar, page Utilisateurs) | OK | P0 — Critique | P01 — Onboarding premier login | B4 | E9.1, E9.6 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E9.6

- `SPRINT_HANDOFF.md`
- `_bmad-output/implementation-artifacts/sprint-status-2026-05-17.md`
- `_bmad-output/implementation-artifacts/story-P0.3-tenant-onboarding-wizard-11-parents.md`
- `_bmad-output/implementation-artifacts/story-S-SUBTENANT-SCOPE-sous-espace.md`
- `_bmad-output/implementation-artifacts/story-S2.2-shop-gammes-sidebar.md`
- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/prd.md`
- `src/modules/tenants/ui/runtime/TenantContext.tsx`
- `src/modules/tenants/ui/workspace/TenantOnboardingPage.tsx`
