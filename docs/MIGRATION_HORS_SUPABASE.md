# Plan de migration hors Supabase

> Statut : decision acceptee, execution en cours
> Date : 2026-09-29
> Perimetre : API, PostgreSQL, authentification, stockage objet, traitements
> asynchrones et environnement de developpement

Decision formelle : `docs/architecture/decisions/0001-sortie-de-supabase.md`.

| Jalon | Etat au 30 septembre 2026 |
|---|---|
| J0 | ADR et garde-fou contre les nouvelles dependances Supabase livres |
| J1 | Compose, healthchecks, migrations et buckets livres ; seed et CI restent a faire |
| J2 | runtime Node, health/readiness et facade de transition livres |
| J3 | contexte transactionnel, roles, Conversations, session, réglages tenant, membres, rôles et invitations, réglages commerciaux, étapes de production, clients, projets, étiquettes, catalogue PIM et public, bibliothèques produits, règles tarifaires, devis, gabarits HTML et PDF, administration et invitations des comptes clients boutique PostgreSQL livrés ; commandes boutique, rôles, transitions, audit, idempotence, notifications et routes Node livrés ; outils idempotents de reprise des anciennes `shop_orders` et du rapport clients legacy livrés, exécution à faire sur chaque environnement ; idempotence API, outbox durable et réservation worker portable livrées |
| J4 | adaptateurs S3 des exports, fichiers de lignes projet, gabarits PDF, documents de devis et visuels de boutiques livres ; autres buckets non bascules |
| J5 | OIDC, annuaire d'identites, socle Better Auth PostgreSQL, invitations Magrit, récupération de mot de passe, authentification directe storefront, activation, recovery et délégation storefront livres ; bascule UI globale reste a faire |
| J6 et suivants | diagnostics IA/Clariprint, assistant éditorial et chiffrage Clariprint avec quotas PostgreSQL servis par Node ; primitive PostgreSQL et repository du drain d'outbox livrés ; résolution PostgreSQL/S3 du courriel `quote.sent` livrée ; tables et repositories portables des modèles et journaux de notifications, routes Node, immuabilité et enqueue idempotent/regroupant livrés ; composition finale des consommateurs, sender, scheduler et autres jobs restent à migrer |

## 1. Decision proposee

Magrit doit sortir de la plateforme Supabase avant la mise en production, sans
reecriture fonctionnelle et sans bascule globale en une seule operation.

La cible conserve les briques standards utiles :

- PostgreSQL 17 comme base de donnees ;
- un stockage objet compatible avec l'API S3 ;
- une API TypeScript/Node 22 deployee dans un conteneur standard ;
- une authentification integree a l'API avec une bibliotheque open source ;
- OpenID Connect pour les fournisseurs d'identite externes ;
- un processus worker pour l'outbox, les notifications, les exports et les
  purges.

Supabase reste temporairement la source de vérité des seuls domaines qui ne
sont pas encore basculés. Les domaines activés dans le runtime Node utilisent
PostgreSQL/S3 comme source de vérité. Aucun nouveau code ne doit accroître la
dépendance à Supabase.

## 2. Constats mesures

L'etat local audite le 25 septembre 2026 contient :

- PostgreSQL 17.6 ;
- 160 fichiers de migration historiques ;
- 75 tables publiques avec RLS active ;
- 157 policies RLS actives sur 69 tables ;
- 60 cles etrangeres de tables metier vers `auth.users` ;
- 66 fonctions SQL publiques utilisant `auth.uid()` ;
- 50 adaptateurs dans `src/adapters/supabase` ;
- 14 repertoires de fonctions Edge deployables, hors `_shared` ;
- deux taches `pg_cron` actives, toutes deux des purges SQL nocturnes ;
- huit buckets Storage ;
- aucun objet present dans les buckets de l'environnement local audite.

Les fonctions Edge ne sont pas toutes des jobs. Elles se repartissent entre :

- facade HTTP principale : `magrit-api` ;
- traitements asynchrones potentiels : outbox, notifications, exports et
  purge des fichiers ;
- traitements appeles a la demande : mockups, PIM, assistant, sitemap et
  workflow de commande ;
- code historique a inventorier puis supprimer.

## 3. Principes non negociables

### 3.1 API-first

Le navigateur ne communique jamais directement avec PostgreSQL ou le stockage
objet. Il n'utilise que des routes Magrit de meme origine sous `/api/v1` et les
routes d'authentification explicitement exposees.

### 3.2 Identite metier independante

Les donnees metier referencent un identifiant Magrit stable. Elles ne
referencent jamais directement une table appartenant a une bibliotheque ou a
un fournisseur d'authentification.

### 3.3 Fournisseurs remplacables

L'application ne depend que de contrats standards : protocole PostgreSQL, API
S3, OpenID Connect et HTTP. Les SDK propres aux fournisseurs restent confines
aux adaptateurs.

### 3.4 Securite en profondeur

