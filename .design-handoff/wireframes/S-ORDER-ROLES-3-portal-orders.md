# Wireframe lo-fi — PortalOrders refondu (4 tabs filtrés par rôle)

> **Story** : S-ORDER-ROLES-3 (Sprint 6+, roadmap qualité-first)
> **Écran** : `/shop/:slug/orders` (refonte du composant `PortalOrders.tsx` existant)
> **Persona ciblée** : acheteur B2B authentifié + validateur N + producteur (tabs masqués selon rôles)
> **Auteure** : Sally (BMAD UX) — session 2026-06-08
> **Status** : spec-ready dev, attente arbitrage Q1/Q2/Q3 Arnaud

---

## Résumé exécutif

PortalOrders devient le **hub unique commandes** côté boutique, segmenté en 4 tabs filtrés par rôle workflow. Chaque tab affiche un compteur badge à droite du libellé. Les tabs "À approuver" et "À produire" se **masquent** quand le user n'a aucune commande à traiter dans cette colonne (économie de SQL + clarté UX). Chaque ligne de commande affiche 1 à 3 boutons d'action contextuels (Valider / Annuler / Modifier / Exporter) résolus par `useOrderRoles(orderId, userId).capabilities` croisé avec `canDoAction(action, state, status)`. La sémantique des tabs reprend le vocabulaire workflow déjà acquis dans le design hi-fi 05 — **stepper dynamique** alimenté par `tenant_role_definitions` ordonnés par `ordering_index`, et non plus un workflow figé "Vous → N+1 → Achats → Magrit". L'objectif : faire matcher 1:1 ce que voit l'acheteur avec la chaîne réellement configurée par son admin tenant.

---

## Layout général (desktop, ≥ 1024 px)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  [Header co-brandé tenant × Magrit — déjà existant ShopHeader]                       │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                       │
│   Mes commandes                                                                       │
│   Toutes les commandes liées à votre activité dans cette boutique.                    │
│                                                                                       │
│  ┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐           │
│  │ Mes commandes ⓘ │ À valider  (3)  │ À approuver (1) │ À produire (0)  │           │
│  └━━━━━━━━━━━━━━━━━┴─────────────────┴─────────────────┴─────────────────┘           │
│                                                                                       │
│  ┌───────────────────────────────────────────────────────────────────────────────┐   │
│  │ Filtres                                                                       │   │
│  │  Statut: [ Tous ▼ ]   Période: [ 30 derniers jours ▼ ]   Min HT: [______]    │   │
│  │  [✕ Réinitialiser]                                                            │   │
│  └───────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                       │
│  ┌───────────────────────────────────────────────────────────────────────────────┐   │
│  │ Date  ▼ │ Réf       │ Articles               │ Total HT ▼ │ Statut       │ … │   │
│  ├─────────┼───────────┼────────────────────────┼────────────┼──────────────┼───┤   │
│  │ 08/06   │ CMD-2491  │ Cartes brandées 500 ex.│   78,00 €  │ Brouillon    │ ⋯ │   │
│  │         │ ●         │ + 2 autres             │            │ ┃ À valider  │   │
│  │         │           │                        │            │              │   │
│  │ Actions: [ Modifier ] [ Annuler ]                                  [ Historique ] │
│  ├───────────────────────────────────────────────────────────────────────────────┤   │
│  │ 06/06   │ CMD-2488  │ Flyers Viva Tech 2k ex.│  268,00 €  │ Validée      │ ⋯ │   │
│  │         │           │                        │            │ ▶ Achats     │   │
│  │ Actions: [ Renouveler ] [ Exporter ▾ ]                              [ Historique ] │
│  ├───────────────────────────────────────────────────────────────────────────────┤   │
│  │ 04/06   │ CMD-2486  │ Packaging kraft 250 ex.│  412,00 €  │ Annulée      │   │
│  │         │           │                        │            │              │   │
│  │ Actions: [ Renouveler ]                                              [ Historique ] │
│  └───────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                       │
│  [ Charger 25 commandes de plus ]    (si > 100 lignes — pagination "load more")      │
│                                                                                       │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

**Notes layout :**

