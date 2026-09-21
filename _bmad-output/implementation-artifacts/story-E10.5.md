---
id: E10.5
epic: E10 — Gestion commerciale
source: notion
notion_url: https://app.notion.com/p/3cad0131973c810b859dcfdc9b5ecab2
---
# E10.5 — Dissociation des comptes utilisateurs Magrit et des comptes clients boutique

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E10.5 — Dissociation des comptes utilisateurs Magrit et des comptes clients boutique](https://app.notion.com/p/3cad0131973c810b859dcfdc9b5ecab2) · extrait le 17/09/2026 · page modifiée le 01/09/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E10 — Gestion commerciale | Sprint 5 — Gestion commerciale | P0 | M | Terminé | Claude code | Toutes | RP 28/08/2026, WM 01/09/2026 | 3 |

### Description fonctionnelle (Notion)

**En tant qu'**administrateur d'espace, **je veux** que les utilisateurs Magrit et les clients de la boutique soient deux populations distinctes, **afin de** ne jamais exposer le back-office Magrit à un client final.

##### Statut

Draft — prêt pour agent dev

##### Contexte produit

Décision RP du 28/08/2026 : les utilisateurs Magrit sont le personnel interne — commerciaux, administrateurs. Les clients finaux n'accèdent qu'à la boutique ou aux devis établis pour eux, jamais à la page d'accueil Magrit. Xavier Péchoultres met explicitement en garde contre la fusion des deux notions. La séance acte de traiter les concepts séquentiellement : la gestion commerciale d'abord, les droits d'accès des clients boutique ensuite.

##### Critères d'acceptation

1. L'écran « Utilisateurs » ne liste que les membres internes du tenant ; aucun interlocuteur client n'y apparaît.
2. Un interlocuteur client (E10.4) n'a par défaut aucun compte d'authentification.
3. L'ouverture d'un accès boutique à un interlocuteur est une action explicite et distincte, qui crée un compte de type `shop_customer` lié à `customer_contact_id`.
4. Un compte `shop_customer` ne peut atteindre aucune route `/t/:slug/dashboard/*` ; la tentative renvoie une 403 côté RLS et une redirection côté routeur.
5. Un compte interne ne peut pas être converti en compte client, ni l'inverse.
6. La documentation du modèle de droits (E9.3) est mise à jour pour intégrer le type `shop_customer` à côté de `magrit_full` et `shop_only`.

##### Tâches / Sous-tâches

- [ ] Audit du modèle existant `tenant_memberships` et `access_scope` (CA : 4, 6)
- [ ] Migration SQL : colonne `customer_contact_id` sur le compte boutique, contrainte d'exclusivité avec l'appartenance interne (CA : 3, 5)
- [ ] Filtrage de la requête de l'écran Utilisateurs sur les seuls membres internes (CA : 1)
- [ ] Action « Ouvrir l'accès boutique » sur la fiche interlocuteur (CA : 3)
- [ ] Guard routeur + test RLS d'étanchéité, dans la lignée de E9.10 (CA : 4)

##### Dev Notes

###### Contraintes techniques

- Le guard React n'est pas une sécurité, c'est de l'UX. L'étanchéité réelle vient de RLS — reprendre le pattern de E9.3 et le jeu de tests de E9.10.
- Ne pas réutiliser la table des membres du tenant pour les clients boutique : la fusion des deux populations est précisément ce que la séance a écarté.

###### data-testid

`users-section-internal`, `customer-contact-open-shop-access-btn`, `customer-contact-shop-access-badge` (+ `data-status="none"|"invited"|"active"`)

###### Dépendances

- Bloquée par : E10.4
- Liée à : E9.2, E9.3, E9.10

##### Contrat API (ajout WM 01/09/2026)

Conventions de **E10.0**.

| Méthode | Route | Objet |
|---|---|---|
| GET | `/api/v1/users` | Membres **internes** du tenant uniquement ; aucun interlocuteur client |
| POST | `/api/v1/customers/{id}/contacts/{contactId}/shop-access` | Ouvre un accès boutique à un interlocuteur ; action explicite et distincte |
| DELETE | `/api/v1/customers/{id}/contacts/{contactId}/shop-access` | Révoque l'accès |

Aucune route ne permet de convertir un compte interne en compte client ni l'inverse : l'exclusivité est portée par une contrainte de base, pas par une vérification applicative. Un compte de type `shop_customer` qui appelle une route `/api/v1/` réservée au back-office reçoit 403 avec `code: "auth.scope_forbidden"`, et RLS le bloque de toute façon à la lecture.

##### Tests

Parcours P12 — un compte client boutique tente d'atteindre le dashboard Magrit ; blocage attendu côté routeur et côté base.

##### Change Log

- 2026-08-28 — v1 — Création à partir de la séance du 28/08/2026 — Arnaud Mazon / Claude

##### Dev Agent Record

###### Agent Model Used

Claude Sonnet (dev-story) · Claude Opus (qa-review)

###### Debug Log References

Aucune référence fournie par le dev-story

###### Completion Notes

**CA1 (écran Utilisateurs = membres internes uniquement)** : déjà tenu par l'existant (filtrage `access_scope === 'magrit_full'`), vérifié par la QA comme réel et non seulement déclaratif, pas recodé.

**CA2 (interlocuteur sans compte par défaut)** : déjà garanti par E10.4, vérifié qu'aucun trigger ni service ne crée de compte implicitement.

**CA3 (ouverture d'accès boutique explicite, liée à l'interlocuteur)** : tenu. Contrainte d'unicité (un interlocuteur ne peut pas avoir deux comptes actifs sur la même boutique) posée en base, `Idempotency-Key` obligatoire sur l'action.

**CA4 (étanchéité dashboard pour un compte client boutique)** : tenu, vérifié en profondeur par la QA comme la garantie de sécurité la plus sensible de la story. Quatre niveaux de protection indépendants confirmés : absence structurelle d'identité d'authentification pour un compte boutique délégué (aucune voie d'écriture ne peuple ce champ), garde routeur, refus explicite 403 à l'API, RLS. Aucun chemin de contournement trouvé, y compris sur les scénarios de recouvrement historique et de condition de course envisagés par la revue.

**CA5 (exclusivité comptes interne/client portée en base)** : tenu, deux triggers symétriques testés dans les deux sens.

**CA6 (documentation du modèle de droits)** : tenu, `docs/SHOP_ACCESS_CONTROL.md` mis à jour et cohérent avec le code livré.

**Point écarté avec motif** (non bloquant) : test SQL d'exclusivité non exécuté (Docker indisponible). Sélectionne un utilisateur de test sans garantir qu'il est réellement libre de tout lien existant — sur une base réelle avec des données, ce cas de test échouerait à sa propre mise en place plutôt que de valider silencieusement quelque chose de faux. Écarté par la QA comme non bloquant car l'échec serait bruyant, jamais un faux positif. À corriger avant première exécution réelle (ajout de deux clauses d'exclusion dans la requête de sélection du candidat de test).

**Dettes tracées** (reprendre de `docs/api/CONVENTIONS.md` §8.4) : cas SQL jamais exécuté (Docker absent), comportement « échoue ouvert » d'une fonction de diagnostic secondaire (la RLS reste la vraie barrière, écarté comme sans impact réel), affichage simplifié d'un badge d'accès boutique sur la fiche client (un seul badge affiché même si le modèle supporte plusieurs boutiques).

###### File List

**Créés :**

- `supabase/migrations/20260901000400_gescom_e10_5_shop_customer_link.sql`
- `tests/sql/gescom-e10-5-shop-customer-link.sql`
- `src/modules/shop-customers/application/customer-contact-shop-access-service.ts`
- `src/server/api/customer-shop-access-routes.ts`
- `tests/contract/_fakes/customers-repository.fake.ts`
- `tests/contract/customer-shop-access.contract.test.ts`
- `tests/architecture/shop-customer-dashboard-boundary.test.ts`

**Modifiés :**

- `openapi/magrit-core.v1.yaml`
- `src/platform/api/generated/magrit-core.v1.ts`
- `src/modules/customers/api/{contracts,client}.ts`
- `src/adapters/supabase/{customers-repository,shop-customers-repository,shop-customer-delegation-gateway,api-principal-verifier}.ts`
- `src/modules/shop-customers/api/contracts.ts`
- `src/modules/shop-customers/application/{shop-customers-repository,shop-customers-service}.ts`
- `src/modules/_shared/application/problem.ts`
- `src/server/api/gescom-routes.ts`
- `supabase/functions/magrit-api/index.ts`
- `src/modules/customers/ui/{hooks/useCustomerDetail.ts,workspace/CustomerDetailPage.tsx}`
- `src/modules/members/ui/workspace/MembersPage.tsx`
- `src/shared/presentation/testIds.ts`
- `docs/SHOP_ACCESS_CONTROL.md`
- `docs/api/CONVENTIONS.md`

##### QA Results

Accepté dès le premier passage. CA4 (garantie de sécurité critique) vérifiée en profondeur, aucun contournement trouvé. Un point de fragilité de test écarté avec motif explicite, deux remarques mineures tracées.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-167](https://app.notion.com/3cad0131973c8148b38afb0c3a2c89c5) | GC — Étanchéité : un compte client boutique n'atteint pas le dashboard Magrit | À jouer | P0 — Critique | P12 — Comptes clients boutique | B6 | E10.5, E10.4, E9.3, E9.10 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E10.5

- `_bmad-output/implementation-artifacts/story-E10-10b-1-lecture-portail-client.md`
- `_bmad-output/implementation-artifacts/story-E10-10b-2-decision-client.md`
- `_bmad-output/implementation-artifacts/story-E10-10b-3-notification.md`
- `_bmad-output/implementation-artifacts/story-E10-16-fiche-commande.md`
- `_bmad-output/implementation-artifacts/story-E10.10b-4c.md`
- `_bmad-output/implementation-artifacts/story-E10.20a.md`
- `docs/SHOP_ACCESS_CONTROL.md`
- `docs/api/CONVENTIONS.md`
- `docs/spec/backlog.md`
- `openapi/magrit-core.v1.yaml`
- `src/adapters/supabase/api-principal-verifier.ts`
- `src/adapters/supabase/customers-repository.ts`
- `src/modules/_shared/application/problem.ts`
- `src/modules/_shared/application/tenant-resolution.ts`
- `src/modules/customers/api/client.ts`
- `src/modules/customers/api/contracts.ts`
- `src/modules/customers/ui/hooks/useCustomerDetail.ts`
- `src/modules/customers/ui/workspace/CustomerDetailPage.tsx`
- `src/modules/members/ui/workspace/MembersPage.tsx`
- `src/modules/shop-customers/api/contracts.ts`
- `src/modules/shop-customers/application/customer-contact-shop-access-service.ts`
- `src/modules/shop-customers/application/shop-customers-repository.ts`
- `src/modules/shop-customers/application/shop-customers-service.ts`
- `src/modules/storefront-quotes/application/storefront-quotes-service.ts`
- `src/platform/api/generated/magrit-core.v1.ts`
- `src/server/api/customer-shop-access-routes.ts`
- `src/server/api/gescom-routes.ts`
- `src/shared/presentation/testIds.ts`
- `supabase/functions/magrit-api/index.ts`
- `supabase/migrations/20260901000400_gescom_e10_5_shop_customer_link.sql`
- `supabase/migrations/20260906170000_gescom_e10_10b_1_storefront_quotes.sql`
- `supabase/migrations/20260907000000_gescom_e10_10b_2_storefront_quote_decision.sql`
- `supabase/migrations/20260909010000_gescom_e10_16_order_contact_and_delivery.sql`
- `tests/adapters/supabase/api-principal-verifier.test.ts`
- `tests/architecture/shop-customer-dashboard-boundary.test.ts`
- `tests/contract/_fakes/commercial-orders-repository.fake.ts`
- `tests/contract/_fakes/customers-repository.fake.ts`
- `tests/contract/customer-shop-access.contract.test.ts`
- `tests/contract/customers.contract.test.ts`
- `tests/contract/storefront-quotes.contract.test.ts`
- `tests/sql/gescom-e10-10b-1-storefront-quotes.sql`
- `tests/sql/gescom-e10-16-order-contact-and-delivery.sql`
- `tests/sql/gescom-e10-5-shop-customer-link.sql`