L'autorisation est decidee par les services applicatifs. Une RLS PostgreSQL
reduite conserve l'isolation multi-tenant sur les donnees sensibles. Le role
runtime de l'API n'est ni proprietaire des tables, ni superutilisateur, ni
`BYPASSRLS`.

### 3.5 Migration reversible

Chaque lot doit pouvoir etre active par configuration et revenir au chemin
precedent tant que son jalon de stabilisation n'est pas valide.

## 4. Architecture cible

```text
Navigateur React
      |
      | HTTPS meme origine
      v
API Magrit Node 22
      |
      +-- services applicatifs et autorisations
      +-- Better Auth ou equivalent open source
      +-- adaptateur OIDC par boutique
      +-- adaptateurs PostgreSQL directs
      +-- adaptateur S3
      |
      +------ PostgreSQL 17 manage
      +------ stockage objet S3-compatible
      +------ fournisseur email transactionnel

Worker Magrit Node 22
      +------ PostgreSQL/outbox
      +------ stockage S3
      +------ services externes
```

L'API et le worker sont deux points d'entree du meme code applicatif. Ils
partagent les modules, les contrats et les adaptateurs, mais pas leur cycle de
vie d'execution.

## 5. Serveurs et services externes necessaires

### 5.1 Socle obligatoire en production

| Besoin | Service attendu | Remplacable | Remarque |
|---|---|---|---|
| Execution | hebergeur de conteneurs ou VM | oui | l'API et le worker peuvent partager un serveur au demarrage |
| Donnees | PostgreSQL 17 manage | oui | connexion standard, sauvegardes et restauration testees |
| Fichiers | stockage objet S3-compatible | oui | buckets prives, URL signees produites par l'API |
| Emails | service SMTP/API transactionnel | oui | Resend aujourd'hui, adaptateur remplacable |
| Exposition | DNS, certificats TLS et reverse proxy | oui | peut etre inclus dans l'hebergeur de calcul |

Le front statique peut etre servi par le meme hebergeur que l'API ou par un
CDN distinct. L'API et le worker peuvent partager la meme VM au debut : ce
sont deux processus, pas necessairement deux fournisseurs.

### 5.2 Capacites d'exploitation obligatoires

Ces capacites peuvent etre integrees aux fournisseurs precedents et ne
necessitent pas obligatoirement un service supplementaire :

- sauvegardes PostgreSQL avec restauration ponctuelle et PITR selon l'offre ;
- copie ou versionnement des objets S3 ;
- destination de sauvegarde separee du compte principal ;
- centralisation des logs, metriques et alertes de disponibilite ;
- stockage et rotation des secrets ;
- CI/CD pour construire, tester et deployer les conteneurs.

### 5.3 Integrations metier

| Integration | Necessite | Comportement sans le service |
|---|---|---|
| Clariprint | necessaire au prix reel | repli explicite vers le prix marche quand le parcours l'autorise |
| fournisseur IA | un seul parmi Anthropic, OpenAI ou Mistral | fonctions d'assistant et de generation indisponibles |
| HopeStudio | optionnel, configure par tenant | parcours HopeStudio indisponibles uniquement |
| fournisseur OIDC client | optionnel, configure par boutique | authentification locale conservee si elle est autorisee |

Notion, Figma et les outils de qualite ne sont pas des dependances runtime de
Magrit. Supabase ne figure plus dans la cible.

### 5.4 Authentification

L'authentification locale avec Better Auth ou une bibliotheque equivalente ne
necessite aucun serveur d'identite externe : elle utilise l'API Magrit et le
PostgreSQL du socle. Un serveur OpenID Connect externe n'est requis que pour
les boutiques dont le client impose sa propre identite.

### 5.5 Cache distribue

Redis ou un serveur compatible n'est pas requis dans le socle initial. Les
sessions, outbox, files de travaux et verrous utilisent PostgreSQL ; les caches
HTTP sont portes par le reverse proxy ou le CDN et les caches purement
techniques peuvent rester locaux au processus. Ce composant ne sera ajoute que
si des mesures en production montrent un besoin de coordination entre
plusieurs instances ou une pression de latence que PostgreSQL ne couvre pas.
Les clés `Idempotency-Key` de la façade métier sont elles aussi persistées dans
PostgreSQL : elles survivent aux redémarrages du processus et un bail abandonné
peut être repris, sans serveur de cache distribué.

## 6. Environnement de developpement cible

### 6.1 Services locaux

Un fichier Compose dedie au developpement doit demarrer au minimum :

| Service | Image/cible | Usage |
|---|---|---|
| `postgres` | PostgreSQL 17, version epinglee | donnees, auth, outbox |
| `s3` | SeaweedFS, version epinglee | API S3 locale |
| initialisation S3 | script AWS SDK versionne | creation idempotente des buckets |
| `mail` | Mailpit, optionnel mais recommande | emails d'invitation et de recuperation |

L'API React/Node et le worker restent lances par `pnpm` afin de conserver le
rechargement a chaud. Une variante Compose pourra les lancer pour les tests
d'integration et la CI.

