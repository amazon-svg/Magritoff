---
id: E9.9
epic: E9 — Multi-tenant & gouvernance
source: notion
notion_url: https://app.notion.com/p/357d0131973c81a7a671fb1a4510580f
---
# E9.9 — SSO SAML 2.0 / OIDC (Enterprise + Business+)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E9.9 — SSO SAML 2.0 / OIDC (Enterprise + Business+)](https://app.notion.com/p/357d0131973c81a7a671fb1a4510580f) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E9 — Multi-tenant & gouvernance | Sprint 4 | P1 | L | Pas commencé | Claude code | Business+ | Beta 3 livraison, DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant que** tenant Business ou Enterprise, **je veux** authentifier mes utilisateurs via mon SSO d'entreprise (Azure AD, Google Workspace, Okta), **afin de** centraliser la gestion des comptes et appliquer mes politiques de sécurité.

##### Articulation

Exigence formelle de [T-01](https://www.notion.so/349d0131973c81e4a88cc6e071c71e10) (« SSO SAML 2.0 et OIDC obligatoire dès le plan Business »). Cette story délivre le socle technique réutilisé par T-01.

##### Critères d'acceptation

- Support **SAML 2.0** (Azure AD, Okta, OneLogin, Ping Identity).
- Support **OIDC** (Google Workspace, Auth0, Keycloak).
- Configuration par tenant : metadata IdP uploadé, certificat de signature, mapping attributs.
- Auto-provisioning : création user + tenant_membership au premier login.
- Mapping rôles via attribut SAML/OIDC (ex : `groups["magrit-admin"]` → admin du tenant).
- Déprovisioning via SCIM 2.0 (option Enterprise).
- Forcer SSO (désactiver login email/password) paramétrable par tenant.

##### Options techniques

- **Supabase Auth SAML/OIDC** : natif depuis 2024, mais limité.
- **WorkOS** : SDK b2b SSO/SCIM, premium mais robuste.
- **Auth0** : flexibilité max, coûteux.

Recommandation : commencer Supabase Auth natif, basculer vers WorkOS si besoins SCIM/audit avancés.

##### Dépendances

- E9.2, E9.3 (modèle users + droits)
- Choix hébergeur SSO

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E9.9

_Aucun fichier du dépôt ne cite cet identifiant._
