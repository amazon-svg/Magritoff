# Guide Acheteur B2B — Magrit v1.1 bêta

> Cible : acheteur B2B d'un client de l'imprimeur (ex: équipe ERAM commandant chez Imprimerie IPA).

## 1. Accès à ta boutique

Ton administrateur crée un compte client dans **cette boutique**, puis te
transmet un lien d’activation à usage unique. Tu choisis ton mot de passe et te
connectes ensuite depuis `/shop/<slug>`.

- Une boutique **sur invitation** ne montre ni son catalogue ni son identité
  avant connexion et ne propose aucune inscription libre.
- Ton compte n’existe que dans cette boutique.
- Utiliser le même email dans une autre boutique nécessite un second compte et
  une autre activation.
- Un compte Magrit utilisé par l’équipe de l’imprimeur ne donne aucun accès
  client à la boutique.

Tu ne vois jamais les tenants, sous-espaces ou autres boutiques depuis cette
session storefront.

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

1. **Session storefront requise**, directe ou déléguée par un opérateur Magrit
2. Création atomique via l’API Orders (`tenant_orders` +
   `tenant_order_items`, ADR-ORDERS-1)
3. Status initial : `draft`
4. Notification email part automatiquement aux validateurs du tenant
5. Page de confirmation `PortalThankYou`

**Self-service** : tu peux **annuler ta propre commande tant qu'elle est en draft** (Sprint 5 S3.4). Pour les transitions ultérieures, ton admin tenant gère.

## 4. Historique commandes

**Route** : `/shop/<slug>/orders`

Tu vois **uniquement les commandes de ton compte dans cette boutique**. Le
serveur filtre par `shop_customer_account_id` et `shop_id`, pas par une identité
Magrit transverse.

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
- ❌ Le mode historique `self_signup` n’est pas encore refondu sur les nouveaux
  comptes boutique ; utiliser le mode sur invitation pour les tests.