MinIO n'est pas retenu : son depot communautaire a ete archive en avril 2026
et ses binaires historiques ne sont plus maintenus. Le choix local reste sans
incidence sur la production, car Magrit ne depend que du contrat S3.

### 6.2 Buckets locaux

Le script d'initialisation recree les buckets de maniere idempotente. Les noms
Supabase historiques contiennent des `_`, interdits dans un nom de bucket S3.
Le mapping logique vers le nom physique S3 est donc explicite et versionne dans
`config/storage-buckets.json` :

| Bucket logique actuel | Bucket physique S3 | Acces / limite actuelle |
|---|---|---|
| `commercial_line_files` | `commercial-line-files` | prive, 15 Mio |
| `commercial_order_files` | `commercial-order-files` | prive, 50 Mio |
| `document_pdf_templates` | `document-pdf-templates` | prive, 10 Mio |
| `order_documents` | `order-documents` | prive |
| `order_exports` | `order-exports` | prive, 20 Mio |
| `product_mockups` | `product-mockups` | public ou facade CDN/API, 5 Mio |
| `quote_documents` | `quote-documents` | prive |
| `shop_backgrounds` | `shop-backgrounds` | public ou facade CDN/API, 5 Mio |
| `shop_product_mockups` | `shop-product-mockups` | public ou facade CDN/API, 5 Mio |

Les limites de taille et les types MIME sont controles par l'API. Les buckets
peuvent rester tous prives ; dans ce cas l'API produit des URL signees ou sert
les objets publics derriere une route cacheable.

En developpement, le script d'initialisation applique idempotemment une policy
`s3:GetObject` anonyme aux trois buckets de visuels publics (`product-mockups`,
`shop-backgrounds`, `shop-product-mockups`). `S3_PUBLIC_BASE_URL` designe leur
origine HTTP ; en production, cette origine peut etre un endpoint S3 public ou
une facade CDN/API appliquant la meme politique de lecture.

### 6.3 Commandes attendues

Le lot d'infrastructure locale introduit des commandes stables :

```text
pnpm infra:dev:up       # PostgreSQL, S3, initialisation, email
pnpm infra:dev:down     # arret sans destruction des volumes
pnpm infra:dev:status   # etat et healthchecks
pnpm infra:dev:logs     # logs des services locaux
pnpm infra:dev:reset    # destruction explicite des seules donnees locales
pnpm db:migrate         # applique les migrations PostgreSQL Magrit
pnpm db:seed            # identite, tenant et appartenance de developpement
pnpm dev                # API, worker et Vite, ou orchestrateur equivalent
```

`infra:dev:reset` doit afficher une confirmation et ne doit jamais accepter un
chemin ou un nom de volume fourni librement par l'utilisateur.

### 6.4 Variables locales

Les applications ne recoivent plus de cle Supabase. Les variables minimales
sont :

```text
DATABASE_URL=
MAGRIT_DATABASE_MIGRATION_URL=
S3_ENDPOINT=
S3_PUBLIC_BASE_URL=
S3_REGION=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_FORCE_PATH_STYLE=true
MAGRIT_AUTH_SECRET=
APP_BASE_URL=
MAIL_HOST=
MAIL_PORT=
MAIL_SECURE=false
MAIL_USER=
MAIL_PASSWORD=
MAGRIT_FROM_EMAIL=
```

Les secrets de fournisseurs OIDC ne sont jamais exposes a Vite.

L'authentification locale est activee uniquement lorsque `APP_BASE_URL` et
`MAGRIT_AUTH_SECRET` sont definis. Le secret doit contenir au moins 32
caracteres. Better Auth utilise le schema PostgreSQL isole `authn`, garde les
sessions opaques en base et expose ses routes sous `/api/v1/auth`. Le cache de
session en cookie n'est pas active afin qu'une revocation prenne effet sans
attendre l'expiration d'un cache. L'inscription publique est desactivee ; les
comptes de production devront provenir du flux d'invitation Magrit.

Le navigateur utilise exclusivement l'adaptateur Better Auth local. Le fallback
Supabase Auth et `VITE_AUTH_PROVIDER` ont été retirés. L'adaptateur local
n'expose aucun token au JavaScript ; les
requêtes same-origin transportent uniquement le cookie `HttpOnly`.
En developpement, `VITE_API_PROXY_TARGET=http://127.0.0.1:8787` dirige
la SPA vers le serveur Node. `GET /session`, `PATCH /session/preferences` et
`PUT /session/current-tenant` sont deja traites par PostgreSQL ; le fournisseur
Supabase n'est plus une option d'authentification du navigateur. La
création et la suppression des sous-espaces sont locales, avec
une profondeur limitée à deux niveaux. La création d'un
tenant racine, son SIREN et ses gammes d'onboarding sont désormais atomiques
dans PostgreSQL. La résolution des
anciens slugs et `PATCH /tenants/{tenantId}` sont également locales ; les slugs
restent réservés aux super-administrateurs et historisés 90 jours.
`GET/PATCH /commercial-settings` passe également par la façade Node et
PostgreSQL, avec ETag, capacités applicatives et RLS. C'est le premier module de
la façade Gestion commerciale entièrement sorti du runtime Supabase.
Le référentiel `/production-steps` est également local : les six étapes
standard sont initialisées pour chaque tenant et les créations, suppressions et
réordonnancements restent atomiques sous verrou PostgreSQL.

