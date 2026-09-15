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
  n'écrit qu'aux administrateurs du tenant) : SUPPRIMÉ, pas reformulé.
- Textes du panier (`PortalCart.tsx:417,428`) et libellé du badge « Prix
  marché » (`PortalCart.tsx:349`) corrigés selon §8.25.
- Hors périmètre : budget factice et « Livraison : Siège social » (lot 8,
  Q5 non tranchée), dimensions et finitions (lot 7).

## Critères d'acceptation — un par un

| # | Critère (cadrage §8.25 point 5.1) | Statut | Preuve |
|---|---|---|---|
| 1 | `orderStatus.ts` (`STATUS_LABELS`) devient la SEULE table de libellés de statut sous `src/modules/orders/ui/` ; `draft` → « En attente de validation » | **Fait** | `src/modules/orders/ui/helpers/orderStatus.ts` ; `tests/lib/orderStatus.test.ts` (assertions `getStatusInfo("draft").label` et `labelToStatus("En attente de validation")`) |
| 2 | `PortalOrders.helpers.ts` (STATUS_LABELS) devient un import/dérivé, pas une seconde table | **Fait** | `PortalOrders.helpers.ts` ré-exporte `STATUS_LABELS` de `orderStatus.ts` ; `tests/components/shop/portal/PortalOrders.helpers.test.ts` (inchangé, toujours vert car le ré-export porte les mêmes clés) |
| 3 | `orderAuditTrail.helpers.ts` (STATUS_LABELS_FR) devient un import/dérivé | **Fait** | `formatAuditEventTitle` appelle `getStatusInfo(...).label` ; `tests/server/order_audit_trail.test.ts` (« Statut : En attente de validation → Validée ») |
| 4 | `ResumeBanner.tsx` (STATUS_LABELS en ligne) reste une forme DÉRIVÉE, pas une seconde table | **Fait** | `statusLabel()` dérive `getStatusInfo(status).label` (minuscule initiale) ; `tests/components/shop/portal/resumeBanner.helpers.test.ts` (nouveau cas `draft` → contient « en attente de validation », pas « brouillon ») |
| 5 | Un test échoue si une seconde table de libellés de statut réapparaît sous `src/modules/orders/` | **Fait** | `tests/architecture/order-status-single-source.test.ts` (nouveau). Preuve d'échec sur l'ancien code : rejoué contre les 3 anciennes versions des fichiers via `git show HEAD:...` — `ResumeBanner.tsx` (6 clés), `PortalOrders.helpers.ts` (7 clés), `orderAuditTrail.helpers.ts` (7 clés) étaient tous les trois en défaut |
| 6 | Q1 : l'atelier voit le même mot que l'acheteur (`ValidateOrderConfirmDialog`, `orderValidation.helpers`, `orderCancellation.helpers`, `PortalOrderEditor`, infobulle `OrderHistoryTable`) | **Fait, sauf `OrderRolesPage.tsx:578` — voir « Écart remonté »** | Détail par fichier ci-dessous |
| 7 | Écran de remerciement : « Commande transmise — en attente de validation par l'imprimeur » | **Fait** | `PortalThankYou.tsx:90` ; `tests/components/shop/portal/PortalThankYou.test.ts` (nouveau describe, `toContain`/`not.toContain`) |
| 8 | Panier : « Vous recevrez un email de confirmation. » supprimé, pas reformulé | **Fait** | `PortalCart.tsx` (bloc retiré) ; `tests/components/shop/portal/PortalCart.text.test.ts` (nouveau) |
| 9 | Panier : nouveau texte « Votre commande sera transmise à l'imprimeur, qui la validera. », infobulle N+1 retirée | **Fait** | `PortalCart.tsx:428` (ancien numéro de ligne) ; même test |
| 10 | Panier : badge Prix marché reformulé, sans mention Clariprint | **Fait** | `PortalCart.tsx:349` (ancien numéro de ligne) ; même test |
| 11 | Hors périmètre : budget factice, « Livraison : Siège social », dimensions/finitions | **Respecté — non touché** | Vérifié négativement : `budget`, `BudgetInfo`, `Livraison : Siège social`, `formatDimensionsMm` absents du diff |

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

## Tests

