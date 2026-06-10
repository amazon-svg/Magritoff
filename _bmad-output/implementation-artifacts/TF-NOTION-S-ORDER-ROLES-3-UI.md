---
story_id: S-ORDER-ROLES-3-UI
sprint_cible: Sprint 6+ (roadmap qualité-first)
created_at: 2026-06-10 (Amelia / Dev)
livrable: Cahiers de tests copy-paste pour la DB Notion 🧪 Cahiers de tests fonctionnels Magrit
notion_db_url: https://www.notion.so/7e576e695d504cc9a32ead92f4dde01c
---

# TF Notion — S-ORDER-ROLES-3-UI (4 cas + bonus)

> Lesson 2026-05-18 §distinction docs spec interne / artefacts copy-paste :
> ce fichier est destiné à être collé dans la DB Notion 🧪 Cahiers de tests
> fonctionnels Magrit. Un TF = une page de la DB. Chaque champ est prêt à
> copier dans la propriété Notion correspondante.

---

## TF-S-ORDER-ROLES-3-UI-01 — PortalOrders 4 tabs avec masquage conditionnel

**Titre** : Le tab "À valider" est masqué pour un acheteur sans capability can_validate

**Parcours** : P09 (Boutique portail B2B)

**Persona** : Acheteur B2B (shop_only, role Acheteur uniquement)

**Précondition** :
- User `emgaar@me.com` membre du tenant `imprimerie-ipa`, scope=shop_only, boutique ERAM
- Aucun rôle Validateur / Producteur assigné dans `tenant_role_assignments`
- Au moins 1 commande draft passée par cet user

**Étapes** :
1. Se connecter avec `emgaar@me.com` (compte cobaye Magrit)
2. Naviguer vers `/shop/xyfjjo-q6kekm/orders` (boutique ERAM)
3. Observer la barre de tabs en haut de la page