Le catalogue PIM partagé (`product_gammes`, `product_definitions`) et les
souscriptions de gammes par tenant sont désormais servis directement par
PostgreSQL. Les mutations du référentiel global restent réservées aux
administrateurs de plateforme ; les souscriptions sont isolées par tenant et
modifiables par ses administrateurs. L'ingestion de candidats et la génération
assistée de définitions restent volontairement relayées vers l'API historique :
ce sont des traitements asynchrones à extraire séparément, pas des opérations
du repository catalogue. La copie des gammes et définitions existantes doit
précéder l'activation de ces routes sur un environnement contenant des données.

Les règles tarifaires et les marges par défaut des gammes sont également
locales. PostgreSQL assure l'isolation tenant, les contraintes de portée et de
période, ainsi que le journal append-only portant l'acteur explicite. La
résolution ne dépend plus d'une RPC PostgREST : une requête SQL directe choisit
la portée la plus spécifique, puis la règle la plus récente. Cette extraction
permet au futur adaptateur Devis d'utiliser le moteur Pricing sans rappel vers
Supabase.

Le schéma PostgreSQL portable des devis commerciaux est posé : entêtes, lignes
tarifées, compteur annuel, isolation tenant, garde des lignes hors brouillon et
journaux append-only. L'adaptateur PostgreSQL direct couvre aussi les lectures,
la création tarifée, les mutations, l'envoi et la duplication transactionnels ;
les auteurs d'audit sont désormais transmis explicitement par le port. Les
routes Devis et Documents de devis sont désormais activées dans le serveur Node
pour le back-office. Les données existantes devront être copiées et contrôlées
avant l'activation de ces routes en environnement partagé.

Les gabarits PDF de devis et de commandes sont maintenant servis par la façade
Node avec PostgreSQL et le bucket S3 `document-pdf-templates`. Le dépôt reste
direct vers S3 par URL signée, puis l'API relit et inspecte le PDF avant de le
publier. La géométrie et la carte de champs sont isolées par tenant ; un
remplacement conserve le statut par défaut et refuse un changement de
géométrie tant que la carte n'est pas explicitement réinitialisée. La table
append-only des documents de devis est également servie par un adaptateur
PostgreSQL/S3. Le dépôt définitif est protégé contre l'écrasement et les aperçus
filigranés restent remplaçables. La lecture portail client continue d'être
relayée vers l'API historique : elle ne basculera qu'avec les comptes et
sessions boutique, afin de conserver un contrôle d'accès complet plutôt qu'un
mode dégradé.

Le cycle des commandes boutique est désormais servi localement par Node et
PostgreSQL : création Magrit ou storefront, lecture atelier et portail,
édition du brouillon, revalorisation serveur, transitions, rôles, audit et
reçus idempotents. La configuration Clariprint est comparée en JSONB avant de
qualifier un prix de `catalog`; une configuration divergente reste
`client_unverified`. Les notifications de création et de changement d'étape
utilisent SMTP en développement ou Resend en hébergement, avec résolution des
destinataires et de `notify_policy` dans PostgreSQL ; les Edge Functions
`send-order-notification` et `order-workflow-step` ne sont plus appelées par le
runtime Node. La bascule d'un environnement existant exige encore une reprise
contrôlée de `shop_orders` vers `tenant_orders` : l'adaptateur portable ne lit
volontairement pas la table historique et ne doit donc être activé qu'après ce
cutover.

La reprise est fournie par `pnpm db:import:legacy-orders`. Elle exige une URL
PostgreSQL directe vers la source historique dans
`MAGRIT_LEGACY_SOURCE_DATABASE_URL` et utilise
`MAGRIT_DATABASE_MIGRATION_URL` (ou `DATABASE_URL`) comme cible. Sans option,
la commande importe et vérifie toute la cohorte dans une transaction puis fait
un `ROLLBACK` : c'est le mode de répétition obligatoire avant la bascule.
L'écriture nécessite explicitement `--apply` :

```text
MAGRIT_LEGACY_SOURCE_DATABASE_URL=postgresql://... \
MAGRIT_DATABASE_MIGRATION_URL=postgresql://... \
pnpm db:import:legacy-orders

# après contrôle du bilan JSON et gel des écritures sur la source
MAGRIT_LEGACY_SOURCE_DATABASE_URL=postgresql://... \
MAGRIT_DATABASE_MIGRATION_URL=postgresql://... \
pnpm db:import:legacy-orders -- --apply
```