- `tests/lib/orderStatus.test.ts` — assertions `draft` → « En attente de validation » (2 emplacements : `getStatusInfo`, `labelToStatus`).
- `tests/server/order_audit_trail.test.ts` — `formatAuditEventTitle` → « Statut : En attente de validation → Validée ».
- `tests/components/shop/portal/orderValidation.helpers.test.ts` et `orderCancellation.helpers.test.ts` — assertions de message d'erreur mises à jour.
- `tests/components/shop/portal/resumeBanner.helpers.test.ts` — nouveau cas `draft` prouvant la dérivation depuis la table unique.
- `tests/architecture/order-status-single-source.test.ts` (nouveau) — interdit toute seconde table de libellés de statut sous `src/modules/orders/ui/` (heuristique : ≥3 clés de statut canoniques comme clés d'objet littéral hors `orderStatus.ts`).
- `tests/components/shop/portal/PortalThankYou.test.ts` (étendu), `PortalCart.text.test.ts`, `ValidateOrderConfirmDialog.text.test.ts`, `PortalOrderEditor.text.test.ts`, `OrderHistoryTable.text.test.ts` (nouveaux) — lecture de source (`readFileSync`), pattern déjà en usage dans ce dépôt pour les textes JSX (ex. `StorefrontUnavailable.test.ts`), puisque `@testing-library/react` est absent du dépôt et qu'aucun composant n'y est rendu en test.

**Preuve d'échec sur l'ancien code (exigée par la règle du mandat) :**
- `tests/architecture/order-status-single-source.test.ts` : rejoué contre le contenu `git show HEAD:...` des 3 anciens fichiers (avant tout changement de cette story) — `ResumeBanner.tsx` (6 clés de statut en dur), `PortalOrders.helpers.ts` (7 clés), `orderAuditTrail.helpers.ts` (7 clés) déclenchaient tous les trois le seuil de détection (≥3). Après la story, 0 fichier hors `orderStatus.ts` ne déclenche le seuil.
- **Exécution réelle, tous les fichiers source à la fois** : les 11 fichiers source modifiés ont été remis un par un au contenu `git show HEAD:<fichier>` (pré-story), puis les 12 fichiers de test concernés ont été rejoués ensemble. Résultat : **11 fichiers de test sur 12 échouent, 14 assertions en échec** (`orderStatus.test.ts` ×2, `order_audit_trail.test.ts`, `orderCancellation.helpers.test.ts`, `orderValidation.helpers.test.ts`, `resumeBanner.helpers.test.ts`, et les 5 tests de source neufs `PortalThankYou`, `PortalCart.text`, `ValidateOrderConfirmDialog.text`, `PortalOrderEditor.text`, `OrderHistoryTable.text` — seul `PortalOrders.helpers.test.ts` reste vert, car son assertion pré-existante ne fixait qu'un label non vide, pas le texte exact). Les 11 fichiers source ont ensuite été restaurés à leur contenu de cette story, et l'intégralité des gates (`typecheck`, `pnpm test`, `test:contract`, `test:architecture`) rejouée au vert (section suivante).

## Gates

- `pnpm typecheck` : **vert**.
- Vitest ciblé (tests listés ci-dessus, 13 fichiers) : **96 passed | 3 skipped**.
- `pnpm test` (suite complète) : **2842 passed | 86 skipped**, 290 fichiers.
- `pnpm test:contract` : **432 passed** (23 fichiers) — aucun contrat touché par cette story (aucun endpoint modifié), rejoué par prudence.
- `pnpm test:architecture` : **194 passed** (43 fichiers), nouveau test inclus.

## Écart remonté — pas tranché en silence

**`OrderRolesPage.tsx:578`** (bloc « Statuts personnalisés de commande »,
placeholder V2, lecture seule) contient déjà, AVANT cette story, la
séquence : « Brouillon · **En attente de validation** · Validée · En
production · Expédiée · Livrée · Facturée · Annulée » (8 items pour 7
statuts canoniques). Le cadrage cite ce fichier/ligne comme suivant le même
renommage que les autres textes nommant « Brouillon ». Appliqué littéralement,
le renommage produirait un doublon adjacent : « En attente de validation ·
En attente de validation · Validée · … ».

Hypothèse la plus probable : le second item anticipait déjà, depuis la
création de la page (`S-ORDER-ROLES-3-UI`, Sprint 6, statut d'approbation
N+1), un futur statut distinct (`pending_approval_n1`) sous le même
intitulé français que celui que Q1 réutilise aujourd'hui pour `draft` — pure
coïncidence de vocabulaire entre deux statuts différents, pas une erreur de
saisie évidente à corriger sans arbitrage.

**Décision prise : ne pas toucher ce fichier.** Un doublon visible dans un
placeholder « lecture seule — édition à venir » est un défaut mineur, mais
il est facilement identifiable a posteriori et sa correction dépend d'un
fait que je n'ai pas (le second item désigne-t-il vraiment un état futur
distinct, ou est-ce une redite à supprimer ?). Remonté à l'architecte /
Arnaud pour arbitrage avant toute édition de ce fichier.

**Constat additionnel, également remonté :** `PortalThankYou.tsx:120`
affiche « Un email de confirmation sera envoyé prochainement à {email}. »
— la même promesse fausse que celle retirée de `PortalCart.tsx:417`
(`send-order-notification` n'écrit qu'aux administrateurs du tenant,
constat 1(6) du cadrage). Cette ligne n'est PAS citée par le point 5.1 du
cadrage (qui ne nomme que `PortalThankYou.tsx:90`), donc non touchée par
cette story — mais elle porte le même défaut et mérite un arbitrage
explicite (probable BCP-5 bis, ou ajout au point 5.1).

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
10. Sur la page des rôles de commande (`OrderRolesPage`) : noter, sans agir
    (écart remonté ci-dessus), que le bloc « Statuts personnalisés de
    commande » affiche toujours « Brouillon · En attente de validation ·
    … » — signaler à l'architecte si ce doublon visible gêne la recette.

Chaque geste ci-dessus crée ou modifie une vraie commande de recette ; son
sort (conservation ou nettoyage) appartient à Arnaud, comme pour le smoke
E2E de clôture du chantier §8.25.
