# Story technique — Contexte client/projet de l’accueil Magrit

## Statut

Prête pour revue d’architecture, non implémentée.

Date : 10 septembre 2026.

Spécification UX opposable :
[`spec-ux-accueil-contexte-client-projet.md`](../planning-artifacts/spec-ux-accueil-contexte-client-projet.md).

Cette story prolonge
[`story-hopstudio-pim-dual-workspace.md`](./story-hopstudio-pim-dual-workspace.md).

## Objectif technique

Introduire un contexte commercial explicite dans l’accueil Magrit :

```ts
type WorkspaceCommercialContext = Readonly<{
  customer: CustomerContextSummary;
  project: ProjectContextSummary | null;
  source: 'saved' | 'counter' | 'selected' | 'created';
}>;
```

Le contexte actif appartient à l’onglet navigateur. Le backend persiste
uniquement le **dernier contexte utilisé** afin d’amorcer une prochaine visite.
Cette distinction évite que deux onglets ouverts sur deux clients différents se
remplacent mutuellement leur contexte en cours.

## État existant vérifié

### Déjà disponible

- `GET /customers` : recherche paginée par raison sociale, prénom ou nom ;
- `POST /customers` : création d’un client ;
- `GET /projects` : pagination par `(updated_at, id)`, recherche sur projet ou
  nom du client, filtre par `customer_id` et `status` ;
- `POST /projects` : création avec `customer_id` obligatoire ;
- `ConfiguratorPage` : sélection entre l’ancien chat et le nouveau workspace
  selon l’activation HopeStudio ;
- `ConfiguratorWorkspace` : machine d’état `home/split/studio/pim` ;
- `HopeStudioWorkspace` : identité tenant/utilisateur et transport workflow ;
- `commercial_settings` : singleton tenant lisible par les membres et modifiable
  sous `can_manage_pricing` ;
- `user_preferences` : préférences utilisateur globales, dont le dernier
  tenant, mais sans contexte commercial par tenant.

### Manques bloquants

1. aucune persistance du dernier couple client/projet par utilisateur et
   tenant ;
2. aucun client comptoir configurable ;
3. `ProjectDto` ne fournit pas le nom du client nécessaire aux dix projets
   récents ;
4. la recherche Clients ne couvre pas le SIRET ;
5. le contexte n’est pas injecté dans les appels HopeStudio ;
6. aucune garde serveur commune ne vérifie le couple
   `tenant/customer/project` avant relais externe ;
7. la machine d’état du configurateur ne sait pas protéger un changement de
   contexte après le début d’une conversation.

## Architecture cible

```text
ConfiguratorPage
└── WorkspaceCommercialContextBoundary
    ├── bootstrap du dernier contexte / client comptoir
    ├── ContextBar
    ├── ContextPicker
    ├── QuickProjectDialog
    └── ConfiguratorWorkspace
        ├── MagritConfiguratorHome
        └── DualToolWorkspace
            ├── HopeStudioWorkspace(customerId, projectId)
            └── PimSearchPanel(customerId, projectId)
```

Le contexte commercial est une orchestration de surface entre les modules
`customers`, `projects`, `commercial-settings`, `catalog` et `hopstudio`. Les
modules métier restent propriétaires de leurs entités. Aucun composant ne doit
importer un chemin profond d’un autre module : les contrats et clients utiles
doivent être exposés par leurs façades publiques.

## Modèle de données

### Client comptoir du tenant

Étendre `public.commercial_settings` :

```sql
alter table public.commercial_settings
  add column counter_customer_id uuid null references public.customers(id)
  on delete set null;
```

Une contrainte ou un trigger doit garantir que le client appartient au même
tenant que `commercial_settings.tenant_id`. La FK simple ne suffit pas à cette
garantie.

Règles :

- `null` signifie « forcer la sélection lorsqu’aucun contexte n’est restauré » ;
- le client doit être actif au moment de la résolution ;
- la modification réutilise le droit `can_manage_pricing`, car le choix affecte
  directement le contexte de résolution commerciale ;
- aucun client « comptoir » n’est créé implicitement par migration.

### Dernier contexte par utilisateur et tenant

Créer une table dédiée plutôt que d’ajouter deux colonnes globales à
`user_preferences` :

```sql
create table public.user_workspace_contexts (
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (user_id, tenant_id)
);
```

Garanties obligatoires en base :

- l’utilisateur est membre du tenant ;
- le client appartient au tenant ;
- le projet, s’il existe, appartient au tenant et au client ;
- RLS en lecture/écriture limitée à `auth.uid() = user_id` et aux tenants
  accessibles ;
