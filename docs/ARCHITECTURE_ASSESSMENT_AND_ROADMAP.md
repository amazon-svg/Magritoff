# Diagnostic d'architecture et trajectoire de consolidation

**Projet :** Magrit  
**Date du diagnostic :** 4 août 2026  
**Statut :** document de travail vivant  
**Objectif :** rendre l'application solide, maintenable et évolutive sans réécriture brutale.

**Précision associée :** [Kernel, modules et services](./ARCHITECTURE_KERNEL_MODULES_SERVICES.md)

## 1. Résumé exécutif

Magrit repose sur un socle Supabase cohérent et possède déjà des frontières métier identifiables : multi-tenant, boutiques, catalogue/PIM, commandes, devis, assistant IA, Clariprint et mockups.

L'application n'est toutefois pas encore « API-first » au sens strict. Supabase fournit bien une API technique (PostgREST, RPC et Edge Functions), mais l'application ne dispose pas d'une API métier contractuelle, indépendante de son frontend. Le code React connaît fréquemment les tables, les colonnes et les procédures PostgreSQL, parfois jusque dans les composants de page.

Le système peut être qualifié de **monolithe modulaire Supabase** : les domaines existent, mais les frontières entre présentation, orchestration métier et accès aux données restent perméables.

### Évaluation initiale

| Axe | Note indicative | Lecture |
|---|---:|---|
| API-first | 4/10 | Backend exposé comme API, mais pas de contrats métier stables et indépendants |
| Découpage métier | 6/10 | Domaines reconnaissables, organisation encore largement technique |
| Séparation UI / métier / données | 4/10 | Accès Supabase et orchestration présents dans les composants |
| Sécurité multi-tenant | 7/10 | RLS, RPC et tests d'isolation constituent un socle sérieux |
| Testabilité | 6/10 | Bonne diversité de tests, mais frontières difficiles à isoler |
| Maintenabilité | 5/10 | Plusieurs abstractions utiles, contrebalancées par de gros composants et un backend historique monolithique |

Ces notes constituent une photographie de départ, pas une mesure de performance d'équipe.

## 2. Architecture observée

```text
React / React Router
        |
        +-- Contexts React
        |       +-- appels directs Supabase/PostgREST
        |
        +-- Pages et composants
        |       +-- appels directs Supabase/RPC/Edge Functions
        |
        +-- Hooks, helpers et quelques adaptateurs
                +-- Claude SSE / Clariprint
                            |
                            v
                       Supabase
                       +-- PostgreSQL + RLS
                       +-- RPC PostgreSQL
                       +-- Edge Functions Deno
                       +-- Storage
                            |
                            v
                  Claude / Clariprint / Resend
```

### Domaines fonctionnels déjà visibles

- tenants, membres, invitations et capacités ;
- boutiques et personnalisation ;
- catalogue, bibliothèques et PIM ;
- panier, commandes et workflow ;
- devis et modèles de devis ;
- assistant conversationnel et consommation LLM ;
- tarification Clariprint ;
- génération et gestion des mockups.

### Organisation du frontend

Le frontend est principalement organisé par nature technique :

```text
src/app/
  components/
  contexts/
  hooks/
  lib/
  utils/
src/schemas/
src/server/
```

Des sous-domaines sont cependant déjà visibles dans `components/shop`, `components/shop/portal`, `components/dashboard`, `components/tenant` et `components/mockup`.

## 3. Positionnement API-first

### Ce qui est déjà favorable

- Supabase expose les données via PostgREST.
- Les opérations sensibles peuvent être portées par des RPC PostgreSQL.
- Plusieurs intégrations sont isolées dans des Edge Functions.
- Des schémas Zod formalisent certains payloads.
- Clariprint est protégé par une interface Adapter testable.

### Ce qui empêche de parler d'API-first

- aucun contrat OpenAPI ou équivalent n'est maintenu ;
- absence de versionnement explicite des contrats (`v1`, `v2`) ;
- absence de couche canonique `repositories`/`services` pour les données ;
- environ 28 fichiers frontend utilisent directement `supabase.from()`, `rpc()` ou `functions.invoke()` ;
- les noms de tables et colonnes traversent le frontend ;
- certaines transactions métier sont orchestrées depuis le navigateur ;
- les contrats de requête et de réponse ne sont pas systématiquement partagés entre frontend et Edge Functions.

