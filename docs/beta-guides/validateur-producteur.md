# Guide Validateur / Producteur — Magrit v1.1 bêta

> Cible : user assigné aux rôles Validateur (can_validate / can_cancel / can_modify / can_export) ou Producteur (can_modify / can_export) sur un tenant.

## 1. Accès

Tu as été invité par ton admin tenant avec un rôle Validateur ou Producteur (ou les deux via cumul).

- Si tu es **scope `magrit_full`** (accès complet tenant) : tu navigues `/t/<slug>/dashboard` comme un admin.
- Si tu es **scope `shop_only`** sur certaines boutiques : tu vois uniquement ces boutiques.

## 2. Validation commande (rôle Validateur)

Tu reçois un email Resend automatiquement quand :

- Une commande passe en `pending` ou `draft` selon la `notify_policy` du rôle actif sur la transition
- L'edge function `order-workflow-step` (S-N1-APPROVAL) calcule les destinataires selon :
  - **chain_next** : tu reçois si ton `ordering_index` est juste au-dessus du rôle actif (ex: tu es Validateur ord 40, le passeur Acheteur ord 30 vient de valider → tu reçois)
  - **all_roles** : tu reçois pour toutes les transitions de la commande
  - **none** : pas de notification (rôle silencieux)

**Email contient** : nom de la commande, transition (de X → vers Y), lien direct vers la commande dans ton tenant.

## 3. Actions disponibles selon tes capabilities

Le hook `useOrderRoles(orderId, userId)` calcule en temps réel ce que tu peux faire sur chaque commande, via le helper `canDoAction(action, state, orderStatus)`.

Matrice MVP :

| Capability | Action UI | Statuts cibles |
|---|---|---|
| `can_validate` | Bouton **Valider** | draft (→ validated) |
| `can_cancel` | Bouton **Annuler** | tous sauf terminaux (delivered, invoiced, cancelled). Self-service auteur sur draft. |
| `can_modify` | Bouton **Modifier statut** | validated → in_production → shipped → delivered |
| `can_export` | Bouton **Exporter** (3 dots menu) | tous statuts |

**Cumul de rôles** : si tu as Validateur + Acheteur, tes capabilities sont **OR cumulées** (helper `mergeCapabilities`).

## 4. Audit trail commande

**Composant `<OrderAuditTrailModal>`** (S3.5, à wirer dans OrderHistoryTable) :

Affiche la timeline UNION :

- **Status events** (`tenant_order_status_events`) : transitions draft → validated → in_production → shipped → ...
- **Role events** (`tenant_order_role_events`) : assignations / révocations / mises à jour capabilities

Tri DESC par `occurred_at`. Chaque entry montre acteur (email) + timestamp formaté + titre humain (ex: « Statut : Brouillon → Validée », « Rôle assigné : Validateur »).

Lecture seule. Tu vois l'historique de toutes les commandes de ton tenant (RLS via `tenant_id ∈ current_user_tenant_ids()`).

## 5. Mode Producteur

Si tu as `can_modify` (rôle Producteur ou Admin) :

1. Tu vois les commandes au statut `validated` dans le dashboard
2. Tu peux les faire avancer : `validated → in_production → shipped → delivered`
3. Chaque transition est notifiée selon `notify_policy` de ton rôle

**Export** : tu peux exporter les commandes en PDF devis / PDF facture / CSV récap (S5.2 Canva en attente, V2+).

## 6. Transitions illégales

La RPC `transition_tenant_order_status` (S-ORDER-ROLES-2) refuse les transitions hors matrice :

- `draft → shipped` (skip validated) → ❌ `transition_not_allowed`
- `cancelled → validated` (ressuscitation) → ❌ `transition_not_allowed`
- `validated → draft` (régression) → ❌ `transition_not_allowed`

Pour ajouter une transition custom à ton tenant, l'admin doit insert dans `tenant_order_status_transitions` (UI admin à venir, MVP via SQL pour l'instant).

## 7. Limites bêta

- ❌ Tabs filtrés « À valider » / « À produire » dans PortalOrders (S-ORDER-ROLES-3-UI) — pour l'instant, navigation par dashboard plat.
- ❌ Workflow N+1 chaîné automatique (post-validation déclenche auto la transition suivante) — pour l'instant, chaque transition est manuelle.
- ❌ Statuts custom par tenant (UI admin) — `tenant_order_status_definitions` extensible côté DB, UI à venir Sprint 10+ si demandé.
- ❌ Notifications Resend granulaires (par capability au lieu de par rôle) — V2+.
