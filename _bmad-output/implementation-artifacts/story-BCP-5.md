---
id: BCP-5
epic: E10 — Gestion commerciale (chantier boutique hors E10, §8.25)
status: done (implementation dev-story) — qa-review distincte requise avant merge
branch: worktree isole "agent-afbaf2886b4c51f73", depuis feat/gescom-e10-4-entite-client @ efc52207
depends_on: []
parallelisable_avec: [BCP-6, BCP-9]
---
# BCP-5 — Une table de libellés de statut, une seule (lot 5, avancé pendant le banc Clariprint)

Cadrage opposable : `docs/api/CONVENTIONS.md` §8.25, point **5.1** (« BCP-5 —
une table de statuts, une seule »), le constat 1(5) (« il y a QUATRE tables
de libellés de statut, pas deux »), et les décisions **Q1** (« l'atelier lit
lui aussi "En attente de validation" — TRANCHÉE : oui ») et **Q5** (livraison
factice, non tranchée — hors périmètre de cette story).

Décisions d'Arnaud opposables, reprises telles quelles :
- Le statut `draft` d'une commande boutique reste CONFORME au PRD (FR18/FR49).
  Le cycle de vie n'a pas changé, seuls les libellés changent.
- Q1 : oui, l'atelier voit le même mot que l'acheteur pour `draft`.
- Écran de remerciement : « Commande transmise — en attente de validation par
  l'imprimeur » remplace « Commande confirmée ».
- « Vous recevrez un email de confirmation. » est FAUX (`send-order-notification`
  n'écrit qu'aux administrateurs du tenant) : SUPPRIMÉ, pas reformulé —
  **partout où la phrase apparaît**, pas seulement dans le panier (décision
  du coordinateur, suite à l'écart remonté sur `PortalThankYou.tsx:120`).
- Textes du panier (`PortalCart.tsx:417,428`) et libellé du badge « Prix
  marché » (`PortalCart.tsx:349`) corrigés selon §8.25.
- Hors périmètre : budget factice et « Livraison : Siège social » (lot 8,
  Q5 non tranchée), dimensions et finitions (lot 7).

**Deux rounds de suite, après l'implémentation initiale :**
1. Le coordinateur a demandé la suppression de la même fausse promesse
   d'email dans `PortalThankYou.tsx:120` (hors du point 5.1 littéral, mais
   sous la même règle), plus une recherche exhaustive de promesses
   similaires dans `src/modules/orders/ui/storefront` et
   `src/modules/shops/ui/storefront`.
2. L'architecte a tranché l'écart remonté sur `OrderRolesPage.tsx:578` (voir
   arbitrage cité au point 5.1, section « (a) »–« (c) ») : le huitième item
   était un vestige sans statut réel, RETIRÉ, et l'écran lit désormais la
   table unique via un helper pur (`getOrderStatusLegendLabels()`). La garde
   d'architecture est étendue en conséquence.

## Critères d'acceptation — un par un