Conclusion : **Magrit utilise un backend fourni sous forme d'API, mais n'est pas encore conçu API-first.**

## 4. Forces à préserver

### 4.1 Sécurité et isolation multi-tenant

- utilisation importante des Row Level Security policies ;
- tenant scope explicite dans le modèle ;
- RPC pour plusieurs transitions et opérations sensibles ;
- tests d'isolation sur tenants, commandes, devis et rôles ;
- audit trail et workflow de commande modélisés en base.

Les invariants d'autorisation doivent continuer à être imposés côté base ou serveur, jamais uniquement dans React.

### 4.2 Validation et contrats locaux

Des schémas Zod existent pour les commandes, lignes de commande, produits, paniers et payloads Clariprint. Les Edge Functions les plus récentes valident également leurs entrées.

Cette pratique doit devenir systématique et s'appuyer sur des contrats partagés.

### 4.3 Intégrations externes

Le pattern `ClariprintAdapter` est une bonne référence interne :

- interface stable ;
- erreurs typées ;
- implémentation de production et mock ;
- validation centralisée ;
- isolation du fournisseur externe.

Le wrapper Anthropic partagé suit la même direction.

### 4.4 Tests et migrations

Le dépôt contient des tests unitaires, de contexts, de hooks, de schémas, d'Edge Functions, de RLS, d'accessibilité et end-to-end. Les migrations SQL sont versionnées et accompagnées de documentation.

## 5. Faiblesses et risques

### 5.1 Couplage du frontend au schéma Supabase

Les composants et contexts connaissent directement les tables, les colonnes et les RPC. Une évolution SQL peut donc se propager à de nombreux écrans.

**Risque :** coût de changement élevé, duplication des requêtes et erreurs difficiles à normaliser.

### 5.2 Transactions métier réalisées dans l'interface

La création de commande réalise actuellement plusieurs étapes depuis `PublicShop.tsx` : validation, insertion de l'entête, insertion des lignes, rollback compensatoire et notification.

**Risque :** état partiel en cas de panne ou fermeture du navigateur, logique difficile à réutiliser et tests plus coûteux.

Cette opération doit devenir une transaction atomique côté PostgreSQL ou Edge Function.

### 5.3 Composants et fonctions volumineux

Principaux signaux observés lors du diagnostic :

| Fichier | Taille approximative |
|---|---:|
| `supabase/functions/make-server-e3db71a4/index.ts` | 1 633 lignes |
| `DashboardShopEditor.tsx` | 1 230 lignes |
| `OrderHistoryTable.tsx` | 1 133 lignes |
| `DashboardUsers.tsx` | 1 104 lignes |
| `ChatInterface.tsx` | 1 070 lignes |
| `PortalCatalog.tsx` | 989 lignes |
| `PublicShop.tsx` | 945 lignes |

La taille seule n'est pas un défaut. Ici, elle accompagne souvent un mélange de rendu, état local, accès aux données, validation et orchestration métier.

### 5.4 Monolithe de providers React

`AppShell` empile les providers Tenant, Conversation, Library, Shops, QuoteTemplates, Cart et Quotes. Cela facilite l'accès global mais augmente les dépendances implicites, les re-renders et la difficulté à comprendre les besoins réels de chaque route.

### 5.5 Client Supabase insuffisamment typé

`src/types/database.types.ts` existe, mais le client est créé sans le générique `Database`.

**Conséquences :** perte d'autocomplétion et de vérification compile-time, recours à des casts et risque de dérive entre TypeScript et PostgreSQL.

### 5.6 Contrats dispersés

- Zod est utilisé à plusieurs endroits et avec plusieurs versions côté Edge ;
- les réponses d'API ne sont pas toutes validées ;
- les types générés de la base ne constituent pas un contrat métier ;
- aucun SDK ou client d'API canonique n'existe.

### 5.7 Documentation fragmentée

Les décisions sont réparties entre `ARCHITECTURE.md`, les documents BMAD, les stories et les rapports de refactorisation. Certaines descriptions historiques ne correspondent plus exactement au code actuel.

## 6. Architecture cible

La cible n'est pas nécessairement un ensemble de microservices. Un **monolithe modulaire** bien structuré est adapté au produit tant que les frontières sont explicites.

