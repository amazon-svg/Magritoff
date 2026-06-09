# Wireframe lo-fi — Modale création / modification d'un rôle

> **Story** : S-ORDER-ROLES-3 (Sprint 6+, roadmap qualité-first)
> **Composant** : `<RoleEditorDialog>` (création + modification, même modale, mode déduit par prop `role?`)
> **Persona ciblée** : admin tenant (`can_manage_roles` requis)
> **Auteure** : Sally (BMAD UX) — session 2026-06-08
> **Status** : spec-ready dev, dépend Q3 Arnaud (scope multi-shop)

---

## Résumé exécutif

Une seule modale (`<RoleEditorDialog>`) gère création **et** modification — différenciée par le prop `role?: TenantRoleDefinition` (présent = mode édition, absent = mode création). Le nom est auto-rempli `Validateur X` (X = `MAX(ordering_index) + 1` parmi rôles `can_validate=true` du tenant) mais éditable librement. 4 toggles capabilities + 1 dropdown notify_policy + 1 segmented control scope (tenant/boutique). Validation Zod live : nom obligatoire, unique par tenant, au moins 1 capability cochée (un rôle sans pouvoir = bug UX). La modale fait 520-580 px de large, hauteur fit-content avec scroll interne si l'écran fait < 700 px. Submit en bas : `Créer le rôle` ou `Enregistrer les modifications` selon mode.

---

## Wireframe (mode création)