- aucun accès `anon` ;
- un projet archivé ou client désactivé peut rester référencé historiquement,
  mais il est ignoré lors du bootstrap.

## Contrat API proposé

Le contrat OpenAPI doit être écrit avant les routes et les types générés.

### Lire le contexte initial

```http
GET /api/v1/workspace-context
X-Magrit-Tenant: <tenant-id>
```

Réponse avec contexte :

```json
{
  "data": {
    "source": "saved",
    "customer": {
      "id": "...",
      "display_name": "Imprimerie Dupont",
      "type": "company",
      "is_counter": false
    },
    "project": {
      "id": "...",
      "name": "Campagne été 2027",
      "updated_at": "2026-09-10T08:00:00Z"
    }
  },
  "meta": {}
}
```

Réponse sans contexte disponible :

```json
{
  "data": {
    "source": "selection_required",
    "customer": null,
    "project": null
  },
  "meta": {}
}
```

Résolution serveur :

1. relire le dernier contexte utilisateur ;
2. conserver le client et le projet uniquement s’ils sont encore valides ;
3. si le client sauvegardé est invalide, essayer le client comptoir actif ;
4. sinon rendre `selection_required` ;
5. ne jamais révéler qu’un identifiant hors tenant existe.

### Mémoriser le dernier contexte

```http
PUT /api/v1/workspace-context
X-Magrit-Tenant: <tenant-id>
Content-Type: application/json

{
  "customer_id": "...",
  "project_id": "..."
}
```

`project_id` est nullable. Le serveur valide l’ensemble atomiquement avant
l’upsert. Codes métier proposés :

- `workspace_context.customer_required` — 422 ;
- `workspace_context.customer_not_found` — 404 sans oracle inter-tenant ;
- `workspace_context.customer_inactive` — 409 ;
- `workspace_context.project_not_found` — 404 ;
- `workspace_context.project_archived` — 409 ;
- `workspace_context.project_customer_mismatch` — 422.

Le `PUT` ne change que la préférence d’amorçage. Il ne pilote pas les autres
onglets déjà ouverts.

### Réglages commerciaux

Étendre `CommercialSettings` et `UpdateCommercialSettingsCommand` avec :

```yaml
counter_customer_id:
  type: [string, "null"]
  format: uuid
```

La réponse peut aussi fournir un résumé `counter_customer` si cela évite une
lecture supplémentaire dans l’écran de réglages. Il ne faut pas dénormaliser le
nom en base.

### Résultats projet enrichis

Étendre la représentation de liste des projets avec un résumé client calculé :

```ts
type ProjectCustomerSummary = Readonly<{
  id: string;
  display_name: string;
  type: 'company' | 'individual';
}>;
```

Option recommandée : ajouter `customer` à `ProjectDto` et à `ProjectDetailDto`
via un embed PostgREST sur la FK existante. Cela évite un N+1 pour les dix
projets récents et rend également la page Projets plus autonome.

Si l’impact de contrat est jugé trop large, créer une représentation dédiée
`RecentProjectContext`; ne pas effectuer dix appels `GET /customers/{id}`.

### Recherche

Réutiliser en parallèle :

```text
GET /projects?q=<term>&status=active&page[size]=10
GET /customers?q=<term>&page[size]=10
```

Étendre la recherche `customers.q` au SIRET. Les réponses conservent leurs
curseurs indépendants. Une route de recherche unifiée n’est justifiée que si
les mesures montrent que deux requêtes posent un problème réel.

## État frontend

### Types

```ts
type WorkspaceContextSource =
  | 'saved'
  | 'counter'
  | 'selected'
  | 'created'
  | 'selection_required';

type WorkspaceCommercialContextState = Readonly<{
  status: 'loading' | 'ready' | 'selection_required' | 'error';
  source: WorkspaceContextSource;
  customer: CustomerContextSummary | null;
  project: ProjectContextSummary | null;
  pickerOpen: boolean;
  pickerTarget: 'customer' | 'project';
}>;
```

### Invariants du reducer

- `status === 'ready'` implique `customer !== null` ;
- `project !== null` implique `customer.id === project.customer_id` ;
- `selectProject(project)` remplace client et projet ensemble ;
- `selectCustomer(customer)` conserve le projet uniquement si compatible ;
- `clearProject()` ne change pas le client ;
- `invalidateCustomer()` passe à `selection_required` ;
- le composeur n’est activé que lorsque `status === 'ready'`.