```text
UI / Routes
    |
    v
Hooks de cas d'usage
    |
    v
Services applicatifs
    |
    +-- règles métier pures
    +-- orchestration
    |
    v
Repositories / API client
    |
    +-- PostgREST pour CRUD simples et sûrs
    +-- RPC transactionnelles pour opérations métier
    +-- Edge Functions pour secrets et intégrations externes
    |
    v
PostgreSQL / RLS / services externes
```

### Structure cible indicative

```text
src/
  modules/
    orders/
      domain/
      application/
      infrastructure/
      ui/
    shops/
    catalog/
    quotes/
    tenants/
    conversations/
  shared/
    api/
    auth/
    validation/
    ui/
```

Cette structure pourra être introduite progressivement. Il n'est pas nécessaire de déplacer tout le dépôt avant d'en tirer profit.

## 7. Principes d'architecture à adopter

1. **Les composants ne connaissent pas les tables.** Ils appellent des hooks ou cas d'usage.
2. **Une opération métier critique est atomique côté serveur.**
3. **La RLS demeure la dernière barrière d'autorisation.**
4. **Chaque entrée externe est validée.**
5. **Les contrats métier sont distincts des lignes PostgreSQL.**
6. **Les intégrations externes passent par des adaptateurs.**
7. **Une seule source de vérité par donnée.**
8. **Les dépendances vont de l'UI vers le domaine, jamais l'inverse.**
9. **Les refactorisations restent incrémentales et couvertes par des tests.**
10. **Toute décision structurante est consignée dans un ADR court.**

## 8. Feuille de route proposée

### Phase 0 — Baseline et garde-fous

- aligner la version Node locale et CI ;
- rendre obligatoires `build`, tests unitaires et tests critiques RLS ;
- mesurer couverture, temps de build et taille du bundle ;
- brancher `Database` sur le client Supabase ;
- introduire une règle interdisant les nouveaux appels Supabase directs depuis les composants ;
- documenter les exceptions temporaires.

**Résultat attendu :** aucune nouvelle dette de frontière pendant la migration.

### Phase 1 — Commandes comme module pilote

- créer un module `orders` ;
- centraliser types, schémas et statuts ;
- créer un repository de lecture ;
- déplacer la création de commande vers une RPC transactionnelle ;
- rendre la notification idempotente et observable ;
- migrer `PublicShop`, `PortalOrders` et `DashboardOrders` vers les cas d'usage ;
- conserver les tests RLS et ajouter des tests d'intégration de la transaction.

**Pourquoi commencer ici :** il s'agit d'un flux financier critique et le besoin d'atomicité est déjà visible.

### Phase 2 — Boutiques, catalogue et PIM

- séparer les modèles PIM, bibliothèque et produit de boutique ;
- définir un modèle de lecture canonique pour le catalogue ;
- extraire les accès Supabase de `ShopsContext`, `PublicShop` et `PortalCatalog` ;
- centraliser filtrage, enrichissement, pricing et résolution de gamme ;
- découper les gros écrans par cas d'usage.

### Phase 3 — Utilisateurs, rôles et invitations

- centraliser les opérations de membres et invitations ;
- garantir leur atomicité ;
- séparer administration des rôles, audit et affichage ;
- normaliser les erreurs d'autorisation ;
- renforcer les tests de capacités et transitions.

### Phase 4 — API contractuelle

À déclencher si un client mobile, un partenaire ou une API publique est prévu :

- définir les ressources et cas d'usage exposés ;
- versionner l'API ;
- produire un contrat OpenAPI ;
- générer un client typé ;
- ajouter tests contractuels, idempotency keys et rate limiting ;
- documenter authentification, erreurs et pagination.

### Phase 5 — Performance et observabilité

- remplacer les rechargements manuels par une stratégie de cache/invalidation ;
- limiter la portée des providers ;
- tracer les transactions importantes avec correlation IDs ;
- centraliser logs et erreurs Edge Functions ;
- définir SLO et alertes pour commandes, Claude, Clariprint et notifications.

## 9. Backlog initial priorisé