Les boutiques doivent déjà exister dans la cible. L'outil conserve l'UUID, la
date, les montants, le statut traduit et le snapshot source intégral. Il crée
ou réutilise le compte client de la boutique, marque les lignes `legacy` et ne
conserve un `product_id` que si le produit appartient au même tenant. La table
`legacy_shop_order_imports` porte le SHA-256 du snapshot : une deuxième passe
identique est un replay, tandis qu'une source modifiée après import fait
échouer la transaction. La fonction de cutover est révoquée au rôle
`magrit_api` et reste réservée au compte de migration.

Le rapport de contrôle des anciens membres `shop_only` est copié séparément,
avant l'arrêt de la source, car sa vue historique dépend encore de
`auth.users`. `pnpm db:import:legacy-shop-customer-report` suit la même
discipline : simulation transactionnelle par défaut, puis `--apply` après
contrôle. Le snapshot cible est isolé par tenant, lisible seulement avec
`can_manage_shop_customers`, et son import est inaccessible au rôle API :

```text
MAGRIT_LEGACY_SOURCE_DATABASE_URL=postgresql://... \
MAGRIT_DATABASE_MIGRATION_URL=postgresql://... \
pnpm db:import:legacy-shop-customer-report

pnpm db:import:legacy-shop-customer-report -- --apply
```

L'administration des membres du tenant est également locale. Les lectures
s'appuient sur `app_users`, les rôles historiques `owner` et `admin` sont
présentés comme administrateurs par le contrat public, et chaque changement de
rôle, d'accès ou suppression est atomique avec son journal. Une garde sous
verrou empêche de rétrograder ou retirer le dernier administrateur. Les rôles
personnalisés sont désormais eux aussi locaux : définitions, portées boutique,
affectations, capacités, ordre et archivage sont tenus par PostgreSQL. Les deux
options produit sont initialisées automatiquement pour chaque tenant.

Le cycle des invitations Magrit est désormais local : création, activation,
liste, renvoi, révocation et acceptation sont servis par Node et PostgreSQL.
Les liens utilisent un jeton opaque de 256 bits dont seul le SHA-256 est
conservé. L'acceptation vérifie l'adresse du compte connecté, ajoute
l'appartenance et ses options dans une seule transaction, et reste idempotente
pour le destinataire après succès. En production, l'envoi utilise l'adaptateur
Resend lorsqu'aucun SMTP n'est configuré ; sans clé, l'API restitue le lien et
signale explicitement que le courriel n'a pas été envoyé. En développement,
`MAIL_HOST` et `MAIL_PORT` sélectionnent l'adaptateur SMTP et livrent les
invitations dans Mailpit. `MAIL_USER` et `MAIL_PASSWORD` sont facultatifs mais
doivent être fournis ensemble ; `MAIL_SECURE=true` active TLS implicite.
Pour une adresse encore inconnue, le même jeton autorise une seule création de
compte Better Auth : le serveur impose l'adresse portée par l'invitation, un
mot de passe d'au moins 12 caractères et des identifiants UUID. Un trigger
transactionnel provisionne alors `app_users` et l'identité
`urn:magrit:local` ; l'inscription Better Auth sans invitation reste refusée.
La récupération de mot de passe suit le même choix de transport. Better Auth
conserve en base un jeton à usage unique valable une heure, le courriel pointe
vers son endpoint de validation puis revient sur `/reset-password`. Le
navigateur transmet explicitement le jeton avec un mot de passe de 12 à 128
caractères ; les sessions précédentes sont révoquées après succès.

Le seed local est idempotent. Il cree par defaut
`developer@magrit.local`, le tenant `magrit-development` et une identite OIDC
de developpement. Les valeurs peuvent etre surchargees avec les variables
`MAGRIT_DEV_USER_*`, `MAGRIT_DEV_TENANT_*` et `MAGRIT_DEV_OIDC_*`. Ce seed ne
demarre pas un fournisseur OIDC et ne doit jamais etre execute en production.
Il cree aussi un compte Better Auth local avec le mot de passe
`MAGRIT_DEV_USER_PASSWORD` (valeur locale par defaut :
`magrit-development-only`). Le mot de passe est hache par Better Auth avant
son insertion et n'est jamais journalise.

Le runtime Node active le module Conversations hors Supabase uniquement si les
trois variables suivantes sont presentes. Une configuration partielle fait
echouer le demarrage ; une configuration absente conserve le relais vers l'API
historique :

```text
MAGRIT_OIDC_ISSUER=https://identity.client.example
MAGRIT_OIDC_AUDIENCE=magrit-client-shop
MAGRIT_OIDC_JWKS_URL=https://identity.client.example/.well-known/jwks.json
MAGRIT_OIDC_ALGORITHMS=RS256
```

Le jeton ne contient pas l'identifiant applicatif faisant autorite. Le serveur
verifie sa signature, traduit `(issuer, subject)` via `user_identities`, puis
controle `tenant_members` avant d'injecter `user_id` et `tenant_id` dans la
transaction PostgreSQL soumise a la RLS.

## 7. Identite et authentification

### 7.1 Separation des responsabilites

La bibliotheque d'authentification gere :

