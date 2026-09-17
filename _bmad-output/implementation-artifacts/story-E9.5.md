---
id: E9.5
epic: E9 — Multi-tenant & gouvernance
source: notion
notion_url: https://app.notion.com/p/357d0131973c810882f2e4928dd10d6b
---
# E9.5 — Email invitations (Resend/SendGrid) avec lien d'activation

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E9.5 — Email invitations (Resend/SendGrid) avec lien d'activation](https://app.notion.com/p/357d0131973c810882f2e4928dd10d6b) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E9 — Multi-tenant & gouvernance | Sprint 2 | P1 | M | Terminé | Claude code | Toutes | Beta 3 livraison | — |

### Description fonctionnelle (Notion)

**En tant qu'**admin d'espace, **je veux** que les invitations envoyées à de nouveaux utilisateurs partent par email automatiquement, **afin de** ne plus avoir à générer manuellement le lien via prompt JS comme aujourd'hui.

##### Contexte

Dans Beta 3 livré le 2026-04-24, les invitations existent (table `tenant_invitations`, route `/invitations/:token`) mais le **lien d'activation est généré manuellement** par Arnaud via un `prompt()` JS et copié-collé à la main. Aucun envoi automatique.

##### Critères d'acceptation

- Edge function `send-invitation-email` créée dans `supabase/functions/`.
- Déclenchement automatique à la création d'invitation (E9.2) si email destinataire = user inexistant.
- Template email brandé : logo Magrit, nom du tenant, lien d'activation, expiration 7 jours.
- Choix fournisseur : **Resend** (recommandé, simple + bon free tier) ou SendGrid.
- Variables d'env : `RESEND_API_KEY` ou `SENDGRID_API_KEY` ajoutées aux secrets Supabase B1/B2/B3.
- Webhook Resend : tracker open/click/bounce dans `tenant_invitation_events`.
- Resend manuel possible depuis l'UI admin si l'utilisateur n'a pas reçu (bouton « Renvoyer l'invitation »).

##### Dépendances

- E9.2 pour le flow CRUD
- Création compte Resend/SendGrid (Arnaud)

##### Red flag

Les emails transactionnels sont sensibles à la réputation domaine. Prévoir DKIM/SPF/DMARC sur le domaine d'envoi (probablement `magrit.app` ou sous-domaine `mail.magrit.app`).

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-40](https://app.notion.com/358d0131973c814aad20eb365fe4611f) | Invitation envoyée automatiquement par email via Resend | À jouer | P0 — Critique | P10 — Email invitation automatique | B5 | E9.5 |
| [TF-41](https://app.notion.com/358d0131973c815e85a6e0f1aacc4245) | Lien d invitation Magrit expiré (14 jours) → message clair, aucun compte créé | À jouer | P1 — Importante | P10 — Email invitation automatique | B5 | E9.5 |
| [TF-42](https://app.notion.com/358d0131973c81cd92dcec91aad1d7ad) | Renvoyer une invitation depuis l'UI admin | OK | P1 — Importante | P10 — Email invitation automatique | B5 | E9.5 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E9.5

- `SPRINT_HANDOFF.md`
- `_bmad-output/implementation-artifacts/story-R5-refacto-pattern-supabase-unique.md`
- `_bmad-output/implementation-artifacts/story-S3.2-residual-email-permission.md`
- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/roadmap-v1.1-qualite-first-2026-05-21.md`
- `docs/api/CONVENTIONS.md`
- `docs/project-context.md`