| Priorité | Chantier | Valeur | Risque |
|---|---|---|---|
| P0 | Aligner Node/CI et rendre le build reproductible | Baseline fiable | Faible |
| P0 | Typer le client Supabase avec `Database` | Détection précoce des dérives | Faible à moyen |
| P0 | RPC atomique de création de commande | Intégrité des commandes | Moyen |
| P0 | Tests transactionnels et RLS de création de commande | Sécurisation du flux critique | Faible |
| P1 | Créer le module pilote `orders` | Modèle reproductible pour les autres domaines | Moyen |
| P1 | Interdire les nouveaux accès Supabase dans l'UI | Stopper l'accumulation de dette | Faible |
| P1 | Décomposer `PublicShop` et `PortalCatalog` | Maintenabilité catalogue | Moyen |
| P1 | Scinder la grosse Edge Function historique | Isolation des intégrations | Moyen |
| P2 | Extraire `shops` et `catalog` en modules | Réduction du couplage | Moyen |
| P2 | Réduire la portée des providers | Performance et lisibilité | Moyen |
| P2 | Consolider les contrats Zod partagés | Fiabilité des échanges | Faible |
| P3 | OpenAPI et client généré | Multi-client/API publique | À décider selon roadmap produit |

## 10. Critères de réussite

La trajectoire sera considérée comme réussie lorsque :

- aucun composant de présentation n'importe directement le client Supabase ;
- les opérations multi-tables critiques sont atomiques côté serveur ;
- chaque domaine expose une interface applicative claire ;
- les types Supabase générés sont utilisés et vérifiés en CI ;
- les contrats d'entrée et de sortie sont validés ;
- les erreurs sont normalisées et observables ;
- les tests de domaine n'exigent pas le rendu d'une page complète ;
- une modification de schéma n'oblige pas à parcourir de nombreux composants ;
- la documentation d'architecture et les ADR correspondent au code actif ;
- les métriques de qualité sont suivies dans le temps.

## 11. Règles de conduite du chantier

- éviter la réécriture globale ;
- migrer un flux vertical complet à la fois ;
- sécuriser le comportement existant avant extraction ;
- supprimer l'ancien chemin dès que le nouveau est validé ;
- éviter les couches abstraites sans cas d'usage concret ;
- utiliser le module `orders` comme modèle avant de généraliser ;
- réévaluer les priorités après chaque phase.

## 12. Limites du diagnostic

Le diagnostic repose sur une inspection statique du dépôt au 4 août 2026. La suite de tests n'a pas pu être exécutée dans l'environnement observé : Node.js 16.15.0 y est actif alors que la version installée de pnpm exige Node.js 22.13 ou supérieur.

Les notes et priorités doivent être actualisées après restauration d'une baseline exécutable et mesure de la couverture effective.

## 13. Journal de décisions

Les décisions suivantes sont proposées comme point de départ et devront être confirmées avant implémentation :

| ID | Décision proposée | Statut |
|---|---|---|
| ADR-ARCH-001 | Conserver un monolithe modulaire plutôt que migrer vers des microservices | À confirmer |
| ADR-ARCH-002 | Interdire l'accès Supabase direct depuis les composants UI | À confirmer |
| ADR-ARCH-003 | Utiliser `orders` comme premier module vertical de référence | À confirmer |
| ADR-ARCH-004 | Exécuter les opérations critiques multi-tables via RPC transactionnelles | À confirmer |
| ADR-ARCH-005 | Introduire OpenAPI seulement lorsqu'un second consommateur est planifié | À confirmer |

## 14. Stratégie MCP

### 14.1 Décision recommandée

La mise en place d'un serveur Model Context Protocol est une bonne orientation pour Magrit, à condition de le considérer comme un **adaptateur entrant** de l'architecture et non comme un second backend métier.

Le serveur MCP expose les capacités de Magrit aux agents et assistants IA. Il ne doit contenir ni règles métier propres, ni accès opportunistes aux tables Supabase, ni orchestration dupliquée par rapport au frontend.

La règle structurante est la suivante :

> Le frontend, les API traditionnelles et le serveur MCP doivent appeler les mêmes services applicatifs.

```text
                         Modules métier Magrit
                +--------------------------------+
                | orders                        |
                | shops                         |
                | catalog / PIM                 |
                | quotes                        |
                | tenants / users / roles       |
                | conversations / AI            |
                +---------------+----------------+
                                |
                       Services applicatifs
                                |
             +------------------+------------------+
             |                  |                  |
             v                  v                  v
       Frontend React      API / RPC         Adaptateurs MCP
                                                     |
                                                     v
                                               Serveur MCP
```