- Header co-brandé (`ShopHeader` existant) inchangé, juste la sous-titre + tabs ajoutés en-dessous.
- Largeur max 5xl (cohérent avec `PortalOrders.tsx:163` existant `max-w-5xl mx-auto`).
- Tabs en shadcn `<Tabs>` underline variant (sobre, cohérent design tokens lovely).
- Filtres = composant `<OrderHistoryTable>` filtres déjà livré S3.1 (réutilisé tel quel, déjà testé).
- Pagination "load more" : déjà existant côté table, pas de changement.

---

## Tab 1 — Mes commandes (par défaut, jamais masqué)

**Filtre SQL** :
```sql
SELECT * FROM tenant_orders
WHERE shop_id = :shopId
  AND (created_by = auth.uid()
       OR id IN (SELECT order_id FROM tenant_order_roles
                 WHERE user_id = auth.uid()
                   AND revoked_at IS NULL
                   AND role_definition_id IN (
                     SELECT id FROM tenant_role_definitions
                     WHERE name IN ('Acheteur')
                   )))
ORDER BY created_at DESC
LIMIT 100;
```

**Sémantique** : "toutes les commandes où je suis impliqué en tant que passeur OU rôle Acheteur explicite (workflow paramétrable Q2 cumul)". Inclut les statuts terminaux (Livrée, Annulée, Facturée).

**Empty state** :
```
        ┌────────────────────────────────────────────┐
        │                                            │
        │         🛒  Aucune commande pour l'instant │
        │                                            │
        │   Vous n'avez encore rien commandé dans    │
        │   cette boutique. Parcourez le catalogue   │
        │   pour ajouter vos premiers articles.      │
        │                                            │
        │        [ Voir le catalogue → ]             │
        │                                            │
        └────────────────────────────────────────────┘
```

**Actions par ligne (sous-bloc déroulant en hover ou systématiquement visible sur desktop) :**

| Capability source | Bouton visible | Statut requis |
|---|---|---|
| `isCreator && status='draft'` | `Modifier` (S-ORDER-ROLES-3-UI scope futur) — désactivé MVP, tooltip "Bientôt disponible" | draft |
| `isCreator && status='draft'` OU `capabilities.can_cancel && !terminal` | `Annuler` (existant `shop-order-cancel-btn`) | draft, validated, in_production |
| `status` non-terminal v1.1 | `Renouveler` (existant `shop-order-renew-btn`) | validated, in_production, shipped, delivered |
| `capabilities.can_export` (toujours) | `Exporter ▾` (menu 3 options : PDF devis / PDF facture / CSV récap) | tout statut |
| toujours | `Historique` (icône `History`, ouvre `OrderAuditTrailModal` existant) | tout statut |

**Indicateur visuel de progression workflow** (colonne "Statut" enrichie) :

```
┌──────────────┐
│ Brouillon    │      ← libellé statut courant (texte FR)
│ ┃ À valider  │      ← prochaine étape (préfixe ┃ visuel = "en attente de")
└──────────────┘
```

Le préfixe `┃` (bar vertical) signale **l'étape suivante du workflow** alimentée par `tenant_role_definitions` ordonnées. Si le rôle suivant a un `name` long (> 14 char), on tronque avec ellipsis et `title` HTML pour fallback hover.

---

## Tab 2 — À valider (compteur badge `n`)

**Filtre SQL** :
```sql
SELECT * FROM tenant_orders o
JOIN tenant_order_roles r ON r.order_id = o.id
JOIN tenant_role_definitions d ON d.id = r.role_definition_id
WHERE r.user_id = auth.uid()
  AND r.revoked_at IS NULL
  AND d.capabilities->>'can_validate' = 'true'
  AND d.archived_at IS NULL
  AND o.status IN ('draft', 'pending_validation') -- statuts amont
  AND o.shop_id = :shopId
ORDER BY o.created_at ASC;  -- FIFO : le plus ancien à valider en premier
```

**Sémantique** : "commandes que JE dois valider, dans leur état amont — tri FIFO pour limiter les goulots". Tab visible **si et seulement si** le user a au moins 1 rôle avec `can_validate=true` configuré pour ce tenant (vérifié via une query `count` séparée, lazy au mount du tab).

**Empty state** :
```
        ┌────────────────────────────────────────────┐
        │                                            │
        │      ✓  Aucune commande à valider          │
        │                                            │
        │  Tout est à jour. Les nouvelles commandes  │
        │  s'afficheront ici dès qu'elles            │
        │  remonteront vers vous.                    │
        │                                            │
        └────────────────────────────────────────────┘
```

