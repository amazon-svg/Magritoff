---
id: E10.1
epic: E10 — Gestion commerciale
source: notion
notion_url: https://app.notion.com/p/3cad0131973c811a8853e04577537bc1
---
# E10.1 — Espace Projets : conteneur de travail en remplacement du panier

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E10.1 — Espace Projets : conteneur de travail en remplacement du panier](https://app.notion.com/p/3cad0131973c811a8853e04577537bc1) · extrait le 17/09/2026 · page modifiée le 01/09/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E10 — Gestion commerciale | Sprint 5 — Gestion commerciale | P0 | L | Terminé | Claude code | Pro+ | RP 28/08/2026, WM 01/09/2026 | 4 |

### Description fonctionnelle (Notion)

**En tant que** commercial ou acheteur, **je veux** regrouper mes chiffrages dans un projet nommé et rattaché à un client, **afin de** travailler par dossier professionnel plutôt que par panier e-commerce.

##### Statut

Draft — prêt pour agent dev

##### Contexte produit

Décision RP du 28/08/2026 : la logique « ajouter au panier » est abandonnée sur les surfaces internes Magrit. Un commercial gère plusieurs affaires en parallèle ; le panier ne permet ni de nommer, ni de retrouver, ni de reprendre un chiffrage. Le projet devient le conteneur de travail et le point d'entrée de la création de devis (E10.3). Le panier reste en vigueur côté boutique publique (E4.1).

##### Critères d'acceptation

1. Le bouton « Ajouter au panier » disparaît des surfaces internes Magrit (atelier, résultats de chiffrage) et est remplacé par « Ajouter au projet ».
2. Une entrée « Projets » est présente dans la sidebar du dashboard et liste les projets du tenant, triés par date de dernière modification décroissante.
3. La création d'un projet exige un nom non vide et un client (cf. E10.4) ; le bouton de validation reste désactivé tant que le client n'est pas sélectionné.
4. Un projet contient N éléments de chiffrage ; l'ajout d'un chiffrage depuis l'atelier propose de choisir un projet existant ou d'en créer un.
5. L'ouverture d'un projet restitue la liste de ses chiffrages avec leur configuration produit et permet de reprendre l'itération conversationnelle sur l'un d'eux.
6. Un projet est modifiable (nom, client, tags) et archivable ; il n'est jamais supprimé physiquement.
7. RLS : un projet n'est lisible et modifiable que par les utilisateurs du tenant propriétaire.

##### Tâches / Sous-tâches

- [ ] Migration SQL `projects` et `project_items` (CA : 4, 6, 7)
    - [ ] `projects` : id, tenant_id, customer_id FK NOT NULL, name, status ('active'\|'archived'), created_by, created_at, updated_at
    - [ ] `project_items` : id, project_id, label, quote_payload jsonb, clariprint_config jsonb, position, created_at
    - [ ] Politiques RLS sur tenant_id, index sur (tenant_id, updated_at desc)
- [ ] Service `src/services/projects.ts` — CRUD + `addItemToProject` (CA : 4, 5, 6)
- [ ] Page `src/pages/dashboard/projects/index.tsx` — liste + recherche (CA : 2)
- [ ] Page `src/pages/dashboard/projects/[id].tsx` — détail projet (CA : 5)
- [ ] Composant `src/components/projects/CreateProjectModal.tsx` (CA : 3)
- [ ] Remplacement du CTA panier sur les surfaces internes (CA : 1)
- [ ] Entrée sidebar `nav-sidebar-projects-link` (CA : 2)

##### Dev Notes

###### Modèle de données

`projects.customer_id` est **NOT NULL** : c'est cette contrainte qui porte le CA 3 au niveau base, la validation UI n'étant que du confort. `project_items.quote_payload` conserve le payload de chiffrage tel que calculé, afin de reprendre une itération sans rejouer Clariprint.

###### Composants et fichiers cibles

- `src/pages/dashboard/projects/` (nouveau)
- `src/components/projects/` (nouveau)
- `src/components/Sidebar.tsx` (ajout de l'entrée)
- `src/components/marguerite/QuoteResult.tsx` (dé-paniérisation)

###### data-testid (convention SPEC_data-testid 06/05/2026)

`nav-sidebar-projects-link`, `projects-page`, `projects-table`, `project-row` (+ `data-project-id`), `project-create-btn`, `project-create-modal`, `project-name-input`, `project-customer-select`, `project-create-submit-btn`, `project-detail-page`, `project-item-row` (+ `data-item-id`), `project-add-to-project-btn`

###### Contraintes techniques

- Ne pas toucher au `CartContext` de la boutique publique : le panier reste le modèle du storefront.
- L'archivage est un changement de `status`, jamais un DELETE — la traçabilité commerciale en dépend.

###### Dépendances

- Bloquée par : E10.4 (entité Client)
- Bloque : E10.2, E10.3

##### Contrat API (ajout WM 01/09/2026)

Conventions de **E10.0** applicables sans exception : préfixe `/api/v1`, tenant résolu par le jeton, erreurs RFC 7807, pagination par curseur, `Idempotency-Key` sur POST, `If-Match` sur PATCH, OpenAPI écrit avant le code.

| Méthode | Route | Objet |
| --- | --- | --- |
| GET | `/api/v1/projects` | Liste ; `?q=`, `?customer_id=`, `?tag_id=`, \`?status=active |
| POST | `/api/v1/projects` | Crée un projet ; `customer_id` **obligatoire** |
| GET | `/api/v1/projects/{id}` | Détail avec ses éléments |
| PATCH | `/api/v1/projects/{id}` | Renomme, change de client, archive (`If-Match`) |
| POST | `/api/v1/projects/{id}/items` | Ajoute un chiffrage au projet |
| DELETE | `/api/v1/projects/{id}/items/{itemId}` | Retire un élément |

Un `customer_id` absent ou inconnu renvoie 422 avec `code: "project.customer_required"`. Événement émis : `project.created`.

**Le module Projets est celui que Studio attend en premier** : Xavier Péchoultres a indiqué au WM du 01/09 attendre « les contrats API fournis par la nouvelle gestion de projet » pour brancher l'intégration de données. Publier l'OpenAPI de ces routes dès qu'il est stable, avant même la fin de l'implémentation.

##### Tests

Cahier de tests fonctionnels — parcours P13. Cas nominal de création de projet avec client, cas limite de création sans client (blocage attendu).

##### Change Log

- 2026-08-28 — v1 — Création à partir de la séance de spécification gestion commerciale du 28/08/2026 — Arnaud Mazon / Claude

##### Dev Agent Record

###### Agent Model Used

Sonnet pour l'implémentation (dev-story) ; Opus pour la vérification (qa-review). **3 passages, 3 cycles de correction.**

###### Debug Log References

Aucune référence fournie par le dev-story — section laissée vide.

###### Completion Notes

**CA1** (bouton panier disparu de l'atelier) : tenu après correction. Deux boutons panier résiduels (header global et rail de conversation) ont dû être retirés, ils n'avaient pas été identifiés au premier passage.

**CA2** (entrée Projets en sidebar, tri dernière modification) : tenu. Tri serveur vérifié (pas un tri client qui casserait à la pagination).

**CA3** (nom + client obligatoires) : tenu, porté par une contrainte NOT NULL en base en plus de la validation d'interface.

**CA4** (N chiffrages par projet, choix projet existant ou nouveau) : tenu.

**CA5** (reprise d'un chiffrage sans rejouer Clariprint) : tenu après un correctif en deux temps. Un premier correctif a introduit une régression qui aurait fait planter l'affichage du prix à la reprise ; corrigé en séparant clairement les données de reprise (inchangées) des montants normalisés destinés à la future création de devis.

**CA6** (projet modifiable/archivable, jamais supprimé) : tenu. Point d'extension "tags" posé proprement (colonne présente, aucune UI ni logique d'écriture) pour E10.2.

**CA7** (RLS étanche par tenant) : tenu au niveau code et testé de façon approfondie (y compris scénarios de contournement par mutation directe de clé) ; non exécuté réellement faute d'environnement Docker disponible.

**Dette explicitement actée, à tracer :** suppression d'un élément de projet inexistant renvoie un succès au lieu d'une erreur "non trouvé" · filtre de statut invalide silencieusement ignoré · écran de liste sans pagination visible, plafonné à 50 résultats · suppression physique possible par appel direct à la base · test SQL d'isolation entre tenants écrit et relu mais non exécuté.

###### File List

**Créés :** `src/modules/projects/**`, `src/adapters/supabase/projects-repository.ts`, `src/server/api/projects-routes.ts`, `supabase/migrations/20260901000500_gescom_e10_1_projects.sql`, `tests/sql/gescom-e10-1-projects.sql`, `tests/contract/projects.contract.test.ts`, `tests/contract/_fakes/projects-repository.fake.ts`, `src/modules/projects/ui/helpers/serializeQuotePayload.ts`, `src/modules/catalog/ui/product-card/clariprintAmount.ts`, `tests/modules/projects/serializeQuotePayload.test.ts`, `tests/modules/catalog/clariprintAmount.test.ts`, `tests/e2e/atelier-no-cart-button.spec.ts`.

**Modifiés :** `openapi/magrit-core.v1.yaml`, `src/platform/api/generated/magrit-core.v1.ts`, `src/server/api/gescom-routes.ts`, `supabase/functions/magrit-api/index.ts`, `src/surfaces/application-registry.ts`, `src/app/surfaces/workspaceRuntimeRoutes.tsx`, `src/app/layouts/{DashboardLayout,Header}.tsx`, `src/modules/conversations/ui/components/ChatInterface.tsx`, `src/modules/quotes/ui/components/QuoteDialog.tsx`, `src/modules/catalog/ui/{components/ProductCard.tsx,product-card/ProductCardPrix.tsx}`, `src/modules/clariprint/ui/hooks/useClariprintProduct.ts`, `src/shared/presentation/testIds.ts`, `docs/api/CONVENTIONS.md`.

##### QA Results

**Verdict :** Accepté en 3e passage.

**Point le plus sérieux détecté :** régression croisée entre deux correctifs distincts — normalisation de montants et réutilisation du prix stocké — détectée par un test d'aller-retour complet rejoué indépendamment par la QA (10 assertions sur un cas volontairement piégeux, prix atelier à zéro avec prix fournisseur réel non nul).

**Déploiement :** Migration appliquée, fonction API redéployée sur le projet Supabase partagé, endpoint vérifié et répond correctement.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-160](https://app.notion.com/3cad0131973c81d5b1ade8634aa63519) | GC — Créer un projet rattaché à un client et l'ouvrir | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.1, E10.4 |
| [TF-161](https://app.notion.com/3cad0131973c81feb579f0dea9e61ad1) | GC — Limite : création de projet refusée sans client | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.1 |
| [TF-163](https://app.notion.com/3cad0131973c8100b201ef061c0b4cde) | GC — Créer un devis depuis un projet avec deux produits sélectionnés | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.3, E10.1 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E10.1

- `docs/api/CONVENTIONS.md`
- `docs/spec/backlog.md`
- `openapi/magrit-core.v1.yaml`
- `src/adapters/supabase/customers-repository.ts`
- `src/adapters/supabase/projects-repository.ts`
- `src/app/layouts/Header.tsx`
- `src/modules/catalog/ui/components/ProductCard.tsx`
- `src/modules/catalog/ui/components/QuoteModal.tsx`
- `src/modules/catalog/ui/product-card/ProductCardPrix.tsx`
- `src/modules/catalog/ui/product-card/clariprintAmount.ts`
- `src/modules/clariprint/ui/hooks/useClariprintProduct.ts`
- `src/modules/conversations/ui/components/ChatInterface.tsx`
- `src/modules/customers/api/contracts.ts`
- `src/modules/customers/ui/workspace/CustomerDetailPage.tsx`
- `src/modules/project-tags/api/contracts.ts`
- `src/modules/projects/api/client.ts`
- `src/modules/projects/api/contracts.ts`
- `src/modules/projects/application/projects-service.ts`
- `src/modules/projects/ui/helpers/serializeQuotePayload.ts`
- `src/modules/projects/ui/workspace/AddToProjectModal.tsx`
- `src/modules/projects/ui/workspace/ProjectCreateModal.tsx`
- `src/platform/api/generated/magrit-core.v1.ts`
- `src/server/api/commercial-quotes-routes.ts`
- `src/server/api/gescom-routes.ts`
- `src/server/api/project-tags-routes.ts`
- `src/server/api/projects-routes.ts`
- `src/shared/presentation/testIds.ts`
- `supabase/functions/magrit-api/index.ts`
- `supabase/migrations/20260901000300_gescom_e10_4_customers.sql`
- `supabase/migrations/20260901000500_gescom_e10_1_projects.sql`
- `supabase/migrations/20260901000600_gescom_e10_3_commercial_quotes.sql`
- `supabase/migrations/20260902000100_gescom_e10_2_project_tags.sql`
- `supabase/migrations/20260902000200_gescom_e10_6_price_rules.sql`
- `supabase/migrations/20260902000400_gescom_devis_unification_drop_legacy_quotes.sql`
- `tests/adapters/supabase/projects-repository.test.ts`
- `tests/contract/_fakes/commercial-quotes-repository.fake.ts`
- `tests/contract/_fakes/project-tags-repository.fake.ts`
- `tests/contract/_fakes/projects-repository.fake.ts`
- `tests/contract/commercial-quotes.contract.test.ts`
- `tests/contract/projects.contract.test.ts`
- `tests/e2e/atelier-no-cart-button.spec.ts`
- `tests/e2e/quote-modal-tp-fix.spec.ts`
- `tests/modules/catalog/clariprintAmount.test.ts`
- `tests/modules/projects/serializeQuotePayload.test.ts`
- `tests/sql/gescom-e10-1-projects.sql`
- `tests/sql/gescom-e10-2-project-tags.sql`
- `tests/sql/gescom-e10-3-commercial-quotes.sql`