- comptes et preuves d'authentification ;
- hashage des mots de passe ;
- verification d'adresse email ;
- recuperation du mot de passe ;
- sessions et revocation ;
- protections de base contre les abus.

Magrit gere :

- tenants et boutiques ;
- membres, invitations, roles et options ;
- rattachement d'un utilisateur a un client ;
- autorisations metier ;
- audit des actions.

### 7.2 Modele cible

```text
app_users
- id uuid primary key
- email_normalized
- display_name
- status
- created_at
- updated_at

user_identities
- id uuid primary key
- app_user_id references app_users(id)
- provider_type       local | oidc
- provider_id
- issuer
- subject
- unique (issuer, subject)
```

Les tables gerees par la bibliotheque d'authentification vivent dans un schema
dedie, par exemple `authn`. Les tables metier referencent seulement
`app_users.id`.

Pour minimiser la migration, les `app_users.id` importes conservent les UUID
actuels de `auth.users`. Les 60 cles etrangeres peuvent alors etre repointees
transactionnellement sans reecrire les valeurs.

### 7.3 Authentification locale

La solution a evaluer en premier est Better Auth, branchee directement a
PostgreSQL. La validation doit couvrir : inscription, invitation, verification
d'email, connexion, session cookie `HttpOnly`, deconnexion, revocation,
changement et recuperation du mot de passe.

Supabase utilise des hachages bcrypt, tandis que Better Auth utilise scrypt par
defaut. Deux strategies doivent etre prototypees puis tranchees :

1. imposer une recuperation de mot de passe a la bascule, acceptable si le
   nombre de comptes reels est faible ;
2. verifier temporairement les hashes bcrypt importes, puis produire un hash
   moderne lors de la premiere connexion reussie.

La deuxieme option n'est retenue qu'apres un test de migration et de
rehashage atomique.

### 7.4 OpenID Connect par boutique

Une boutique peut utiliser le serveur d'identite de son client. La
configuration cible est :

```text
identity_providers
- id
- tenant_id
- name
- protocol            oidc
- issuer
- client_id
- encrypted_secret
- scopes
- enabled

shop_identity_providers
- shop_id
- identity_provider_id
- login_mode          local | oidc | local_and_oidc
- provisioning_mode   invitation_only | automatic

customer_external_identities
- identity_provider_id
- subject
- shop_customer_account_id
- unique (identity_provider_id, subject)
```

Le flux utilise Authorization Code, PKCE, `state` et `nonce`. Il verifie
strictement issuer, audience, signature et `sub`. Une adresse email ou son
domaine ne suffit jamais a autoriser un acces.

Le mode par defaut d'une boutique privee est `invitation_only`. Apres le
callback OIDC, Magrit emet sa propre session boutique opaque ; le reste du
code boutique ne depend donc pas du fournisseur externe.

L'integration OIDC doit passer par un port Magrit. Un adaptateur base sur la
bibliotheque MIT `openid-client` constitue la solution de repli independante
si un plugin SSO ajoute une dependance commerciale ou une configuration trop
statique.

## 8. PostgreSQL et RLS

### 8.1 Baseline propre

Les 160 migrations historiques ne doivent pas devenir le mecanisme
d'installation d'une nouvelle base de production. Produire une baseline SQL
auditee representant l'etat voulu :

- schemas, tables, index, contraintes, vues et fonctions utiles ;
- donnees de reference indispensables ;
- sans schemas internes `auth`, `storage`, `realtime` ou Vault de Supabase ;
- sans roles `anon`, `authenticated` ou `service_role` ;
- sans `pg_net` ;
- sans policies devenues obsoletes.

L'historique reste archive pour la tracabilite. Les evolutions post-baseline
reprennent avec des migrations incrementales immuables.

### 8.2 Roles PostgreSQL

Prevoir au minimum :

- `magrit_owner` : proprietaire des objets, jamais utilise par l'application ;
- `magrit_migrator` : applique les migrations ;
- `magrit_api` : acces runtime minimal, sans `BYPASSRLS` ;
- `magrit_worker` : droits necessaires aux files, purges et traitements ;
- `magrit_readonly` : diagnostic et support, sans secrets.

### 8.3 Contexte de requete portable

Remplacer `auth.uid()` par des fonctions Magrit independantes du fournisseur,
par exemple :

```text
app.current_user_id()
app.current_tenant_id()
```

L'API positionne les valeurs avec `set_config(..., true)` dans une transaction
dediee. Le caractere local a la transaction est obligatoire afin d'eviter la
fuite de contexte entre connexions du pool.

### 8.4 Reduction des policies

Pour chaque table, classer la protection attendue :

1. isolation par `tenant_id` ;
2. lecture publique explicite ;
3. acces seulement par un service applicatif ;
4. table technique inaccessible a l'utilisateur ;
5. table d'audit append-only.

Les policies CRUD creees uniquement pour exposer PostgREST sont supprimees.
Les policies restantes expriment l'isolation tenant ou une exception metier
documentee. Le nombre de policies n'est pas un objectif en soi ; la matrice
d'autorisation et les tests sont la source de verite.