**Action principale par ligne** :

```
┌───────────────────────────────────────────────────────────────────┐
│ 08/06 · CMD-2491 · Léa G. (Communication Groupe)                  │
│ Cartes brandées 500 ex. + 2 autres                                │
│ Total HT : 758,00 €    Statut : ┃ En attente de votre validation  │
│                                                                   │
│   [ ✓ Valider ]   [ ✕ Refuser ]   [ Historique ]                  │
└───────────────────────────────────────────────────────────────────┘
```

- **Valider** → RPC `transition_tenant_order_status(orderId, next_status_from_matrix)` puis refresh `useOrderRoles`. Toast confirmation : *"Commande validée. Notification envoyée à [nom rôle suivant]."*
- **Refuser** → ouvre AlertDialog "Refus de la commande" avec champ `reason` (textarea obligatoire, 10-500 char) → RPC `transition_tenant_order_status(orderId, 'rejected', reason)`. Toast : *"Commande refusée. Léa G. a été notifiée."*
- **Historique** → `OrderAuditTrailModal` existant.

---

## Tab 3 — À approuver (visible uniquement validateur final)

**Visibilité du tab** : montré uniquement si le user a au moins 1 rôle où :
- `capabilities.can_validate = true`
- ET `ordering_index = MAX(ordering_index)` parmi les rôles avec `can_validate=true` du tenant
- ET au moins 1 commande en attente sur ce rôle.

Sinon tab **complètement masqué** (pas un tab grisé — la cohérence UX est meilleure quand on ne voit pas ce qui ne nous concerne pas).

**Filtre SQL** : identique au tab "À valider" mais le rôle assigné doit être le validateur final (ordering_index max du tenant).

**Empty state** : identique en sémantique "tout est à jour" mais microcopy spécifique :
```
        ┌────────────────────────────────────────────┐
        │                                            │
        │      ✓  Aucune approbation en attente      │
        │                                            │
        │  Les commandes vous remonteront ici une    │
        │  fois validées par les étapes précédentes. │
        │                                            │
        └────────────────────────────────────────────┘
```

**Actions par ligne** : strictement identiques au tab "À valider" — la distinction est sémantique (étape finale du workflow), pas fonctionnelle. Différencie pour l'utilisateur sa charge "validation intermédiaire" vs "approbation finale qui débloque la production".

---

## Tab 4 — À produire (visible uniquement Producteur)

**Visibilité du tab** : montré uniquement si le user a au moins 1 rôle où `name = 'Producteur'` (rôle canonique, non renommable par convention) assigné non-révoqué pour ce tenant.

**Filtre SQL** :
```sql
SELECT * FROM tenant_orders o
JOIN tenant_order_roles r ON r.order_id = o.id
JOIN tenant_role_definitions d ON d.id = r.role_definition_id
WHERE r.user_id = auth.uid()
  AND r.revoked_at IS NULL
  AND d.name = 'Producteur'
  AND o.status IN ('validated', 'in_production')
  AND o.shop_id = :shopId
ORDER BY o.created_at ASC;
```

**Empty state** :
```
        ┌────────────────────────────────────────────┐
        │                                            │
        │      🛠  Atelier au repos                  │
        │                                            │
        │  Aucune commande validée à produire pour   │
        │  l'instant. Les commandes apparaîtront     │
        │  ici dès leur approbation finale.          │
        │                                            │
        └────────────────────────────────────────────┘
```

**Actions par ligne** :

| Bouton | RPC | Confirmation |
|---|---|---|
| `Démarrer la production` | `transition_tenant_order_status(orderId, 'in_production')` | "Production démarrée. Léa G. notifiée." |
| `Marquer expédiée` | `transition_tenant_order_status(orderId, 'shipped')` | "Commande expédiée. Acheteur et admin notifiés." |
| `Signaler un problème` (V2+) | placeholder désactivé MVP | tooltip "Bientôt disponible" |
| `Historique` | `OrderAuditTrailModal` | — |

---

## Comportement transverse

### Compteurs badges

Chaque tab affiche un compteur en suffixe :
- `(3)` quand `n > 0`
- pas de badge quand `n = 0` (réduit le bruit visuel)
- `(99+)` au-delà de 99 (rare en pratique, anti-pattern de stress visuel)

