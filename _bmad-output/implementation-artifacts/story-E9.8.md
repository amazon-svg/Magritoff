---
id: E9.8
epic: E9 — Multi-tenant & gouvernance
source: notion
notion_url: https://app.notion.com/p/357d0131973c81ba848adc5439e52710
---
# E9.8 — Billing Stripe par tenant (abonnements Magrit)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E9.8 — Billing Stripe par tenant (abonnements Magrit)](https://app.notion.com/p/357d0131973c81ba848adc5439e52710) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E9 — Multi-tenant & gouvernance | Sprint 4 | P1 | L | Pas commencé | Claude code | Toutes | Beta 3 livraison | — |

### Description fonctionnelle (Notion)

**En tant que** tenant payant, **je veux** souscrire à mon plan Magrit (Pro / Business / Corporate / Enterprise) avec paiement par carte ou prélèvement automatique, **afin de** activer les fonctionnalités de mon tier sans intervention humaine.

##### Contexte

Dans Beta 3, le champ `plan` existe sur `tenants` (`freemium`/`pro`/`enterprise`) mais aucun mécanisme de facturation n'est branché. Toute mise à jour du plan se fait manuellement en SQL.

##### Articulation

Distinct de E4.3 (paiement Stripe **commandes shop**). Même fournisseur (Stripe), 2 produits différents :

- E9.8 = abonnements Magrit (revenu MRR AGE Dvt)
- E4.3 = paiement client final sur boutique Pro+ (revenu commande imprimeur)

##### Critères d'acceptation

- Page `dashboard/billing` accessible aux owners du tenant.
- Stripe Customer Portal intégré : changement de plan, méthodes de paiement, factures, annulation.
- Webhooks Stripe → edge function : sync `tenant.plan` automatique sur subscription updated/cancelled.
- Mode trial : 30 jours Pro offerts à la création tenant (paramétrable par superadmin).
- Downgrade auto en `freemium` si paiement échoué + 14 jours grace.
- TVA FR/EU : Stripe Tax activé, factures conformes e-invoicing 2026-2027.

##### Dépendances

- Compte Stripe AGE Dvt créé avec compte de tax FR
- Tarification validée (cf. doc Pricing Magrit V1)

##### Red flag

Planifier la conformité e-invoicing FR 2026-2027 dès la conception (Stripe Tax + Chorus Pro pour clients publics).

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E9.8

- `SPRINT_HANDOFF.md`
