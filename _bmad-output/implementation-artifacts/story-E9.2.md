---
id: E9.2
epic: E9 — Multi-tenant & gouvernance
source: notion
notion_url: https://app.notion.com/p/357d0131973c81f490a1fbabd13a8721
---
# E9.2 — CRUD utilisateurs par admin d'espace

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E9.2 — CRUD utilisateurs par admin d'espace](https://app.notion.com/p/357d0131973c81f490a1fbabd13a8721) · extrait le 17/09/2026 · page modifiée le 06/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E9 — Multi-tenant & gouvernance | Sprint 1 | P0 | M | Terminé | Claude code | Toutes | Demande 05/05 | — |

### Description fonctionnelle (Notion)

**En tant qu'**admin d'un espace Magrit, **je veux** créer, modifier et supprimer des utilisateurs de mon espace, **afin de** gérer mon équipe sans avoir à passer par le superadmin Magrit.

##### Contexte

En l'état de Beta 3, seul Arnaud (superadmin) peut ajouter des utilisateurs à un espace. C'est un blocage pour l'autonomie des admins clients.

##### Critères d'acceptation

- Page `dashboard/users` accessible aux owners et admins de l'espace courant (RLS déjà en place).
- **Créer** : formulaire avec email + rôle (owner / admin / member / partner) + droits granulaires (cf. E9.3).
- **Modifier** : changer rôle et droits, jamais l'email (clé de jointure auth).
- **Supprimer** : retire le membership tenant, ne supprime pas le user auth global.
- Confirmation explicite avant suppression (« Cette action retire l'accès de X de l'espace Y. L'utilisateur conservera son compte Magrit. »).
- Un admin ne peut pas supprimer un owner ; seul un autre owner peut.
- Audit trail : chaque action (created, role_changed, deleted) est tracée dans `tenant_membership_events`.

##### Spécifications techniques

- RPC SQL : `create_tenant_member(tenant_id, email, role, permissions)`, `update_tenant_member`, `remove_tenant_member`.
- Si email = utilisateur Magrit existant : ajout direct au tenant.
- Si email inexistant : envoi d'invitation (cf. E9.5) avec lien d'activation.
- Migration SQL : table `tenant_membership_events` pour audit.

##### Dépendances

- E9.3 (droits granulaires) qui définit la structure des permissions
- E9.5 (email invitations) pour le flow d'activation

##### Red flag

Ne jamais permettre à un admin de s'auto-rajouter superadmin Magrit. La promotion `magrit-root` reste exclusivement contrôlée par RPC SQL dédié (`bootstrap_magrit_admin`).

##### Avancement Sprint 1 / B4 (livré 05/05/2026)

**Livré :**

- CRUD complet sur `/t/<slug>/dashboard/users` : inviter (email + rôle), changer le rôle inline depuis la table, retirer un membre (avec confirmation), révoquer une invitation en attente.
- Restriction technique : impossible de retirer ou de modifier le owner ; impossible de se promouvoir superadmin (conforme red flag).
- Audit trail tracé dans la table `tenant_member_events` (nom retenu à la livraison ; remplace `tenant_membership_events` initialement prévu).
- **Invitation par lien manuel** : génération du lien d'activation à copier-coller (envoi email automatique = E9.5, Sprint 2).
- SQL à appliquer (≈1 min) sur les environnements existants ; livré nativement dans le bootstrap B4 (`supabase/_bootstrap_b4.sql`).

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-9](https://app.notion.com/358d0131973c81f9844ec438d49b4be9) | Inviter un utilisateur Magrit (profil utilisateur + option) et activer l invitation | OK | P0 — Critique | P02 — Gestion utilisateurs | B4 | E9.1, E9.2, E9.3 |
| [TF-10](https://app.notion.com/358d0131973c81ea8bb3df798b07bae0) | Changer le profil d un membre (Utilisateur ↔ Admin) depuis la ligne | OK | P1 — Importante | P02 — Gestion utilisateurs | B4 | E9.2 |
| [TF-11](https://app.notion.com/358d0131973c8102abedd492fc82874f) | Retirer un membre avec confirmation explicite | OK | P0 — Critique | P02 — Gestion utilisateurs | B4 | E9.2 |
| [TF-12](https://app.notion.com/358d0131973c816195a8f32d7217d96e) | Le dernier admin d un espace ne peut être ni retiré ni rétrogradé | OK | P0 — Critique | P02 — Gestion utilisateurs | B4 | E9.2, E9.10 |
| [TF-13](https://app.notion.com/358d0131973c81c28c2cc76a2c60c51a) | Un admin ne peut PAS se promouvoir superadmin Magrit | À jouer | P0 — Critique | P02 — Gestion utilisateurs | B4 | E9.2, E9.10 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E9.2

- `SPRINT_HANDOFF.md`
- `supabase/_bootstrap_b4.sql`
- `supabase/migrations/20260505000100_e9_users_management.sql`
