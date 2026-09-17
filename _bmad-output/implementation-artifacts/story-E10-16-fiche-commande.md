---
id: E10.16
epic: E10 — Gestion commerciale
status: done
branch: feat/gescom-e10-4-entite-client
depends_on: [E10.4, E10.5, E10.10b-2, E10.12, E10.13, E10.14, E10.21]
blocks: [E10.17, E10.19, E10.20]
---
# E10.16 — Écran de détail d'une commande

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E10.16 — Écran de détail d'une commande](https://app.notion.com/p/3cad0131973c819a87f8c9427f99c80e) · extrait le 17/09/2026 · page modifiée le 09/09/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E10 — Gestion commerciale | Sprint 5 — Gestion commerciale | P0 | M | Terminé | Claude code | Pro+ | RP 28/08/2026, WM 01/09/2026 | 16 |

### Description fonctionnelle (Notion)

**En tant que** gestionnaire de commandes, **je veux** un écran de commande complet, **afin de** disposer de toutes les informations commerciales et techniques sans sortir de Magrit.

##### Statut

Draft — prêt pour agent dev

##### Contexte produit

Décision RP du 28/08/2026 : l'écran de commande actuel est qualifié de rustique, il manque le détail. La séance acte un écran portant le client, les dates, les articles, les détails techniques, les informations commerciales, la gamme de fabrication issue de Clariprint, la génération du lien de dépôt de fichiers et l'action de changement de statut.

##### Critères d'acceptation

1. La fiche commande présente : numéro, statut courant, client et interlocuteur, dates (création, dernière transition, livraison prévue), devis d'origine.
2. Le détail des lignes affiche libellé produit, configuration technique complète, quantité, prix de vente et remise appliquée.
3. La gamme de fabrication et les données techniques produit récupérées de Clariprint sont accessibles depuis la ligne, y compris le PDF de gamme lorsqu'il existe.
4. La fiche expose le bouton de changement de statut (E10.14) et le panneau d'historique.
5. La fiche expose la génération du lien de dépôt de fichiers (E10.17) et le lien vers l'emplacement des fichiers déposés.
6. La fiche est accessible depuis la grille des commandes et par URL directe `/t/:slug/dashboard/orders/:id`.
7. Aucun écran ne permet de modifier les prix d'une commande : ils sont figés à la conversion (E10.12).

##### Tâches / Sous-tâches

- [ ] Page `src/pages/dashboard/orders/[id].tsx` (CA : 1, 2, 6)
- [ ] Composant `src/components/orders/OrderLinesTable.tsx` (CA : 2)
- [ ] Récupération et affichage de la gamme de fabrication Clariprint (CA : 3)
- [ ] Intégration du dialogue de statut et de l'historique (CA : 4)
- [ ] Intégration du bloc fichiers (CA : 5)

##### Dev Notes

###### Contraintes techniques

- Les données techniques produit et la gamme de fabrication proviennent de Clariprint : les récupérer via le service existant, ne pas les redupliquer dans le schéma Magrit au-delà du snapshot de commande.
- L'écran est en lecture seule sur les montants (CA 7) — c'est une conséquence directe du gel de E10.12, pas une option d'affichage.

###### data-testid

`order-detail-page`, `order-customer-block`, `order-lines-table`, `order-line-row` (+ `data-line-id`), `order-line-tech-details-btn`, `order-manufacturing-range-link`, `order-status-btn`, `order-files-block`, `order-file-link-generate-btn`

###### Dépendances

- Bloquée par : E10.12
- Intègre : E10.14, E10.17

##### Mise à jour — WM du 01/09/2026

- **Bon de commande PDF extrait en story dédiée : E10.19.** La fiche commande expose le bouton, la génération et le gabarit sont traités là-bas.
- **Bloc fichiers revu.** Le CA 5 est remplacé : la fiche n'expose plus « un lien de dépôt » mais le **panneau de fichiers groupé par item** (E10.17), avec dépôt direct depuis le back-office, bascule public / privé et suppression par fichier, plus la génération du lien public de dépôt à transmettre au client (E10.20).
- Le prix affiché sur les lignes provient du snapshot de commande, formaté selon `PricedLine` (**E10.21**).

##### Contrat API

| Méthode | Route | Objet |
| --- | --- | --- |
| GET | `/api/v1/orders/{orderId}` | Détail complet : commande, client, interlocuteur, lignes, étape courante, devis d'origine |
| GET | `/api/v1/orders/{orderId}/lines` | Lignes avec configuration technique et `PricedLine` |
| GET | `/api/v1/orders/{orderId}/lines/{lineId}/manufacturing-range` | Gamme de fabrication Clariprint (302 vers une URL signée) |

