# Guide Admin tenant — Magrit v1.1 bêta

> Cible : dirigeant imprimeur Pro / admin tenant qui pilote son espace Magrit.

## 1. Onboarding initial

Quand ton tenant est créé par Arnaud :

1. Tu reçois un email d'invitation → clic sur le lien `/invitations/<token>`
2. Création de ton mot de passe
3. Accès direct à `/t/<slug>/dashboard`

Si l'invitation est envoyée à un autre email que celui que tu utilises, la RPC `accept_tenant_invitation` te bloque avec un message **« Cette invitation est destinée à X, vous êtes connecté en tant que Y »**. Déconnecte-toi puis reconnecte avec le bon compte.

## 2. Inviter ton équipe

**Route** : `/t/<slug>/dashboard/users`

Pour chaque membre à inviter :

1. Clic **Inviter un utilisateur**
2. Email + sélection des rôles (Acheteur / Validateur / Producteur / Admin)
3. Si scope `shop_only` (acheteur dédié à 1 ou N boutiques) : sélectionne les boutiques autorisées
4. Envoyer → email Resend partira automatiquement

**Garde-fous bêta** :
- Pas de doublon : si une invitation pending existe déjà pour cet email/tenant, le système te bloque avec **« duplicate_pending »** + l'id de l'invitation existante (renvoie-la via le bouton Renvoyer plutôt qu'en créer une nouvelle).
- Rôles strictement du tenant : tu ne peux pas assigner un rôle d'un autre tenant (impossible côté UI mais durci côté serveur depuis Sprint 9 = `role_mismatch_tenant`).
- Capability requise : ton compte doit avoir `can_invite` pour inviter (Owner et Admin presets l'ont par défaut).

## 3. Gérer les rôles de ton catalogue

**Route** : `/t/<slug>/dashboard/users` section « Rôles et droits »

5 rôles presets seedés à la création de ton tenant :

| Rôle | can_quote | can_order | can_invite | can_validate | can_cancel | can_modify | can_export | can_manage_catalog | can_manage_roles |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Owner | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |   |
| Acheteur | ✓ | ✓ |   |   |   |   |   |   |   |
| Validateur |   |   |   | ✓ | ✓ | ✓ | ✓ |   |   |
| Producteur |   |   |   |   |   | ✓ | ✓ |   |   |

Tu peux **assigner plusieurs rôles à un même user** (cumul) : ex Acheteur + Validateur pour un dirigeant qui passe des commandes pour lui-même et les valide.

## 4. Sous-tenants (filiales multi-sites)

**Route** : `/t/<slug>/spaces`

Si ton imprimerie a plusieurs sites (Paris + Lyon + Bordeaux), crée un sous-tenant par site :

1. Clic **Créer un sous-espace**
2. Nom + slug
3. Le sous-tenant hérite automatiquement de tes gammes PIM, des 5 rôles presets, des 7 statuts canoniques

**KPIs HQ consolidés** (Sprint 8 V4) : chaque carte sous-tenant affiche **nb commandes du mois + CA HT du mois**.

**Affectation personnel** : un user appartient à **un seul sous-tenant à la fois**. Pour déplacer un user de Paris → Lyon, utilise le bouton **Déplacer** (RPC `move_user_between_subtenants` atomique).

**Sécurité** : seuls les admins du parent peuvent gérer les sous-tenants (RPC SECURITY DEFINER + check parent_match).

## 5. Visuels boutique

**Route** : `/t/<slug>/dashboard/shops/<shop_id>` section « Visuels de la boutique » (V4 Sprint 7)

Pour chaque boutique tu peux configurer :

- **Fond global** : choix dans la bibliothèque Magrit (10 fonds curatés Sally) OU upload custom (JPG/PNG/WebP max 5 MB)
- **Couleur primaire** : utilisée dans les templates SVG mockup (carte de visite liseré, flyer texte, etc.)
- **Override par gamme** : tu peux assigner un fond différent par gamme (ex: fond marbre pour cartes de visite, fond kraft pour étiquettes)

Cascade de résolution : **gamme > shop > default Magrit**. Le helper SQL `resolve_shop_background(shop_id, gamme_slug)` est appelé côté front au rendu mockup.

**Composition layered** (V5) : le fond est appliqué via CSS `background-image` sur le wrapper du PNG produit (transparent). Le PNG reste cacheable indépendamment du fond — changement de fond instantané sans regénération.

## 6. Validation et workflow N+1

Quand un acheteur passe commande (status `draft`) :

1. Notification email partira automatiquement aux destinataires selon `notify_policy` du rôle actif (chain_next / all_roles / none)
2. Tu accèdes à `/t/<slug>/dashboard/orders` pour voir la commande
3. Bouton **Valider** (draft → validated) — réservé aux comptes avec `can_validate` ou rôle owner/admin
4. Bouton **Annuler** (draft → cancelled) — réservé aux comptes avec `can_cancel` ou auteur self-service

**Matrice transitions canoniques v1.1** (8 transitions seedées par tenant) :

| De | Vers | Capability requise | Self-service auteur |
|---|---|---|---|
| draft | cancelled | can_cancel | ✓ (acheteur peut annuler sa draft) |
| draft | validated | can_validate | ✗ |
| validated | cancelled | can_cancel | ✗ |
| validated | in_production | can_modify | ✗ |
| in_production | shipped | can_modify | ✗ |
| in_production | cancelled | can_cancel | ✗ |
| shipped | delivered | can_modify | ✗ |
| delivered | invoiced | can_export | ✗ |

**Audit trail** : chaque transition est journalisée dans `tenant_order_status_events`. Le composant `<OrderAuditTrailModal>` (S3.5, à wirer) affichera l'historique complet incluant aussi les assignations/révocations de rôles depuis `tenant_order_role_events`.

## 7. Sécurité & limites

- **Email guard** sur acceptation invitation (faille colmatée 2026-05-27) : seul le compte dont l'email correspond peut accepter.
- **JWT auth check** sur invite-member (Sprint 9 hardening) : forgery du champ invited_by bloquée.
- **Idempotence** invitations : doublon pending même email/tenant → 409.
- **RLS strict** sur toutes les tables : un user ne voit que son tenant + sous-tenants accessibles via héritage.

## 8. Ce que tu ne peux PAS faire en bêta v1.1

- ❌ Page admin catalog rôles `/t/:slug/admin/order-roles` (tracée S-ORDER-ROLES-3-UI)
- ❌ Tabs filtrés PortalOrders (Mes commandes / À valider / À approuver / À produire) — UI plate pour l'instant
- ❌ Wire-up `<OrderAuditTrailModal>` historique (composant prêt côté backend, intégration UI à venir)
- ❌ Visuels packaging 3D (tracé S-PRODUCT-VIEWS-3D-PACKAGING pour V2+ quand le catalogue packaging arrive)
- ❌ Marketplace de fonds Canva-like (V3+)