Le reducer doit être pur et testé indépendamment du DOM.

### Persistance

Une sélection met à jour immédiatement l’état local, puis mémorise le contexte
en arrière-plan. Si la mémorisation échoue :

- le contexte de l’onglet reste utilisable ;
- un message non bloquant indique qu’il ne pourra peut-être pas être restauré ;
- une erreur de validation métier remet en revanche l’interface en sélection
  obligatoire.

Les identifiants peuvent être reflétés dans l’URL pour permettre le rechargement
et les liens profonds, sous forme de paramètres de requête. L’URL ne devient pas
la source d’autorité : le backend revalide toujours les deux identifiants.

## Intégration HopeStudio

Étendre les propriétés de `HopeStudioWorkspace` :

```ts
type HopeStudioWorkspaceProps = Readonly<{
  tenantId: string;
  userId: string;
  customerId: string;
  projectId: string | null;
  initialRequest: HopeStudioInitialRequest;
  compact?: boolean;
}>;
```

Le transport workflow doit envoyer le contexte sous des noms métier stables :

```json
{
  "tenantId": "...",
  "userId": "...",
  "customerId": "...",
  "projectId": "..."
}
```

Le backend ne doit pas se contenter de recopier ces champs dans le formulaire
HopeStudio. Il doit :

1. imposer `tenantId` et `userId` depuis l’identité authentifiée ;
2. vérifier que `customerId` appartient au tenant et est actif ;
3. vérifier que `projectId`, s’il existe, appartient au client et est actif ;
4. remplacer toute valeur contradictoire éventuellement émise par HLUX ;
5. injecter les identifiants vérifiés dans la session/les paramètres transmis à
   HopeStudio ;
6. inscrire `customerId` et `projectId` dans les métadonnées expurgées de
   `external_service_requests`.

La même validation s’applique au chemin `/api/v1/assistant/chat` lorsqu’il est
routé vers HopeStudio.

### Cycle de session

Le couple suivant définit l’espace de conversation :

```text
(tenant_id, user_id, customer_id, project_id nullable)
```

Au changement de ce couple :

- démonter/détacher l’instance active après confirmation ;
- remettre `sessionRef` et `sessionDataRef` à `null` ;
- créer une nouvelle `InitialConfiguratorRequest` au prochain prompt ;
- ne jamais envoyer le nouveau client dans une ancienne session HopeStudio.

## Découpage recommandé

### Lot 1 — Contrat et persistance

- migration `commercial_settings.counter_customer_id` ;
- table `user_workspace_contexts`, contraintes et RLS ;
- OpenAPI et types générés ;
- repository/service/routes du contexte ;
- extension de la recherche client au SIRET ;
- résumé client sur les projets récents.

### Lot 2 — Sélecteur et barre de contexte

- `WorkspaceCommercialContextBoundary` ;
- reducer et bootstrap ;
- `ContextBar` desktop/mobile ;
- `ContextPicker` paginé et accessible ;
- affichage des dix projets récents ;
- branchement des formulaires Client et Projet existants.

### Lot 3 — Protection du travail en cours

- détection prompt/conversation/configuration ;
- dialogue de confirmation ;
- réinitialisation sûre de `ConfiguratorWorkspace` ;
- conservation du prompt non envoyé ;
- gestion des invalidations client/projet.

### Lot 4 — Propagation HopeStudio et prix

- contrats `customerId`/`projectId` ;
- validation backend et injection forcée ;
- séparation des sessions par contexte ;
- invalidation des prix au changement de client ;
- traces externes enrichies sans donnée personnelle supplémentaire.

Chaque lot doit rester déployable et testable. Le composeur reste bloqué tant
que Lot 4 n’est pas capable de garantir le contexte côté serveur.

## Fichiers pressentis

### Contrat et backend

- `openapi/magrit-core.v1.yaml` ;
- `src/platform/api/generated/magrit-core.v1.ts` ;
- `src/modules/commercial-settings/api/contracts.ts` ;
- `src/modules/workspace-context/api/contracts.ts` ;
- `src/modules/workspace-context/api/client.ts` ;
- `src/modules/workspace-context/application/workspace-context-service.ts` ;
- `src/modules/workspace-context/application/workspace-context-repository.ts` ;
- `src/adapters/supabase/workspace-context-repository.ts` ;
- `src/server/api/workspace-context-routes.ts` ;
- `src/server/api/gescom-routes.ts` ;
- `supabase/functions/magrit-api/index.ts` ;
- nouvelle migration datée après les migrations présentes.

