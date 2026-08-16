---
title: Brief de refactorisation API-first et modulaire
date: 2026-08-11
source_branch: main@eea7f56
delivery_branch: refactor/api-first-foundation
status: en_cours
owners: [AGE Développement, Expert Solutions]
---

# Brief — Refactorisation API-first et modulaire

## Problème à résoudre

Magrit possède des domaines fonctionnels identifiables, mais le navigateur connaît encore directement Supabase : tables, RPC, Auth, Storage, Edge Functions et URL fournisseur. La baseline au démarrage de cette initiative compte 45 fichiers UI important un SDK ou utilitaire Supabase, dont 42 le client de données, et 83 références `supabase.*` dans `src/app`.

L'ancien Epic Refacto 1 a stabilisé ce fonctionnement. Son ADR-R3 autorisait les lectures `from()` directes côté navigateur. Cette décision est désormais remplacée par la règle R1 de `docs/REGLES_ARCHITECTURE.md` : toute interaction passe par une API métier contractuelle.

## Résultat produit attendu

- Le navigateur consomme uniquement des contrats Magrit versionnés sous `/api/v1`.
- Supabase reste le premier adaptateur serveur, sans être l'API publique du produit.
- Les règles métier sont partagées entre les surfaces et ne sont pas réimplémentées dans React.
- Les migrations sont verticales, testables et sans interruption fonctionnelle.

## Surfaces de sortie

| Surface | Routes actuelles | Responsabilité |
|---|---|---|
| `storefront` | `/shop/:slug` | vitrine et catalogue public |
| `customer-portal` | `/shop/:slug/account/*`, checkout | compte acheteur, commandes et devis |
| `workspace` | `/t/:tenantSlug` | configurateur et travail courant |
| `backoffice` | `/t/:tenantSlug/dashboard/*` | administration et exploitation du tenant |

Les surfaces ne possèdent pas la logique métier. Un module peut publier plusieurs adaptateurs UI qui consomment les mêmes cas d'usage et contrats HTTP.

## Architecture cible

```text
Surfaces React
  -> clients API Magrit typés
    -> /api/v1
      -> handlers du module
        -> services applicatifs
          -> ports
            -> adaptateurs Supabase / Clariprint / Anthropic / Resend
```

Structure indicative :

```text
src/
  kernel/
  platform/
    identity/
    tenant/
    access/
    entitlements/
  modules/
    orders/
    quotes/
    catalog/
    shops/
    commercial-pricing/
    production/
    conversations/
  surfaces/
    storefront/
    customer-portal/
    workspace/
    backoffice/
  server/
    composition/
    infrastructure/
```

## Invariants

1. `domain`, `application`, `api` et `ui` n'importent aucun fournisseur.
2. Les opérations critiques sont atomiques côté serveur.
3. La RLS reste une barrière finale, même derrière l'API.
4. Les contrats HTTP ne réexportent jamais les types générés de PostgreSQL.
5. Le manifeste métier et les contributions UI sont séparés pour ne pas introduire React côté serveur.
6. Toute migration réduit la baseline Supabase ; aucune story ne peut l'augmenter.
7. La suppression de Supabase Auth du navigateur intervient après la façade de données et la stabilisation des sessions.

## Séquencement BMAD

### Sprint AF-A — Fondation, 4 stories

- AF0 : kernel minimal, baseline et tests de frontières.
- AF1 : conventions HTTP `/api/v1`, enveloppes d'erreur et composition serveur.
- AF2 : API de bootstrap session/tenant/préférences et migration des providers globaux.
- AF3 : registre des quatre surfaces, routes et navigation déclaratives.

### Sprint AF-B — Module pilote Orders, 4 stories

- AF4 : contrats de lecture Orders et repository serveur.
- AF5 : commandes et transitions atomiques côté serveur.
- AF6 : migration storefront/portail/back-office vers le client Orders.
- AF7 : suppression des dépendances Supabase Orders dans `src/app` et baisse de baseline.