| # | Critère (cadrage §8.25 point 5.1) | Statut | Preuve |
|---|---|---|---|
| 1 | `orderStatus.ts` (`STATUS_LABELS`) devient la SEULE table de libellés de statut sous `src/modules/orders/ui/` ; `draft` → « En attente de validation » | **Fait** | `src/modules/orders/ui/helpers/orderStatus.ts` ; `tests/lib/orderStatus.test.ts` (assertions `getStatusInfo("draft").label` et `labelToStatus("En attente de validation")`) |
| 2 | `PortalOrders.helpers.ts` (STATUS_LABELS) devient un import/dérivé, pas une seconde table | **Fait** | `PortalOrders.helpers.ts` ré-exporte `STATUS_LABELS` de `orderStatus.ts` ; `tests/components/shop/portal/PortalOrders.helpers.test.ts` (inchangé, toujours vert car le ré-export porte les mêmes clés) |
| 3 | `orderAuditTrail.helpers.ts` (STATUS_LABELS_FR) devient un import/dérivé | **Fait** | `formatAuditEventTitle` appelle `getStatusInfo(...).label` ; `tests/server/order_audit_trail.test.ts` (« Statut : En attente de validation → Validée ») |
| 4 | `ResumeBanner.tsx` (STATUS_LABELS en ligne) reste une forme DÉRIVÉE, pas une seconde table | **Fait** | `statusLabel()` dérive `getStatusInfo(status).label` (minuscule initiale) ; `tests/components/shop/portal/resumeBanner.helpers.test.ts` (nouveau cas `draft` → contient « en attente de validation », pas « brouillon ») |
| 5 | Un test échoue si une seconde table de libellés de statut réapparaît sous `src/modules/orders/` | **Fait** | `tests/architecture/order-status-single-source.test.ts` (nouveau). Preuve d'échec sur l'ancien code : rejoué contre les 3 anciennes versions des fichiers via `git show HEAD:...` — `ResumeBanner.tsx` (6 clés), `PortalOrders.helpers.ts` (7 clés), `orderAuditTrail.helpers.ts` (7 clés) étaient tous les trois en défaut |
| 6 | Q1 : l'atelier voit le même mot que l'acheteur (`ValidateOrderConfirmDialog`, `orderValidation.helpers`, `orderCancellation.helpers`, `PortalOrderEditor`, infobulle `OrderHistoryTable`) | **Fait** | Détail par fichier ci-dessous |
| 7 | Écran de remerciement : « Commande transmise — en attente de validation par l'imprimeur » | **Fait** | `PortalThankYou.tsx:90` ; `tests/components/shop/portal/PortalThankYou.test.ts` (nouveau describe, `toContain`/`not.toContain`) |
| 8 | Panier : « Vous recevrez un email de confirmation. » supprimé, pas reformulé | **Fait** | `PortalCart.tsx` (bloc retiré) ; `tests/components/shop/portal/PortalCart.text.test.ts` (nouveau) |
| 9 | Panier : nouveau texte « Votre commande sera transmise à l'imprimeur, qui la validera. », infobulle N+1 retirée | **Fait** | `PortalCart.tsx:428` (ancien numéro de ligne) ; même test |
| 10 | Panier : badge Prix marché reformulé, sans mention Clariprint | **Fait** | `PortalCart.tsx:349` (ancien numéro de ligne) ; même test |
| 11 | Hors périmètre : budget factice, « Livraison : Siège social », dimensions/finitions | **Respecté — non touché** | Vérifié négativement : `budget`, `BudgetInfo`, `Livraison : Siège social`, `formatDimensionsMm` absents du diff |
| 12 | Même fausse promesse d'email retirée partout où elle apparaît, pas seulement dans le panier | **Fait** | `PortalThankYou.tsx:120` (bandeau retiré) ; recherche `grep` exhaustive sur `src/modules/orders/ui/storefront` et `src/modules/shops/ui/storefront` (aucune autre occurrence buyer-facing, une seule trouvée et traitée) ; `tests/components/shop/portal/PortalThankYou.test.ts` (nouveau cas) |
| 13 | `OrderRolesPage.tsx:578` : huitième item fantôme retiré, liste tirée de la table unique | **Fait (arbitrage architecte)** | `getOrderStatusLegendLabels()` dans `orderStatus.ts`, publié par `orders/ui/index.ts`, consommé par `OrderRolesPage.tsx` ; `tests/lib/orderStatus.test.ts` (2 nouveaux cas), `tests/modules/roles/OrderRolesPage.text.test.ts` (nouveau) |
| 14 | Garde d'architecture étendue : refuse aussi un libellé de statut écrit en dur (forme légende/phrase), sous `src/modules/orders/` ET `src/modules/roles/` | **Fait** | `tests/architecture/order-status-single-source.test.ts` (2e `it`, nouveau) — preuve d'échec exécutée sur l'ancien `OrderRolesPage.tsx` (7 libellés détectés) |

## Ce qui est livré, fichier par fichier

