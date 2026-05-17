---
story_id: S-DUAL-READ
epic: Sprint 4 — PIM-Boutique-Commandes (Phase 1 Bascule orders)
title: PortalOrders dual-read shop_orders (legacy) UNION tenant_orders (v1.1)
status: draft
target_branch: beta/v5
agent: Dev (Claude Code) + UX consultation (Sally pour design badge "Legacy" + tri)
size: S (~1j)
depends_on: S-MIGRATION-ORDERS (les nouvelles commandes doivent atterrir dans tenant_orders pour qu'il y ait quelque chose à dual-read)
unblocks: S3.1 OrderHistoryTable (qui étendra PortalOrders avec filtres avancés)
adr_ref: architecture.md §4.10 ADR-ORDERS-1
ux_consultation: requise (badge "Legacy" sur cohort shop_orders, tri merged)
---

# Story S-DUAL-READ — PortalOrders dual-read

## Story (As / I want / So that)

**As an** acheteur B2B qui consulte son historique de commandes sur la boutique
**I want** voir l'ensemble de mes commandes peu importe leur âge (anciennes avant la bascule modèle + nouvelles post-bascule), avec un indicateur visuel léger pour distinguer les commandes legacy des nouvelles
**So that** la bascule du modèle d'orders soit transparente pour moi — je vois toujours toutes mes commandes, dans l'ordre chronologique, sans perte d'historique.

## Contexte

Conformément à ADR-ORDERS-1 (§4.10 architecture.md), la prod va contenir **deux cohorts** de commandes après la livraison de S-MIGRATION-ORDERS :
- **Cohort legacy `shop_orders`** : commandes antérieures à la bascule (figées, lecture seule)
- **Cohort v1.1 `tenant_orders` + `tenant_order_items`** : commandes post-bascule (croissantes)

[PortalOrders.tsx](src/app/components/shop/portal/PortalOrders.tsx) (livré S-FIX-3 le 11/05) lit seulement `shop_orders` actuellement. Après bascule, l'utilisateur ne verrait plus ses nouvelles commandes. Cette story étend la lecture pour faire l'UNION des 2 sources, normalise les données vers une interface UI unique, et ajoute un indicateur visuel discret pour le cohort legacy.

## Pre-flight UX (Sally)

Question UX : comment distinguer une commande legacy d'une nouvelle dans la table actuelle (date / client / articles / total HT/TTC / statut) ?

**Hypothèses Sally** :
- **H1 (recommandée)** : ajouter une **icône discrète** à gauche du statut pour les legacy (ex: 🗄️ ou un point gris) avec tooltip "Commande antérieure au 17/05/2026". Pas de colonne dédiée, pas de bloat visuel.
- **H2** : ajouter une **colonne "Source"** explicite avec badge "Legacy" / "v1.1". Plus clair mais plus lourd.
- **H3** : ne rien afficher visuellement (les statuts diffèrent déjà : `pending` legacy vs `draft` v1.1 → le tag statut véhicule l'info implicitement).

**Décision pré-spec** : H1 sauf objection Sally + Arnaud. Le statut reste la primary info, l'icône legacy est secondaire.

## Acceptance Criteria

**AC1** — `PortalOrders.tsx` query **deux tables** en parallèle :
- Query A : `shop_orders` filtré `shop_id` + `customer_email` (comportement actuel)
- Query B : `tenant_orders` joint à `tenant_order_items` (agrégat items), filtré `shop_id` + `created_by=user.id` si authentifié
- Promise.all les 2 queries, merge les résultats en un seul array `Order[]` UI-normalisé

**AC2** — Interface UI commune `Order` avec :
- `id`, `source: 'legacy' | 'v1_1'`
- `date` (ISO string)
- `customer_name`, `customer_email`
- `items[]` (normalisés : `{ name, qty, price_ht }` peu importe source)
- `total_ht`, `total_ttc`
- `status` mappé vers labels UI uniformes (cf. AC3)
- Tri global `date DESC`

**AC3** — Mapping des statuts unifié vers UI commune :
| Statut source | Source | Label UI | Couleur |
|---|---|---|---|
| `pending` | shop_orders | En attente | warn |
| `approved` | shop_orders | Validée | ok |
| `in_production` | shop_orders | En production | info |
| `shipped` | shop_orders | Expédiée | info |
| `cancelled` | shop_orders | Annulée | err |
| `draft` | tenant_orders | Brouillon | warn (info + ⚠️ icon "modifiable") |
| `validated` | tenant_orders | Validée | ok |
| `in_production` | tenant_orders | En production | info |
| `shipped` | tenant_orders | Expédiée | info |
| `delivered` | tenant_orders | Livrée | ok |
| `invoiced` | tenant_orders | Facturée | ok |
| `cancelled` | tenant_orders | Annulée | err |

**AC4** — Icône legacy (H1) : si `source === 'legacy'`, afficher un point gris discret à gauche du badge statut + tooltip "Commande antérieure au 17/05/2026 (modèle legacy)".

**AC5** — Empty states adaptés :
- Si les 2 queries retournent vides : "Vous n'avez pas encore de commande dans cette boutique."
- Si une query échoue, l'autre query continue à afficher (résilience). Log l'erreur, ne block pas la vue.

**AC6** — Performance : les 2 queries en parallèle (Promise.all), pas séquentielles. Tri merge en O(n+m) au mount. Limit 100 chacune (200 max au total).

**AC7** — Pas de régression sur les commandes legacy existantes : doivent toujours apparaître avec les bons totaux + statuts (test sur commandes prod existantes ex `a.mazon@me.com`).

**AC8** — Tests vitest :
- 1 cas : mock 2 queries → render avec icône legacy sur cohort legacy, pas sur v1.1
- 1 cas : query A échoue, query B succès → render uniquement les v1.1 + log erreur

**AC9** — TF Notion (à créer après livraison) : "PortalOrders dual-read shop_orders + tenant_orders, icône legacy visible".

## Décisions techniques

| Décision | Choix | Argument |
|---|---|---|
| Architecture query | 2 queries SDK séparées avec Promise.all | Plus simple qu'une vue SQL ou RPC. Cohérent avec pattern Supabase existant. |
| Normalisation données | Helper `normalizeShopOrder()` + `normalizeTenantOrder()` exportés du même fichier | Testable en isolation. |
| Icône legacy | Point gris (CSS `bg-ink-mute-2 w-1.5 h-1.5 rounded-full`) + tooltip natif `title=` | Léger, accessible, pas de dépendance icon library supplémentaire. |
| Mapping statuts | Constante `STATUS_LABELS` étendue avec entries `tenant_orders` enum | Cohérent avec format actuel ligne 67-72. |
| `created_by` filter v1.1 | Coté front défensif via `user?.id`, RLS le ferait aussi | Cohérent avec pattern `customer_email` legacy. |
| Tri merged | `Array.prototype.sort` sur `date` desc après merge | Acceptable jusqu'à 200 lignes. |

## Risques & mitigations

| Risque | Mitigation |
|---|---|
| RLS `tenant_orders` bloque lecture acheteur shop_only | Pre-flight SQL test avec compte shop_only. Si bloque, ajouter policy. |
| Confusion utilisateur sur 2 cohorts coexistants | AC4 icône legacy + tooltip explicatif. Sally + Arnaud arbitrage. |
| Performance dégradée si beaucoup de commandes | AC6 limit 100 + 100. Performance future via OrderHistoryTable (S3.1) avec pagination. |
| Bug normalisation statuts (ex: tenant status inattendu) | AC3 fallback vers `{ label: <raw>, className: 'bg-line text-ink-2' }` (cf. ligne 208-211 existant). |
| Régression sur commandes legacy | AC7 test explicite. |

## Procédure d'exécution

### Étape 1 — Pre-flight RLS tenant_orders read (Claude Code via SQL CLI)
```sql
-- Test RLS depuis user shop_only fictif
set role authenticated;
set request.jwt.claims = '{"sub":"<user_uuid>","email":"acheteur@test.fr"}';
select * from public.tenant_orders limit 5;  -- doit retourner les orders accessibles
```

### Étape 2 — Code PortalOrders.tsx
Refacto en suivant AC1-AC6. Extraire `normalizeXxxOrder` en helpers exportés pour testabilité.

### Étape 3 — Tests vitest
2 nouveaux cas (AC8).

### Étape 4 — Test manuel régression (Arnaud)
Sur localhost:5177, boutique avec commandes legacy + nouvelles → vérifier visuellement.

### Étape 5 — TF Notion + commit + push.

## TF Notion à créer en fin de story

- **TF "PortalOrders dual-read legacy + v1.1 + icône Legacy"** :
  - Parcours : P09 — Boutique portail B2B
  - Persona : Acheteur shop_only
  - Type : Manuel humain + IA Chrome
  - Étapes : connecter compte avec >1 commande legacy + >0 commande v1.1 → vue Mes commandes → vérifier ordre chronologique + icônes legacy + tooltips

## Notes

Sally à invoquer (skill `bmad-agent-ux-designer`) pour valider H1 (icône legacy discrète) avant le code. Si elle propose H2 ou alternative, ajuster AC4.

Le code est volontairement modeste : pas de pagination, pas de filtres avancés. Ces fonctionnalités sont scope **S3.1 OrderHistoryTable** (Phase 3). Cette story est juste la "bascule de lecture" minimale pour Phase 1.
