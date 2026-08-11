# Story — Le Parc machine passe en base, derrière un contrat d'API

> **Branche** : `feat/parc-machine-api` (base : `feat/multi-devise-t1` remise à niveau sur `origin/main`)
> **Date** : 2026-08-11 · **Agent** : Amelia 💻 Dev (BMAD)
> **Règles opposables** : R1 API-first · R2 Modularité · R5 Souplesse encadrée · R6 Workflow Git · R8 Sortie de tâche
> **Origine métier** : séance RP#070826 — BK-07, BK-09/10, BK-13, BK-15, BK-17, BK-18, BK-19, BK-22, BK-27

---

## 1. Demande

Cinq points arbitrés par Arnaud le 2026-08-11 :

1. Contrat d'API Park d'abord (R1), rétro-documenté puis implémenté.
2. Table + RLS tenant-scopée, et `MACHINE_LIBRARY` côté serveur — référentiel Fournisseur unifié BK-07.
3. Les 5 fonctions du helper deviennent des appels d'API, signature inchangée.
4. Tests sur `parkIsCalculable` — règle BK-17, non couverte jusqu'ici.
5. Le module doit être connecté à la base « comme il doit l'être ».

Deux arbitrages complémentaires pris en séance : l'API vit dans une **edge function**
(le seul chemin pleinement conforme à R1) ; les parcs de maquette en `localStorage`
sont **abandonnés**, la base fait foi.

---

## 2. Ce qui a été trouvé avant d'écrire une ligne

Trois constats, tous vérifiés, qui ont changé le point de départ.

### 2.1 La branche ignorait la moitié du module

`origin/main` portait `b93d741` (08/08) : bibliothèque machines **à 70 modèles**
classés par sous-famille avec rang de popularité, recherche libre, et **paramètres
de prix par type** (calage, gâche, plaques, clic couleur, encre au m², cadences).
La purge des `€` de la tranche 1 multi-devise avait été appliquée à la version
**antérieure, à 35 modèles**. Une fusion tardive aurait détruit l'enrichissement.

→ `origin/main` fusionné en premier. Les trois fichiers du module ont fusionné
automatiquement ; seuls deux documents ont demandé un arbitrage.

### 2.2 Le module était cassé, et il n'était pas le seul

`MachineDialog`, `CartRow` et `FinalSteps` lisaient une variable `currency`
définie dans un **autre composant**. `ReferenceError` dès qu'on ouvrait une
machine ou qu'on atteignait le modèle de coût du wizard.

### 2.3 La cause racine : aucune vérification de types n'a jamais tourné

Dépôt écrit intégralement en `.ts`/`.tsx`, **sans TypeScript installé ni
`tsconfig.json`**. `vite build` transpile via esbuild, qui efface les types sans
les vérifier. Build vert, 866 tests verts, et trois écrans en panne.

La première passe de typage a trouvé **5 symboles introuvables**, tous des pannes
réelles — dont **trois du même défaut**, tous introduits par la même purge des euros :

| Écran | Symbole | Conséquence à l'usage |
|---|---|---|
| `MachineParkDetail.MachineDialog` | `currency` | paramétrer une machine |
| `MachineParkWizard.CartRow` / `FinalSteps` | `currency` | panier et modèle de coût |
| `DashboardCommercial.RuleDialog` | `currency`, `adjustModeLabel` | créer une règle de prix |
| `AccountHub.AccountQuotes` | `currency` | onglet Devis de l'acheteur |
| `DashboardAdminPIM` | `upsertGamme` | enregistrer le visuel d'une gamme |

---

## 3. Ce qui a été livré

### 3.1 Le contrat (R1)

- **[docs/API_PARC_MACHINE.md](../../docs/API_PARC_MACHINE.md)** v1.0 — transport,
  authentification, objets du domaine, 7 routes, table des erreurs, et un §6
  « décisions de conception et leur motif ».
- **[src/server/park/contract.ts](../../src/server/park/contract.ts)** — la forme
  exécutable : schémas Zod, types, codes d'erreur, et `parkIsCalculable`.

