# Guide Acheteur B2B — Magrit v1.1 bêta

> Cible : acheteur B2B d'un client de l'imprimeur (ex: équipe ERAM commandant chez Imprimerie IPA).

## 1. Accès à ta boutique

Tu as été invité par ton admin tenant. Au login :

- Si ton accès est **scope `shop_only`** sur 1 seule boutique → tu es **redirigé automatiquement** vers `/shop/<slug>` (depuis Sprint 5 fix `60bb45c`).
- Si tu as accès à plusieurs boutiques → TenantPicker propose le choix.

Tu ne vois **PAS** les autres tenants ni les sous-tenants — uniquement les boutiques de `allowed_shop_ids` autorisées.

## 2. Recherche IA Magrit

**Route** : `/shop/<slug>/portal` (recherche guidée IA)

1. Décris ton besoin en langage naturel : *« 500 cartes de visite 350g pelliculage mat »*
2. L'IA Magrit propose 3 configurations Clariprint
3. Clic une carte → ajout au panier

**Modes** (E2.x Sprint 1) :
- **Ouvert** : Magrit interprète librement, fait des hypothèses
- **Strict** : Magrit demande précision dès qu'une option est ambiguë (chips cliquables)

**Persistance** : tes conversations restent ouvertes au tab focus + F5 (clé localStorage `magrit_current_conversation__<tenant_id>`, fix `acb7352`).

## 3. Panier et commande

Quand tu valides ton panier :

1. **Connexion requise** (décision Arnaud B2 — acheteur B2B avec compte tenant)
2. Insert `tenant_orders` + `tenant_order_items` (ADR-ORDERS-1)
3. Status initial : `draft`
4. Notification email part automatiquement aux validateurs du tenant
5. Page de confirmation `PortalThankYou`

**Self-service** : tu peux **annuler ta propre commande tant qu'elle est en draft** (Sprint 5 S3.4). Pour les transitions ultérieures, ton admin tenant gère.

## 4. Historique commandes

**Route** : `/shop/<slug>/orders`

Tu vois **uniquement tes commandes** (RLS strict sur `tenant_orders` via `created_by = auth.uid()` OU `customer_email = auth.email()` pour cohort shop_orders legacy).

**Filtres** (S3.1) : statut / période (7j / 30j / 90j / année) / montant min.

**Tri** : Date / Total HT / Total TTC.

**Renouveler 1-clic** (S3.3) : bouton sur les commandes non-draft → rebuild cart + warnings produits indispo.

## 5. Visuels produits

Quand tu navigues le catalogue, chaque produit affiche un **mockup généré dynamiquement** :

- PNG produit transparent généré côté edge (`mockup-generator`, cache CDN 24h)
- Fond shop superposé via CSS `background-image` (composition layered V5)
- 5 templates SVG photo-réalistes (V6) : flyer, carte visite, brochure, étiquette, kakemono
- Vues recto/verso pour flyer + carte visite (V7 S-PRODUCT-VIEWS-MULTI)

Le fond et la couleur primaire dépendent de la configuration de ta boutique par l'admin tenant.

## 6. AskMagrit pendant la commande

Tu peux poser une question IA à tout moment via le widget chat — l'IA t'aide à comparer 2 options, expliquer une finition (pelliculage mat vs brillant), confirmer un délai.

L'IA est connectée à Clariprint pour les vrais devis + utilise Sonnet 4.5 (raisonnement) ou Haiku 4.5 (génération rapide).

## 7. Limites bêta

- ❌ Refonte UI tabs PortalOrders : pour l'instant, vue plate filtrée. Tabs « Mes commandes / À valider / À approuver / À produire » à venir (S-ORDER-ROLES-3-UI).
- ❌ Modale historique audit trail : bouton à wirer (S3.5 composant prêt).
- ❌ Vue 3D packaging : tracé V2+ quand catalogue packaging arrive.