## 9. Acces aux donnees

Les interfaces de repositories presentes dans les modules sont conservees.
Pour chaque domaine :

1. figer les tests contractuels de l'adaptateur Supabase actuel ;
2. implementer un adaptateur PostgreSQL direct ;
3. executer les memes tests sur les deux adaptateurs ;
4. comparer les resultats sur un jeu de donnees identique ;
5. basculer le point de composition par configuration ;
6. retirer l'adaptateur Supabase apres stabilisation.

La migration est effectuee par domaine, en commencant par les domaines en
lecture et faible criticite, puis clients/projets/catalogue, devis, commandes,
documents, notifications et administration.

Les fonctions SQL metier peuvent etre conservees lorsqu'elles assurent une
transaction atomique utile. Elles doivent seulement perdre leurs dependances a
`auth.uid()`, `auth.users`, aux roles Supabase et a PostgREST.

## 10. Stockage S3

Introduire un contrat unique couvrant :

- depot d'un objet avec type et taille controles ;
- lecture ou URL signee a duree limitee ;
- suppression idempotente ;
- enumeration reservee aux traitements de reconciliation ;
- metadonnees et somme de controle ;
- promotion eventuelle d'un objet temporaire vers sa cle finale.

Les references metier stockent uniquement : bucket logique, cle d'objet,
version ou ETag, taille et type MIME. Aucune URL fournisseur n'est persistee.

La migration des objets se fait bucket par bucket : inventaire source,
copie, verification taille/checksum, double lecture temporaire, bascule des
ecritures, puis arret de l'ancien bucket. Les buckets publics font l'objet
d'un controle de cache et de politique CORS separe.

## 11. API, fonctions Edge et worker

### 11.1 Extraction de l'API

La facade `magrit-api` devient un point d'entree Node standard. Le handler
actuel base sur `Request`/`Response` et les routes sous `src/server/api`
doivent rester reutilisables. Le runtime Node fournit seulement :

- serveur HTTP ;
- configuration ;
- pool PostgreSQL ;
- adaptateur S3 ;
- authentification ;
- healthchecks, logs et arret propre.

### 11.2 Classification des fonctions Edge

Chaque fonction existante recoit un statut documente :

- `migrate-api` : route synchrone integree a l'API ;
- `migrate-worker` : traitement asynchrone integre au worker ;
- `keep-temporarily` : encore necessaire pendant la transition ;
- `delete-legacy` : route couverte ailleurs ou fonctionnalite abandonnee.

Les quatre traitements de type worker identifies sont regroupes dans le
worker Magrit. Les fonctions PIM, mockup, assistant et sitemap sont classees
selon leur duree : route API si courte, commande asynchrone sinon.

### 11.3 Planification

Les deux purges SQL actuelles peuvent etre declenchees par :

- le scheduler du fournisseur de calcul ; ou
- une boucle planifiee du worker avec verrou PostgreSQL advisory.

Le choix ne doit pas exiger `pg_cron`. En developpement, les commandes de purge
restent invocables manuellement et le scheduler peut etre active avec une
cadence acceleree dans les tests.

## 12. Deroulement par jalons

### J0 - Decision et gel de la dette

Livrables :

- ADR validant la cible ;
- interdiction CI de toute nouvelle dependance directe a Supabase ;
- inventaire des fonctions Edge, policies, RPC et buckets ;
- choix provisoire de la bibliotheque d'authentification.

Sortie : aucun nouveau developpement n'augmente les compteurs Supabase.

### J1 - Infrastructure de developpement autonome

Livrables :

- Compose PostgreSQL 17 + SeaweedFS + initialisation + Mailpit ;
- commandes `infra:dev:*`, migrations et seed ;
- healthchecks ;
- CI d'integration sur cette infrastructure.

Sortie : un clone neuf demarre Magrit sans Supabase CLI et sans compte
Supabase pour un premier smoke technique.

### J2 - API Node hors Edge Runtime

Livrables :

- serveur Node conteneurisable ;
- facade `/api/v1` montee sans Deno ;
- configuration, logs structures et healthchecks ;
- deploiement d'un environnement de recette ;
- Supabase encore utilise derriere les adaptateurs existants.

Sortie : le front de recette n'appelle plus Supabase Edge directement.

### J3 - Baseline PostgreSQL et adaptateurs directs

Livrables :

- baseline SQL nettoyee ;
- roles PostgreSQL ;
- nouveau runner de migrations ;
- adaptateurs PostgreSQL par domaine ;
- tests contractuels doubles ;
- remplacement progressif de `auth.uid()` par le contexte Magrit.

Sortie : l'API de recette fonctionne contre un PostgreSQL standard sans
PostgREST.

### J4 - Stockage S3

Livrables :

- contrat Storage unique ;
- adaptateur S3 et SeaweedFS ;
- huit buckets et leurs controles ;
- outil de copie et de verification ;
- double lecture temporaire et procedure de rollback.

Sortie : aucun parcours applicatif ne depend de `storage.objects` ou d'une URL
Supabase.

