---
id: E10.14
epic: E10 — Gestion commerciale
status: done
branch: feat/gescom-e10-4-entite-client
depends_on: [E10.12, E10.13]
blocks: [E10.15, E10.16]
---
# E10.14 — Modale unifiée de changement de statut et historique horodaté

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