| Fichier | Changement |
|---|---|
| `src/modules/orders/ui/helpers/orderStatus.ts` | `STATUS_LABELS.draft.label` : `"Brouillon"` → `"En attente de validation"`. Commentaire posant cette table comme SEULE source, gardée par le nouveau test d'architecture. |
| `src/modules/orders/ui/storefront/PortalOrders.helpers.ts` | `STATUS_LABELS` devient `= CANONICAL_STATUS_LABELS` (import de `orderStatus.ts`). Plus aucune clé en dur. |
| `src/modules/orders/ui/storefront/orderAuditTrail.helpers.ts` | Table `STATUS_LABELS_FR` retirée. `formatAuditEventTitle` appelle `getStatusInfo(from).label` / `getStatusInfo(to).label` (fallback safe sur le statut brut inconnu, comportement identique à l'ancien `?? from`). |
| `src/modules/orders/ui/storefront/ResumeBanner.tsx` | Table `STATUS_LABELS` en ligne retirée. `statusLabel()` dérive `getStatusInfo(status).label` puis met la première lettre en minuscule — c'est la forme « dérivée » explicitement autorisée par le cadrage, pas une seconde table. Effet de bord positif : `invoiced` (« facturée ») est désormais couvert, il ne l'était pas dans l'ancienne table locale. |
| `src/modules/orders/ui/storefront/ValidateOrderConfirmDialog.tsx:76` | « La commande passera du statut **Brouillon** à **Validée** » → « La commande passera de **En attente de validation** à **Validée** ». |
| `src/modules/orders/ui/storefront/orderValidation.helpers.ts:34` | « …n'est plus en statut Brouillon… » → « …n'est plus en attente de validation… ». |
| `src/modules/orders/ui/storefront/orderCancellation.helpers.ts:36` | Idem. |
| `src/modules/orders/ui/storefront/PortalOrderEditor.tsx:59` | « Modifiable tant que la commande est en brouillon. » → « Modifiable tant qu'elle est en attente de validation. ». |
| `src/modules/orders/ui/storefront/OrderHistoryTable.tsx:1121` | Infobulle bouton Éditer : « (statut brouillon uniquement) » → « (en attente de validation uniquement) ». |
| `src/modules/orders/ui/storefront/PortalThankYou.tsx:90` | « Commande confirmée » → « Commande transmise — en attente de validation par l'imprimeur ». Vérifié (comme l'exige le cadrage) : seul l'admin du tenant fait passer `draft` → `validated` (`20260509000100_e1_orders_v1_1.sql:247`, PRD FR49) ; `PortalOrders.tsx:7` confirme que la validation reste interne. |
| `src/modules/orders/ui/storefront/PortalCart.tsx` | (a) Badge Prix marché reformulé, mention Clariprint retirée. (b) Paragraphe « Vous recevrez un email de confirmation. » retiré entièrement (pas reformulé). (c) « Envoi direct atelier · Validation hiérarchique à venir. » + son infobulle retirés, remplacés par « Votre commande sera transmise à l'imprimeur, qui la validera. » sans infobulle. |
| `src/modules/orders/ui/storefront/PortalThankYou.tsx:120` (2e round) | Bandeau « Un email de confirmation sera envoyé prochainement à {email}. » retiré entièrement (pas reformulé) — même défaut que `PortalCart.tsx:417`, décidé applicable partout où la phrase apparaît. `userEmail` reste dans `Props` (signature du caller `PublicShop.tsx` inchangée) mais n'est plus affiché. |
| `src/modules/orders/ui/helpers/orderStatus.ts` (3e round) | Nouvel export `getOrderStatusLegendLabels()` : les 7 libellés canoniques (workflow + terminal, sans `pending`/`approved`), dans l'ordre du flux. |
| `src/modules/orders/ui/index.ts` (3e round) | Publie `getOrderStatusLegendLabels` (même discipline que `helpers/tax`), pour un import inter-module conforme à `modular-ui-boundaries.test.ts`. |
| `src/modules/roles/ui/workspace/OrderRolesPage.tsx:578` (3e round, arbitrage architecte) | Phrase en dur « Brouillon · En attente de validation · Validée · En production · Expédiée · Livrée · Facturée · Annulée » (8 items, dont un fantôme) → `{getOrderStatusLegendLabels().join(' · ')}` (7 items, tirés de la table unique). |

