---
id: E5.1
epic: E5 — API & intégrations
source: notion
notion_url: https://app.notion.com/p/357d0131973c816cad79fdec5fa177c3
---
# E5.1 — API publication CMS (Pro+)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E5.1 — API publication CMS (Pro+)](https://app.notion.com/p/357d0131973c816cad79fdec5fa177c3) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E5 — API & intégrations | Sprint 3 | P1 | L | Pas commencé | Claude code | Pro+ | Vision Produit 15/04 | — |

### Description fonctionnelle (Notion)

**En tant que** web-to-printer, **je veux** publier une API pour intégrer le moteur de devis dans mon CMS e-commerce, **afin d'**utiliser Magrit comme moteur sans changer mon storefront.

##### Contexte commercial

*« Nous ne remplaçons pas votre ERP/storefront, nous l'augmentons. »* Story fondamentale pour la base web-to-printers (cible prioritaire Pro). Recoupe directement [T-04](https://www.notion.so/349d0131973c811e9ba0e962aa48bc83) (plug-in Prompt).

##### Critères d'acceptation

- API REST publique documentée (OpenAPI 3.1), authentification par clé API + rotation.
- Endpoints principaux : `POST /quote`, `GET /products`, `GET /quote/{id}`, `POST /quote/{id}/order`.
- Endpoint prompt : `POST /marguerite` pour intégration dans barre de recherche du CMS (alimente T-04).
- SDK JavaScript pour intégration front simple.
- Rate limiting par clé (100 req/min par défaut, configurable par tier).
- Webhooks sortants : `quote.created`, `quote.updated`, `order.created`.
- Logs d'usage exposés au client (Pro+) pour debug et facturation.

##### Livrables techniques

- Documentation Swagger hébergée
- Exemples de code (JS, PHP, Python)
- Plug-in WordPress officiel (complément de T-04)

##### Red flags

- Multiplication des connecteurs = dette technique. Standardiser sur un socle + adaptateurs.
- Sécurité API : auth forte, rotation clés, audit externe avant V1.
- SLA à formaliser dès V1 : 99,5% uptime socle, 99,9% premium.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E5.1

- `_bmad-output/planning-artifacts/prd.md`