### Vagues suivantes

`quotes` → `shops/catalog` → `commercial-pricing` → assets/événements → conversations/IA → BFF d'identité.

### Epic différé — Identités Magrit et comptes boutique

La cible fonctionnelle sépare strictement les utilisateurs Magrit des comptes
clients boutique. Un compte client appartient à une seule boutique et son
identité est le couple `(boutique, email normalisé)` ; la même adresse dans une
autre boutique correspond à un autre compte. Le backoffice proposera une action
unique « Se connecter à la boutique » : elle créera le compte miroir s’il
manque, puis démarrera une délégation auditée « Se connecter comme » sans
fusionner les identités.

Cette évolution est spécifiée dans
`_bmad-output/planning-artifacts/spec-identites-magrit-et-comptes-boutique.md`.
UM0.1 a livré l’ADR, le module `shop-customers` et les contrats d’identité.
UM1.1 a ajouté la table isolée par boutique en RLS default-deny, sans activer de
comportement storefront. UM1.2 a ajouté service métier, capabilities et policies
workspace. UM1.3 expose les routes de liste et de création ainsi que leur client
HTTP partagé. Cette API reste strictement workspace : la migration Auth, les
sessions boutique et la généralisation des surfaces dépendront du contrat
storefront UM2.

### Extension AF-C — Identité et invitations

- AF7.1 : verrouillage des boutiques `invite_only` et rattachement contrôlé en
  `self_signup` — livré ;
- AF7.2 : rafraîchissement explicite de session avant invitation — livré ;
- AF8 : contrat et commande `POST /api/v1/invitations`, identité de l’invitant
  dérivée côté serveur — livré ;
- AF9 : options, liste des invitations en attente, révocation et renvoi via
  l’API Magrit — livré ;
- AF10 : liste, rôles, droits et retrait des membres via l’API ; sortie complète
  de `DashboardUsers` hors Supabase — livré ;
- AF11.1 : renvoi d’invitation directement via un port email et l’adaptateur
  Resend, sans Edge Function imbriquée — livré ;
- AF11.2 : création initiale via une commande SQL sécurisée puis port Resend,
  sans `invite-member` ni service-role dans l’API — livré ;
- AF12.1 : catalogue, matrice et assignations des rôles via l’API Magrit ;
  `DashboardRolesSection` et `EditUserRolesModal` sortent de Supabase — livré ;
- AF12.2 : édition, archivage et réordonnancement atomique des définitions de
  rôles via l’API ; `RoleEditorDialog` et `OrderRoleAdminPage` sortent de
  Supabase — livré ;
- AF13.1 : CRUD tenant des boutiques et produits manuels via l’API ;
  `ShopsContext` sort de Supabase — livré ;
- AF13.2 : sonde publique minimale et catalogue autorisé via l’API ;
  `PublicShop` sort de Supabase — livré ;
- AF13.3a : lecture et écriture des prix négociés via l’API — livré ;
- AF13.3b : upload multipart des logos et visuels hero via l’API ; l’éditeur
  de boutique ne connaît plus Supabase — livré ;
- AF13.4 : gestion des mockups personnalisés via l’API et inclusion dans le
  catalogue autorisé, sans requête fournisseur par carte — livré ;
- AF14.1 : nouveau module Catalog et gestion contractuelle des souscriptions
  de gammes du tenant ; `DashboardTenantGammes` sort de Supabase — livré ;
- AF14.2a : lectures et CRUD du PIM global via le module Catalog ;
  `PIMContext` sort de Supabase — livré ;
- AF14.2b : compteur, ingestion et génération éditoriale du PIM via le module
  Catalog ; `DashboardAdminPIM` sort de Supabase — livré ;
- AF15.1 : modification contractuelle du nom et du slug d’un tenant ;
  `DashboardTenantSettings` sort de Supabase — livré ;