**Aucune écriture de prix n'est exposée sur une commande** : le gel des montants à la conversion (E10.12) est une propriété du contrat, pas seulement de l'interface. Il n'existe pas de PATCH sur `order_lines.sale_price`.

##### Tests

Parcours P13 — ouverture d'une commande issue d'un devis, contrôle de la présence du client, des lignes, des détails techniques et de l'impossibilité de modifier un prix.

##### Change Log

- 2026-08-28 — v1 — Création à partir de la séance du 28/08/2026 — Arnaud Mazon / Claude

##### Dev Agent Record

###### Agent Model Used

Sonnet (dev-story), Opus (qa-review)

###### Debug Log References

(aucun fourni)

###### Completion Notes

**qa-review : Approved — 1 seul round, 0 bloquant**

**Critères d'acceptation vérifiés :**

- **CA1** (numéro, statut, client, interlocuteur, dates, devis) : ✓ Livré. Interlocuteur recopié automatiquement via `shop_customer_accounts.customer_contact_id` à la conversion depuis `commercial_quotes.decided_by_account_id` (découverte notable évitant saisie manuelle inventée). Date de livraison prévue affichée « Non renseignée » (colonne posée sans écrivain, debt tracée).
- **CA2** (lignes au format PricedLine) : ✓ Livré. Table `order-lines-table`, `order-line-row` (+`data-line-id`).
- **CA3** (gamme Clariprint) : ✓ Hors périmètre confirmé — aucune capacité disponible dans dépôt, différé rapproché d'E10.8 (gelée).
- **CA4** (bouton Statut + historique) : ✓ Livré, câblé pour première fois sur écran réel. `OrderStatusButton` relance `refresh()` après transition. Aucun panneau historique séparé (arbitrage E10.14).
- **CA5** (fichiers/E10.17) : ✓ Hors périmètre — aucun bloc.
- **CA6** (URL directe `/t/:slug/dashboard/commercial-orders/:orderId`) : ✓ Livré. Route cohérente avec reste dépôt, pas collision domaine avec `orders` boutique existant.
- **CA7** (lecture seule prix) : ✓ Livré. Aucun `<input>` ni bouton édition montant.
- **CA8** (PDF bon de commande/E10.19) : ✓ Hors périmètre — aucun bouton.

**Points sensibles testés :**