Ce fichier est **partagé** entre le navigateur (Vite) et l'edge function (Deno),
`zod` étant résolu des deux côtés via `supabase/functions/import_map.json`. Il n'y
a donc **pas deux définitions du parc** à tenir d'accord, et la règle BK-17 n'a
qu'une implémentation.

### 3.2 Le modèle de données

Migration **`20260811000100_machine_park_api.sql`** — idempotente, 4 tables :

| Table | Nature | Isolation |
|---|---|---|
| `machine_library` | référentiel **partagé** (70 modèles seedés) | lecture pour tout membre, écriture super-admin |
| `supplier_directory` | **référentiel Fournisseur unifié BK-07** — papier, transport, sous-traitance dans une seule table (17 entrées communes) | commun visible de tous ; ajout local isolé par espace |
| `machine_parks` | données de l'imprimeur | RLS `current_user_tenant_ids()` |
| `machine_park_machines` | données de l'imprimeur | idem + **trigger** `mpm_tenant_guard` |

Deux points qui méritent d'être dits :

- **Le trigger n'est pas de la ceinture-bretelle.** La RLS seule ne couvre pas le
  cas d'un membre de **deux** espaces qui rattacherait une machine au parc de
  l'autre : il passerait les deux clauses avec un `tenant_id` incohérent avec
  `park_id`. Le trigger l'interdit, et le test Cas 5 le prouve en `service_role`,
  hors RLS.
- **Deux index uniques partiels** sur `supplier_directory`, et non un
  `unique(kind, name, tenant_id)` : en SQL, `NULL` n'est jamais égal à `NULL`,
  ce qui aurait autorisé autant de doublons que d'insertions dans le commun.

### 3.3 La couche serveur

Edge function **`supabase/functions/park-api/`**. Elle **n'utilise pas la clé de
service** : elle repasse le JWT de l'appelant à la base, si bien que la RLS
s'applique à chacune de ses requêtes. Conséquence recherchée — un défaut de
logique dans cette fonction ne peut pas faire fuiter le parc d'un imprimeur vers
un autre, parce que c'est la base qui refuse.

### 3.4 Les 5 fonctions

Mêmes noms, mêmes paramètres. Ce qui change et ne pouvait pas ne pas changer :
elles rendent des **promesses**.

| Fonction | Avant | Après |
|---|---|---|
| `loadParks(tenantId)` | `localStorage` | `GET /parks` |
| `saveParks(tenantId, parks)` | `localStorage` | `PUT /parks` (collection entière) |
| `upsertPark(tenantId, park)` | `localStorage` | `POST /parks` |
| `deletePark(tenantId, parkId)` | `localStorage` | `DELETE /parks/:id` |
| `parkIsCalculable(park)` | locale | **inchangée, et volontairement** |

`parkIsCalculable` reste synchrone : le serveur renvoie déjà `calculable` sur tout
parc enregistré **et fait foi**, mais le wizard doit pouvoir se prononcer sur un
parc *en cours de constitution*, qui n'existe encore nulle part.

### 3.5 Les écrans

Les trois écrans ont gagné les états qu'impose un accès réseau : chargement,
erreur affichable, réessai. Deux détails qui comptent à l'usage :

- **La liste et le détail lisent `park.calculable` du serveur**, ils ne le
  recalculent pas. L'écran n'a pas à pouvoir être d'un autre avis que le moteur
  qui refusera, ou non, de sortir un prix.
- **Un échec d'enregistrement en fin de wizard ne fait pas naviguer.** Le parcours
  vient de coûter 14 à 19 clics (mesure BK-15) ; le perdre sur une coupure réseau
  serait le pire des aboutissements. La saisie est conservée, l'erreur affichée.

### 3.6 L'outillage

`typescript@5.9.3` en dépendance de développement, `tsconfig.json` **volontairement
permissif** (R5), table `paths` pour `/utils/*` et `@/*`, script `pnpm typecheck`.

**79 erreurs → 32.** Zéro symbole introuvable. Les 32 restantes sont de la dette
de typage héritée sans effet au runtime (13 accès hors type, 10 fixtures de test,
7 directives inutiles, 2 casts) : le script est **un compteur à faire baisser, pas
encore une barrière**. Il ne deviendra bloquant que lorsqu'il atteindra zéro.