- AF15.2 : liste, KPI, création et suppression des sous-espaces via l’API ;
  `DashboardTenantSpaces` sort de Supabase et le contexte tenant abandonne sa
  commande legacy de création de sous-tenant — livré ;
- AF15.3 : vérification contractuelle d’une capability de l’utilisateur
  courant via le module Roles ; `useUserCapability` sort de Supabase — livré ;
- AF16.1 : résolution des anciens slugs via Session et redirection du scope
  boutique via Shops ; les deux composants de routage tenant sortent de
  Supabase — livré ;
- AF16.2 : destination post-invitation via Session/Shops et déconnexion via
  AuthContext ; `AcceptInvitation` et `AccountHub` sortent de Supabase — livré ;
- AF16.3 : connexion/inscription via AuthContext et rattachement `self_signup`
  via Shops ; `CheckoutPage` sort de Supabase — livré ;
- AF17.1 : nouveau module Conversations pour la liste, la sauvegarde et la
  suppression RLS ; `ConversationContext` sort de Supabase — livré ;
- AF17.2 : rafraîchissement de la session d’invitation centralisé dans
  `AuthContext` ; `InviteUserModalV2` sort de Supabase — livré ;
- AF17.3 : diagnostic du fournisseur IA derrière un port et une route API
  authentifiée ; `DiagnosticPanel` sort de Supabase et de Claude — livré ;
- AF17.4 : diagnostic CheckAuth Clariprint derrière un port serveur ; le
  panneau ne dépend plus de l’adaptateur Edge legacy — livré ;
- AF18.1 : création rapide d’un brouillon via le nouveau module Quotes ;
  `persistQuote` sort de Supabase et l’auteur vient du bearer — livré ;
- AF18.2 : CRUD complet des devis éditables via Quotes, avec contrôle serveur
  du scope `all` ; `QuotesContext` sort de Supabase — livré ;
- AF18.3 : bibliothèque de gabarits et préférence par défaut via le module
  QuoteTemplates ; `QuoteTemplatesContext` sort de Supabase — livré ;
- AF19.1 : CRUD des bibliothèques via le module Libraries ; la première moitié
  de `LibraryContext` sort de Supabase — livré ;
- AF19.2 : produits de bibliothèque, imports groupés et génération PIM via
  Libraries ; `LibraryContext` sort entièrement de Supabase — livré ;
- AF20.1 : lecture agrégée des règles, groupes, membres et gammes via le module
  Commercial ; les helpers de prix sortent de Supabase — livré ;
- AF20.2 : mutations des règles, groupes et appartenances via Commercial ; le
  dashboard « Prix & marges » sort entièrement de Supabase — livré ;
- AF21.1 : fournisseur Supabase Auth encapsulé dans un adaptateur de compte ;
  `AuthContext` ne dépend plus du SDK — livré ;
- AF21.2 : protocole binaire des mockups et URLs de stockage encapsulés dans
  une passerelle Shops ; les composants visuels sortent de Supabase — livré ;
- AF22.1 : protocole SSE Claude et éditorial de catégorie confinés dans une
  passerelle legacy ; le chat sort de Supabase — livré ;
- AF22.2 : persistance des suggestions IA via Shops `/api/v1` ; `src/app` ne
  contient plus aucune dépendance ou référence Supabase directe — livré ;
- AF23.1 : sélection serveur du fournisseur IA et diagnostic commun Anthropic,
  OpenAI ou Mistral, configurable sans modification du front — livré ;
- AF23.2a : génération de l’éditorial de catégorie via `/api/v1` et le fournisseur
  configuré ; repli déterministe sans clé ou en cas d’indisponibilité — livré ;
- AF23.2b : façade `/api/v1/assistant/chat` pour le flux SSE, authentification
  utilisateur et contrôle tenant ; le navigateur ne connaît plus le protocole
  Supabase/Claude historique — livré ;
