---
id: E9.7
epic: E9 — Multi-tenant & gouvernance
source: notion
notion_url: https://app.notion.com/p/357d0131973c81ac9c1ee293d525aa61
---
# E9.7 — Custom domain par tenant (table tenant_domains)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E9.7 — Custom domain par tenant (table tenant_domains)](https://app.notion.com/p/357d0131973c81ac9c1ee293d525aa61) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E9 — Multi-tenant & gouvernance | Sprint 4 | P2 | L | Pas commencé | Claude code | Enterprise | Beta 3 livraison, DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant que** tenant Enterprise, **je veux** servir Magrit sur mon propre domaine (ex : `print.altavia.com`), **afin de** offrir une expérience white-label à mes utilisateurs internes et clients B2B.

##### Articulation

C'est la concrétisation technique du sous-domaine brandé mentionné dans [T-01](https://www.notion.so/349d0131973c81e4a88cc6e071c71e10) (Corporate Portal). Cette story délivre le mécanisme générique réutilisable pour T-01 et plus largement.

##### Critères d'acceptation

- Table `tenant_domains` (id, tenant_id, domain, verified_at, ssl_issued_at, status).
- UI admin Enterprise : ajouter un domaine, instructions DNS (CNAME ou A record), vérification automatique.
- Émission certificats SSL via Let's Encrypt (ou solution managed type Cloudflare for SaaS).
- Routing edge : reconnaissance du domaine → résolution tenant → chargement du branding.
- Fallback : `tenant.magrit.app` reste toujours accessible en parallèle.

##### Options techniques à évaluer

1. **Cloudflare for SaaS** — SSL automatique, CNAME flattening, 0,10\$/req. Simple mais lock-in CF.
2. **Caddy + Let's Encrypt** — self-managed, plus de contrôle, plus de complexité ops.
3. **Vercel Domains API** — si on héberge sur Vercel.

##### Dépendances

- E9.4 (slug éditable) sert de fallback URL
- Hosting (à décider : actuellement le front Magrit est sur Vite local, prod = ?)

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E9.7

_Aucun fichier du dépôt ne cite cet identifiant._