- Fonction `api_convert_commercial_quote` (3ème recopie ce sprint, après b-2 puis E10.13) : diff mécanique exact (4 changements attendus, rien d'autre). Verrou `FOR UPDATE` volontairement retiré en test pour confirmer bug B1 (corrigé round 1 b-2) réapparaît → test reconnaît bug → verrou restauré. Régression détectée fiablement.
- Isolation inter-tenant (RLS `commercial_orders_select`) : couverture complète sur colonnes neuves sans modification.
- Suppression interlocuteur → `on delete set null` correct, aucun heurt `commercial_orders_immutable()`.

**Tests passés :**

- `pnpm typecheck` : 0 erreur
- `pnpm test:contract` : 275/275 (contrat déjà écrit architecte, aucune route nouvelle)
- `pnpm test:architecture` : 144/144 (module respecte frontières, imports via façade)
- `npx vitest run` : 1735 pass / 36 skip / 3 pré-existants sans rapport
- Suite SQL spécifique (`tests/sql/gescom-e10-16-order-contact-and-delivery.sql`) : 8 scénarios exécutés Docker local, 0 erreur

**10 réserves non bloquantes tracées (détail story-document) :**

R1 (taux remise multiplication flottante) · R2 (message UX confus si lecture secondaire échoue) · R3 (date livraison format ISO brut) · R4 (UI admin-only vs API ouverte, écart pré-existant) · R5 (branche unique non respectée, série complète) · R6 (harnais SQL bloqué fixtures antérieures) · R7 (CA Notion non confrontées, accès limité) · R8 (testid `order-` partagé) · R9-R10 (dette test mineure).

###### File List

**Migration et tests SQL**

- `supabase/migrations/20260909010000_gescom_e10_16_order_contact_and_delivery.sql` (nouveau)
- `tests/sql/gescom-e10-16-order-contact-and-delivery.sql` (nouveau)
- `scripts/test-storefront-sql.sh` (ajout cas nouveau)

**Module commercial-orders (étendu)**

- `src/modules/commercial-orders/api/contracts.ts` (CA1/CA2 schema)
- `src/modules/commercial-orders/index.ts`
- `src/modules/commercial-orders/manifest.ts` (nouveau)
- `src/modules/commercial-orders/surface-contributions.ts` (nouveau)
- `src/adapters/supabase/commercial-orders-repository.ts` (findDetailById())

**UI (nouveau)**

- `src/modules/commercial-orders/ui/index.ts` (export)
- `src/modules/commercial-orders/ui/hooks/useOrderDetail.ts` (5 lectures)
- `src/modules/commercial-orders/ui/workspace/OrderDetailPage.tsx` (CA1-CA2, CA4, CA6-CA7)
- `src/modules/commercial-orders/ui/workspace/order-detail.helpers.ts` (formatage affichage)
- `src/shared/presentation/testIds.ts` (scope `commercialOrder`)
- `src/surfaces/application-registry.ts` (enregistrement)
- `src/app/surfaces/workspaceRuntimeRoutes.tsx` (loader lazy)

**Tests**

- `tests/contract/commercial-orders.contract.test.ts` (CA1/CA2 asserés)
- `tests/contract/_fakes/commercial-orders-repository.fake.ts` (convertQuote fixture)
- `tests/contract/_fakes/commercial-quotes-repository.fake.ts` (decidedByAccountId)
- `tests/modules/commercial-orders/order-detail.helpers.test.ts` (11 tests, nouveau)

**Story document**

- `_bmad-output/implementation-artifacts/story-E10-16-fiche-commande.md`

##### QA Results

**Verdict : Approved**

**Résumé :**

Lot livré complet pour ce qui est disponible aujourd'hui (fiche commande avec CA1-CA2, CA4, CA6-CA7 tenus). CA3 (gamme Clariprint), CA5 (fichiers/E10.17), CA8 (PDF/E10.19) hors périmètre confirmé — aucune capacité Clariprint, aucun bloc, aucun bouton inventé.

**Découverte notable en cours de cadrage :**

L'interlocuteur est recopiable automatiquement à la conversion depuis `commercial_quotes.decided_by_account_id` → `shop_customer_accounts.customer_contact_id` — pas une saisie manuelle à inventer, chaîne de données existante réellement exercée (8 scénarios SQL).

**Fonction api_convert_commercial_quote (3ème recopie ce sprint) :**

Recopie exacte du corps. Verrou `FOR UPDATE` volontairement retiré en test pour confirmer que le bug B1 (corrigé en b-2 round 1) réapparaît immédiatement si quelqu'un le retire par erreur un jour — c'est arrivé, la fonction a été restaurée, empreinte vérifiée identique. Régression clairement détectée par le test.

**Zéro bloquant. 10 réserves non bloquantes tracées dans le backlog (R1-R10, voir Completion Notes).**

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-178](https://app.notion.com/3cad0131973c8132a731d392e5da61fe) | GC — Valider un devis et le transformer en commande | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.12, E10.16 |
| [TF-184](https://app.notion.com/3cad0131973c81dd9925ec7a18081c38) | GC — Fiche commande complète et prix non modifiables | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.16, E10.12, E10.14 |
| [TF-187](https://app.notion.com/3cad0131973c811081d5ec192b193681) | GC — Export XLSX des commandes au détail ligne pour la comptabilité | OK | P1 — Importante | P13 — Devis et gestion commerciale | B6 | E10.18, E10.16 |
| [TF-190](https://app.notion.com/3ced0131973c8190a49cd5856b374556) | GC — Génération du PDF Bon de commande et révision | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.19, E10.16, E10.17 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

Contrat écrit par l'architecte avant le démarrage (`docs/api/CONVENTIONS.md`
§8.17). **Résultat en une ligne, repris du contrat lui-même** : ce lot
n'ajoute aucune opération, aucun schéma, et deux champs
(`customer_contact_id`, `expected_delivery_date`) sur
`CommercialOrderDetail`. Trois arbitrages d'Arnaud du 2026-09-09 ont fermé
les réserves bloquantes de la première remise du contrat : (a) CA3 (gamme de
fabrication Clariprint) **différé**, rapproché d'E10.8 (gelée) ; (b) CA1
(interlocuteur + date de livraison prévue) **posé maintenant** plutôt que
différé — c'est l'objet des deux colonnes migrées par ce lot ; (e) CA4
(panneau d'historique) **tranché en faveur de la décision déjà livrée
d'E10.14** — aucun second panneau, le bouton ouvre `OrderStatusDialog`.

**Limite d'accès héritée du cadrage, non levée par `dev-story`** : comme pour
les lots précédents du sprint, cet agent n'a pas d'accès Notion. Le texte
transmis par l'agent appelant (contrat §8.17, hints DOM, contraintes
techniques) est traité comme le périmètre opposable.

## Ce qui est livré

| Élément | Détail |
|---|---|
| Migration `20260909010000` | Deux colonnes **nullables, sans défaut, sans rattrapage rétroactif** sur `commercial_orders` : `customer_contact_id uuid references customer_contacts(id) on delete set null` et `expected_delivery_date date`. `api_convert_commercial_quote` — **troisième** `create or replace` de cette fonction (après E10.12 puis E10.13), corps recopié verbatim, **deux différences bornées** : (i) le `SELECT … FOR UPDATE` déjà posé (patron B1, qa-review round 1 d'E10.12) lit aussi `decided_by_account_id`, sous le **même verrou** — jamais une seconde requête ; (ii) `customer_contact_id` rejoint la liste de colonnes/valeurs de l'`insert`, sous-requête scalaire déterministe (`shop_customer_accounts.id` = clé primaire), `NULL` sans erreur si `decided_by_account_id` est `NULL` ou si le compte trouvé n'a lui-même aucun `customer_contact_id`. `expected_delivery_date` n'est **pas** dans la liste : rien ne la calcule, l'omettre la laisse à `NULL`. `commercial_orders_immutable()` **n'est pas touchée** (consigne opposable du contrat) — les deux colonnes sont mutables par construction (trigger = liste de refus par colonne), ce qui laisse jouer sans modification le `on delete set null` d'un interlocuteur supprimé (vérifié par le test SQL, scénario 6). |
| `GET /commercial-orders/{orderId}` | Déjà publié (E10.12/E10.13/E10.14), **enrichi** par le contrat des deux nouveaux champs — aucune route, aucun code TypeScript de route à modifier (`src/server/api/commercial-orders-routes.ts` intact). |
| Module `commercial-orders` (étendu) | `api/contracts.ts` : `customer_contact_id`/`expected_delivery_date` ajoutés à `commercialOrderDetailSchema` (import de `dateOnlySchema` depuis `commercial-quotes/api/contracts.ts`), deux assertions neuves dans `COMMERCIAL_ORDERS_CONTRACT_ALIGNMENT`. `manifest.ts`/`surface-contributions.ts` **nouveaux** : capability `commercial-orders.read`, route `commercial-orders/:orderId`, **aucune entrée de navigation** (CA6 : URL directe seulement, pas de grille). |
| Adaptateur Supabase | `src/adapters/supabase/commercial-orders-repository.ts` — `findDetailById()` relit désormais la ligne `commercial_orders` **directement** (plutôt que de déléguer à `findById()`, dont le DTO de liste ne porte pas les deux champs neufs) et compose `customer_contact_id`/`expected_delivery_date` depuis la ligne brute. |
| UI — `OrderDetailPage` (nouveau) | `src/modules/commercial-orders/ui/workspace/OrderDetailPage.tsx`, exporté `DashboardOrderDetail`. CA1 : numéro, statut, étape courante (libellé + couleur, `listProductionSteps`), client (lien vers sa fiche), interlocuteur (nom + e-mail, ou « Non identifié »), date de création, **date de dernière transition** lue **au journal** (`listOrderStepChanges(page[size]=1)`, jamais `updated_at` — décision #5 du contrat), date de livraison prévue (toujours vide dans ce lot, affichée « Non renseignée »), devis d'origine (lien vers `commercial-quotes/:quoteId`, `getQuote(quote_id)`). CA2 : table des lignes au format `PricedLine` (E10.21) tel quel — libellé, configuration technique (aperçu des trois premières clés de `product_config`, sans schéma imposé), quantité, remise, prix de vente. CA4 : `OrderStatusButton` (E10.14) **câblé pour la première fois sur un écran réel**, `onChanged` relance `refresh()`. CA6 : accessible par URL directe `/t/:slug/dashboard/commercial-orders/:orderId` uniquement (voir décision de routage ci-dessous). CA7 : lecture seule — aucun `<input>`/`<button>` d'édition sur un montant de ligne, vérifié par lecture du composant (aucune mutation de prix nulle part dans ce module). |
| UI — `useOrderDetail` (nouveau) | `src/modules/commercial-orders/ui/hooks/useOrderDetail.ts` — cinq lectures : `getCommercialOrder`, `getCustomer` (nom du client **et** de l'interlocuteur, `customer_contact_id` est un pointeur, jamais recopié — décision #9 du contrat), `getQuote` (numéro du devis d'origine, décision #6), `listProductionSteps` (libellé/couleur), `listOrderStepChanges(page[size]=1)` (dernière transition, décision #5). Le cadrage annonce « quatre appels » (réserve (d)) mais omet `getQuote`, pourtant explicitement requis par sa propre décision #6 — écart de comptage documenté dans le code, pas une dérogation prise ici (toutes les lectures sont déjà publiées, aucune n'est nouvelle). |
| UI — `order-detail.helpers.ts` (nouveau, PUR) | `customerDisplayName()`, `contactDisplayName()`, `formatOrderDate()`, `sourceQuoteStatusLabel()` — extraits d'`OrderDetailPage` pour être testés unitairement, même discipline qu'`order-status.helpers.ts` (E10.14). **Aucun calcul de prix/seuil** : formatage d'affichage uniquement. |
| `data-testid` | Scope `commercialOrder` ajouté à `src/shared/presentation/testIds.ts` : `detailPage` (`order-detail-page`), `customerBlock` (`order-customer-block`), `linesTable` (`order-lines-table`), `lineRow` (`order-line-row`, `+data-line-id`) — les quatre testids mandatés par la story Notion. `order-status-btn` **réutilisé tel quel** (déjà déclaré par E10.14, `TEST_IDS.orderStatus.btn`), pas redéclaré. **`order-manufacturing-range-link`/`order-files-block`/`order-file-link-generate-btn` volontairement NON posés** (CA3/CA5 hors périmètre, pas de lien mort). |

## Décision de routage (écart documenté par rapport au chemin proposé par le contrat)

Le contrat §8.17 (décision #7) propose `/t/:slug/dashboard/orders/:id`. Ce
chemin est **déjà pris** : `orders.workspace.list` (module `orders`, écran
`DashboardOrders`) est monté sur le path `orders` et porte un domaine
**différent et incompatible** — les commandes **boutique/storefront**
(`tenant_orders`), pas les commandes de **gestion commerciale**
(`commercial_orders`). C'est exactement la même frontière que celle déjà
posée côté API entre `/commercial-orders` et `/api/v1/orders` (vérifiée par
l'architecte, §0 vérification n°4 du contrat, 25 tests verts sur
`assertNoFacadeCollision()`). Router la fiche sur `orders/:orderId` aurait
créé une ambiguïté visuelle (deux écrans « commandes » sous le même segment
racine) sans être une collision technique stricte au sens React Router
(chemins distincts). **Choix retenu : `commercial-orders/:orderId`**, même
patron que `commercial-quotes/:quoteId` (module voisin, même frontière devis
boutique/gescom) — cohérent avec « route cohérente avec le reste du dépôt »
qu'admettait la consigne de départ comme alternative valide au chemin
littéralement `orders/:id`. Aucune entrée de navigation n'est ajoutée
(CA6 : URL directe seulement).

## Ce qui n'est PAS dans le périmètre

- **CA3 — gamme de fabrication Clariprint.** Aucune capacité de ce type
  n'existe dans le dépôt (vérifié par l'architecte : `manufacturing`/
  `manufacturingRange`/`production_range` — zéro occurrence dans `src/`,
  `supabase/migrations/`, `openapi/`). **Différé**, rapproché d'E10.8
  (gelée). Aucune section, aucun lien mort, aucun testid posé pour ce point.
- **CA5 — fichiers par item (E10.17).** Non livrée, aucun bloc, aucun champ,
  aucun point d'extension ouvert d'avance (décision #4 du contrat : la forme
  n'est pas connue, la publier maintenant choisirait la forme la plus
  contraignante des trois possibles et se l'interdirait de changer).
- **CA8 — bon de commande PDF (E10.19).** Non livrée. Le contrat admettait un
  bouton « Bon de commande » **inerte** sur la fiche ; ce lot va plus loin et
  **ne pose aucun bouton du tout** (consigne explicite de l'agent appelant) :
  un bouton désactivé sans appel API n'apporte rien à l'utilisateur et
  aurait pu laisser croire à une fonctionnalité proche.
- **Aucune grille de commandes.** N'existe pas dans ce dépôt (décision #7 du
  contrat, réserve (f) ouverte) ; le seul chemin d'accès livré ici est l'URL
  directe. `listCommercialOrders` sert déjà ce besoin côté API depuis
  E10.12/E10.13, il manque un écran — hors périmètre de cette story.
- **Aucun panneau d'historique séparé sur la fiche.** Arbitrage (e) du
  contrat : le bouton `OrderStatusButton` ouvre `OrderStatusDialog`
  (E10.14), qui contient déjà l'historique en colonne gauche. Construire un
  second rendu du même journal aurait été la « seconde implémentation »
  explicitement interdite par le cadrage d'E10.14.
- **Aucune saisie de date de livraison prévue.** La colonne
  `expected_delivery_date` est posée, **sans aucun écrivain** : réserve (h)
  du contrat, non tranchée (« qui la saisit, quand, par quel geste »). Elle
  vaut `NULL` sur 100 % des commandes tant que cette question n'est pas
  arbitrée.
- **Aucune écriture de prix.** Ni `PATCH` sur `commercial_orders`, ni sur une
  ligne — le contrat ne publie ni l'un ni l'autre, et le trigger
  `commercial_orders_lines_immutable`/`commercial_orders_immutable` (E10.12)
  n'est pas rouvert.

## Dette introduite ou héritée

| Réf. | Trou | Chemin de mise en conformité |
|---|---|---|
| **(h) héritée, ouverte** | `expected_delivery_date` n'a aucun chemin d'écriture. | Une story dédiée tranche qui la saisit, par quel geste (une opération dédiée journalisée, jamais un `PATCH` générique) et si elle est révisable — à rapprocher d'E10.15 (notifications) si une date promise non tenue doit alerter. |
| **(f) héritée, ouverte** | La fiche n'est atteignable que par URL directe : aucune grille de commandes n'existe. | Une story qui livre la grille (CA6 côté liste) ajoute un lien vers `commercial-orders/:orderId` — une ligne de plus, aucun changement de contrat. |
| **(d) héritée, ouverte, coût de lecture** | Cinq appels réseau pour peupler la fiche (`getCommercialOrder` + `getCustomer` + `getQuote` + `listProductionSteps` + `listOrderStepChanges`). | À ne rouvrir que si le coût devient réel, et alors de façon additive (bloc de référence sur `CommercialOrderDetail`) — pas par anticipation (décision #3 du contrat : recopier casserait la doctrine « le contrat rend des identifiants, l'appelant joint »). |
| **(g) héritée, ouverte** | Relecture Notion des CA exacts non faite (limite d'accès, même réserve que les lots précédents). | Le `scribe` ou un humain avec accès Notion confronte ce document aux CA numérotés de la page avant clôture définitive. |
| **Nouvelle — écart de comptage du cadrage (§0 réserve (d) vs décision #6)** | Le contrat annonce « quatre appels » pour la fiche mais sa propre décision #6 exige un cinquième (`getQuote`). | Signalé dans le code (`useOrderDetail.ts`) et ici ; sans effet pratique (toutes les lectures sont déjà publiées), à corriger dans une future relecture du contrat si l'architecte le juge utile. |

## Vérifications

`pnpm typecheck` (= `typecheck:modular`) : **0 erreur**. `pnpm
gen:api:check` : aligné (aucune modification du contrat par ce lot — déjà
livré par l'architecte). `pnpm test:architecture` : **144/144** (33
fichiers), inchangé — le nouveau module respecte les frontières modulaires
(imports cross-module par façade publique : `@/modules/customers`,
`@/modules/commercial-quotes`, `@/modules/production-steps`, jamais un
chemin profond `api/client`/`api/contracts`). `pnpm test:contract` :
**275/275** (15 fichiers) — `tests/contract/commercial-orders.contract.test.ts`
passe désormais à **10/10** (2 tests différenciés `sent`/`accepted` sur
`convertQuote`, `getCommercialOrder` mis à jour), les trois échecs attendus
par le contrat sont résolus par la complétion **différenciée** des faux
(consigne opposable de l'architecte, pas une valeur bidon identique
partout). `npx vitest run` (suite complète) : **1735 passés / 36 skip**, 3
échecs **pré-existants et sans rapport**
(`tests/storage/product_mockups_isolation.test.ts` — bucket Storage local
`product_mockups` introuvable, même symptôme de désynchronisation
Storage/Kong déjà documenté par les lots précédents du sprint).

**Tests unitaires de logique d'affichage**
(`tests/modules/commercial-orders/order-detail.helpers.test.ts`, 11 tests) :
`customerDisplayName()` (société/particulier, replis « Client »),
`contactDisplayName()` (repli sur l'e-mail), `formatOrderDate()` (`null` ->
tiret), `sourceQuoteStatusLabel()` (`sent`/`accepted`, repli sur la valeur
brute). Aucun calcul de prix/seuil dans ce lot — uniquement du formatage
d'affichage à partir de valeurs déjà rendues par l'API.

`tests/sql/gescom-e10-16-order-contact-and-delivery.sql` : **exécuté
réellement** (Docker local, migration `20260909010000` appliquée par `pnpm
db:local:push`), 8 scénarios, `rollback` final, 0 erreur : (1) fixtures —
tenant A avec deux interlocuteurs (X, Y), un compte boutique **décidé** lié
à X, un compte boutique **auto-inscrit/legacy** (`customer_contact_id`
`NULL`), trois devis prêts (`sent`, `accepted` décidé par le compte lié à
X, `accepted` décidé par le compte legacy) ; (2) conversion depuis `sent` —
`customer_contact_id` `NULL` (aucune décision portail, cas le plus
fréquent) ; (3) conversion depuis `accepted` décidé par le compte **lié à
X** — `customer_contact_id` = X, **la chaîne de dérivation
`decided_by_account_id` -> `shop_customer_accounts.customer_contact_id` ->
`customer_contacts` est réellement exercée**, pas seulement rendue `NULL`
par défaut ; (4) conversion depuis `accepted` décidé par le compte
**legacy** — `customer_contact_id` `NULL` **même si** `decided_by_account_id`
n'est pas `NULL`, le pointeur intermédiaire étant vide ; (5)
`expected_delivery_date` `NULL` sur les trois commandes, confirmé ; (6)
suppression de l'interlocuteur X — `on delete set null` opère sans heurter
`commercial_orders_immutable()` (intouchée par ce lot) ; (7) mutabilité en
base n'est **pas** un chemin d'écriture ouvert — un `UPDATE` direct de
`customer_contact_id` par un admin du tenant propriétaire, sous rôle
`authenticated`, n'affecte **aucune ligne** (aucune policy RLS d'écriture
sur `commercial_orders`) ; (8) isolation inter-tenant en lecture — la RLS
posée par ligne (`commercial_orders_select`, E10.12) couvre les deux
colonnes neuves **sans aucune modification**, un membre du tenant B ne lit
aucune ligne d'une commande du tenant A.

**Suite SQL complète (`pnpm test:storefront:sql`)** : bloquée sur un cas
**antérieur, non lié au sprint E10, et sans rapport avec ce lot**
(`legacy-shop-only-write-freeze.sql`, `CHECK
tenant_members_role_admin_check` violé par une insertion `role='owner'` —
fixture de test obsolète face à un renommage de catalogue de rôles introduit
par une story identité distincte, `feat(identity): separate Magrit role
catalog`, commit `f3bb094`, 2026-08-18, aucun rapport avec la gestion
commerciale). Isolé de ce blocage (exécution directe, hors script), le
fichier `tests/sql/gescom-e10-16-order-contact-and-delivery.sql` passe
**seul** et **chaîné après** `gescom-e10-12/13/14-*.sql` (dépendances
directes de ce lot), à froid comme après un run précédent — 0 écart.

## Critères d'acceptation (contrat §8.17, tenus un par un)

Numérotation reprise du texte de la story transmis par l'agent appelant.

1. **CA1 — numéro, statut courant, client et interlocuteur (peut être vide), dates (création, dernière transition, livraison prévue — vide), devis d'origine.** **Fait.** `OrderDetailPage` affiche les huit informations ; l'interlocuteur affiche « Non identifié » quand `customer_contact_id` est `null` (cas fréquent et normal, pas une anomalie) ; la date de livraison prévue affiche « Non renseignée » (100 % des commandes dans ce lot, réserve (h)) ; la dernière transition se lit au journal (`listOrderStepChanges`), jamais sur `updated_at`.
2. **CA2 — lignes avec libellé produit, configuration technique, quantité, prix de vente et remise, format `PricedLine` (E10.21) tel quel.** **Fait.** Table `order-lines-table`/`order-line-row` (`+data-line-id`), aucun format neuf inventé — `label`, `product_config` (aperçu, sans schéma imposé), `quantity`, `discount_rate`, `sale_price` lus tels quels sur `CommercialOrderLine`.
3. **CA3 — gamme de fabrication Clariprint.** **Hors périmètre, confirmé.** Aucune section, aucun lien mort, aucun testid.
4. **CA4 — bouton « Statut » qui ouvre `OrderStatusDialog`.** **Fait, et c'est ce lot qui le câble enfin.** `OrderStatusButton` (E10.14, `data-testid="order-status-btn"`, réutilisé tel quel) monté sur la fiche, `onChanged` relance `refresh()`. Aucun panneau d'historique séparé (arbitrage (e)).
5. **CA5 — fichiers par item (E10.17).** **Hors périmètre, confirmé.** Aucun bloc, aucun testid.
6. **CA6 — accessible par URL directe.** **Fait**, sur `/t/:slug/dashboard/commercial-orders/:orderId` (écart documenté par rapport au chemin `orders/:id` esquissé par le contrat — collision de domaine avec le module `orders` existant, voir section dédiée ci-dessus). **Aucune grille de commandes construite** — non demandé par le texte de cette story, dette (f) déjà tracée par le contrat.
7. **CA7 — lecture seule sur les prix.** **Fait, vérifié.** Aucun `<input>`, aucun bouton d'édition sur un montant de ligne ou un total dans `OrderDetailPage`/`useOrderDetail` — la seule écriture disponible depuis cette fiche est le changement d'étape de production (`OrderStatusButton`), qui ne touche aucun prix.
8. **CA8 — bon de commande PDF (E10.19).** **Hors périmètre, confirmé.** Aucun bouton, aucune génération, aucun lien.

## Fichiers créés/modifiés

**Migration et tests SQL**
- `supabase/migrations/20260909010000_gescom_e10_16_order_contact_and_delivery.sql` (nouveau)
- `tests/sql/gescom-e10-16-order-contact-and-delivery.sql` (nouveau)
- `scripts/test-storefront-sql.sh` (ajout du nouveau cas)

**Module `commercial-orders` (étendu)**
- `src/modules/commercial-orders/api/contracts.ts` (`customer_contact_id`/`expected_delivery_date` sur `commercialOrderDetailSchema`, import `dateOnlySchema`, deux assertions `CONTRACT_ALIGNMENT`)
- `src/modules/commercial-orders/index.ts` (export du manifest/de la contribution)
- `src/modules/commercial-orders/manifest.ts` (nouveau)
- `src/modules/commercial-orders/surface-contributions.ts` (nouveau)
- `src/adapters/supabase/commercial-orders-repository.ts` (`findDetailById()` relit la ligne brute)

**UI (nouveau)**
- `src/modules/commercial-orders/ui/index.ts` (export `DashboardOrderDetail`/`useOrderDetail`)
- `src/modules/commercial-orders/ui/hooks/useOrderDetail.ts`
- `src/modules/commercial-orders/ui/workspace/OrderDetailPage.tsx`
- `src/modules/commercial-orders/ui/workspace/order-detail.helpers.ts`
- `src/shared/presentation/testIds.ts` (scope `commercialOrder`)
- `src/surfaces/application-registry.ts` (enregistrement manifest/contribution)
- `src/app/surfaces/workspaceRuntimeRoutes.tsx` (loader lazy `commercial-orders.workspace.detail`)

**Tests**
- `tests/contract/commercial-orders.contract.test.ts` (mise à jour : deux champs asserés sur trois tests, scénario `accepted` différencié)
- `tests/contract/_fakes/commercial-orders-repository.fake.ts` (`registerShopAccountContactForTest()`, résolution de `customer_contact_id` à la conversion)
- `tests/contract/_fakes/commercial-quotes-repository.fake.ts` (`setDecidedByAccountIdForTest()`)
- `tests/modules/commercial-orders/order-detail.helpers.test.ts` (nouveau, 11 tests)

**Story document**
- `_bmad-output/implementation-artifacts/story-E10-16-fiche-commande.md` (ce fichier)

Aucun fichier `openapi/magrit-core.v1.yaml`/`docs/api/CONVENTIONS.md`/
`src/platform/api/generated/magrit-core.v1.ts` n'a été touché par cette
story — déjà écrits par l'architecte avant le démarrage de ce lot (gates
rejoués sans écart, §7 du contrat). Aucun câblage supplémentaire n'a été
nécessaire dans `src/server/api/gescom-routes.ts` ni
`src/server/api/commercial-orders-routes.ts` : `getCommercialOrder` était
déjà publié, seul son schéma de réponse s'est enrichi.