Compteurs requêtés **en parallèle** au mount via une seule RPC agrégat `get_portal_orders_counters(p_shop_id, p_user_id)` qui retourne `{mine, to_validate, to_approve, to_produce}`. Évite 4 round-trips SQL.

### Refresh post-action

Toute action qui transitionne un statut OU révoque/assigne un rôle déclenche :
1. `refresh()` du hook `useOrderRoles` sur la ligne touchée (déjà exposé dans l'API du hook).
2. `loadOrders()` du parent `PortalOrders` (déjà existant).
3. `loadCounters()` (nouveau) pour rafraîchir les badges.
4. Toast `Sonner` succès/erreur Sally microcopy (voir §microcopy).

### Loading & error states

- **Loading initial** : skeleton 3 lignes (`<TableRowSkeleton>` Radix) sur le tab actif uniquement, badges affichent `…`.
- **Error fetch tab** : banner d'erreur en haut du tab `<Alert variant="destructive">` avec bouton "Réessayer" qui re-déclenche `loadOrders()`. Le tab reste accessible, juste avec son contenu indisponible.
- **Error RPC action** : toast `Sonner` rouge avec le message RPC renvoyé (déjà formaté côté `update_tenant_order_status` ex : "EMAIL_MISMATCH" → "Cette commande ne vous est pas adressée").

### Cohérence inter-écrans (lesson 2026-05-25)

⚠️ Le composant `<OrderHistoryTable>` (S3.1) est aussi utilisé dans `DashboardOrders` côté admin tenant. La refonte ne doit **pas** créer 2 systèmes côte à côte :

- Côté **DashboardOrders** (admin tenant) : conserve l'affichage actuel **mais** ajoute le même set de boutons d'action role-driven (Valider/Annuler/etc.) qui résolvent les capabilities **du super-admin tenant** (qui a toutes les capabilities par défaut côté `tenant_role_assignments`).
- Côté **PortalOrders** (acheteur shop) : ajoute les 4 tabs.
- **Aucun écran n'expose à la fois l'ancien système "tous les boutons sont là tout le temps" et le nouveau système role-driven** — le routage des boutons passe **uniquement** par `useOrderRoles + canDoAction`.

---

## Microcopy FR — brand voice Magrit

Style : direct, concret, orienté action. Pas de "Veuillez", pas de "Nous vous informons que". Verbe à l'impératif court ou nom d'objet sans politesse superflue.

### Labels tabs
- ✅ `Mes commandes` (familier, pronom possessif renforce "ce qui me concerne d'abord")
- ✅ `À valider` (verbe à l'infinitif, charge claire)
- ✅ `À approuver` (variant amont/aval intentionnel — voir Q2)
- ✅ `À produire` (impératif métier)

### Microcopy boutons

| Action | Label | Variante survol/tooltip |
|---|---|---|
| Validation | `Valider` (✓ icône lucide `Check`) | `Approuver cette commande et la faire avancer dans le circuit` |
| Refus | `Refuser` (✕ icône lucide `X`) | `Refuser cette commande avec une raison` |
| Annulation | `Annuler` (déjà existant) | inchangé |
| Renouveler | `Renouveler` (déjà existant) | inchangé |
| Modifier | `Modifier` (lucide `Pencil`) — désactivé MVP | tooltip "Bientôt disponible" |
| Exporter | `Exporter` ▾ (lucide `Download`) | Menu : `PDF devis`, `PDF facture`, `CSV récap` |
| Démarrer prod | `Démarrer la production` (lucide `Play`) | "Marque cette commande comme en cours de production" |
| Marquer expédiée | `Marquer expédiée` (lucide `Truck`) | "Indique que la commande a quitté l'atelier" |
| Historique | `Historique` (lucide `History`) | inchangé (déjà existant `f49926b`) |

### Toasts

Patterns Sonner cohérents avec le reste du projet :

| Contexte | Message |
|---|---|
| Validation OK | `Commande validée. {nom rôle suivant} a été prévenu.` |
| Refus OK | `Commande refusée. {nom acheteur} a été prévenu.` |
| Démarrage prod | `Production démarrée. {nom acheteur} a été prévenu.` |
| Expédition | `Commande expédiée. Acheteur et admin prévenus.` |
| Erreur RPC | `Action impossible : {message RPC mappé}` |

### Le mot "prévenu" plutôt que "notifié"

Choix volontaire (lesson 2026-05-22 bannir anglicismes/jargon). "Notifié" est jargon SaaS. "Prévenu" est français courant et plus chaleureux.

---

## Anticipation cardinalité (lesson 2026-05-25)

| Élément | Cardinalité actuelle | Cardinalité attendue | Pattern UI |
|---|---|---|---|
| Lignes commandes par tab | 5-20 | 100-500/an actif | Table virtuelle inutile MVP, pagination "load more" déjà OK |
| Compteur badge | 1-5 | jusqu'à 99+ | Suffixe `(99+)` au-delà |
| Tabs visibles | 1-4 selon user | max 4 | OK, pas d'overflow |
| Boutons actions par ligne | 1-3 | max 5 (Valider/Annuler/Renouveler/Exporter/Historique) | Si > 3 → bouton primaire + menu "⋯ Plus" |

---

## Tri colonnes (lesson 2026-05-25)

**Conservé du composant existant `<OrderHistoryTable>` S3.1** : tri 2-états maximum (asc ↔ desc), pas de cycle 3-états. Colonnes triables : Date, Total HT, Total TTC. Colonne Statut **non triable** (catégoriel → filtre dropdown, pas tri).

---

## Identifiants techniques (lesson 2026-05-25)

⚠️ **Aucun identifiant technique exposé en UI :**
- Référence commande : `CMD-XXXX` short id (`order.id.replace(/-/g, '').slice(0, 8).toUpperCase()`) — pattern déjà appliqué dans `CancelOrderConfirmDialog.tsx`.
- Nom acheteur : `customer_name` ou `auth.users.email` si nom absent, jamais UUID.
- Nom rôle suivant dans l'étape "┃ En attente de…" : `tenant_role_definitions.name` ("Direction Communication" pas `7a8b9c0d-...`).

---

## Accessibilité (DoD principe #10)

- **Tabs** : composant shadcn `<Tabs>` Radix-based → conformité ARIA native (`role="tablist"`, `aria-selected`, gestion clavier ←/→/Home/End).
- **Boutons actions** : libellé textuel toujours présent (jamais icône-seule), `aria-label` redondant pour les boutons icône (Historique, Refuser, Exporter).
- **Compteurs badges** : `aria-label="3 commandes à valider"` sur le span badge, le `(3)` visuel reste affiché.
- **Empty states** : icône décorative `aria-hidden="true"`, titre `<h3>` lecteur d'écran-friendly.
- **Toasts** : Sonner expose `role="status"` + `aria-live="polite"` par défaut. OK.

Routes à ajouter au scan `pnpm a11y:scan` (DoD principe #10) :
- `/shop/<slug>/orders?tab=mine`
- `/shop/<slug>/orders?tab=to-validate`
- `/shop/<slug>/orders?tab=to-approve`
- `/shop/<slug>/orders?tab=to-produce`

Note : le scan Playwright bypass-login (livré S9, commit `a8aeb94`) peut couvrir ces routes une fois un compte test avec validations en attente seedé.

---

## testIds à ajouter dans `src/app/lib/testIds.ts`

Scope `shop` étendu (cohérence avec convention §4.3 project-context) :

```typescript
// S-ORDER-ROLES-3-UI (Sprint 6+ — wireframes Sally 2026-06-08)
ordersTabs: 'shop-orders-tabs',
ordersTabMine: 'shop-orders-tab-mine',
ordersTabToValidate: 'shop-orders-tab-to-validate',
ordersTabToApprove: 'shop-orders-tab-to-approve',
ordersTabToProduce: 'shop-orders-tab-to-produce',
ordersTabBadgeCount: 'shop-orders-tab-badge-count',
ordersEmptyState: 'shop-orders-empty-state',
orderValidateBtnRole: 'shop-order-validate-btn-role', // distingue du orderValidateBtn admin existant
orderRejectBtn: 'shop-order-reject-btn',
orderRejectReasonInput: 'shop-order-reject-reason-input',
orderRejectDialog: 'shop-order-reject-dialog',
orderProductionStartBtn: 'shop-order-production-start-btn',
orderShippedBtn: 'shop-order-shipped-btn',
orderExportMenu: 'shop-order-export-menu',
orderExportPdfQuoteBtn: 'shop-order-export-pdf-quote-btn',
orderExportPdfInvoiceBtn: 'shop-order-export-pdf-invoice-btn',
orderExportCsvBtn: 'shop-order-export-csv-btn',
orderNextStepIndicator: 'shop-order-next-step-indicator', // le "┃ À valider"
```

---

## Compteurs RPC (à implémenter Sprint 6+)

```sql
-- Migration suivante : 20260608000100_portal_orders_counters.sql
CREATE OR REPLACE FUNCTION public.get_portal_orders_counters(
  p_shop_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE(mine int, to_validate int, to_approve int, to_produce int)
LANGUAGE plpgsql STABLE SECURITY INVOKER AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- mine
    (SELECT COUNT(*)::int FROM tenant_orders o
     WHERE o.shop_id = p_shop_id
       AND (o.created_by = p_user_id
            OR EXISTS (SELECT 1 FROM tenant_order_roles r
                       JOIN tenant_role_definitions d ON d.id = r.role_definition_id
                       WHERE r.order_id = o.id
                         AND r.user_id = p_user_id
                         AND r.revoked_at IS NULL
                         AND d.name = 'Acheteur'))),
    -- to_validate
    (SELECT COUNT(*)::int FROM tenant_orders o
     JOIN tenant_order_roles r ON r.order_id = o.id
     JOIN tenant_role_definitions d ON d.id = r.role_definition_id
     WHERE o.shop_id = p_shop_id
       AND r.user_id = p_user_id
       AND r.revoked_at IS NULL
       AND d.archived_at IS NULL
       AND (d.capabilities->>'can_validate')::boolean = true
       AND o.status IN ('draft', 'pending_validation')),
    -- to_approve (validateur final)
    (SELECT COUNT(*)::int FROM tenant_orders o
     JOIN tenant_order_roles r ON r.order_id = o.id
     JOIN tenant_role_definitions d ON d.id = r.role_definition_id
     WHERE o.shop_id = p_shop_id
       AND r.user_id = p_user_id
       AND r.revoked_at IS NULL
       AND (d.capabilities->>'can_validate')::boolean = true
       AND d.ordering_index = (
         SELECT MAX(ordering_index) FROM tenant_role_definitions
         WHERE tenant_id = (SELECT tenant_id FROM tenant_orders WHERE id = o.id)
           AND (capabilities->>'can_validate')::boolean = true
           AND archived_at IS NULL
       )
       AND o.status IN ('pending_validation')),
    -- to_produce
    (SELECT COUNT(*)::int FROM tenant_orders o
     JOIN tenant_order_roles r ON r.order_id = o.id
     JOIN tenant_role_definitions d ON d.id = r.role_definition_id
     WHERE o.shop_id = p_shop_id
       AND r.user_id = p_user_id
       AND r.revoked_at IS NULL
       AND d.name = 'Producteur'
       AND o.status IN ('validated', 'in_production'));
END;
$$;
```

(Sera affiné en story doc Dev pour matcher exactement les statuts terminaux et l'ADR matrice de transitions Sprint 6.)

---

## Différé V2+

- **Saut de tab par notification email** (lien direct vers `/shop/:slug/orders?tab=to-validate&order=CMD-XXX`) — requiert tracking deep-link.
- **Approbation groupée** (cocher 3 commandes, cliquer "Valider tout") — UX bonus si le volume justifie.
- **Notifications in-app temps réel** (Realtime Supabase) — V2, MVP suffit en polling au mount + refresh post-action.
- **Filtres avancés "Mes rôles sur cette commande"** (badges colorés par rôle dans la table) — V2.

---

## References

- [Story S-ORDER-ROLES-3 (spec)](../_bmad-output/implementation-artifacts/story-S-ORDER-ROLES-3-ui-portal-orders-roles.md)
- [Hook useOrderRoles livré Sprint 6](../../src/app/hooks/useOrderRoles.ts)
- [PortalOrders existant à refondre](../../src/app/components/shop/portal/PortalOrders.tsx)
- [OrderHistoryTable réutilisé](../../src/app/components/shop/portal/OrderHistoryTable.tsx)
- [Design hi-fi 05 Portail B2B (référence visuelle)](../designs/05%20-%20Portail%20B2B.html)
- [Lesson 2026-05-25 ne pas exposer slugs UI](~/.claude/projects/-Users-arnaudmazon-Documents-Claude-BMAD-Magrit/memory/feedback_*.md)
- [DoD étendue qualité-first §5.2 project-context](../../docs/project-context.md)