### J5 - Identite Magrit et authentification

Livrables :

- `app_users` et `user_identities` ;
- bibliotheque d'authentification locale ;
- migration ou reinitialisation controlee des mots de passe ;
- repointage des 60 cles etrangeres ;
- remplacement des 66 usages SQL de `auth.uid()` ;
- adaptateur OIDC configurable par boutique ;
- tests d'invitation, recovery, session et revocation.

Sortie : aucun parcours ne depend de Supabase Auth.

### J6 - Worker et suppression des fonctions Edge

Livrables :

- worker outbox/notifications/exports/purges ;
- scheduler standard ;
- migration des traitements a la demande ;
- suppression des fonctions et routes legacy prouvees inutiles.

Sortie : aucun runtime Edge Supabase n'est requis.

### J7 - Repetition et bascule

Livrables :

- export de production/recette ;
- restauration PostgreSQL sur une instance vierge ;
- copie S3 avec checksums ;
- comparaison des volumes et invariants metier ;
- tests multi-tenant, securite et performance ;
- procedure de bascule et de rollback chronometree ;
- sauvegarde finale immuable de la source Supabase.

Sortie : deux repetitions completes reussies, dont une avec le volume cible
estime, avant la bascule definitive.

## 13. Strategie de bascule

Tant que le projet n'est pas en production, privilegier une bascule courte :

1. geler temporairement les ecritures ;
2. effectuer l'export final PostgreSQL ;
3. importer et verifier les donnees ;
4. copier puis verifier les objets ;
5. basculer les secrets et la destination de l'API ;
6. executer les smokes authentifies et multi-tenant ;
7. rouvrir les ecritures ;
8. conserver Supabase en lecture seule pendant la periode de securite.

Le rollback remet l'ancienne API en service tant qu'aucune ecriture n'a ete
acceptee sur la nouvelle cible. Apres reouverture des ecritures, un rollback
exige une procedure de reconciliation explicite ; il ne doit pas etre improvise.

## 14. Validation obligatoire

Chaque jalon execute au minimum :

- typecheck et build ;
- tests unitaires et contractuels ;
- tests d'integration PostgreSQL/S3 ;
- tests de non-regression des API OpenAPI ;
- tests d'isolation entre deux tenants ;
- tests de session et de revocation ;
- tests de taille/type MIME et d'URL signee ;
- sauvegarde/restauration automatisee ;
- verification qu'aucun secret ne rejoint le bundle navigateur.

Les chemins sensibles ajoutent des tests de mutation ou de refus explicite :
utilisateur d'un autre tenant, boutique non associee, objet d'un autre tenant,
OIDC issuer/audience/nonce invalides et session revoquee.

## 15. Criteres de sortie de Supabase

La migration est terminee lorsque :

- le paquet `@supabase/supabase-js` n'est plus une dependance runtime ;
- aucun composant, serveur ou worker n'appelle une URL Supabase ;
- aucune table metier ne reference `auth.users` ;
- aucune fonction SQL n'appelle `auth.uid()` ;
- aucun objet metier ne depend de `storage.objects` ;
- les schemas Supabase ne sont pas requis par la baseline ;
- `pg_net`, Vault, PostgREST, Realtime et Edge Runtime ne sont pas requis ;
- le developpement local et la CI fonctionnent sans Supabase CLI ;
- la restauration PostgreSQL et S3 a ete testee ;
- les smokes de recette et les tests multi-tenant sont verts ;
- les procedures d'exploitation, sauvegarde, restauration et rotation des
  secrets sont documentees.

## 16. Risques et parades

| Risque | Parade |
|---|---|
| regression d'autorisation pendant la reduction RLS | matrice d'acces, tests multi-tenant, role runtime non proprietaire |
| perte de contexte avec le pool PostgreSQL | transaction obligatoire et `set_config(..., true)` |
| comptes inutilisables apres migration | prototype bcrypt, campagne de reset et support explicite |
| association OIDC au mauvais compte | cle `(issuer, subject)`, invitation prealable, pas de confiance email seule |
| objet manquant apres copie | inventaire, taille, checksum et double lecture |
| divergence pendant la bascule | gel des ecritures ou synchronisation explicitement concue |
| nouvelle dependance a une bibliotheque Auth | `app_users` independant et port d'authentification Magrit |
| environnement local trop lourd | seulement PostgreSQL, SeaweedFS et Mailpit ; API/worker executes par `pnpm` |

## 17. Ordre de grandeur

L'ordre de grandeur initial, a recalibrer apres J0 et le prototype Auth, est :

- J0-J2 : une a deux semaines ;
- J3-J4 : deux a quatre semaines ;
- J5 : deux a trois semaines ;
- J6-J7 : une a trois semaines.

Soit environ six a douze semaines sequentielles pour une sortie complete. La
mise a disposition de l'infrastructure locale et l'extraction de l'API doivent
etre livrees en premier, car elles reduisent immediatement les pannes de
developpement sans attendre la migration des donnees et de l'authentification.