Cette stratégie renforce directement la trajectoire modulaire définie dans ce document. Elle oblige chaque domaine à formaliser ses cas d'usage et évite que la logique métier reste enfermée dans les composants React.

### 14.2 Un serveur unique, enrichi par les modules

La cible initiale est un seul serveur MCP Magrit composé de modules indépendants :

```text
src/modules/orders/
  domain/
  application/
  infrastructure/
  ui/
  mcp/
    tools.ts
    resources.ts
    prompts.ts
    schemas.ts
    tests/

src/modules/catalog/
  ...

src/mcp/
  server.ts
  registry.ts
  auth.ts
  errors.ts
  observability.ts
```

Le point de composition enregistre explicitement chaque module :

```ts
const modules = [
  createOrdersMcpModule(dependencies),
  createCatalogMcpModule(dependencies),
  createQuotesMcpModule(dependencies),
];

for (const module of modules) {
  module.register(server);
}
```

L'enregistrement doit être déterministe au démarrage. La découverte automatique de code arbitraire, l'ajout de tools depuis la base ou la création de noms différents selon le tenant sont à éviter.

Plusieurs serveurs MCP ne seront envisagés que lorsqu'une véritable frontière de sécurité, de déploiement, d'équipe, de disponibilité ou de conformité l'exigera. Une séparation future entre `magrit-commerce`, `magrit-production` et `magrit-admin` reste possible, mais n'est pas justifiée pour le premier incrément.

### 14.3 Répartition des primitives MCP

MCP distingue trois primitives qui doivent conserver des rôles différents :

| Primitive | Rôle dans Magrit | Exemples |
|---|---|---|
| Resources | Contexte consultable, stable ou adressable | catalogue des gammes, boutique, audit d'une commande, contraintes d'impression |
| Tools | Recherche dynamique, calcul ou mutation | rechercher un produit, calculer un prix, créer un brouillon, effectuer une transition |
| Prompts | Workflow guidé explicitement choisi par l'utilisateur | préparer un devis, analyser une demande d'impression, contrôler une commande |

Exemples d'URI de resources :

```text
magrit://catalog/gammes
magrit://shops/{shopId}
magrit://orders/{orderId}/audit
magrit://knowledge/printing-constraints
```

Les resources ne doivent pas devenir un mécanisme d'export massif de toutes les données d'un tenant.