**Résultat attendu** :
- Tab "Mes commandes" est visible et actif par défaut
- Tab "À valider", "À approuver" et "À produire" sont **MASQUÉS** (pas d'élément DOM correspondant)
- Le compteur badge sur "Mes commandes" reflète le nombre de commandes de l'user

**Hints DOM** :
- `data-testid="shop-orders-tabs"` : conteneur des tabs
- `data-testid="shop-orders-tab-mine"` : tab Mes commandes
- `data-testid="shop-orders-tab-to-validate"` : absent du DOM
- `data-testid="shop-orders-tab-badge-count"` : badge compteur

**URL de départ** : `http://localhost:5177/login`

**Type d'exécution** : Manuel humain · IA Chrome (login bypass Playwright OK)

**Données de test** :
- Login : `emgaar@me.com` / [password à demander à Arnaud]
- Tenant : `imprimerie-ipa`
- Shop slug : `xyfjjo-q6kekm`

**Statut** : à jouer post-déploiement

---

## TF-S-ORDER-ROLES-3-UI-02 — Validateur final voit le tab "À approuver" avec badge compteur

**Titre** : Un validateur final (ordering_index=MAX) voit son tab "À approuver" avec le compteur de commandes draft à approuver

**Parcours** : P09 (Boutique portail B2B) — variante validateur

**Persona** : Validateur final tenant (rôle avec can_validate=true ET ordering_index = MAX)

**Précondition** :
- User connecté avec assignment actif sur un rôle ayant `can_validate=true` ET ordering_index maximal du tenant
- Au moins 1 commande status='draft' dans la boutique avec assignment `tenant_order_roles` (role_definition_id du validateur final, user_id=connected)

**Étapes** :
1. Se connecter avec un user validateur final (ex: `a.mazon@me.com` qui a tous les rôles via cumul Owner)
2. Naviguer vers `/shop/<slug>/orders`
3. Cliquer sur le tab "À approuver"

**Résultat attendu** :
- Tab "À approuver" visible avec badge compteur (ex: `(2)`)
- Au clic, la table affiche uniquement les commandes draft pour lesquelles le user est assigné comme validateur final
- Boutons par ligne : `[Valider]` + `[Refuser]` + `[Historique]`

**Hints DOM** :
- `data-testid="shop-orders-tab-to-approve"` : tab visible
- `data-testid="shop-orders-tab-badge-count"` : badge compteur > 0
- `data-testid="shop-order-validate-btn"` : bouton Valider
- `data-testid="shop-order-reject-btn"` : bouton Refuser

**URL de départ** : `http://localhost:5177/login`

**Type d'exécution** : Manuel humain · IA Chrome · SQL DB (vérif RPC `get_portal_orders_counters`)

**Données de test** :
- Login : `a.mazon@me.com` (cumul rôles Owner partout)
- Shop : Boutique Manitou (`91e77757-0f8e-4cbc-a6c1-659570e3f5f5`)
- Avant test : créer une commande draft + assigner `tenant_order_roles` avec role_definition_id du Validateur final

**Statut** : à jouer post-déploiement

---

## TF-S-ORDER-ROLES-3-UI-03 — Refus avec motif obligatoire transitionne draft → cancelled

**Titre** : Le validateur refuse une commande draft avec motif obligatoire, transition vers cancelled + notification déclenchée

**Parcours** : P09 + workflow N+1 (S-N1-APPROVAL)

**Persona** : Validateur tenant (rôle can_validate, can_cancel)

**Précondition** :
- Commande draft assignée au validateur connecté (tab "À valider" visible)
- Edge function `order-workflow-step` opérationnelle prod B5
- Auteur de la commande a un email valide pour réception Resend

**Étapes** :
1. Se connecter en tant que validateur
2. Naviguer vers `/shop/<slug>/orders?tab=to-validate`
3. Identifier la commande draft à refuser
4. Cliquer sur le bouton `[✕ Refuser]` de la ligne
5. Dans le dialog AlertDialog :
   - Vérifier le titre "Refuser cette commande ?" + short ID `CMD-XXXX`
   - Saisir un motif < 10 chars (ex: "non") → bouton `Refuser` désactivé
   - Saisir un motif valide (ex: "Budget T2 dépassé, commande refusée") → bouton activé
   - Cliquer `Refuser la commande`

**Résultat attendu** :
- Toast Sonner : `Commande refusée. L'auteur a été prévenu.`
- Dialog se ferme
- La ligne disparaît du tab "À valider" (status passé à cancelled)
- Le tab "Mes commandes" pour l'auteur affiche la commande avec statut "Annulée"
- Email Resend envoyé à l'auteur avec le motif
- Audit trail (modal Historique) contient un event `status_changed` avec `from=draft to=cancelled reason="Budget T2..."`

**Hints DOM** :
- `data-testid="shop-order-reject-btn"` : bouton Refuser
- `data-testid="shop-order-reject-dialog"` : AlertDialog
- `data-testid="shop-order-reject-reason-input"` : textarea motif
- `data-testid="shop-order-reject-dialog-confirm"` : bouton confirmation
- `data-testid="shop-order-reject-dialog-cancel"` : bouton Garder

**URL de départ** : `http://localhost:5177/shop/<slug>/orders?tab=to-validate`

**Type d'exécution** : Manuel humain · IA Chrome (test 3 étapes : refus court / refus long / vérif audit trail)

**Données de test** :
- Validateur : `a.mazon@me.com`
- Auteur cible : `emgaar@me.com` (notification Resend)
- Commande pré-créée draft

**Statut** : à jouer post-déploiement

---

## TF-S-ORDER-ROLES-3-UI-04 — Admin crée un nouveau Validateur via la page admin order-roles

**Titre** : Un admin tenant ajoute un Validateur 2 via la modale, le rôle apparaît dans le catalogue + le rail visuel

**Parcours** : P02 (Gestion utilisateurs) — variante workflow admin

**Persona** : Admin tenant (preset Admin, capability can_manage_roles=true depuis migration 2026-06-09)

**Précondition** :
- User admin connecté sur un tenant
- Aucun rôle `Validateur 2` n'existe encore dans le tenant (mais le rôle `Validateur` canonique seedé existe)

**Étapes** :
1. Naviguer vers `/t/<slug>/dashboard/order-roles`
2. Vérifier la présence du rail visuel (cards Acheteur → Validateur → Producteur)
3. Cliquer sur `+ Ajouter un rôle`
4. Dans la modale RoleEditorDialog :
   - Vérifier le nom auto-rempli "Validateur 2" (éditable)
   - Modifier vers "Direction Communication"
   - Cocher uniquement la capability `Valider`
   - Sélectionner notify_policy `Le rôle suivant uniquement`
   - Laisser scope sur `Tout l'espace`
   - Sélectionner position `Après « Validateur »`
   - Cliquer `Créer le rôle`

**Résultat attendu** :
- Dialog se ferme
- Le rail visuel se met à jour avec une nouvelle card "Direction Communication" entre Validateur et Producteur
- La table catalog affiche une nouvelle ligne avec :
  - Ordre = 45 (entre Validateur=40 et Producteur=50)
  - Nom = "Direction Communication"
  - Droits = badge `valider` uniquement
  - Notification = "Suivant"
  - Portée = "Espace"
  - Menu ⋯ disponible (Modifier / Dupliquer / Monter / Descendre / Archiver)
- Si on reclick `+ Ajouter un rôle`, l'auto-fill nom passe à "Validateur 3"

**Hints DOM** :
- `data-testid="order-role-page"` : page racine
- `data-testid="order-role-catalog-add-btn"` : bouton Ajouter
- `data-testid="order-role-editor-dialog"` : modale
- `data-testid="order-role-editor-name-input"` : champ nom
- `data-testid="order-role-editor-cap-validate"` : checkbox Valider
- `data-testid="order-role-editor-notify-chain-next"` : radio Suivant
- `data-testid="order-role-editor-scope-tenant"` : ToggleGroup tenant
- `data-testid="order-role-editor-position-select"` : select position
- `data-testid="order-role-editor-submit-btn"` : bouton Créer
- `data-testid="order-role-catalog-row"` : nouvelle ligne dans le tableau

**URL de départ** : `http://localhost:5177/t/imprimerie-ipa/dashboard/order-roles`

**Type d'exécution** : Manuel humain · IA Chrome · SQL DB (vérif `select * from tenant_role_definitions where name = 'Direction Communication'`)

**Données de test** :
- Login : `a.mazon@me.com` (Owner imprimerie-ipa, can_manage_roles=true)
- Tenant : `imprimerie-ipa`

**Statut** : à jouer post-déploiement

---

## TF-S-ORDER-ROLES-3-UI-05 (bonus) — Cohérence inter-écrans DashboardOrders ↔ PortalOrders

**Titre** : Les boutons d'action role-driven sont cohérents entre Dashboard admin et Portal acheteur (pas 2 systèmes UI)

**Parcours** : P02 + P09

**Persona** : Owner / Admin tenant + Acheteur (test croisé)

**Précondition** :
- 1 commande validée (status='validated') accessible côté Dashboard admin ET côté Portal acheteur (l'acheteur l'a passée puis elle a été validée)
- Producteur configuré avec un user

**Étapes** :
1. Connecter en tant qu'admin tenant (`a.mazon@me.com`)
2. Naviguer vers `/t/<slug>/dashboard/orders`
3. Sur la ligne de la commande validated → identifier le bouton `[Démarrer la production]`
4. **Sans cliquer**, ouvrir un 2e onglet/incognito en tant qu'acheteur (`emgaar@me.com`)
5. Naviguer vers `/shop/<slug>/orders?tab=mine`
6. Identifier la même commande dans "Mes commandes"
7. Sur la ligne, vérifier les boutons disponibles côté acheteur : `[Renouveler]` (validated v1.1) + `[Historique]`
8. **Pas de bouton "Démarrer la production"** côté acheteur (pas de can_modify via assignment workflow)

**Résultat attendu** :
- Côté admin : `[Démarrer la production]` + `[Annuler]` + `[Historique]`
- Côté acheteur : `[Renouveler]` + `[Historique]` UNIQUEMENT
- Pas de 2e set de boutons orphelins, pas de "modal Démarrer" qui pop chez l'acheteur
- Lesson 2026-05-25 §refonte non-cassante respectée

**Hints DOM** :
- `data-testid="shop-order-production-start-btn"` : présent côté admin, absent côté acheteur
- `data-testid="shop-order-renew-btn"` : présent côté acheteur, absent côté admin
- `data-testid="order-history-btn"` : présent des 2 côtés (universal)

**URL de départ** : 2 onglets/sessions

**Type d'exécution** : Manuel humain (cross-onglet/incognito) · IA Chrome (2 contextes)

**Données de test** :
- Admin : `a.mazon@me.com`
- Acheteur : `emgaar@me.com` (post auto-accept invitation)

**Statut** : à jouer post-déploiement (test de non-régression long-terme)

---

## Convention testIds — référence rapide

Toutes les testIds des 5 TF ci-dessus sont déclarées dans
[`src/app/lib/testIds.ts`](../../src/app/lib/testIds.ts) sous les scopes :
- `shop.orderRejectBtn` / `shop.orderRejectDialog` / etc.
- `shop.ordersTab*` / `shop.orderProductionStartBtn` / `shop.orderShippedBtn`
- `orderRole.*` (nouveau scope, page admin + modale)

Lesson 2026-05-08 §convention §4.4 : un testid ne se renomme pas à la
légère. Si l'un de ces tests Notion change un testid après livraison,
dual-tag pendant 1 sprint puis suppression.

---

## References

- [Story doc S-ORDER-ROLES-3](story-S-ORDER-ROLES-3-ui-portal-orders-roles.md)
- [Wireframes Sally](../../.design-handoff/wireframes/)
- [DB Notion 🧪 Cahiers de tests](https://www.notion.so/7e576e695d504cc9a32ead92f4dde01c)
- [DoD étendue qualité-first §5.2](../../docs/project-context.md)