- AF24.1 : devis Clariprint via `/api/v1/clariprint/quote`, protocole et secrets
  limités à l’adaptateur serveur ; les configurateurs ne connaissent plus
  l’Edge Function historique — livré ;
- AF24.2 : assets et génération des mockups via `/api/v1/mockups`, sans URL
  Storage, Edge Function ou clé Supabase dans les composants — livré ;
- AF24.3 : création d’espace racine et acceptation d’invitation via le module
  Session et `/api/v1` ; `TenantContext` ne dépend plus d’un adaptateur
  Supabase et la commande legacy est supprimée — livré ;
- AF24.4 : suppression du client Session DEV direct ; le bootstrap emprunte
  désormais `/api/v1` dans tous les environnements et le proxy Vite choisit
  seulement la cible Edge locale ou distante — livré ;
- AF24.5 : garde-fou transitive interdisant à l’UI de charger un adaptateur
  Supabase, hors passerelle Auth temporaire documentée jusqu’à UM2 — livré ;
- AF25.1 : runtime HTTP React unique sous l’Auth et migration des contextes
  Session, PIM, Conversations, Libraries, Quotes, QuoteTemplates et Shops ;
  le jeton n’est plus recâblé séparément dans chaque provider — livré ;
- AF25.2 : migration des dashboards, outils de rôles, hooks de capabilities et
  diagnostic vers le runtime HTTP injecté ; seul le renouvellement atomique de
  session avant invitation conserve temporairement un client frais — livré ;
- AF25.3 : migration du storefront, du portail client, des redirections tenant,
  du panier et des devis vers le runtime injecté ; les constructions directes
  sont bornées au runtime et aux deux parcours post-auth immédiats — livré ;
- AF25.4 : fabrique de transport à jeton explicite confinée dans le runtime ;
  checkout et invitations ne construisent plus le client HTTP et
  `ApiRuntimeContext` devient son unique composition root navigateur — livré ;
- AF26.1 : manifeste Orders et contributions déclarées pour storefront,
  customer-portal, workspace et backoffice ; la route workspace Commandes est
  désormais chargée par le registre de surfaces — livré ;
- AF26.2 : manifeste Shops pour storefront, workspace et backoffice ; liste,
  éditeur et navigation Boutiques proviennent désormais du registre — livré ;
- AF26.3 : manifeste Quotes sur les quatre surfaces ; bibliothèque, attente,
  éditeur et navigation Devis sont chargés depuis le registre — livré ;
- AF26.4 : manifeste QuoteTemplates limité au workspace ; route et navigation
  Gabarits de devis sont chargées depuis le registre — livré ;
- AF26.5 : manifeste Libraries limité au workspace ; routes liste/détail et
  navigation Bibliothèques sont chargées depuis le registre — livré ;
- AF26.6 : manifeste Catalog initialement limité à la gestion workspace ; routes
  Gammes et PIM ainsi que leur navigation sont chargées depuis le registre — livré ;
- AF26.7 : manifeste Commercial limité au workspace ; route et navigation
  Prix & marges sont chargées depuis le registre — livré ;
- AF26.8 : manifeste Members limité aux utilisateurs Magrit du workspace ;
  route et navigation Utilisateurs sont chargées depuis le registre — livré ;
- AF26.9 : manifeste Tenants limité au workspace ; routes Paramètres et
  Sous-espaces ainsi que leur navigation sont chargées depuis le registre — livré ;
- AF26.10 : manifeste Roles limité au workspace ; route et navigation
  Workflow & rôles sont chargées depuis le registre — livré ;
- AF26.11 : manifeste Conversations limité au workspace ; route et navigation
  Historique sont chargées depuis le registre — livré ;
- AF26.12 : manifeste MachineParks limité au workspace ; routes liste, wizard,
  détail et navigation Parc machine sont chargées depuis le registre — livré ;
- AF26.13 : manifeste Mockups limité au workspace actuel ; route et navigation
  Visuels Magrit sont chargées depuis le registre — livré ;
