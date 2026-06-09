# Wireframe lo-fi — Page admin catalog rôles workflow

> **Story** : S-ORDER-ROLES-3 (Sprint 6+, roadmap qualité-first)
> **Écran** : `/t/:slug/admin/order-roles` (nouvelle route)
> **Persona ciblée** : admin tenant (DG, DAF, office manager)
> **Auteure** : Sally (BMAD UX) — session 2026-06-08
> **Status** : spec-ready dev, attente arbitrage Q1 Arnaud (permission d'accès)

---

## Résumé exécutif

Nouvelle page admin qui **matérialise visuellement le workflow de validation paramétrable** d'un tenant. L'admin y voit la chaîne ordonnée de ses rôles (Acheteur → Validateur 1 → ... → Validateur N → Producteur), peut **ajouter / modifier / archiver** chaque maillon, et **assigner les users** à chaque rôle (UI assignation cohabite avec la page Users existante : on assigne le rôle ici, mais qui peut le porter est défini sur la fiche users — pas 2 systèmes côte à côte). Le tableau du haut donne la **vue catalogue** (les rôles définis pour ce tenant) ; la rail visuelle horizontale en bas montre **la chaîne workflow ordonnée** comme un stepper de référence. Une bande "Statuts personnalisés" en dessous expose les statuts custom du tenant (lecture seule MVP, édition Sprint 8+).

---

## Layout général (desktop, ≥ 1280 px)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  [Sidebar Dashboard existante — NAV gauche]                                          │
├──────────┬───────────────────────────────────────────────────────────────────────────┤
│ Nav      │                                                                            │
│ Espace   │  Workflow & rôles de commande                                              │
│ Users    │  Configurez la chaîne de validation pour les commandes de cet espace.      │
│ ▸ Rôles  │                                                                            │
│ Atelier  │  ┌────────────────────────────────────────────────────────────────────┐    │
│ Confs    │  │  Aperçu de votre circuit de validation                             │    │
│          │  │                                                                    │    │
│          │  │   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐        │    │
│          │  │   │ Acheteur │ → │ Val. N+1 │ → │ DAF      │ → │Producteur│        │    │
│          │  │   │ 4 perso. │   │ 2 perso. │   │ 1 perso. │   │ 1 perso. │        │    │
│          │  │   └──────────┘   └──────────┘   └──────────┘   └──────────┘        │    │
│          │  │     (créateur)    (validation)   (approb.)     (production)        │    │
│          │  │                                                                    │    │
│          │  │   Les commandes circulent dans cet ordre. Vous pouvez insérer un  │    │
│          │  │   nouveau validateur entre deux étapes ou modifier les droits.    │    │
│          │  └────────────────────────────────────────────────────────────────────┘    │
│          │                                                                            │
│          │  ┌────────────────────────────────────────────────────────────────────┐    │
│          │  │ Catalogue des rôles                          [ + Ajouter un rôle ] │    │
│          │  ├────────────────────────────────────────────────────────────────────┤    │
│          │  │  Ordre │ Nom         │ Droits             │ Notif       │ Portée │  ⋯ │   │
│          │  ├────────┼─────────────┼────────────────────┼─────────────┼────────┼────┤   │
│          │  │   1    │ Acheteur    │ [créer] [exporter] │ —           │ Espace │ ⋯  │   │
│          │  │   2    │ Val. N+1    │ [valider] [annul.] │ Suivant     │ Espace │ ⋯  │   │
│          │  │   3    │ DAF         │ [valider]          │ Tout le mde │ Espace │ ⋯  │   │
│          │  │   4    │ Producteur  │ [valider] [modif.] │ Acheteur    │ Espace │ ⋯  │   │
│          │  │ ────── (rôles archivés cachés par défaut · [ + Voir l'archive ]) ──── │   │
│          │  └────────────────────────────────────────────────────────────────────┘    │
│          │                                                                            │
│          │  ┌────────────────────────────────────────────────────────────────────┐    │
│          │  │ Assignations users × rôles            (référence : page Utilisateurs)│   │
│          │  ├────────────────────────────────────────────────────────────────────┤    │
│          │  │  User           │ Acheteur │ Val. N+1 │ DAF │ Producteur │ Actions  │    │
│          │  ├─────────────────┼──────────┼──────────┼─────┼────────────┼──────────┤    │
│          │  │  Léa G.         │   ●      │          │     │            │  [✏]    │    │
│          │  │  Claire D.      │          │   ●      │     │            │  [✏]    │    │
│          │  │  Marc P. (DAF)  │          │          │  ●  │            │  [✏]    │    │
│          │  │  Atelier ABC    │          │          │     │     ●      │  [✏]    │    │
│          │  └────────────────────────────────────────────────────────────────────┘    │
│          │                                                                            │
│          │  ▸ Statuts personnalisés de commande      (lecture seule — modifiable V2)   │
│          │     pending · pending_validation · validated · in_production · shipped ·    │
│          │     delivered · cancelled · rejected                                        │
│          │                                                                            │
└──────────┴───────────────────────────────────────────────────────────────────────────┘
```

---

## Bloc 1 — Aperçu chaîne workflow (rail visuel horizontal)

**Sémantique** : donne en 1 coup d'œil la **chaîne de validation actuelle**, ordonnée par `ordering_index`. Permet à l'admin de voir si elle correspond à la réalité organisationnelle, AVANT de scroller le catalog tabulaire en dessous.

**Rendu détaillé** :

```
┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│  Acheteur      │ ──→ │  Validateur N+1│ ──→ │  DAF           │
│                │     │                │     │                │
│  4 personnes   │     │  2 personnes   │     │  1 personne    │
│  (créateur)    │     │  (validation)  │     │  (approbation) │
└────────────────┘     └────────────────┘     └────────────────┘
```

- Chaque card affiche : nom du rôle + nb de personnes assignées + tag sémantique entre parenthèses.
- Tag sémantique calculé : `créateur` (rôle Acheteur), `validation` (can_validate=true et pas ordering_index max), `approbation` (can_validate=true et ordering_index max), `production` (rôle Producteur), `autre` (cas autre).
- Cliquer une card scroll vers la ligne correspondante du catalog en dessous.
- Si > 5 cards : wrap à la ligne suivante avec espacement régulier.
- Largeur card fixe (~180 px) → scrollable horizontalement sur mobile/tablet via overflow-x.

**Pourquoi pas un grand stepper riche type design hi-fi 05** : le stepper du design hi-fi 05 affiche le **statut courant d'une commande spécifique** (étape active + temps estimé). Ici on affiche la **structure du workflow lui-même** (catalog des rôles). Le rail est plus adapté qu'un stepper — il ne montre pas un état (pas de "active step").

---

## Bloc 2 — Catalogue des rôles (table principale)

Colonnes (de gauche à droite) :

| Colonne | Type | Tri | Notes |
|---|---|---|---|
| Ordre | int | non | Drag-handle si l'admin veut réordonner (V2+, MVP = bouton "Monter / Descendre" dans menu ⋯) |
| Nom | text | non (catégoriel) | Cliquable → modale modification |
| Droits | badges | non | 4 chips visuels max : `valider` / `annuler` / `modifier` / `exporter` |
| Notification | badge | non | Libellé FR : "Suivant" (`chain_next`), "Tout le monde" (`all_roles`), "—" (`none`) |
| Portée | badge | non | "Espace" (tenant) ou "Boutique [nom]" (shop) |
| ⋯ | menu | — | Modifier · Dupliquer · Monter · Descendre · Archiver |

**Lesson 2026-05-25 appliquée** : pas de tri sur colonnes catégorielles. Ordre = drag/handles ou menu, pas un tri ASC/DESC. Et "Portée" affiche le **nom** de la boutique, pas son slug ni son uuid (cf. `shops.name`).

**Anticipation cardinalité (lesson 2026-05-25)** :
- 1-10 rôles : table standard pleine.
- 10-30 rôles : pagination "load more" + filtre `<Input>` "Rechercher un rôle".
- 30+ rôles : pas vu en pratique (catalogue workflow d'un tenant unique reste fini), donc pas pré-optimisé MVP. Si rencontré : recherche full-text + virtualisation Tanstack Table.

**Lignes spéciales** :

- **Acheteur** et **Producteur** : rôles canoniques (seedés à la création du tenant via trigger Sprint 6 `tenants_seed_catalogs`). **Non archivables** (le workflow ne fonctionne plus sans eux), seul le rename + ajustement capabilities est permis. Le menu ⋯ masque "Archiver" pour ces 2 rôles.

- **Validateurs créés par l'admin** : entièrement éditables et archivables. Soft-delete via `archived_at`, conserve l'historique.

- **Archivés cachés** : ligne séparatrice + bouton `+ Voir l'archive` qui ré-expand la section avec les rôles archivés en gris.

**Header de table** :

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Catalogue des rôles                                  [ + Ajouter un rôle ]│
└──────────────────────────────────────────────────────────────────────────┘
```

Le bouton "Ajouter un rôle" ouvre la modale création (voir wireframe séparé `S-ORDER-ROLES-3-create-modal.md`).

---

## Bloc 3 — Assignations users × rôles (matrice)

**Sémantique** : "qui occupe quel rôle pour ce tenant". Matrix `users (lignes) × rôles (colonnes)` avec coches/cellules cliquables pour assigner ou révoquer.

**⚠️ Cohérence inter-écrans (lesson 2026-05-25)** : cette matrice cohabite avec :
1. La section "Rôles" de `DashboardUsers` (livrée Phase A S-USERS-REFONTE, commit `01939ba`) : matrix users × rôles existante.
2. La fiche d'un user individuel (modale "Éditer les rôles" déjà existante).

**Décision UX** : la matrix ici est **strictement la même** que la section "Rôles" de DashboardUsers, mais **affichée sous l'angle "rôles" plutôt que "users"** (transposée). Source de vérité = même table `tenant_role_assignments`. Pas de divergence possible.

Pour éviter le doublon UX, deux options :

- **Option A (recommandée)** : afficher ici un **résumé compact en lecture seule** + un bouton `→ Gérer les assignations` qui ouvre une side-sheet ou navigue vers `/t/:slug/dashboard/users#section-roles`. Évite la duplication d'interaction édition.
- **Option B** : matrix éditable ici aussi → cohérence UX dégradée (2 écrans qui éditent la même chose).

→ **MVP = Option A**. La matrix ici est un **rappel visuel** + un lien vers l'écran d'édition source.

**Rendu Option A** :

```
┌────────────────────────────────────────────────────────────────────┐
│ Personnes assignées par rôle      [ → Gérer dans la page Users ]   │
├────────────────────────────────────────────────────────────────────┤
│  Acheteur     :  Léa G., Antoine M., Yann B., Camille R.           │
│  Validateur 1 :  Claire D., Émilie F.                              │
│  DAF          :  Marc P.                                           │
│  Producteur   :  Atelier ABC                                       │
└────────────────────────────────────────────────────────────────────┘
```

Compact, scanable, lecture seule. Si > 5 noms par rôle → tronqué `Léa G., Antoine M. + 3 autres`.

---

## Bloc 4 — Statuts personnalisés (placeholder V2+)

Section repliable, lecture seule MVP. Affiche la liste des statuts canoniques du tenant (`tenant_order_status_definitions`) seedés à la création.

```
▸ Statuts personnalisés de commande              [ Lecture seule — édition V2 ]

  pending · pending_validation · validated · in_production ·
  shipped · delivered · cancelled · rejected
```

Si l'admin clique sur le bouton "Édition V2" → toast informatif : *"La personnalisation des statuts arrivera dans une mise à jour à venir."*

---

## Empty state global (tenant fraîchement créé sans rien configurer)

Cas peu probable car le trigger Sprint 6 `tenants_seed_catalogs` seede 5 rôles par défaut. Mais si l'admin a archivé tout sauf Acheteur + Producteur :

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│            🔧  Workflow minimal en place               │
│                                                        │
│   Votre espace fonctionne sans étape de validation     │
│   intermédiaire. Les commandes passent directement     │
│   de l'acheteur à la production.                       │
│                                                        │
│   Souhaitez-vous ajouter une étape de validation ?     │
│                                                        │
│           [ + Ajouter un validateur ]                  │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## Permission d'accès à cette page — Q1 OUVERTE (recommandation Sally)

**Question Arnaud (AC5 last sentence du story doc)** : qui accède à cette page ?
- Option A : réutiliser `can_invite` existant (champ `tenant_members.permissions.can_invite`).
- Option B : créer nouvelle permission `can_manage_roles`.

**Recommandation Sally : Option B `can_manage_roles`**

Arguments :

1. **Acquis architectural** : le hook `useOrderRoles` expose déjà `can_manage_roles` dans son enum `OrderCapability` (`useOrderRoles.ts:32`). Le schéma de capabilities est donc déjà conçu pour cette permission. L'implémenter complète cohérent, ne pas l'implémenter laisse une dette sémantique.

2. **Separation of concerns** (lesson 2026-05-25 §gestion users — *"un utilisateur du tenant est une entité unique. Les droits métiers sont des permissions modulaires octroyées par l'admin"*) :
   - `can_invite` = inviter quelqu'un dans l'espace
   - `can_manage_roles` = configurer le workflow
   Ces deux droits sont fonctionnellement orthogonaux. Un DAF peut vouloir configurer le workflow sans pouvoir inviter de nouveaux users. Un office manager peut vouloir inviter sans pouvoir toucher au workflow.

3. **Sécurité** : configurer le workflow a un impact business plus large (qui valide quoi) que inviter un user. Séparer permet à un admin de déléguer l'invitation à un office manager sans lui ouvrir la configuration du workflow.

4. **Futur-proof** : si on cumule `can_invite + can_manage_roles` en un seul flag, démêler ensuite est douloureux (audit, migrations). L'inverse est trivial.

**Implémentation** :
- Ajouter `can_manage_roles` aux 5 presets de rôles seedés par `tenants_seed_catalogs` (Sprint 6) — par défaut seul "Admin tenant" l'a à `true`.
- Helper SQL `user_has_capability(p_user_id, p_tenant_id, 'can_manage_roles')` (déjà standardisé Phase A).
- Côté UI : la route `/t/:slug/admin/order-roles` redirige 403 si `user_has_capability ≠ true` (même pattern que DashboardUsers actuel).
- Le superadmin Magrit (`is_super_admin()`) bypass évidemment.

**Effort additionnel estimé** : 0,5 j (1 migration + 1 guard route + 1 test RLS).

---

## Microcopy FR — brand voice Magrit

Style : direct, terre-à-terre, vocabulaire métier de l'imprimerie/B2B.

### Titre + lede page

- Titre : `Workflow & rôles de commande`
- Lede : `Configurez la chaîne de validation pour les commandes de cet espace.`

(évite "circuit d'approbation" jargon corporate ; évite "settings workflow" anglicisme)

### Labels colonnes catalog

- `Ordre` (court, métaphore explicite)
- `Nom` (banal)
- `Droits` (FR courant, pas "Capabilities" anglicisme)
- `Notification` (FR ; le badge intérieur dit "Suivant" / "Tout le monde" / "—")
- `Portée` (FR ; "scope" anglicisme banni)

### Badges droits

- `valider` (lowercase, badge bleu)
- `annuler` (lowercase, badge orange)
- `modifier` (lowercase, badge vert)
- `exporter` (lowercase, badge gris)
- `créer` (lowercase, badge gris — pour Acheteur)

### Badge notification

- `Suivant` (au lieu de `chain_next`) — *"Prévient uniquement le rôle suivant dans la chaîne"*
- `Tout le monde` (au lieu de `all_roles`) — *"Prévient tous les rôles configurés"*
- `—` (au lieu de `none`) — *"N'envoie aucune notification"* (sera affiché en tooltip)

### Boutons

- `+ Ajouter un rôle` (CTA principal page)
- `→ Gérer dans la page Users` (lien vers édition assignations)
- `+ Voir l'archive` (expand des rôles archivés)
- Menu ⋯ : `Modifier` · `Dupliquer` · `Monter d'un cran` · `Descendre d'un cran` · `Archiver`

### Confirmations

- Archive un rôle : *"Archiver le rôle « {nom} » ? Les commandes en cours conservent leurs assignations actuelles ; aucune nouvelle assignation ne sera possible."* (AlertDialog + bouton "Archiver" rouge + bouton "Annuler" neutre)
- Suppression définitive (V2+) : pas en MVP. Archive uniquement.
- Réordonner : feedback immédiat post-clic Monter/Descendre, toast *"Ordre mis à jour."*

### Tooltips info (icône ⓘ)

- À côté du titre des Statuts personnalisés : *"Les statuts définissent les étapes par lesquelles passe une commande. Vous pourrez personnaliser cette liste dans une prochaine mise à jour."*
- À côté du tag "(créateur)" sur le rail visuel : *"L'acheteur est l'auteur de la commande. Ce rôle ne peut pas être archivé."*

---

## Comportements transverses

### Drag & drop ordre (V2+ ou MVP simple)

MVP : boutons "Monter d'un cran" / "Descendre d'un cran" dans le menu ⋯. Sûr, accessible clavier, scriptable test. Drag & drop = V2 si volume + usability le justifient.

### Réordonner : effets de bord

Quand on réordonne, le `ordering_index` du catalog est mis à jour mais les commandes **en cours de circuit** conservent leur chaîne historique (snapshot dans `tenant_order_roles` par commande). On affiche un info banner discret au moment du réordonnancement :

```
ℹ Les commandes déjà en cours conservent leur circuit actuel. La nouvelle
  chaîne s'applique aux nouvelles commandes uniquement.
```

### Édition d'un rôle existant

Ouvre la même modale que création (composant partagé `<RoleEditorDialog>`), pré-remplie avec les valeurs actuelles. Le nom reste éditable (validation unicité par tenant). Les capabilities peuvent être modifiées. Effet sur les commandes en cours : les `tenant_order_roles` capturent les capabilities **au moment de l'assignation** (snapshot pattern à confirmer côté Dev — alternative : recompute live). Recommandation Sally : **snapshot** (capabilities figées sur l'assignment), audit clair, comportement prévisible. RPC `update_tenant_order_role_capabilities` (Sprint 6) gère déjà le cas.

---

## Anticipation cardinalité

| Élément | Cardinalité actuelle | Cardinalité attendue | Pattern UI |
|---|---|---|---|
| Rôles dans le catalog | 5 (seedés) - 10 | jusqu'à 20+ pour grosse organisation | Pagination "load more" puis virtualisation au-delà |
| Rail visuel cards | 5 | jusqu'à 10 | Wrap à la ligne ou scroll horizontal |
| Lignes archivés | 0-50 | rare > 20 | Section repliable |
| Users dans matrix | 5-30 | jusqu'à 100 | Renvoi vers page Users existante (Option A) |
| Boutiques (scope=shop) | 1-3 | jusqu'à 30+ (gros tenant multi-sites) | Combobox dropdown dans la modale création (cf. lesson 2026-05-25) |

---

## Accessibilité

- Tableau catalog : `<table>` sémantique avec `<th scope="col">`. Tri non applicable.
- Boutons icônes : `aria-label` toujours présent (Modifier/Archiver/Monter/Descendre).
- Modale création : `<Dialog>` Radix avec focus trap natif. Champs validés en live (Zod) + résumé d'erreurs en haut au submit.
- Rail visuel : pas un stepper actif → pas de `role="navigation"`, juste une liste sémantique `<ul>` avec items.

Routes à ajouter au scan `pnpm a11y:scan` :
- `/t/<slug>/admin/order-roles`

---

## testIds à ajouter dans `src/app/lib/testIds.ts`

Nouveau scope `orderRole` (pas dans `user.*` pour éviter pollution + cohérence convention §4.3 : scope = domaine, ici workflow rôles est un domaine à part).

```typescript
orderRole: {
  page: 'order-role-page',
  // Rail visuel haut de page
  workflowRail: 'order-role-workflow-rail',
  workflowRailCard: 'order-role-workflow-rail-card',
  // Catalog
  catalogTable: 'order-role-catalog-table',
  catalogRow: 'order-role-catalog-row',
  catalogAddBtn: 'order-role-catalog-add-btn',
  catalogMenuBtn: 'order-role-catalog-menu-btn',
  catalogMenuEdit: 'order-role-catalog-menu-edit',
  catalogMenuDuplicate: 'order-role-catalog-menu-duplicate',
  catalogMenuMoveUp: 'order-role-catalog-menu-move-up',
  catalogMenuMoveDown: 'order-role-catalog-menu-move-down',
  catalogMenuArchive: 'order-role-catalog-menu-archive',
  catalogArchiveConfirmDialog: 'order-role-catalog-archive-confirm-dialog',
  catalogArchiveConfirmBtn: 'order-role-catalog-archive-confirm-btn',
  catalogShowArchivedBtn: 'order-role-catalog-show-archived-btn',
  // Bloc assignations (Option A : lecture seule + lien)
  assignmentsSummary: 'order-role-assignments-summary',
  assignmentsManageLink: 'order-role-assignments-manage-link',
  // Statuts (placeholder V2)
  statusesSection: 'order-role-statuses-section',
}
```

---

## Différé V2+

- **Drag & drop réordonnancement** (au-delà des boutons Monter/Descendre).
- **Édition statuts personnalisés** (table `tenant_order_status_definitions`).
- **Édition matrice transitions** (table `tenant_order_status_transitions`).
- **Notification "test" depuis le catalog** : bouton "Envoyer un email de test" sur la ligne pour vérifier la `notify_policy`.
- **Templates de workflow pré-faits** : "Workflow imprimeur Pro" / "Workflow corporate 4 niveaux" / "Workflow simplifié" — l'admin choisit un template au lieu de construire.
- **Versioning du workflow** : voir l'historique des modifications du catalog (qui a ajouté quel rôle quand).

---

## References

- [Story S-ORDER-ROLES-3 (spec)](../_bmad-output/implementation-artifacts/story-S-ORDER-ROLES-3-ui-portal-orders-roles.md)
- [Overview S-ORDER-ROLES](../_bmad-output/implementation-artifacts/story-S-ORDER-ROLES-roles-commande.md) — §Décision Q4 couche séparée
- [Hook useOrderRoles livré Sprint 6](../../src/app/hooks/useOrderRoles.ts) — voir enum OrderCapability:32
- [Migration Sprint 6 seed catalogs](../../supabase/migrations/20260601000200_*.sql)
- [DashboardUsers existant (matrix users × rôles Phase A)](../../src/app/components/dashboard/DashboardUsers.tsx)
- [Wireframe écran 1 PortalOrders](./S-ORDER-ROLES-3-portal-orders.md)
- [Wireframe écran 3 modale création](./S-ORDER-ROLES-3-create-modal.md)
