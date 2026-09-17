---
id: E4.2
epic: E4 — Mini-shop
source: notion
notion_url: https://app.notion.com/p/357d0131973c81b984fbf01c4baf137c
---
# E4.2 — Validation d'une commande boutique par un utilisateur Pro (storefront)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E4.2 — Validation d'une commande boutique par un utilisateur Pro (storefront)](https://app.notion.com/p/357d0131973c81b984fbf01c4baf137c) · extrait le 17/09/2026 · page modifiée le 01/09/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E4 — Mini-shop | Sprint 3 | P1 | L | Pas commencé | Claude code | Pro+ | Vision Produit 15/04, WM 01/09/2026 | — |

### Description fonctionnelle (Notion)

> ℹ️ **Périmètre précisé au WM du 01/09/2026 — arbitrage rendu : pas de fusion avec E10.12.**
>
> Cette story concerne **exclusivement la boutique**. Un utilisateur lambda de la boutique constitue et valide son panier ; la commande n'est réputée passée qu'une fois validée par un utilisateur **« Pro »** de cette même boutique. La notion d'utilisateur Pro appartient au storefront et n'existe pas de façon transverse dans Magrit.
>
> Ne pas confondre avec **E10.12**, qui traite de la validation d'un devis en commande par un **utilisateur Magrit** (commercial) depuis le back-office. E10.12 est la story de référence du workflow commercial Magrit.
>
> Les deux workflows convergent sur le même objet Commande. La transformation d'un panier boutique en commande Magrit — et le statut « en attente de validation client » qui l'accompagne éventuellement — est un sujet à traiter séparément, hors sprint 5.
>
> Verbatim Xavier Péchoultres : « il faut travailler flux par flux, workflow par workflow ; la E10 concerne le workflow de gestion commerciale, il faut travailler là-dessus, il ne faut pas partir dans les trucs à droite à gauche ; après on reprendra l'autre sujet proprement ».

**En tant qu'**utilisateur Pro, **je veux** transformer un devis validé en commande avec notifications et suivi, **afin de** boucler le cycle commercial dans Magrit.

##### Critères d'acceptation

- Bouton « Valider la commande » sur le panier.
- Création d'un BC avec numéro unique, horodatage, utilisateur, lignes produit, prix total.
- Statuts : `draft` → `validated` → `in_production` → `shipped` → `delivered` → `invoiced`.
- Notifications email à chaque transition majeure.
- Page de suivi publique accessible par lien unique (sans connexion) partageable avec le client final.
- Export PDF de la commande à chaque étape.

##### Red flags

- Conformité juridique : CGV, droit de rétractation B2B/B2C, e-invoicing FR (échéance 2026-2027).
- Support client final : qui répond en cas de problème ? Politique à définir.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E4.2

- `_bmad-output/implementation-artifacts/story-S1.4-order-entity-tenant.md`
- `_bmad-output/planning-artifacts/prd.md`
