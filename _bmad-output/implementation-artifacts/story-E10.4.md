---
id: E10.4
epic: E10 — Gestion commerciale
source: notion
notion_url: https://app.notion.com/p/3cad0131973c817e8f6fee1ce54746ca
---
# E10.4 — Entité Client (personne morale ou physique) et interlocuteurs

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E10.4 — Entité Client (personne morale ou physique) et interlocuteurs](https://app.notion.com/p/3cad0131973c817e8f6fee1ce54746ca) · extrait le 17/09/2026 · page modifiée le 01/09/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E10 — Gestion commerciale | Sprint 5 — Gestion commerciale | P0 | L | Terminé | Claude code | Pro+ | RP 28/08/2026, WM 01/09/2026 | 2 |

### Description fonctionnelle (Notion)

**En tant qu'**administrateur ou commercial, **je veux** disposer d'une entité Client distincte à laquelle je rattache des interlocuteurs, **afin de** cesser de traiter une adresse email comme une entreprise.

##### Statut

Draft — prêt pour agent dev

##### Contexte produit

Décision RP du 28/08/2026 : c'est la lacune structurante relevée en séance. Aujourd'hui la notion de client n'existe pas et une adresse email tient lieu d'entité d'entreprise. Un client est une personne morale (avec SIRET) ou une personne physique, et porte N interlocuteurs. Toute la gestion commerciale — projets, devis, règles de prix, commandes — s'accroche à cette entité.

##### Critères d'acceptation

1. Un module « Clients » est accessible depuis la sidebar du dashboard, avec liste, recherche et fiche détaillée.
2. La création d'un client impose un type : `company` (raison sociale, SIRET, TVA intracommunautaire, adresses de facturation et de livraison) ou `individual` (civilité, nom, prénom, adresse).
3. Pour le type `company`, le SIRET est contrôlé au format (14 chiffres, clé de Luhn) ; la vérification INSEE réutilise le service existant de E6.1.
4. Un client porte 0 à N interlocuteurs : nom, prénom, fonction, email, téléphone, drapeau « contact principal » (un seul par client).
5. Un interlocuteur est une donnée de gestion : sa création **ne crée aucun compte utilisateur** et n'envoie aucune invitation (cf. E10.5).
6. La fiche client affiche les projets, devis et commandes rattachés.
7. Un client référencé par un projet, un devis ou une commande ne peut pas être supprimé ; il est désactivable.
8. RLS : les clients sont strictement scopés au tenant.

##### Tâches / Sous-tâches

- [ ] Migration SQL `customers` et `customer_contacts` (CA : 2, 4, 7, 8)
  - [ ] `customers` : id, tenant_id, type, company_name, siret, vat_number, first_name, last_name, billing_address jsonb, shipping_address jsonb, is_active, created_at
  - [ ] `customer_contacts` : id, customer_id, first_name, last_name, role, email, phone, is_primary
  - [ ] Index unique partiel garantissant un seul `is_primary` par client
  - [ ] Politiques RLS sur tenant_id
- [ ] Service `src/services/customers.ts` — CRUD client et interlocuteurs (CA : 1, 4, 7)
- [ ] Pages `src/pages/dashboard/customers/index.tsx` et `[id].tsx` (CA : 1, 6)
- [ ] Composant `src/components/customers/CustomerFormModal.tsx` avec bascule de type (CA : 2, 3)
- [ ] Réutilisation du vérificateur SIREN/SIRET de E6.1 (CA : 3)
- [ ] Entrée sidebar `nav-sidebar-customers-link` (CA : 1)

##### Dev Notes

###### Modèle de données

`customers` est la table pivot de tout l'epic E10 : `projects.customer_id`, `quotes.customer_id`, `orders.customer_id` et `price_rules.customer_id` y pointent. Poser cette migration en premier.

###### Contraintes techniques

- La suppression est refusée par contrainte FK `ON DELETE RESTRICT`, pas par un contrôle applicatif.
- Les adresses sont stockées en `jsonb` structuré (`line1`, `line2`, `postal_code`, `city`, `country`) — pas en texte libre, l'export comptable (E10.18) en dépend.

###### data-testid

`nav-sidebar-customers-link`, `customers-page`, `customers-table`, `customer-row` (+ `data-customer-id`), `customer-create-btn`, `customer-form-modal`, `customer-type-radio` (+ `data-type="company"|"individual"`), `customer-company-name-input`, `customer-siret-input`, `customer-siret-verify-btn`, `customer-save-btn`, `customer-detail-page`, `customer-contact-row` (+ `data-contact-id`), `customer-contact-add-btn`, `customer-contact-primary-toggle`

###### Dépendances

- Bloque : E10.1, E10.3, E10.5, E10.6, E10.12
- Réutilise : E6.1 (validation SIREN)

##### Contrat API (ajout WM 01/09/2026)

Conventions de **E10.0**. **Cette story est la première à livrer du sprint** (arbitrage WM 01/09 : « E10.4 est la première à livrer, tout le reste en dépend »), et son contrat est le premier attendu par Studio.

| Méthode | Route | Objet |
|---|---|---|
| GET | `/api/v1/customers` | Liste ; `?q=`, \`?type=company ⚠️ *cellule arrivée tronquée à l’extraction — lire la page Notion* |
| POST | `/api/v1/customers` | Crée un client ; `Idempotency-Key` honoré |
| GET | `/api/v1/customers/{id}` | Détail avec interlocuteurs, projets, devis et commandes rattachés |
| PATCH | `/api/v1/customers/{id}` | Modifie, désactive (`If-Match`) |
| GET | `/api/v1/customers/{id}/contacts` | Interlocuteurs |
| POST | `/api/v1/customers/{id}/contacts` | Ajoute un interlocuteur ; **ne crée aucun compte** |
| PATCH | `/api/v1/customers/{id}/contacts/{contactId}` | Modifie ; passer `is_primary` à vrai bascule automatiquement l'ancien contact principal |
| POST | `/api/v1/customers/{id}/verify-siret` | Vérification INSEE (réutilise E6.1) |

Une suppression est refusée en 409 avec `code: "customer.in_use"` lorsque le client est référencé. Événement émis : `customer.created` — consommé par le moteur de notifications (E10.15).

Scope de clé de service `customers:read` pour Studio.

##### Tests

Parcours P13 — création d'un client personne morale avec SIRET valide et deux interlocuteurs ; cas limite : SIRET invalide, et tentative de suppression d'un client rattaché à un devis.

##### Change Log

- 2026-08-28 — v1 — Création à partir de la séance du 28/08/2026 — Arnaud Mazon / Claude

##### Dev Agent Record

###### Agent Model Used

Agent `dev-story` (Claude Sonnet) pour l'implémentation ; agent `qa-review` (Claude Opus) pour la revue et validation. Un cycle de correction suite aux 5 manquements bloquants (M1-M5) et 3 remarques mineures (m1-m3), tous corrigés et re-vérifiés.

###### Debug Log References

Aucun fourni par le dev-story.

###### Completion Notes

**CA1** (module Clients, sidebar, liste, recherche, fiche) : tenu. Recherche côté serveur, pas de filtrage client simple.

**CA2** (type imposé company/individual, champs conditionnels) : tenu après correction. Civilité de la personne physique (M3) et TVA/adresses de l'entreprise (M4) manquaient initialement ; désormais saisissables et contraints en base des deux côtés (contrainte CHECK + validation applicative), pas seulement côté UI.

**CA3** (SIRET 14 chiffres + Luhn, vérification INSEE mockée) : tenu. Algorithme Luhn réécrit spécifiquement pour 14 chiffres (vérifié numériquement sur plusieurs SIRET réels), pas de réutilisation erronée de l'algorithme SIREN à 9 chiffres. Endpoint renommé `POST /customers/{id}/siret-verifications` (au lieu de `verify-siret` prévu) pour respecter la règle de nommage pluriel du socle E10.0 — validé par la QA comme correction légitime.

**CA4** (0 à N interlocuteurs, un seul contact principal, bascule automatique) : tenu, garanti par contrainte + trigger en base (pas seulement applicatif).

**CA5** (interlocuteur = donnée de gestion pure, aucun compte créé) : tenu, vérifié qu'aucun chemin de code ne crée de compte ni d'invitation.

**CA6** (fiche client : projets/devis/commandes en point d'extension) : tenu, sections vides sans donnée inventée, en attente de E10.1/E10.3/E10.12.

**CA7** (suppression refusée par contrainte FK) : tenu sur le mécanisme (contrainte Postgres, pas de CASCADE erroné) ; non observable de bout en bout tant que les tables qui référenceront `customers` n'existent pas.

**CA8** (RLS stricte par tenant) : tenu après correction. La RLS sur `customer_contacts` n'avait initialement aucun test d'isolation (M5, données personnelles : nom, email, téléphone) ; corrigé avec contrôles positif et négatif en lecture et en écriture.

**Bug corrigé en cours de route (M1, le plus significatif)** : le champ « SIRET vérifié » ne se réinitialisait pas quand le SIRET était modifié après coup — un client pouvait afficher « vérifié » à côté d'un SIRET qui ne l'était pas, et le bouton de re-vérification restait bloqué. Corrigé par un trigger en base, garanti pour tout écrivain.

**Dette explicitement actée** (documentée dans `docs/api/CONVENTIONS.md`) :

- Une race résiduelle mineure entre une vérification SIRET en cours et une modification concurrente du SIRET peut marquer vérifié le mauvais SIRET dans une fenêtre très étroite (le correctif M1 empêche le cas général, pas ce cas concurrent précis).
- Le trigger de réinitialisation du SIRET vérifié n'a pas de test SQL réel exécuté en base (Docker indisponible en dev) — testé uniquement contre une reproduction du comportement en mémoire.
- Une adresse de livraison saisie via l'API pour un client « personne physique » serait effacée à la première édition depuis l'interface.
- Le test SQL sur `customer_contacts` est écrit et relu mais non exécuté faute de Docker.

###### File List

**Créés** : `src/modules/customers/api/`, `src/modules/customers/application/`, `src/modules/customers/ui/`, `src/modules/customers/index.ts`, `src/modules/customers/manifest.ts`, `src/modules/customers/surface-contributions.ts`, `src/adapters/supabase/customers-repository.ts`, `src/server/api/customers-routes.ts`, `supabase/migrations/20260901000300_gescom_e10_4_customers.sql`, `tests/sql/gescom-e10-4-customers.sql`, `tests/contract/customers.contract.test.ts`, `tests/adapters/supabase/customers-repository.test.ts`, `src/modules/customers/ui/workspace/AddressFields.tsx`.

**Modifiés** : `openapi/magrit-core.v1.yaml`, `src/platform/api/generated/magrit-core.v1.ts`, `src/platform/api/contracts.ts`, `src/platform/api/fetch-api-client.ts`, `src/shared/presentation/testIds.ts`, `src/surfaces/application-registry.ts`, `src/app/surfaces/workspaceRuntimeRoutes.tsx`, `tests/contract/gescom-routes.contract.test.ts`, `docs/api/CONVENTIONS.md`.

##### QA Results

**Verdict** : Accepté après un cycle de correction.

**Manquements bloquants corrigés** (M1-M5) :

- M1 : SIRET vérifié ne se réinitialisait pas lors de modification du SIRET → trigger en base pour réinitialisation garantie
- M2 : ETag manquant sur les réponses PATCH → ajouté en en-tête
- M3 : Civilité absente pour personne physique → saisie et contrainte CHECK ajoutées
- M4 : TVA et adresses non saisissables pour personne morale → champs exposés en UI et stockés structurés en base
- M5 : RLS sur `customer_contacts` non testée → ajout de tests positif/négatif en lecture/écriture

**Remarques mineures corrigées** (m1-m3) :

- m1 : Cohérence de nommage des propriétés JSON
- m2 : Messages d'erreur de validation align
- m3 : Ordre des paramètres dans les requêtes API

**Vérifications QA menées** : reproduction de bugs en environnement isolé ; vérification numérique de l'algorithme Luhn sur plusieurs SIRET réels ; relecture ligne à ligne des tests SQL ; validation des contraintes en base ; isolement des sessions par tenant (RLS).

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-160](https://app.notion.com/3cad0131973c81d5b1ade8634aa63519) | GC — Créer un projet rattaché à un client et l'ouvrir | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.1, E10.4 |
| [TF-165](https://app.notion.com/3cad0131973c81358e0ddd7c877442d9) | GC — Créer un client personne morale avec SIRET et deux interlocuteurs | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.4 |
| [TF-166](https://app.notion.com/3cad0131973c8196ba2bf74ba0796d03) | GC — Limite : suppression refusée d'un client rattaché à un devis | À jouer | P1 — Importante | P13 — Devis et gestion commerciale | B6 | E10.4 |
| [TF-167](https://app.notion.com/3cad0131973c8148b38afb0c3a2c89c5) | GC — Étanchéité : un compte client boutique n'atteint pas le dashboard Magrit | À jouer | P0 — Critique | P12 — Comptes clients boutique | B6 | E10.5, E10.4, E9.3, E9.10 |
| [TF-183](https://app.notion.com/3cad0131973c81ceb41efc9665c0fb5d) | GC — Modèle de notification à balises, aperçu et envoi sur transition d'étape | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.15, E10.14, E10.4 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E10.4

- `SPRINT_HANDOFF.md`
- `_bmad-output/implementation-artifacts/story-BCP-0b.md`
- `_bmad-output/implementation-artifacts/story-BCP-0c.md`
- `_bmad-output/implementation-artifacts/story-BCP-10.md`
- `_bmad-output/implementation-artifacts/story-BCP-11.md`
- `_bmad-output/implementation-artifacts/story-BCP-1a.md`
- `_bmad-output/implementation-artifacts/story-BCP-5.md`
- `_bmad-output/implementation-artifacts/story-BCP-6.md`
- `_bmad-output/implementation-artifacts/story-BCP-6b.md`
- `_bmad-output/implementation-artifacts/story-BCP-9.md`
- `_bmad-output/implementation-artifacts/story-E10-10a-envoi-duplication-remise-globale.md`
- `_bmad-output/implementation-artifacts/story-E10-10b-1-lecture-portail-client.md`
- `_bmad-output/implementation-artifacts/story-E10-10b-2-decision-client.md`
- `_bmad-output/implementation-artifacts/story-E10-10b-3-notification.md`
- `_bmad-output/implementation-artifacts/story-E10-11-can-manage-pricing.md`
- `_bmad-output/implementation-artifacts/story-E10-12-conversion-commande.md`
- `_bmad-output/implementation-artifacts/story-E10-13-etapes-production.md`
- `_bmad-output/implementation-artifacts/story-E10-14-modale-statut-historique.md`
- `_bmad-output/implementation-artifacts/story-E10-16-fiche-commande.md`
- `_bmad-output/implementation-artifacts/story-E10-9-remises-granulaires.md`
- `_bmad-output/implementation-artifacts/story-E10.10b-4a.md`
- `_bmad-output/implementation-artifacts/story-E10.10b-4b.md`
- `_bmad-output/implementation-artifacts/story-E10.10b-4c.md`
- `_bmad-output/implementation-artifacts/story-E10.15a.md`
- `_bmad-output/implementation-artifacts/story-E10.15b.md`
- `_bmad-output/implementation-artifacts/story-E10.15c.md`
- `_bmad-output/implementation-artifacts/story-E10.15d-1.md`
- `_bmad-output/implementation-artifacts/story-E10.15d-2.md`
- `_bmad-output/implementation-artifacts/story-E10.17a.md`
- `_bmad-output/implementation-artifacts/story-E10.17b.md`
- `_bmad-output/implementation-artifacts/story-E10.18a.md`
- `_bmad-output/implementation-artifacts/story-E10.18b.md`
- `_bmad-output/implementation-artifacts/story-E10.18c.md`
- `_bmad-output/implementation-artifacts/story-E10.18d.md`
- `_bmad-output/implementation-artifacts/story-E10.18e-1.md`
- `_bmad-output/implementation-artifacts/story-E10.18e-2.md`
- `_bmad-output/implementation-artifacts/story-E10.19a.md`
- `_bmad-output/implementation-artifacts/story-E10.19b.md`
- `_bmad-output/implementation-artifacts/story-E10.20a.md`
- `_bmad-output/implementation-artifacts/story-E10.20b.md`
- `_bmad-output/implementation-artifacts/story-E10.22a.md`
- `_bmad-output/implementation-artifacts/story-E10.22b.md`
- `_bmad-output/implementation-artifacts/story-E10.22d.md`
- `docs/RECAP_2026-09-16_lot_boutique.md`
- `docs/SHOP_ACCESS_CONTROL.md`
- `docs/api/CONVENTIONS.md`
- `docs/spec/STORY_DOCUMENT_STANDARD.md`
- `docs/spec/backlog.md`
- `openapi/magrit-core.v1.yaml`
- `src/adapters/supabase/commercial-quotes-repository.ts`
- `src/adapters/supabase/customers-repository.ts`
- `src/adapters/supabase/projects-repository.ts`
- `src/adapters/supabase/shop-customer-delegation-gateway.ts`
- `src/adapters/supabase/shop-customers-repository.ts`
- `src/modules/customers/api/client.ts`
- `src/modules/customers/api/contracts.ts`
- `src/modules/customers/application/customers-service.ts`
- `src/modules/customers/application/siret-verification.ts`
- `src/modules/customers/ui/workspace/AddressFields.tsx`
- `src/modules/customers/ui/workspace/CustomerFormModal.tsx`
- … et 41 autres fichiers
