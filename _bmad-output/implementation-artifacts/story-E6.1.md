---
id: E6.1
epic: E6 — Données & qualité
source: notion
notion_url: https://app.notion.com/p/357d0131973c8181adb1dc5c991797a0
---
# E6.1 — Validation SIREN + email professionnel

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E6.1 — Validation SIREN + email professionnel](https://app.notion.com/p/357d0131973c8181adb1dc5c991797a0) · extrait le 17/09/2026 · page modifiée le 06/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E6 — Données & qualité | Sprint 1 | P0 | M | Terminé | Claude code | Freemium+ | Vision Produit 15/04 | — |

### Description fonctionnelle (Notion)

**En tant que** système, **je veux** valider l'identité des utilisateurs par SIREN et email professionnel à l'inscription, **afin de** garantir la qualité de la base et le positionnement B2B exclusif.

##### Critères d'acceptation

- À l'inscription : saisie obligatoire du SIREN (FR) ou identifiant entreprise équivalent (EU : VAT, international : tax ID).
- Vérification automatique SIREN via **API INSEE Sirene V3** : existence, actif, raison sociale, code NAF.
- Email obligatoire : domaine non-générique (pas de @gmail, @yahoo, @hotmail sauf exception manuelle support).
- Validation par double opt-in (lien de confirmation).
- Badge « Entreprise vérifiée » affiché dans l'interface une fois l'inscription complète.
- Stockage sécurisé des identifiants (RGPD conforme).
- API : `POST /auth/signup` avec validation en chaîne.

##### Red flags

- API INSEE rate limited → cache obligatoire.
- RGPD : DPA à formaliser pour stockage SIREN + emails.

##### Avancement Sprint 1 / B4 (livré 05/05/2026)

**Livré :**

- Champ SIREN dans le wizard `/tenants/new` + bouton **Vérifier** : checksum Luhn + résolution INSEE (raison sociale, code NAF, état actif).
- Badge vert « Vérifié » si SIREN valide ; message d'erreur explicite sinon.
- Stockage des données INSEE sur le tenant (`siren`, `siren_data`, `verified=true`).
- Filtrage des emails génériques : bandeau d'info si l'email est sur un domaine grand public (≈30 domaines listés dans `lib/emailValidator.ts` : gmail, yahoo, hotmail, orange, free, icloud…).
- **Mode bouchon INSEE** : appel API INSEE Sirene V3 mocké (à brancher sur le compte INSEE réel d'AGE Dvt. avant production).
- **Feature flags actifs en beta** (à inverser pour la production via `lib/featureFlags.ts`) :
  - `REQUIRE_VERIFIED_SIREN` : vérification optionnelle en beta, obligatoire en prod (1 ligne à changer).
  - `REQUIRE_PRO_EMAIL` : warning informatif en beta, blocage en prod (1 ligne à changer).

##### Reste à livrer

- Branchement réel API INSEE Sirene V3 (nécessite création compte INSEE par Arnaud).
- Validation par double opt-in (lien de confirmation email).
- Bascule des feature flags en mode bloquant pour la production V1.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-1](https://app.notion.com/358d0131973c819ebd45efb0ea74e367) | Création nominale d'un tenant avec SIREN valide et email pro | OK | P0 — Critique | P00 — Création espace tenant | B4 | E6.1 |
| [TF-2](https://app.notion.com/358d0131973c81018f9ec73b042bea31) | Rejet d'un SIREN invalide (Luhn KO) | OK | P0 — Critique | P00 — Création espace tenant | B4 | E6.1 |
| [TF-3](https://app.notion.com/358d0131973c813d8342f9b48cfd6905) | Avertissement sur email générique grand public | Obsolète | P1 — Importante | P00 — Création espace tenant | B4 | E6.1 |
| [TF-4](https://app.notion.com/358d0131973c8180a522d48532e2acf0) | Refus de création avec slug déjà pris | À jouer | P1 — Importante | P00 — Création espace tenant | B4 | E6.1 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E6.1

- `SPRINT_HANDOFF.md`
- `_bmad-output/planning-artifacts/prd.md`
- `openapi/magrit-core.v1.yaml`
- `src/modules/customers/application/siret-verification.ts`
- `src/modules/customers/ui/workspace/CustomerFormModal.tsx`
- `src/modules/tenants/ui/helpers/emailValidator.ts`
- `src/modules/tenants/ui/helpers/sirenValidator.ts`
- `src/modules/tenants/ui/runtime/TenantContext.tsx`
- `src/modules/tenants/ui/workspace/TenantOnboardingPage.tsx`
- `src/platform/api/generated/magrit-core.v1.ts`
- `src/shared/config/featureFlags.ts`
- `supabase/migrations/20260505000400_e6_siren_email_pro.sql`
- `supabase/migrations/20260901000300_gescom_e10_4_customers.sql`
- `tests/modules/customers/siret-verification.test.ts`