### Frontend

- `src/modules/catalog/ui/workspace/ConfiguratorPage.tsx` ;
- `src/modules/catalog/ui/workspace/ConfiguratorWorkspace.tsx` ;
- `src/modules/catalog/ui/workspace/configurator-workspace-state.ts` ;
- `src/modules/catalog/ui/workspace/WorkspaceContextBar.tsx` ;
- `src/modules/catalog/ui/workspace/WorkspaceContextPicker.tsx` ;
- `src/modules/catalog/ui/workspace/QuickProjectDialog.tsx` ;
- `src/modules/hopstudio/ui/HopeStudioWorkspace.tsx` ;
- `src/shared/presentation/testIds.ts`.

Les noms sont indicatifs. L’architecture modulaire peut préférer placer la
composition de contexte sous `src/app/surfaces/`; la revue doit trancher ce
point avant implémentation pour éviter que `catalog` devienne propriétaire
d’une règle commerciale transverse.

## Plan de tests

### Domaine et contrats

- priorité dernier contexte > client comptoir > sélection obligatoire ;
- client sauvegardé inactif ;
- projet sauvegardé archivé avec client encore valide ;
- client/projet de tenants différents ;
- projet appartenant à un autre client ;
- suppression du client comptoir (`ON DELETE SET NULL`) ;
- recherche client par SIRET ;
- pagination indépendante clients/projets ;
- `ProjectDto.customer` sans N+1.

### RLS et SQL

- un utilisateur ne lit/modifie que ses contextes ;
- un membre ne peut pas mémoriser un client d’un autre tenant ;
- un projet incohérent est rejeté en base même en contournant l’API ;
- `anon` n’a aucun accès ;
- le client comptoir doit appartenir au tenant ;
- un membre sans `can_manage_pricing` ne modifie pas le client comptoir.

### Frontend

- barre visible dans les quatre modes ;
- sélecteur bloquant sans client ;
- dix projets récents ;
- debounce, annulation et réponse obsolète ignorée ;
- sélection projet => sélection client atomique ;
- changement client => projet incompatible retiré ;
- création projet préremplie et prompt conservé ;
- navigation clavier, focus et annonces accessibles ;
- responsive mobile ;
- confirmation après démarrage d’une conversation ;
- échec de mémorisation non bloquant.

### HopeStudio

- aucun appel sans `customerId` ;
- remplacement des identifiants falsifiés ;
- rejet d’un projet hors client/tenant ;
- injection du contexte dans `parameters_value.session` ;
- remise à zéro des références de session après changement ;
- contexte présent dans les traces, secrets absents ;
- panne HopeStudio indépendante du panneau PIM.

## Critères d’acceptation de développement

1. Les quinze critères UX du document associé sont couverts par des tests ou
   une preuve manuelle documentée.
2. Le contrat OpenAPI précède et décrit toutes les nouvelles opérations.
3. Les types générés sont alignés (`pnpm gen:api:check`).
4. Les invariants tenant/client/projet existent dans le service et en base.
5. Aucun N+1 n’est introduit pour les dix projets récents.
6. Aucun secret ni coût/marge interne n’est ajouté aux payloads HopeStudio ou
   aux traces.
7. Le contexte actif d’un onglet ne dépend pas d’une relecture continue de la
   préférence persistée.
8. Le build, le typecheck, les contrats, l’architecture modulaire, les tests
   RLS/SQL et les parcours E2E ciblés passent.

## Hors périmètre technique

- moteur de calcul des marges ;
- persistance complète des conversations HopeStudio dans Magrit ;
- synchronisation temps réel multi-onglets ;
- création automatique d’un client comptoir ;
- migration des conversations historiques vers un contexte client/projet ;
- recherche sémantique clients/projets.

## Questions à fermer en revue

1. Le client comptoir est-il retenu comme option tenant ou la sélection doit-elle
   toujours être forcée au premier accès ?
2. Quel écran admin porte son réglage : Réglages commerciaux ou fiche Client ?
3. Le contexte doit-il apparaître dans l’URL dès le premier lot ?
4. Une conversation existante peut-elle être rouverte si son client est devenu
   inactif ? En lecture seule est la recommandation.
5. Faut-il autoriser « sans projet » pour tous les usages HopeStudio, ou forcer
   un projet dès qu’une configuration est enregistrée ?
6. Le module transverse se nomme-t-il `workspace-context` ou reste-t-il une
   composition sous `app/surfaces` ?