- AF26.14 : manifeste Plans limité au workspace ; route et navigation Plan &
  abonnement sont chargées depuis le registre — livré ;
- AF26.15 : sidebar workspace composée directement depuis les contributions ;
  ordre, groupes, libellés, routes et présentation ne sont plus dupliqués — livré ;
- AF27.1 : racine storefront, checkout et sections du portail client résolus
  depuis les contributions host ; l'écart `/quote` reste explicite — livré ;
- AF27.2 : `AuthenticationGateway` injecté depuis le runtime navigateur ;
  `src/app` ne charge plus aucun adaptateur Supabase — livré ;
- AF27.3 : distinction entre routes actives et cibles planifiées ; `/quote` et
  les contributions backoffice restent documentées sans être exposées comme
  runtime exécutable avant livraison de leurs composition roots — livré ;
- AF27.4 : passerelle de prix Clariprint composée par le runtime avec le client
  authentifié partagé puis injectée aux hooks et vues boutique ; le front ne
  construit plus l'adaptateur Clariprint concret — livré ;
- AF27.5 : passerelle de connexion assistant injectée par le runtime dans le
  chat Magrit et la recherche conversationnelle boutique ; suppression des
  imports du singleton HTTP concret dans ces composants — livré ;
- AF27.6 : passerelle Mockups injectée dans l'image produit et l'administration
  des visuels ; `src/app` n'importe désormais plus aucun adaptateur concret,
  avec garde-fou global en architecture — livré ;
- AF27.7 : protocole HTTP/SSE assistant déplacé du hook React vers la passerelle
  injectée ; l'UI ne connaît plus endpoint, parsing d'événements ni détection
  des erreurs fournisseur — livré ;
- AF28.1 : routes storefront de liste catalogue, gamme et produit attribuées au
  module Catalog puis consommées par le routeur du portail depuis le registre — livré ;
- AF28.2 : route storefront de confirmation attribuée à Orders et consommée
  depuis le registre sans littéral dupliqué dans le routeur du portail — livré ;
- AF29.1 : composition d'une façade Orders unique pour les surfaces React ;
  suppression des sept constructions dispersées du client de module — livré ;
- AF29.2 : composition centralisée des façades Shops, y compris la fabrique
  post-authentification du checkout ; suppression des constructions dans les
  composants et contextes — livré ;
- AF29.3 : composition centralisée des façades Quotes et QuoteTemplates ; les
  composants d'impression et contextes devis consomment les instances partagées — livré ;
- AF29.4 : composition d'une façade Catalog unique pour les écrans PIM,
  administration catalogue et gammes actives — livré ;
- AF29.5 : composition centralisée des façades Libraries et LibraryProducts ;
  le contexte bibliothèque reçoit désormais ses dépendances partagées — livré ;
- AF29.6 : composition centralisée des façades Conversations, Commercial et
  Diagnostics, derniers clients hors chantier identité — livré ;
- AF29.7 : composition d'une façade Session unique pour le bootstrap, les
  espaces Magrit, redirections et acceptations d'invitation — livré ;
- AF29.8 : composition centralisée des façades d'identité workspace Roles,
  Members et Invitations, nommées explicitement sans assimilation aux comptes boutique — livré ;
- AF29.9 : garde-fou transversal interdisant toute construction de client API
  React hors des composition roots transport et modules — livré ;
- suite : implémenter les futurs modules et surfaces depuis ces composition
  roots, en conservant la séparation fonctionnelle des identités comme chantier produit distinct.

## Critères de succès

- `pnpm test:architecture` est requis en CI.
- Aucune nouvelle dépendance Supabase n'entre dans l'UI.
- Une migration de fournisseur ne change ni les composants ni les contrats `/api/v1`.
- Le chargement initial ne déclenche plus de requêtes PostgREST depuis le navigateur après AF2.
- Les trois surfaces Orders utilisent le même service après AF7.