---

## 4. Tests

| Fichier | Cas | État |
|---|---|---|
| `tests/server/park/parkContract.test.ts` | **26** | ✅ verts |
| `tests/rls/machine_park_isolation.test.ts` | **10** | ⏳ en attente de la migration |

**BK-17 est couverte pour la première fois** — 10 cas, dont trois qui n'étaient
évidents pour personne :

- un massicot **inactif** ne rend pas le parc calculable (BK-27) : sinon l'écran
  promettrait un prix que le moteur refuse ;
- `active` **absent** vaut actif, `active: null` aussi — la base rend `null`,
  le wizard rend `undefined` ;
- l'absence de **plieuse** n'est pas bloquante : c'est une question, pas un refus.

Et un cas qui ferme une porte : **`calculable` envoyé par un client est ignoré**.
L'accepter reviendrait à laisser déclarer calculable un parc qui ne l'est pas.

**Suite complète : 892 tests verts** (866 avant, +26).

---

## 5. Rapport de sortie de tâche (R8)

### 5.1 Modules touchés

`dashboard/machines` (les 3 écrans, le helper, un hook neuf) · `server/park`
(contrat + adaptateur, neufs) · `supabase/functions/park-api` (neuf) · migration
`20260811000100` · **hors périmètre initial mais corrigés** : `dashboard/commercial`,
`shop/portal/AccountHub`, `DashboardAdminPIM`.

### 5.2 API créées

Contrat v1.0 complet dans [docs/API_PARC_MACHINE.md](../../docs/API_PARC_MACHINE.md).
7 routes : `GET /machine-library` · `GET /suppliers` · `GET /parks` ·
`GET /parks/:id` · `POST /parks` · `PUT /parks` · `DELETE /parks/:id`.

### 5.3 Dérogations R5

| Dérogation | Chemin de mise en conformité |
|---|---|
| **Contrat rétro-documenté** — l'écran existait avant l'API, contre l'ordre prescrit par R1 | Refermée à la livraison : le front ne parle plus à la base, et rien de nouveau n'est écrit hors contrat |
| **Pas de transaction** sur le remplacement des machines — PostgREST n'en ouvre pas sur plusieurs requêtes | Fenêtre où le parc est vu sans ses machines. Sans conséquence sur un écran de paramétrage ; **à reprendre en fonction SQL transactionnelle si un calcul de prix vient lire ces tables en continu** |
| **32 erreurs de typage héritées** tolérées | Compteur à faire baisser ; `pnpm typecheck` bloquant en CI à zéro |
| **Montants en `number`** | Périmètre de la **tranche 2** multi-devise, qui porte précisément sur les coûts de production |

### 5.4 Tests exécutés

- `pnpm build` : ✅ vert
- `pnpm typecheck` : 32 erreurs héritées, **0 dans le module** (79 avant l'intervention)
- `pnpm test` : **892 verts** hors RLS Parc machine
- RLS Parc machine (10 cas) : ⏳ **en attente de l'application de la migration**

---

## 6. Reste à faire

| # | Action | Qui |
|---|---|---|
| 1 | **Appliquer la migration** `20260811000100` (`supabase db push`) — bloquée par le garde-fou d'autorisation en séance | Arnaud (autorisation) |
| 2 | **Déployer** `supabase functions deploy park-api --import-map supabase/functions/import_map.json` | idem |
| 3 | Rejouer les 10 tests RLS une fois la migration appliquée | Amelia |
| 4 | Recette visuelle des 3 écrans en conditions réelles | Amelia |
| 5 | Faire valider le contrat v1.0 par Xavier Péchoultres — c'est le point de substitution vers Clariprint Data | Arnaud |

**Point de vigilance à connaître** : l'import du bundle Deno suit un chemin
relatif vers `src/server/park/contract.ts`, hors du dossier des fonctions. C'est
supporté (le bundler suit le graphe de modules), mais **c'est le premier usage du
genre dans ce dépôt** — à vérifier au premier déploiement. En cas d'échec, le
repli est de recopier le contrat dans `supabase/functions/_shared/`, au prix
d'une duplication à tenir d'accord.