```
┌──────────────────────────────────────────────────────────────────────┐
│   Ajouter un rôle                                              [ ✕ ] │
│   ──────────────────────────────────────────────────────────────     │
│                                                                      │
│   Nom du rôle *                                                      │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │  Validateur 1                                                │   │
│   └──────────────────────────────────────────────────────────────┘   │
│   Personnalisez le nom pour qu'il reflète votre organisation         │
│   (ex : « Direction Communication », « N+1 », « DAF »).              │
│                                                                      │
│   Droits accordés au rôle *                                          │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │   [✓] Valider     Approuve la commande et la fait avancer    │   │
│   │       Toggle      dans le circuit.                           │   │
│   │   [ ] Annuler     Peut annuler la commande à n'importe       │   │
│   │                   quelle étape non terminale.                │   │
│   │   [ ] Modifier    Peut modifier les articles ou quantités    │   │
│   │                   de la commande.                            │   │
│   │   [ ] Exporter    Peut exporter la commande en PDF/CSV.      │   │
│   └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│   Notification à l'étape de ce rôle                                  │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │  ( • ) Le rôle suivant uniquement                            │   │
│   │  (   ) Tous les rôles du circuit                             │   │
│   │  (   ) Aucune notification                                   │   │
│   └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│   Portée du rôle *                                                   │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │  [ Tout l'espace ●●● ] [ Une boutique précise           ]    │   │
│   │                                                              │   │
│   │   Le rôle s'applique à toutes les commandes de l'espace.     │   │
│   └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│   Position dans le circuit                                           │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │  Insérer  [ Après Acheteur ▾ ]                               │   │
│   │                                                              │   │
│   │   Aperçu : Acheteur → ▸ Validateur 1 ◂ → DAF → Producteur    │   │
│   └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│   ──────────────────────────────────────────────────────────────     │
│                                  [ Annuler ]   [ Créer le rôle ]     │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Wireframe (mode édition d'un rôle existant)

```
┌──────────────────────────────────────────────────────────────────────┐
│   Modifier le rôle                                             [ ✕ ] │
│   ──────────────────────────────────────────────────────────────     │
│                                                                      │
│   Nom du rôle *                                                      │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │  Validateur N+1                                              │   │
│   └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│   Droits accordés au rôle *                                          │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │   [✓] Valider     ...                                        │   │
│   │   [✓] Annuler     ...                                        │   │
│   │   [ ] Modifier    ...                                        │   │
│   │   [✓] Exporter    ...                                        │   │
│   └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│   Notification à l'étape de ce rôle                                  │
│   ( • ) Le rôle suivant uniquement                                   │
│   (   ) Tous les rôles du circuit                                    │
│   (   ) Aucune notification                                          │
│                                                                      │
│   Portée du rôle *                                                   │
│   [ Tout l'espace ●●● ] [ Une boutique précise           ]           │
│                                                                      │
│   ──────────────────────────────────────────────────────────────     │
│   ℹ Les changements de droits s'appliquent aux NOUVELLES             │
│     assignations. Les commandes déjà en cours conservent             │
│     leurs droits historiques.                                        │
│   ──────────────────────────────────────────────────────────────     │
│                       [ Annuler ]   [ Enregistrer les modifications ]│
└──────────────────────────────────────────────────────────────────────┘
```

---

## Section "Portée" — détail du choix tenant vs boutique

**Segmented control** à 2 options (shadcn-ui style ToggleGroup) :

### Option "Tout l'espace" (sélectionnée par défaut)

Le rôle s'applique à toutes les commandes de toutes les boutiques de l'espace tenant.

```
┌──────────────────────────────────────────────────────────────────┐
│  [ Tout l'espace ●●● ] [ Une boutique précise              ]     │
│                                                                  │
│   Le rôle s'applique à toutes les commandes de l'espace,         │
│   quelle que soit la boutique.                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Option "Une boutique précise"

Le rôle est limité à une boutique. Le champ caché auparavant devient visible :

```
┌──────────────────────────────────────────────────────────────────┐
│  [ Tout l'espace        ] [ Une boutique précise ●●● ]           │
│                                                                  │
│   Boutique *                                                     │
│   ┌──────────────────────────────────────────────────────────┐   │
│   │  ⌕ Rechercher une boutique…                             ▾│   │
│   ├──────────────────────────────────────────────────────────┤   │
│   │  Boutique Léa G. — Communication Groupe                  │   │
│   │  Boutique Atelier IPA                                    │   │
│   │  Boutique Stand Viva Tech                                │   │
│   └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│   Le rôle ne s'applique qu'aux commandes passées dans            │
│   cette boutique.                                                │
└──────────────────────────────────────────────────────────────────┘
```

**Pattern UI choisi : Combobox shadcn avec search box** (lesson 2026-05-25 §cardinalité). Cohérent avec le filtre Boutique du DashboardOrders livré S3.1.

**Liste affichée** : `shops.name` (jamais `shops.slug` ni `shops.id` — lesson 2026-05-25). Tri alpha par défaut.

---

## Q3 OUVERTE — Scope conflict (recommandation Sally)

**Question Arnaud (brief session)** : un Validateur 1 configuré scope=shop_A peut-il être réutilisé scope=shop_B, ou faut-il créer un Validateur 1 par shop ?

**Recommandation Sally : 1 définition = 1 scope unique (tenant OU shop). Pas de multi-shop par row.**

Arguments :

1. **Schéma actuel l'impose** : `tenant_role_definitions.scope_shop_id` est un `uuid nullable`, pas un `uuid[]`. Pas d'ambiguïté DB. Ajouter `scope_shop_ids` array casse l'invariant + complexifie les RLS. Coût migration disproportionné MVP.

2. **Clarté UX** : dans le rail visuel du catalog (`S-ORDER-ROLES-3-admin-roles.md` §Bloc 1), un même rôle "Validateur 1" affiché dans 2 cards séparées (une par boutique) est plus lisible qu'une card avec une liste de boutiques. L'admin voit clairement quel workflow s'applique à quoi.

3. **Cas d'usage simple courant** : la plupart des tenants ont 1-3 boutiques. Dupliquer un workflow 1-3 fois est tolérable. Bonus UX : bouton "Dupliquer" dans le menu ⋯ de la ligne catalog qui ouvre la modale création pré-remplie sur tous les champs sauf "Boutique" — switch vers l'autre boutique en 2 clics.

4. **Évite l'effet de bord** : si un même rôle pilote 2 boutiques avec un même user assigné, qui peut-il valider exactement ? Une commande passée dans shop_A par Léa G. — peut-elle être validée par un user assigné au Validateur 1 multi-shop, alors qu'il n'est listé que sur shop_B dans `tenant_role_assignments` ? La logique RLS devient fragile.

5. **V2+ si justifié par l'usage** : si un tenant remonte qu'il a 15 boutiques avec exactement le même workflow et que dupliquer est pénible, on introduit alors `scope_shop_ids uuid[]` + migration. Pas avant.

**Implication UX immédiate** :
- La section "Portée" est **single-value** (tenant OU une seule boutique).
- Le menu ⋯ catalog expose `Dupliquer` (V2 ou MVP simple = précharge modale).

---

## Validation Zod (côté front)

```typescript
const roleSchema = z.object({
  name: z.string()
    .trim()
    .min(2, 'Le nom doit faire au moins 2 caractères')
    .max(50, 'Le nom ne peut pas dépasser 50 caractères')
    .refine(async (name) => !await nameExists(name, tenantId, currentRoleId), {
      message: 'Ce nom est déjà utilisé pour un autre rôle de cet espace',
    }),
  capabilities: z.object({
    can_validate: z.boolean(),
    can_cancel: z.boolean(),
    can_modify: z.boolean(),
    can_export: z.boolean(),
  }).refine(
    (caps) => Object.values(caps).some((v) => v === true),
    { message: 'Sélectionnez au moins un droit' },
  ),
  notify_policy: z.enum(['chain_next', 'all_roles', 'none']),
  scope: z.enum(['tenant', 'shop']),
  scope_shop_id: z.string().uuid().nullable(),
  ordering_index: z.number().int().positive(),
}).refine(
  (data) => data.scope === 'tenant' ? data.scope_shop_id === null : data.scope_shop_id !== null,
  { message: 'Boutique requise quand la portée est "Une boutique précise"', path: ['scope_shop_id'] },
);
```

**Validation live** : chaque champ déclenche son erreur au blur + résumé d'erreurs en haut de modale au submit.

---

## États & feedback

### État loading (création/édition en cours)

Le bouton submit affiche un spinner + texte "Création…" / "Enregistrement…". Les champs sont disabled. Pas de fermeture modale par clic outside pendant la requête.

### État succès

1. Modale ferme.
2. Toast Sonner vert : `Rôle « {nom} » créé.` ou `Rôle « {nom} » mis à jour.`
3. Catalog table de la page admin refresh + ligne nouveau rôle highlighted 2s (fond vert pâle qui fade).

### État erreur RPC

Banner d'erreur en haut de modale (au-dessus du champ Nom) :

```
┌──────────────────────────────────────────────────────────────────┐
│  ⚠ Création impossible : ce nom est déjà utilisé.                │
└──────────────────────────────────────────────────────────────────┘
```

Pas de toast (l'erreur doit rester visible à côté du champ concerné). Modale reste ouverte, l'admin corrige.

---

## Microcopy FR — brand voice Magrit

| Élément | Texte |
|---|---|
| Titre modale création | `Ajouter un rôle` |
| Titre modale édition | `Modifier le rôle` |
| Sous-titre champs * | (pas de sous-titre global, label + champ + helper texte) |
| Label Nom | `Nom du rôle` |
| Helper Nom | `Personnalisez le nom pour qu'il reflète votre organisation (ex : « Direction Communication », « N+1 », « DAF »).` |
| Label Droits | `Droits accordés au rôle` |
| Helper Droits — Valider | `Approuve la commande et la fait avancer dans le circuit.` |
| Helper Droits — Annuler | `Peut annuler la commande à n'importe quelle étape non terminale.` |
| Helper Droits — Modifier | `Peut modifier les articles ou quantités de la commande.` |
| Helper Droits — Exporter | `Peut exporter la commande en PDF/CSV.` |
| Label Notif | `Notification à l'étape de ce rôle` |
| Option notif 1 | `Le rôle suivant uniquement` |
| Option notif 2 | `Tous les rôles du circuit` |
| Option notif 3 | `Aucune notification` |
| Label Portée | `Portée du rôle` |
| Toggle 1 | `Tout l'espace` |
| Toggle 2 | `Une boutique précise` |
| Helper Portée tenant | `Le rôle s'applique à toutes les commandes de l'espace, quelle que soit la boutique.` |
| Helper Portée shop | `Le rôle ne s'applique qu'aux commandes passées dans cette boutique.` |
| Label Position | `Position dans le circuit` |
| Helper Position | (aperçu live ASCII) |
| Bouton submit création | `Créer le rôle` |
| Bouton submit édition | `Enregistrer les modifications` |
| Bouton annuler | `Annuler` |
| Banner info édition | `Les changements de droits s'appliquent aux NOUVELLES assignations. Les commandes déjà en cours conservent leurs droits historiques.` |

---

## Accessibilité

- `<Dialog>` Radix : focus trap natif, focus initial sur champ Nom, fermeture par `Esc`.
- Tous les labels sont des `<label for="…">` (pas `aria-label` seul).
- Le toggle Portée est un `<ToggleGroup>` Radix avec `role="radiogroup"` et `aria-checked` géré.
- Le Combobox boutique est un Radix Combobox conforme WAI-ARIA Combobox pattern.
- Les checkboxes Droits ont un `<label>` cliquable couvrant toggle + nom + helper (zone de hit étendue mobile).
- Les helpers texte sont liés via `aria-describedby` aux champs concernés.
- Le banner info édition a `role="status"`.

---

## testIds à ajouter dans `src/app/lib/testIds.ts`

```typescript
orderRole: {
  // ... (déjà listés dans le wireframe S-ORDER-ROLES-3-admin-roles.md)
  // Modale création/édition
  editorDialog: 'order-role-editor-dialog',
  editorNameInput: 'order-role-editor-name-input',
  editorCapValidate: 'order-role-editor-cap-validate',
  editorCapCancel: 'order-role-editor-cap-cancel',
  editorCapModify: 'order-role-editor-cap-modify',
  editorCapExport: 'order-role-editor-cap-export',
  editorNotifyChainNext: 'order-role-editor-notify-chain-next',
  editorNotifyAllRoles: 'order-role-editor-notify-all-roles',
  editorNotifyNone: 'order-role-editor-notify-none',
  editorScopeTenant: 'order-role-editor-scope-tenant',
  editorScopeShop: 'order-role-editor-scope-shop',
  editorScopeShopCombobox: 'order-role-editor-scope-shop-combobox',
  editorScopeShopOption: 'order-role-editor-scope-shop-option',
  editorPositionSelect: 'order-role-editor-position-select',
  editorSubmitBtn: 'order-role-editor-submit-btn',
  editorCancelBtn: 'order-role-editor-cancel-btn',
  editorErrorBanner: 'order-role-editor-error-banner',
}
```

---

## Différé V2+

- **Permissions plus fines** : ouvrir des sous-droits (ex : `can_modify_items` vs `can_modify_quantities`).
- **Conditions d'activation** : "ce rôle ne s'active que si montant > 1000 €" (workflow conditionnel).
- **Liste préset de rôles** : "Direction Comm" / "DAF" / "Manager" en templates pré-remplis.
- **Mode test** : "Simuler la création pour voir l'impact sur le rail visuel sans l'enregistrer".
- **Import/export config workflow** en YAML/JSON pour répliquer entre tenants partenaires.

---

## References

- [Story S-ORDER-ROLES-3 (spec)](../_bmad-output/implementation-artifacts/story-S-ORDER-ROLES-3-ui-portal-orders-roles.md)
- [Schéma tenant_role_definitions Sprint 6](../../supabase/migrations/20260601000100_*.sql)
- [Wireframe écran 1 PortalOrders](./S-ORDER-ROLES-3-portal-orders.md)
- [Wireframe écran 2 page admin](./S-ORDER-ROLES-3-admin-roles.md)
- [Pattern Combobox shadcn Magrit existant (S3.1 filtre Boutique)](../../src/app/components/shop/portal/OrderHistoryTable.tsx)
- [Lesson 2026-05-25 cardinalité Combobox](~/.claude/projects/-Users-arnaudmazon-Documents-Claude-BMAD-Magrit/memory/feedback_*.md)