## Tests

- `tests/lib/orderStatus.test.ts` — assertions `draft` → « En attente de validation » (2 emplacements : `getStatusInfo`, `labelToStatus`).
- `tests/server/order_audit_trail.test.ts` — `formatAuditEventTitle` → « Statut : En attente de validation → Validée ».
- `tests/components/shop/portal/orderValidation.helpers.test.ts` et `orderCancellation.helpers.test.ts` — assertions de message d'erreur mises à jour.
- `tests/components/shop/portal/resumeBanner.helpers.test.ts` — nouveau cas `draft` prouvant la dérivation depuis la table unique.
- `tests/architecture/order-status-single-source.test.ts` (nouveau) — interdit toute seconde table de libellés de statut sous `src/modules/orders/ui/` (heuristique : ≥3 clés de statut canoniques comme clés d'objet littéral hors `orderStatus.ts`).
- `tests/components/shop/portal/PortalThankYou.test.ts` (étendu ×2), `PortalCart.text.test.ts`, `ValidateOrderConfirmDialog.text.test.ts`, `PortalOrderEditor.text.test.ts`, `OrderHistoryTable.text.test.ts` (nouveaux) — lecture de source (`readFileSync`), pattern déjà en usage dans ce dépôt pour les textes JSX (ex. `StorefrontUnavailable.test.ts`), puisque `@testing-library/react` est absent du dépôt et qu'aucun composant n'y est rendu en test.
- `tests/modules/roles/OrderRolesPage.text.test.ts` (nouveau, 3e round) — même pattern, vérifie l'appel à `getOrderStatusLegendLabels()` et l'absence de la phrase en dur.
- `tests/lib/orderStatus.test.ts` (étendu, 3e round) — `getOrderStatusLegendLabels()` retourne exactement les 7 libellés canoniques, dans l'ordre, sans doublon ni statut hérité.
- `tests/architecture/order-status-single-source.test.ts` (étendu, 3e round) — 2e `it` : refuse toute énumération en dur de ≥3 libellés canoniques (VALEURS, pas seulement clés), sous `src/modules/orders/` ET `src/modules/roles/` (portée élargie ; le 1er `it` ne couvrait que `src/modules/orders/ui/` et la forme « table à clés »).

**Preuve d'échec sur l'ancien code (exigée par la règle du mandat), en 3 vagues, chacune exécutée puis restaurée à l'identique (diff vérifié inchangé après restauration) :**
- **1re vague (round initial)** : `tests/architecture/order-status-single-source.test.ts` (1er `it`) rejoué contre le contenu `git show HEAD:...` des 3 anciens fichiers — `ResumeBanner.tsx` (6 clés), `PortalOrders.helpers.ts` (7 clés), `orderAuditTrail.helpers.ts` (7 clés) déclenchaient tous les trois le seuil (≥3). Puis les 11 fichiers source de ce round remis ensemble au contenu pré-story et les 12 fichiers de test rejoués : **11 fichiers de test sur 12 échouent, 14 assertions en échec**.
- **2e vague (retrait de `PortalThankYou.tsx:120`)** : `PortalThankYou.tsx` remis au contenu `git show HEAD:...` (post-1re-vague, donc avec le bandeau email encore présent) ; `tests/components/shop/portal/PortalThankYou.test.ts` rejoué : le nouveau cas (« ne promet plus un email de confirmation ») **échoue**, les autres passent.
- **3e vague (`OrderRolesPage.tsx:578`)** : `OrderRolesPage.tsx` remis au contenu `git show HEAD:...` (phrase de 8 items) ; `tests/architecture/order-status-single-source.test.ts` (2e `it`, nouveau) **échoue** en détectant les 7 libellés canoniques dans la phrase.
- Après chaque vague, le fichier a été restauré à son contenu de cette story (`git diff --stat` comparé avant/après pour confirmer l'identité), puis l'intégralité des gates rejouée au vert (section suivante, chiffres finaux).

## Gates (chiffres finaux, après les 3 vagues)

- `pnpm typecheck` : **vert**.
- Vitest ciblé (17 fichiers listés ci-dessus) : **97 passed | 3 skipped**.
- `pnpm test` (suite complète) : **2848 passed | 86 skipped**, 291 fichiers.
- `pnpm test:contract` : **432 passed** (23 fichiers) — aucun contrat touché par cette story (aucun endpoint modifié), rejoué par prudence.
- `pnpm test:architecture` : **195 passed** (43 fichiers), les 2 `it` du test étendu inclus.

## Écarts remontés, puis résolus dans ce même worktree

**`OrderRolesPage.tsx:578` — RÉSOLU par arbitrage architecte (§8.25 point 5.1,
« Arbitrage de l'architecte »).** Le huitième item (« Brouillon » +
« En attente de validation » adjacents) ne représentait AUCUN statut réel :
vestige du `pending_validation` de la maquette de Sally, jamais créé par
S-ORDER-ROLES (migration `20260609000200`, l. 20-21). Retiré, pas renommé.
L'écran lit désormais la table unique via `getOrderStatusLegendLabels()`
(nouveau, `orderStatus.ts`, publié par `orders/ui/index.ts`) — la liste
rendue est maintenant : « En attente de validation · Validée · En
production · Expédiée · Livrée · Facturée · Annulée » (7 items, 0 doublon).
La garde d'architecture est étendue pour refuser toute future récidive de ce
type (une énumération de labels écrite en dur), sous `src/modules/orders/`
ET `src/modules/roles/`.

**`PortalThankYou.tsx:120` — RÉSOLU par décision du coordinateur.** Même
défaut que `PortalCart.tsx:417` (`send-order-notification` n'écrit qu'aux
administrateurs du tenant, jamais à l'acheteur). Le bandeau « Un email de
confirmation sera envoyé prochainement à {email}. » est retiré entièrement,
pas reformulé — la règle vaut partout où la phrase apparaît, pas seulement
dans le point 5.1 littéral (qui ne citait que la ligne 90 du même fichier).
Recherche `grep` exhaustive menée sur `src/modules/orders/ui/storefront` et
`src/modules/shops/ui/storefront` (variantes « recevrez », « email/e-mail
de confirmation », « sera envoyé », « courriel », « notifi… ») : aucune
autre occurrence buyer-facing trouvée.

**Point signalé, non modifié (doute assumé, pas tranché en silence) :**
`RejectOrderConfirmDialog.tsx:9` (commentaire) et son texte visible
(« l'auteur sera prévenu de votre refus ») évoquent une « Notification
Resend déclenchée vers l'auteur (notify_policy du rôle) ». C'est un
mécanisme distinct de `send-order-notification` (workflow N+1 refus,
Sprint 6+, hors panier/remerciement), et « l'auteur » d'une commande n'est
pas nécessairement l'acheteur boutique — peut être un utilisateur atelier.
Sans certitude sur l'exactitude de cette promesse ni sur son destinataire
réel, elle n'a PAS été modifiée ; à vérifier séparément si jugé pertinent.

## Ce qui n'est PAS dans le périmètre

- Budget factice, « Livraison : Siège social » (BCP-8, Q5 non tranchée) — non touchés.
- Dimensions et finitions (BCP-7) — non touchés.
- `sheet.tsx`, `ShopLayout.tsx` (BCP-6/BCP-9, agent parallèle) — non touchés, vérifié négativement (`git diff --stat`).
- Tout fichier Clariprint — non touché, vérifié négativement.
- `openapi/` et `docs/api/CONVENTIONS.md` — non touchés (aucun endpoint créé/modifié par cette story).
- Aucun nouveau `data-testid` — aucun Hint DOM ne le demandait pour de simples changements de libellé ; aucun testid inventé.

## Recette navigateur (gestes pour la qa-review / recette humaine — non exécutés par cet agent, aucun serveur démarré)

**Côté boutique (acheteur), sur `/shop/<slug>`, session acheteur active :**
1. Ajouter un produit au panier, ouvrir le panier (`data-testid="shop-cart-drawer"`).
   - Vérifier la présence du texte « Votre commande sera transmise à
     l'imprimeur, qui la validera. » en bas du panier, et l'ABSENCE de
     « Envoi direct atelier · Validation hiérarchique à venir. » et de toute
     infobulle au survol de ce texte.
   - Si le panier contient une ligne en prix marché : vérifier le nouveau
     texte du badge orange (« Prix marché — au moins une ligne est une
     estimation Magrit. Le prix définitif sera confirmé par l'imprimeur à
     la validation de la commande. ») et l'absence de toute mention de
     Clariprint.
2. Cliquer « Passer commande » (`data-testid="shop-checkout-btn"`).
   - Vérifier l'ABSENCE totale du texte « Vous recevrez un email de
     confirmation. » sur l'écran ou le panier.
3. Sur l'écran de remerciement (`data-testid="shop-thank-you-page"`) :
   - Vérifier le titre « Commande transmise — en attente de validation par
     l'imprimeur » (et l'absence de « Commande confirmée »).
   - Vérifier l'ABSENCE totale du bandeau « Un email de confirmation sera
     envoyé prochainement à … » (retiré en 2e round, pas reformulé) : rien
     ne doit promettre un email à l'acheteur nulle part sur cet écran.
4. Aller sur « Mes commandes » (`PortalOrders`) :
   - Vérifier que la commande qui vient d'être créée affiche le badge
     « En attente de validation » (et non « Brouillon »).
5. Sur la fiche de la commande (`OrderHistoryTable`, ligne étendue) :
   - Passer la souris sur le bouton Éditer : vérifier l'infobulle « Modifier
     cette commande (en attente de validation uniquement) ».
   - Ouvrir l'éditeur de commande : vérifier « Modifiable tant qu'elle est
     en attente de validation. ».

**Côté atelier (imprimeur/admin tenant), sur le dashboard (`OrdersPage` /
`OrderHistoryTable` en mode `appearance="dashboard"`) :**
6. Repérer la même commande boutique `draft` : vérifier qu'elle affiche
   EXACTEMENT le même badge « En attente de validation » que côté acheteur
   (Q1 : une seule table, un seul mot des deux côtés).
7. Cliquer sur « Valider » pour ouvrir `ValidateOrderConfirmDialog` :
   vérifier le texte « La commande passera de **En attente de validation**
   à **Validée**. ».
8. Provoquer une race condition de validation (valider la commande depuis
   un autre onglet avant de confirmer ici) : vérifier que le message
   d'erreur contient « …n'est plus en attente de validation… » (pas
   « …statut Brouillon… »). Même vérification côté annulation
   (`orderCancellation.helpers`).
9. Ouvrir l'historique d'audit de la commande (`orderAuditTrail`) : vérifier
   la ligne « Statut : En attente de validation → Validée » après
   validation.
10. Sur la page des rôles de commande (`/t/:tenantSlug/dashboard/order-roles`,
    `OrderRolesPage`, bloc « Statuts personnalisés de commande — Lecture
    seule ») : vérifier que la liste affiche EXACTEMENT « En attente de
    validation · Validée · En production · Expédiée · Livrée · Facturée ·
    Annulée » (7 items) — sans « Brouillon », et sans « En attente de
    validation » en double.

Chaque geste ci-dessus crée ou modifie une vraie commande de recette ; son
sort (conservation ou nettoyage) appartient à Arnaud, comme pour le smoke
E2E de clôture du chantier §8.25.
