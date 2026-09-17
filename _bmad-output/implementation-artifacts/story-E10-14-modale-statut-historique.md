---
id: E10.14
epic: E10 — Gestion commerciale
status: done
branch: feat/gescom-e10-4-entite-client
depends_on: [E10.12, E10.13]
blocks: [E10.15, E10.16]
---
# E10.14 — Modale unifiée de changement de statut et historique horodaté

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E10.14 — Modale unifiée de changement de statut et historique horodaté](https://app.notion.com/p/3cad0131973c81118dccfe0343be3263) · extrait le 17/09/2026 · page modifiée le 08/09/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E10 — Gestion commerciale | Sprint 5 — Gestion commerciale | P0 | M | Terminé | Claude code | Pro+ | RP 28/08/2026, WM 01/09/2026 | 15 |

### Description fonctionnelle (Notion)

**En tant qu'**opérateur, **je veux** changer le statut d'une commande depuis une fenêtre dédiée identique en liste et en fiche, **afin de** ne pas me tromper de ligne dans une grille dense.

##### Statut

Draft — prêt pour agent dev

##### Contexte produit

Décision RP du 28/08/2026 : le changement de statut directement dans la grille est écarté, jugé trop dangereux — « le risque de connerie est trop gros ». La solution retenue est une modale unique, déclenchée par un bouton « Statut » ou un menu d'action, identique depuis la liste et depuis la fiche commande. Xavier Péchoultres pose l'historique horodaté comme indispensable.

##### Critères d'acceptation

1. Aucune modification de statut n'est possible en édition inline dans la grille des commandes.
2. Un bouton « Statut » sur la ligne et un bouton identique dans la fiche commande ouvrent **le même composant modal**.
3. La modale affiche les étapes du tenant dans l'ordre configuré (E10.13), l'étape courante mise en évidence et les étapes déjà franchies distinguées visuellement.
4. Un clic sur une étape la sélectionne ; la validation applique le changement. Le passage direct à une étape avancée est autorisé sans valider les étapes intermédiaires.
5. Chaque changement crée une entrée d'historique : commande, étape précédente, nouvelle étape, auteur, horodatage.
6. L'historique est consultable depuis la fiche commande, en ordre chronologique, non modifiable.
7. Le changement de statut déclenche l'évaluation des notifications (E10.15).

##### Tâches / Sous-tâches

- [ ] Migration SQL `order_status_history` append-only (CA : 5, 6)
- [ ] Composant partagé `src/components/orders/OrderStatusDialog.tsx` (CA : 2, 3, 4)
- [ ] Bouton déclencheur en ligne de grille et en fiche (CA : 2)
- [ ] Panneau d'historique dans la fiche commande (CA : 6)
- [ ] Émission de l'événement `order.step_changed` (CA : 7)
- [ ] Suppression de tout sélecteur de statut inline existant (CA : 1)

##### Dev Notes

###### Contraintes techniques

- Un seul composant modal, deux points d'appel. Dupliquer le composant pour la liste et pour la fiche reproduirait exactement la divergence que la séance a voulu éviter.
- `order_status_history` est append-only : REVOKE UPDATE et DELETE.
- Le changement de statut et l'écriture de l'historique sont dans la même transaction.

###### data-testid

`orders-table`, `order-row` (+ `data-order-id`), `order-status-btn`, `order-status-dialog`, `order-status-option` (+ `data-step-id`, `data-state="done"|"current"|"pending"`), `order-status-confirm-btn`, `order-status-history-panel`, `order-status-history-row` (+ `data-history-id`)

###### Dépendances

- Bloquée par : E10.13
- Bloque : E10.15, E10.17

##### Mise à jour — WM du 01/09/2026

**Précision d'interface demandée par Xavier Péchoultres : une seule modale, deux colonnes.** « Ce que je propose, c'est que cette modale ait les deux choses dessus : à gauche l'historique, à droite les boutons. Comme ça, quand tu cliques sur statut, tu vois l'historique des statuts, tu as les boutons, tu as une jolie interface propre. »

CA 3 amendé et CA 6 fusionné : la modale de changement de statut est **un seul écran à deux colonnes**.

- Colonne gauche : l'historique horodaté des transitions de la commande, du plus récent au plus ancien, avec auteur.
- Colonne droite : les étapes du tenant dans l'ordre configuré, l'étape courante mise en évidence, les étapes franchies distinguées, chacune cliquable.
- Il n'y a plus de panneau d'historique séparé sur la fiche commande : l'historique vit dans cette modale, atteignable des deux points d'appel (grille et fiche).
- Le comportement de fond est inchangé : le saut d'étape reste autorisé et ne valide pas les étapes antérieures.

##### Contrat API

| Méthode | Route | Objet |
| --- | --- | --- |
| GET | `/api/v1/orders/{orderId}/status-history` | Historique horodaté, ordre antichronologique |
| POST | `/api/v1/orders/{orderId}/status` | Change l'étape ; corps `{ step_id, note? }` ; `Idempotency-Key` honoré |

La transition et l'écriture de l'historique sont dans la **même transaction**, et l'événement `order.step_changed` est déposé dans l'outbox de E10.0 — jamais un appel direct au moteur de notifications. L'auteur d'une transition peut être un utilisateur, une clé de service (`module:studio`) ou le système (`system:upload_link`, cf. E10.20).

##### Tests

Parcours P13 — changement de statut depuis la liste puis depuis la fiche, contrôle que la modale est identique et que l'historique enregistre les deux transitions horodatées.

##### Change Log

- 2026-08-28 — v1 — Création à partir de la séance du 28/08/2026 — Arnaud Mazon / Claude

##### Dev Agent Record

###### Agent Model Used

- **dev-story** (implémentation) : claude-sonnet-4-5-20250929
- **qa-review** (révision) : claude-opus-4-1-20250805

###### Debug Log References

Aucun debug log fourni par dev-story.

###### Completion Notes

**Verdict qa-review : Approuvé directement, 1 round, 0 bloquant.**

Reviseur a spécifiquement vérifié le chemin d'autorisation Studio (clé de service, scope `orders:write`) en exécution réelle postgreSQL : appels PostgREST directs sous rôles `anon` et `authenticated`, tentative d'usurpation entre tenants, vérification des grants Postgres. Tout refusé correctement (anon exclu, authenticated/service_role seuls).

Atomicité de la transition vérifiée sous concurrence réelle (deux sessions psql indépendantes) : verrouillage + écriture d'historique + mise à jour projection dans la même transaction, aucune divergence.

**Critères d'acceptation tenus, un par un** :

- **CA1** : aucune modification inline dans grille (E10.16 non livrée, aucune grille n'existe) — tenu par construction
- **CA2** : un seul composant `OrderStatusDialog`, deux points d'appel via `OrderStatusButton` — implémenté
- **CA3** : écran deux colonnes (historique antichronologique à gauche / étapes du tenant à droite), étape courante mise en évidence, franchies distinguées visuellement — implémenté
- **CA4** : saut direct et recul autorisés, aucune validation d'étapes intermédiaires — tenu par construction (aucune garde SQL/métier)
- **CA5** : chaque transition crée une entrée d'historique, le journal et la mise à jour de statut dans la même transaction — implémenté, testé sous concurrence
- **CA6** : historique lisible, antichronologique, horodaté, append-only (revoke insert/update/delete en base) — implémenté
- **CA7** : événement `order.step_changed` publié après la transition, aucune évaluation de notification dans ce lot — implémenté

**8 réserves non bloquantes tracées par qa-review** :

- **R1** (la plus notable) : grant `service_role`, pas `anon`, sur la fonction ; aucun registre de clés de service n'est encore câblé en production — capacité ouverte au contrat mais façade ne l'utilise pas encore. Mapping d'erreur à corriger au moment du câblage réel.
- **R2** : garde de tenant teste l'appartenance directe, pas les enfants (dormant, aucun enfant en base)
- **R3** : `occurred_at` horodaté au début de la transaction plutôt qu'au moment exact du passage — fenêtre théorique d'inversion d'historique inoffensive (contrat interdit dériver l'étape courante du journal)
- **R4, R5** : dettes systémiques préexistantes (curseur non validé, TRUNCATE sur table d'audit)
- **R6** : branche non conforme convention (héritée de toute la série E10.12-E10.14)
- **R7** : critères d'acceptation Notion non confrontés (limite d'accès dev-story/qa-review)
- **R8** : modale sur-lit (`getCommercialOrder` complet) pour n'afficher qu'un champ — sans fuite de capability, à reconsidérer pour E10.16

Gates finales : `pnpm typecheck` ✓, `pnpm gen:api:check` ✓ aligné (contrat déjà livré architecte), `pnpm test:contract` 275/275 (+14), `pnpm test:architecture` 144/144, `npx vitest run` 1724 passés (3 pré-existants sans rapport, 36 skip). Tests SQL 12 scénarios exécutés en Docker, y compris concurrence réelle à deux sessions, aucun écart.

###### File List

**Migration et SQL**

- `supabase/migrations/20260909000000_gescom_e10_14_order_step_changes.sql`
- `tests/sql/gescom-e10-14-order-step-changes.sql`
- `scripts/test-storefront-sql.sh`

**Module commercial-orders (étendu)**

- `src/modules/commercial-orders/api/contracts.ts`
- `src/modules/commercial-orders/api/client.ts`
- `src/modules/commercial-orders/index.ts`
- `src/modules/commercial-orders/application/commercial-orders-repository.ts`
- `src/modules/commercial-orders/application/commercial-orders-service.ts`
- `src/adapters/supabase/commercial-orders-repository.ts`
- `src/server/api/commercial-orders-routes.ts`

**UI (nouveau)**

- `src/modules/commercial-orders/ui/index.ts`
- `src/modules/commercial-orders/ui/components/index.ts`
- `src/modules/commercial-orders/ui/components/OrderStatusDialog.tsx`
- `src/modules/commercial-orders/ui/components/OrderStatusButton.tsx`
- `src/modules/commercial-orders/ui/components/order-status.helpers.ts`
- `src/shared/presentation/testIds.ts` (scope `orderStatus`)

**Tests**

- `tests/contract/commercial-order-step-changes.contract.test.ts` (+14 tests)
- `tests/contract/_fakes/commercial-orders-repository.fake.ts`
- `tests/modules/commercial-orders/order-status.helpers.test.ts` (+8 tests)

**Story document**

- `_bmad-output/implementation-artifacts/story-E10-14-modale-statut-historique.md`

##### QA Results

**Verdict : Accepté** ✓

**1 round de révision, 0 bloquant.**

Points vérifiés en profondeur :

- Autorisation Studio (clé de service, scope `orders:write`) : grants Postgres confirmés, anon exclu, tentatives d'usurpation entre tenants refusées correctement
- Atomicité : transition de statut + écriture d'historique + mise à jour projection dans la même transaction, vérifiée sous concurrence réelle (deux sessions postgreSQL indépendantes)
- Append-only du journal : `revoke insert, update, delete` en base confirmé, aucune voie d'écriture directe
- CA1-CA7 tous tenus

8 réserves non bloquantes (R1-R8) tracées pour suivi futur — aucune n'empêche la validation. R1 (registre de clés de service non câblé en production) est la plus notable, mais la décision d'Arnaud du 09/09 était assumée au moment du cadrage.

Contrat API stable (écrit avant démarrage, inchangé par ce lot — arbitrage 09/09 ne touche que la prose/JSDoc). Dépôt de l'événement `order.step_changed` dans l'outbox confirmé (aucun appel direct au moteur de notifications). 

Composants UI prêts et testés au niveau du contrat d'API, non câblés nulle part — dette explicite pour E10.16 (grille de commandes) et future fiche commande.

Commit : fce0580 (implémentation) + 0c275af (cadrage)

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-181](https://app.notion.com/3cad0131973c81f5b56afc00216e78fd) | GC — Modale de statut à deux colonnes, identique depuis la liste et depuis la fiche | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.14, E10.13 |
| [TF-182](https://app.notion.com/3cad0131973c81f3ab64f0a2de1a7b2d) | GC — Limite : l'historique de statut n'est ni modifiable ni supprimable | À jouer | P1 — Importante | P13 — Devis et gestion commerciale | B6 | E10.14, E10.9 |
| [TF-183](https://app.notion.com/3cad0131973c81ceb41efc9665c0fb5d) | GC — Modèle de notification à balises, aperçu et envoi sur transition d'étape | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.15, E10.14, E10.4 |
| [TF-184](https://app.notion.com/3cad0131973c81dd9925ec7a18081c38) | GC — Fiche commande complète et prix non modifiables | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.16, E10.12, E10.14 |
| [TF-185](https://app.notion.com/3cad0131973c81f9ae74ef0b3ddb2092) | GC — Dépôt de fichiers en deux sessions par item, puis validation explicite | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.20, E10.17, E10.14 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

Contrat écrit par l'architecte avant le démarrage (`docs/api/CONVENTIONS.md`
§8.16), appliqué dans sa **version amendée du 01/09/2026 (Xavier
Péchoultres)** : un seul écran à deux colonnes (historique horodaté à
gauche, étapes du tenant à droite) plutôt qu'une modale plus un panneau
d'historique séparé. Deux réserves du cadrage ont été arbitrées par Arnaud
le 2026-09-09, dans le sens recommandé par l'architecte, **sans modification
de surface du contrat** (ni chemin, ni champ, ni code d'erreur, ni
`security` — seules deux descriptions ont été enrichies) : (a) aucun
`If-Match` sur la transition, dernier écrivain gagnant, acquis pour v1 ; (b)
la clé de service (`orders:write`) peut changer le statut d'une commande —
première opération d'écriture du contrat E10 joignable autrement que par un
jeton utilisateur.

**Limite d'accès héritée du cadrage, non levée par `dev-story`** : comme pour
E10.12/E10.13, cet agent n'a pas d'accès Notion. Le texte transmis par
l'agent appelant (contrat §8.16, amendement du 01/09, hints DOM, contraintes
techniques) est traité comme le périmètre opposable. La confrontation aux CA
numérotés exacts de la page Notion reste à faire par le `scribe` ou un
humain avec accès.

## Ce qui est livré

| Élément | Détail |
|---|---|
| Migration `20260909000000` | Table **neuve** `commercial_order_step_changes` (`id`, `order_id` [cascade], `from_step_id` [nullable, restrict], `to_step_id` [restrict], `note`, `actor_id` [nullable], `actor_label`, `occurred_at`) — patron `commercial_quote_header_audit` (E10.10a), append-only tenu **en base** (`revoke insert, update, delete … from authenticated, anon`, aucune policy d'écriture). RLS de lecture par tenant seule (jointure `commercial_orders.tenant_id`, **sans** `user_has_capability` : ce journal n'est pas tarifaire). Fonction `security definer` `api_change_commercial_order_production_step(p_tenant_id, p_order_id, p_step_id, p_note, p_actor_label)` : verrou `SELECT … FOR UPDATE` (même patron déjà éprouvé en concurrence réelle sur ce sprint, E10.10b-2/E10.12), validations **après** le verrou dans l'ordre `production_step.not_found` → `production_step.inactive` → `order.step_unchanged`, `UPDATE current_production_step_id` **et** `INSERT` de l'entrée dans la **même** transaction. Aucun `If-Match`. `v_actor is null` n'est **pas** une erreur (clé de service légitime) ; `p_actor_label`, fourni par la façade, porte alors le libellé. Grants : `authenticated` + `service_role` (**pas** `anon` — voir dette ci-dessous). |
| RLS | `commercial_order_step_changes_select` : isolation tenant seule, aucune capability. Aucune policy d'écriture — seule voie : la fonction. |
| `GET /commercial-orders/{orderId}/step-changes` | `listOrderStepChanges` — journal antichronologique (`occurred_at desc, id desc`), pagination par curseur, sans paramètre de tri. `bearerAuth` + `serviceKey`, scope `orders:read` (déjà publié, aucun scope neuf). 404 si la commande est absente/hors tenant. |
| `POST /commercial-orders/{orderId}/step-changes` | `changeOrderProductionStep` — 201, `Idempotency-Key` exigée, aucun `ETag` émis (celui de la commande vient de s'invalider — un appelant qui le détient encore doit relire `getCommercialOrder`). `bearerAuth` + `serviceKey`, scope `orders:write` (première écriture du contrat E10 joignable par clé de service). 409 `order.step_unchanged` (avec `current_state.current_production_step_id`) ; 422 `production_step.not_found`/`production_step.inactive` (code neuf) ; 404 si la commande est absente/hors tenant. |
| Module `commercial-orders` (étendu) | `api/contracts.ts` (+`orderStepChangeSchema`, `+changeOrderProductionStepCommandSchema`, `+orderStepChangedPayloadSchema`, alignement de compilation contrat↔schémas) ; `application/commercial-orders-repository.ts` (+`OrderStepUnchangedError`, `+ProductionStepInactiveError`, `+listStepChanges()`, `+changeProductionStep()`) ; `application/commercial-orders-service.ts` (+`getSummary()` — lecture légère sans les lignes, réutilisable, `+listStepChanges()`, `+changeProductionStep()` qui publie `order.step_changed` **après** le commit SQL, même limite déjà acceptée pour les quatre événements de devis — dette M2, §8.2, **constatée et non aggravée**, traitement reporté avant/avec E10.15 par le cadrage lui-même). |
| Adaptateur Supabase | `src/adapters/supabase/commercial-orders-repository.ts` — `listStepChanges()` (lecture directe, pagination curseur `occurred_at`/`id`) ; `changeProductionStep()` délègue entièrement au RPC, mapping d'erreurs par message (`order.not_found`→404, `production_step.not_found`/`production_step.inactive`/`order.step_unchanged` traduits en erreurs de domaine dédiées). |
| Routes | `src/server/api/commercial-orders-routes.ts` — deux routes ajoutées à la fabrique existante (`createCommercialOrdersRoutes`, déjà enregistrée dans `gescom-routes.ts`, **aucun câblage supplémentaire nécessaire**). `withCommercialOrderErrors()` étendu pour les trois erreurs nouvelles, même discipline B2 (E10.12) : `current_state` relu **après** l'échec, jamais avant. |
| Événement `order.step_changed` | Premier producteur (le nom existait déjà dans `EventName`/`REQUIRED_EVENT_NAMES` depuis le socle E10.0, jamais renommé — CA13). Publié **après** la transaction SQL, best-effort (dette M2 constatée, pas traitée ici). |
| UI — `OrderStatusDialog` (composant unique) | `src/modules/commercial-orders/ui/components/OrderStatusDialog.tsx` — écran à deux colonnes : gauche = historique (`listOrderStepChanges`, plus récent en premier, auteur, note), droite = étapes du tenant (`listProductionSteps`, ordre de position), étape courante mise en évidence, étapes de position antérieure distinguées visuellement (`data-state`), chacune cliquable puis confirmée par un bouton dédié (`order-status-confirm-btn`). Aucun `If-Match` posé côté client (le contrat n'en émet ni n'en exige). Logique de dérivation d'état extraite en helper **pur** testé unitairement (`order-status.helpers.ts`, `stepVisualState()`/`currentStepPosition()`). |
| UI — `OrderStatusButton` (point d'appel réutilisable) | `src/modules/commercial-orders/ui/components/OrderStatusButton.tsx` — ouvre `OrderStatusDialog`, `data-testid="order-status-btn"`. **Non câblé** dans aucun écran existant (voir dette CA1/CA2 ci-dessous) : prêt à être monté tel quel par la grille de commandes (E10.16) et par une future fiche commande. |
| `CommercialOrdersApiClient` (étendu) | `listStepChanges()`/`changeProductionStep()` — `Idempotency-Key` générée localement, aucun `If-Match` lu ni posé. |
| `data-testid` | Scope `orderStatus` ajouté à `src/shared/presentation/testIds.ts` : `btn`, `dialog`, `option` (+`data-step-id`, `+data-state`), `confirmBtn`, `historyPanel`, `historyRow` (+`data-history-id`), `errorBanner`, `closeBtn` — testids mandatés par la story Notion (Hints DOM), aucun invention au-delà (`closeBtn`/`errorBanner` ajoutés par nécessité fonctionnelle, même discipline que les autres écrans E10). |

## Ce qui n'est PAS dans le périmètre

- **CA1 — aucune modification de statut inline dans la grille des commandes.** **Vérifié négativement plutôt que traité** : aucune grille de commandes n'existe encore dans ce dépôt (E10.16 non livrée — confirmé : `find src/modules/commercial-orders -type d` ne montre aucun `ui/` avant ce lot, et aucun composant `*.tsx` du dépôt ne référence `CommercialOrder`/`listCommercialOrders` en dehors des modules `commercial-orders`/`commercial-quotes` eux-mêmes). Il n'y a donc **rien à retirer** : le contrat garantit déjà qu'aucune autre voie d'API n'existe pour changer une étape (`changeOrderProductionStep` est la seule opération d'écriture publiée). Le respect effectif du CA1 à l'écran reste une dette explicite pour **E10.16**.
- **Aucune fiche commande** — comme la grille, elle n'existe pas encore dans ce dépôt. `OrderStatusButton` est prêt (composant fonctionnel, testé par les tests de contrat de l'API qu'il consomme) mais **non monté** : l'inventer serait créer un écran hors backlog (règle absolue du projet).
- **E10.15 (évaluation des notifications)** — ce lot **dépose** `order.step_changed` dans `outbox_events` et s'arrête là (CA7). Aucune évaluation, aucun modèle, aucun destinataire.
- **E10.20 (auteur système `system:upload_link`)** — non implémenté, non cadré. Le modèle d'auteur (`actor_id` nullable + `actor_label`) ne l'exclut pas structurellement : un futur acteur système poserait `actor_id: null` et un libellé préfixé, sans changement de schéma.
- **Dette M2 (outbox hors transaction)** — signalée par l'architecte comme à traiter avant/avec E10.15, pas ici. `order.step_changed` suit exactement le même chemin que les quatre événements de devis déjà en dette.
- **Aucune règle de transition** — ni séquence imposée, ni interdiction de reculer, ni fermeture sur une étape terminale. Vérifié par construction (aucune contrainte SQL de ce type) et par les scénarios SQL 8/9 (saut direct, recul).
- **Aucune entrée de journal rétroactive** — le journal démarre vide pour toute commande, y compris celles déjà existantes avant ce lot (aucun rattrapage n'est écrit par la migration).

## Dette introduite ou héritée

| Réf. | Trou | Chemin de mise en conformité |
|---|---|---|
| **E10.16 (héritée, confirmée par ce lot)** | `OrderStatusButton`/`OrderStatusDialog` sont fonctionnels et testés au niveau API, mais **aucun écran ne les monte** : ni grille de commandes, ni fiche commande n'existent dans ce dépôt à ce jour. | E10.16 (ou la première story qui pose une fiche commande) monte `<OrderStatusButton orderId={...} onChanged={...} />` aux deux points d'appel prescrits par l'amendement (ligne de grille, fiche) — le composant n'a pas à être réécrit. |
| **(i) nouvelle — grant `service_role`, pas `anon`, sur la fonction de transition** | La fonction `api_change_commercial_order_production_step` est `grant execute … to authenticated, service_role` (même régime que `list_commercial_orders_by_production_step`, E10.13), **jamais `anon`** : à la différence des fonctions storefront (`api_get_storefront_quote`, …) qui **re-vérifient elles-mêmes** un secret de session avant d'agir, cette fonction ne re-vérifie **aucun** secret de clé de service — elle fait confiance à `auth.uid()`/`p_actor_label` fourni par la façade **après** vérification du scope par `assertScopes()`. Ouvrir l'exécution à `anon` aurait permis à un appel PostgREST direct, sans aucune credential, de déplacer la commande de N'IMPORTE QUEL tenant (la fonction est `security definer`, elle bypasse la RLS par construction — seul le grant protège). **Conséquence assumée, déjà signalée par le contrat** (réserve (b), §5) : « aucun registre de clés de service n'est encore exploité en production, donc la capacité ouverte ici n'a pas encore de porteur » — la façade déclare `orders:write` reachable par clé de service (CA/décision #10 tenus au niveau contrat et TypeScript), mais la **reconciliation réelle côté base** (un client Supabase authentifié en `service_role`, construit **côté edge function** après vérification du secret `X-Magrit-Service-Key` — jamais exposé à l'appelant) n'est pas câblée. C'est **exactement la même limite** que celle déjà actée pour la lecture `orders:read` (aucune route existante ne bascule de client selon le principal). | À traiter quand un premier registre de clés de service sera réellement exploité en production — probablement en même temps que le câblage équivalent pour `orders:read`, pas une dette propre à ce lot. |
| **M2 héritée, étendue sans être aggravée** | `order.step_changed` est publié par la couche applicative **après** le commit SQL (même patron que les quatre événements de devis). Un incident entre le commit et l'écriture d'outbox laisse une transition journalisée mais non notifiée. | Signalé par le cadrage comme devant être traité **avant ou avec E10.15** (premier consommateur réel de cet événement), pas ici. |
| **(f) héritée, ouverte** | Relecture Notion des CA exacts non faite (limite d'accès, même réserve qu'E10.12/E10.13). | Le `scribe` ou un humain avec accès Notion confronte ce document aux CA numérotés de la page avant clôture définitive. |

## Vérifications

`pnpm typecheck` (= `typecheck:modular`) : **0 erreur**. `pnpm gen:api:check` : aligné (aucune modification du contrat par ce lot — déjà livré par l'architecte, y compris l'arbitrage du 09/09 qui n'a touché que de la prose/JSDoc). `pnpm test:architecture` : **144/144** (33 fichiers), inchangé — le nouveau composant UI respecte les frontières modulaires (import cross-module `production-steps` corrigé pour passer par la façade publique du module, `@/modules/production-steps`, plutôt qu'un chemin profond `api/client`/`api/contracts` — détecté et corrigé par `modular-ui-boundaries.test.ts`). `pnpm test:contract` : **275/275** (15 fichiers, +1 nouveau `commercial-order-step-changes.contract.test.ts` avec 14 tests), en hausse de 14 par rapport à la baseline de 261 laissée par E10.13. `npx vitest run` (suite complète) : **1724 passés / 36 skip**, 3 échecs **pré-existants et sans rapport** (`tests/storage/product_mockups_isolation.test.ts` — bucket Storage local `product_mockups` introuvable, même symptôme de désynchronisation Storage/Kong déjà documenté par E10.13, aucun rapport avec `commercial_order_step_changes`/`production_steps`/`commercial_orders`).

**Tests unitaires de logique de calcul (`.claude/rules/frontend.md`, CLAUDE.md)** : `tests/modules/commercial-orders/order-status.helpers.test.ts`, 8 tests, sur les deux fonctions **pures** extraites de `OrderStatusDialog` (`stepVisualState()`, `currentStepPosition()`) — y compris un test qui documente explicitement que le rendu « franchie » (`done`) d'une étape sautée (CA4) est un **affichage**, jamais une preuve de passage réel (celle-ci reste dans le journal `OrderStepChange.from_step_id`/`to_step_id`, jamais recalculée côté client).

`tests/sql/gescom-e10-14-order-step-changes.sql` : **exécuté réellement** (Docker local, migration `20260909000000` appliquée par `pnpm db:local:push`), 12 scénarios, `rollback` final sur les scénarios 1-11, 0 erreur : (1) fixtures — commande de tenant A posée sur « Fichier reçu » ; (2/4bis) RLS lecture — le tenant B ne voit **aucune** entrée du journal du tenant A, ni avant ni après la première transition ; (3) RLS écriture — ni un membre ordinaire ni un admin du tenant propriétaire ne peuvent `INSERT` directement dans le journal (append-only tenu en base, `insufficient_privilege`) ; (4) cas nominal — verrou, `from_step_id`/`to_step_id`/`actor_id`/`actor_label`/`note` corrects, `current_production_step_id` mis à jour **dans la même transaction**, une seule entrée ; (5) `order.step_unchanged` — reposer la même étape est refusé, **aucune** entrée « X → X » n'est écrite ; (6) `production_step.not_found` — étape d'un autre tenant refusée ; (7) `production_step.inactive` — étape désactivée refusée comme cible (arrivée), même déjà portée par une commande ; (8) saut direct (CA4) — de « PAO » à « Livré », **une seule** entrée, aucune étape intermédiaire journalisée, et un acteur **étranger** au tenant refusé en `permission_denied` ; (9) recul (CA4) — de « Livré » à « Fichier validé », accepté, note reprise telle quelle ; (10) acteur **clé de service** — `auth.uid()` explicitement vidé (`request.jwt.claims` remis à `''`, sinon le GUC transaction-local d'un scénario précédent aurait persisté à tort), `p_actor_label` absent refusé (`authentication_required`), fourni accepté (`actor_id` NULL, `actor_label = 'module:studio'`) ; (11) décision #13 — une étape référencée **uniquement** par le journal (plus aucune commande dessus) reste indélébile, `api_delete_production_step` échoue en `production_step.in_use` (même code que la FK `current_production_step_id`) ; (12) **concurrence réelle** (deux connexions `dblink` séparées, patron déjà éprouvé E10.12/E10.10b-2) — deux transitions simultanées vers la **même** étape cible sur la **même** commande : la première committe, la seconde (bloquée sur `FOR UPDATE` puis débloquée) relit l'état déjà commité et lève `order.step_unchanged` ; le journal ne porte qu'**une seule** entrée pour ce mouvement — c'est le seul test qui prouve que le verrou tient sous course réelle.

**Suite SQL complète (`pnpm test:storefront:sql`)** : bloquée sur un cas **antérieur et sans rapport** (`legacy-shop-only-write-freeze.sql`, `CHECK` `tenant_members_role_admin_check` violé par une insertion `role='owner'` — fixture de test obsolète face au schéma actuel, aucun rapport avec ce lot). Isolés (hors ce blocage), les fichiers `gescom-e10-3/5/6/9/10a/11-*.sql` et `storefront-credential-activation.sql` échouent aussi, tous pour des raisons **structurellement sans rapport** avec E10.14 (deuxième `auth.users` attendu et absent, `protect_last_tenant_admin`, FK `product_library` — même symptôme de dérive d'environnement local déjà documenté par E10.13 : « un deuxième/troisième `auth.users` réel, accumulé habituellement par un usage prolongé du poste local »). `gescom-e10-12-quote-conversion.sql` et `gescom-e10-13-production-steps.sql` (dépendances directes de ce lot) passent isolément sans écart. `gescom-e10-14-order-step-changes.sql` passe isolément et après ces deux-là, à froid comme après un run précédent.

## Critères d'acceptation (contrat §8.16, tenus un par un)

Numérotation reprise des mentions explicites du contrat (`docs/api/CONVENTIONS.md` §8.16 et `openapi/magrit-core.v1.yaml`) — la relecture Notion exacte reste une réserve ouverte (f), non levée par cet agent (pas d'accès Notion). Le contrat annonce 7 CA au total (amendement du 01/09, « CA3 et CA6 fusionnés ») ; seuls CA1/CA4/CA5/CA6/CA7 apparaissent explicitement tagués dans le texte transmis, les autres sont décrits sans numéro — traités ici par leur contenu.

1. **CA1 — aucune modification de statut inline dans la grille des commandes.** **Vérifié par construction, pas par retrait** : aucune grille de commandes n'existe encore (E10.16 non livrée) ; le contrat garantit qu'aucune autre voie d'API n'existe pour changer une étape que `changeOrderProductionStep`. Dette explicite pour E10.16 (voir section dédiée).
2. **Un seul composant modal, deux points d'appel, jamais deux implémentations** (amendement du 01/09) — **fait** : `OrderStatusDialog` est l'unique implémentation ; `OrderStatusButton` est le point d'appel réutilisable, prêt à être monté deux fois (grille, fiche) sans jamais être dupliqué. Aucun panneau d'historique séparé n'existe : l'historique vit uniquement dans la modale (colonne gauche).
3. **Écran à deux colonnes : historique horodaté (gauche) / étapes du tenant dans l'ordre configuré (droite), étape courante mise en évidence, étapes déjà franchies distinguées visuellement, chacune cliquable** — **fait**. `OrderStatusDialog` rend les deux colonnes depuis `listOrderStepChanges`/`listProductionSteps` ; `data-state="done"|"current"|"pending"` posé par le helper pur testé unitairement.
4. **CA4 — le saut direct à une étape avancée reste autorisé, ne valide aucune étape intermédiaire ; le recul est autorisé aussi** — **fait**, tenu à trois niveaux : (i) SQL — aucune contrainte d'ordre, testé (scénarios 8/9) ; (ii) service/route — aucune garde ajoutée ; (iii) UI — le helper `stepVisualState()` ne fait qu'un rendu de position, jamais une validation, testé unitairement (le test documente explicitement qu'un « done » d'affichage n'est pas une preuve de passage).
5. **CA5 — toute transition est journalisée dans le même geste, le journal est non modifiable (append-only)** — **fait**. Une seule fonction `security definer`, une seule transaction (UPDATE + INSERT), testé sous concurrence réelle (scénario SQL 12) ; append-only tenu en base (`revoke`), testé (scénario SQL 3).
6. **CA6 — le journal est lisible, ordonné, horodaté** — **fait**. `listOrderStepChanges` antichronologique, pagination par curseur, testé (contrat + SQL).
7. **CA7 — l'événement `order.step_changed` est publié, aucune évaluation de notification n'a lieu dans ce lot** — **fait**. Publié après la transition, testé (contrat : payload exact) ; aucun appel à un moteur de notification.

## Fichiers créés/modifiés

**Migration et tests SQL**
- `supabase/migrations/20260909000000_gescom_e10_14_order_step_changes.sql` (nouveau)
- `tests/sql/gescom-e10-14-order-step-changes.sql` (nouveau)
- `scripts/test-storefront-sql.sh` (ajout du nouveau cas)

**Module `commercial-orders` (étendu)**
- `src/modules/commercial-orders/api/contracts.ts`
- `src/modules/commercial-orders/api/client.ts`
- `src/modules/commercial-orders/index.ts`
- `src/modules/commercial-orders/application/commercial-orders-repository.ts`
- `src/modules/commercial-orders/application/commercial-orders-service.ts`
- `src/adapters/supabase/commercial-orders-repository.ts`
- `src/server/api/commercial-orders-routes.ts`

**UI (nouveau)**
- `src/modules/commercial-orders/ui/index.ts`
- `src/modules/commercial-orders/ui/components/index.ts`
- `src/modules/commercial-orders/ui/components/OrderStatusDialog.tsx`
- `src/modules/commercial-orders/ui/components/OrderStatusButton.tsx`
- `src/modules/commercial-orders/ui/components/order-status.helpers.ts`
- `src/shared/presentation/testIds.ts` (scope `orderStatus`)

**Tests**
- `tests/contract/commercial-order-step-changes.contract.test.ts` (nouveau, 14 tests)
- `tests/contract/_fakes/commercial-orders-repository.fake.ts` (mise à jour : `registerProductionStepForTest()`, `listStepChanges()`, `changeProductionStep()`)
- `tests/modules/commercial-orders/order-status.helpers.test.ts` (nouveau, 8 tests)

**Story document**
- `_bmad-output/implementation-artifacts/story-E10-14-modale-statut-historique.md` (ce fichier)

Aucun fichier `openapi/magrit-core.v1.yaml`/`docs/api/CONVENTIONS.md`/`src/platform/api/generated/magrit-core.v1.ts` n'a été touché par cette story — déjà écrits par l'architecte avant le démarrage de ce lot (gates rejoués sans écart, §7 du contrat). Aucun câblage supplémentaire n'a été nécessaire dans `src/server/api/gescom-routes.ts` ni `supabase/functions/magrit-api/index.ts` : les deux routes nouvelles sont ajoutées à la fabrique `createCommercialOrdersRoutes()` déjà enregistrée et déjà injectée par E10.12.