Références : [capacités serveur MCP](https://modelcontextprotocol.io/specification/2025-11-25/server/index) et [spécification des tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools).

### 14.4 Concevoir les tools autour des cas d'usage

Les tools doivent représenter des intentions métier atomiques, et non reproduire une API CRUD de bas niveau.

À éviter :

```text
insert_tenant_order
update_tenant_order_status_column
select_shop_products
delete_quote_line
```

À privilégier :

```text
magrit.orders.list
magrit.orders.get
magrit.orders.create_draft
magrit.orders.submit
magrit.orders.transition
magrit.catalog.search
magrit.catalog.get_product
magrit.quotes.prepare
magrit.quotes.export
```

Les noms doivent être uniques, stables et explicites. Les points peuvent être utilisés pour matérialiser le domaine. Un suffixe de version ne doit être introduit qu'en cas de rupture de contrat réellement nécessaire.

Un tool sensible doit exprimer les préconditions utiles :

```ts
{
  name: "magrit.orders.transition",
  input: {
    orderId: "uuid",
    targetStatus: "validated | in_production | shipped | delivered",
    expectedCurrentStatus: "string",
    reason: "string?",
    idempotencyKey: "string"
  }
}
```

`expectedCurrentStatus` permet de détecter les modifications concurrentes. `idempotencyKey` empêche l'exécution répétée accidentelle d'une mutation.

### 14.5 Contrats structurés

Chaque tool doit avoir :

- une description non ambiguë ;
- un schéma d'entrée strict ;
- un schéma de sortie structuré ;
- des limites de taille et une pagination si nécessaire ;
- des erreurs métier stables ;
- un niveau de sensibilité déclaré ;
- des tests contractuels.

Le contenu textuel reste utile pour l'humain, mais il ne doit pas constituer l'unique résultat canonique.

```json
{
  "structuredContent": {
    "orderId": "uuid",
    "status": "draft",
    "totalHt": 125.5,
    "currency": "EUR",
    "warnings": []
  }
}
```

Format d'erreur recommandé :

```json
{
  "code": "ORDER_TRANSITION_NOT_ALLOWED",
  "message": "La commande ne peut pas passer de draft à shipped.",
  "details": {
    "currentStatus": "draft",
    "allowedTransitions": ["validated", "cancelled"]
  },
  "retryable": false
}
```

### 14.6 Authentification et isolation tenant

Le `tenantId`, le `userId` et les capacités effectives doivent être dérivés de l'identité authentifiée. Une valeur fournie dans les arguments d'un tool ne constitue jamais une preuve d'autorisation.

```ts
type ActorContext = {
  userId: string;
  tenantId: string;
  capabilities: string[];
  requestId: string;
};
```

Chaque invocation suit les étapes suivantes :

1. authentifier l'appelant ;
2. valider l'audience du token ;
3. déterminer le tenant et les capacités autorisés ;
4. vérifier la permission requise par le tool ;
5. exécuter le service applicatif ;
6. laisser la RLS ou une vérification serveur équivalente constituer la dernière barrière ;
7. journaliser le résultat.

Pour un serveur MCP distant, la cible est OAuth 2.1 avec HTTPS, tokens courts, PKCE pour les clients publics et scopes minimaux. Le token reçu par le serveur MCP ne doit jamais être transmis tel quel à un service aval. L'émetteur, l'expiration et l'audience doivent être vérifiés.

Scopes initiaux possibles :

```text
catalog:read
quotes:read
quotes:write
orders:read
orders:create
orders:transition
shops:admin
users:admin
pim:admin
```

Ces scopes constituent une première barrière. Ils ne remplacent pas les capabilities Magrit ni la RLS.

Références : [autorisation MCP](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization) et [bonnes pratiques de sécurité](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices).

### 14.7 Usage de Supabase depuis MCP

Les handlers MCP ne doivent pas appeler directement `supabase.from()` ou `supabase.rpc()`. Ils passent par les services applicatifs et repositories du domaine.

Deux stratégies d'accès aux données restent possibles :

1. client Supabase agissant avec l'identité de l'utilisateur et bénéficiant directement de la RLS ;
2. client système utilisant `service_role`, réservé aux opérations serveur qui effectuent une autorisation explicite préalable.

La première stratégie est privilégiée pour les opérations ordinaires. La clé `service_role` ne doit jamais être utilisée comme raccourci pour contourner les politiques existantes.

### 14.8 Confirmation humaine et sensibilité des opérations

Les tools sont pilotables par le modèle. Les actions engageantes nécessitent donc une confirmation visible de l'utilisateur.

| Niveau | Exemples | Politique recommandée |
|---|---|---|
| Lecture | rechercher le catalogue, consulter une commande | pas de confirmation systématique |
| Mutation réversible | créer un brouillon, modifier un devis | confirmation selon le contexte |
| Action engageante | soumettre, annuler, supprimer, inviter, changer un rôle | confirmation explicite obligatoire |

Le client doit afficher les tools exposés et les invocations sensibles. Les annotations MCP aident à décrire leur comportement mais doivent être considérées comme des métadonnées, pas comme un mécanisme d'autorisation.

Référence : [sécurité et interaction humaine des tools MCP](https://modelcontextprotocol.io/specification/2025-11-25/server/tools).

### 14.9 Observabilité et audit

Chaque invocation doit produire une trace structurée :

```text
request_id
tool_name
tool_contract_version
user_id
tenant_id
resource_id
duration_ms
result
error_code
confirmation_used
```

Ne doivent jamais être journalisés :

- tokens et secrets ;
- en-têtes `Authorization` ;
- données personnelles sans nécessité opérationnelle ;
- contenu complet des prompts par défaut ;
- documents clients sensibles.

Pour les mutations, le `request_id` MCP doit être corrélé avec l'audit trail métier et, si pertinent, l'identifiant de transaction Supabase.

### 14.10 Stratégie de tests MCP

Chaque module fournit au minimum :

- tests des schémas d'entrée et sortie ;
- tests contractuels des tools ;
- tests d'autorisation par capability ;
- tests d'isolation tenant ;
- tests d'idempotence ;
- tests de concurrence ;
- tests confirmant que la RLS ne peut pas être contournée ;
- snapshots contrôlés de la découverte `tools/list` ;
- tests de limites de taille, pagination et timeouts ;
- tests avec paramètres et contenus malveillants.

Structure indicative :

```text
src/modules/orders/mcp/tests/
  tools.contract.test.ts
  tools.authorization.test.ts
  tools.isolation.test.ts
  tools.integration.test.ts
```

### 14.11 Premier incrément recommandé

Le module `orders`, déjà retenu comme module pilote de la refactorisation, doit également être le pilote MCP.

Catalogue cible :

```text
magrit.orders.list
magrit.orders.get
magrit.orders.get_allowed_transitions
magrit.orders.create_draft
magrit.orders.submit
magrit.orders.transition
magrit.orders.get_audit_trail
```

La première version doit rester en lecture seule :

```text
magrit.orders.list
magrit.orders.get
magrit.orders.get_allowed_transitions
magrit.orders.get_audit_trail
```

Les mutations seront ajoutées après validation de l'authentification, des scopes, de l'idempotence, de l'audit, des confirmations humaines et de la transaction de création de commande.

### 14.12 Garde-fous obligatoires

1. Un serveur MCP unique au départ.
2. Un adaptateur MCP par module métier.
3. Aucune logique métier dans les handlers MCP.
4. Aucun accès Supabase direct depuis les handlers MCP.
5. Tools orientés cas d'usage, jamais CRUD technique.
6. Lecture seule pour le premier incrément.
7. OAuth, scopes, capabilities, RLS et audit avant toute mutation.
8. Confirmation humaine pour les actions engageantes.
9. Contrats structurés, versionnés et testés.
10. Idempotence et contrôle de concurrence sur les mutations.
11. Même couche applicative pour le frontend, l'API et MCP.
12. Découpage en plusieurs serveurs uniquement sur preuve d'une frontière opérationnelle réelle.

### 14.13 Décisions MCP proposées

| ID | Décision proposée | Statut |
|---|---|---|
| ADR-MCP-001 | Considérer MCP comme un adaptateur entrant et non comme une couche métier | À confirmer |
| ADR-MCP-002 | Déployer initialement un seul serveur MCP modulaire | À confirmer |
| ADR-MCP-003 | Interdire les accès Supabase directs dans les handlers MCP | À confirmer |
| ADR-MCP-004 | Utiliser des tools orientés cas d'usage avec résultats structurés | À confirmer |
| ADR-MCP-005 | Lancer le pilote MCP sur le module `orders` en lecture seule | À confirmer |
| ADR-MCP-006 | Exiger OAuth, scopes, capabilities, RLS, audit et confirmation avant les mutations | À confirmer |
| ADR-MCP-007 | Corréler les invocations MCP avec l'audit trail métier | À confirmer |

### 14.14 Impact sur la feuille de route

Le serveur MCP ne constitue pas une phase séparée à réaliser après toute la refactorisation. Il accompagne la modularisation domaine par domaine :

```text
Module orders
  1. domaine et services applicatifs
  2. repository et RPC transactionnelles
  3. hooks frontend
  4. adaptateur MCP en lecture seule
  5. mutations MCP sécurisées

Module catalog
  même séquence

Module quotes
  même séquence
```

Le backlog initial est donc complété par les éléments suivants :

| Priorité | Chantier MCP | Prérequis |
|---|---|---|
| P0 | ADR sur le rôle et les frontières MCP | validation architecture cible |
| P1 | Squelette du serveur et registre modulaire | baseline Node/CI |
| P1 | ActorContext, authentification et scopes | choix du fournisseur OAuth |
| P1 | Tools `orders` en lecture seule | services applicatifs orders |
| P1 | Tests contractuels, RLS et isolation MCP | environnement de tests reproductible |
| P2 | Mutations orders avec confirmation et idempotence | RPC transactionnelles et audit |
| P2 | Adaptateurs MCP catalog et quotes | extraction des modules correspondants |
| P3 | Resources et prompts métier avancés | retours d'usage du pilote |
| P3 | Évaluation d'un découpage multi-serveurs | métriques et besoins opérationnels réels |
