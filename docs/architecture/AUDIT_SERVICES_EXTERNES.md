# Audit des services externes et stratégie de réversibilité

**Date :** 2026-08-11  
**Périmètre :** application React, serveur applicatif, Supabase Edge Functions, migrations SQL, build et ressources chargées à l'exécution  
**Statut :** constat opposable aux nouveaux développements ; trajectoire proposée à valider

## 1. Conclusion

Magrit dépend actuellement de Supabase comme **plateforme complète** : base PostgreSQL, API PostgREST/RPC, authentification, stockage d'objets, temps réel et hébergement de fonctions. Le couplage le plus problématique n'est pas l'utilisation de Supabase en elle-même, mais le fait que son SDK, ses tables, ses RPC et ses URL sont connus directement par le navigateur.

Le dépôt contient au moment de l'audit :

- 47 fichiers sous `src/app` qui référencent Supabase ;
- 83 expressions `supabase.*` dans l'UI historique ;
- 76 appels directs aux capacités `from`, `rpc`, `functions`, `storage` ou `auth` ;
- 11 répertoires de fonctions Edge, dont un répertoire historique vide ;
- 65 migrations SQL utilisant notamment RLS, `auth.users`, `auth.uid()` et `storage.objects`.

Le remplacement immédiat de Supabase serait donc risqué. La stratégie recommandée est de rendre les fournisseurs **remplaçables par ports et adaptateurs**, puis de décider séparément s'il est utile de changer de fournisseur.

## 2. Cartographie des dépendances actives

| Fournisseur / service | Capacités utilisées | Couplage observé | Risque de verrouillage | Cible |
|---|---|---|---|---|
| Supabase | PostgreSQL, PostgREST, RPC, Auth, Storage, Realtime, Edge Functions | SDK et schéma connus de 47 fichiers UI ; URL et clé publique dans `utils/supabase` ; RLS liée à `auth.uid()` ; fonctions liées au runtime Deno/Supabase | Critique | API Magrit même origine, repositories et adaptateurs fournisseur côté serveur |
| Anthropic | génération et streaming IA | wrapper partagé existant, mais appel direct encore dupliqué dans la fonction historique `make-server-e3db71a4` | Élevé | port `LlmProvider`, adaptateur Anthropic unique, format de streaming interne |
| Resend | invitations et notifications de commande | appels HTTP directs dupliqués dans quatre fonctions Edge | Élevé | port métier `EmailSender` / `NotificationSender`, adaptateur Resend unique |
| Clariprint | calcul de devis et test de connexion | un `ClariprintAdapter` existe, mais il cible actuellement une URL Edge Supabase ; la fonction historique connaît directement l'API Clariprint | Élevé | port `PricingEngine`, adaptateur Clariprint serveur indépendant de l'hébergeur API |
| Google Fonts | polices du frontend | import CSS distant au chargement de chaque client | Moyen | polices auto-hébergées et versionnées dans les assets Magrit |
| jsDelivr / unpkg | police Inter et WASM `resvg` du générateur de mockups | téléchargements à l'exécution dans la fonction | Élevé pour la disponibilité du rendu | embarquer les fichiers versionnés dans l'artefact de déploiement ou un stockage maîtrisé |
| Unsplash | images de démonstration enregistrées par migration | URL distantes persistées dans les données de seed | Faible à moyen | importer les assets de démonstration dans le stockage applicatif |

L'API INSEE mentionnée dans `sirenValidator.ts` n'est pas active : son appel est commenté. Les bibliothèques npm/jsr de compilation ne sont pas des services opérationnels, mais les imports Deno par URL doivent être verrouillés et reproductibles.

## 3. Où l'encapsulation existe déjà

### Access Management

Le nouveau module suit la direction cible :

- l'UI appelle une URL relative `/api/v1` ;
- le contrat HTTP est indépendant du fournisseur ;
- Supabase n'apparaît que dans l'adaptateur `infrastructure/legacy` et la composition serveur ;
- l'hébergement Edge est une option de déploiement, pas le contrat public.

Déployer `access-management` sur Supabase reste donc compatible avec la réversibilité. En production, un proxy ou une gateway doit exposer `/api/v1` sur le domaine Magrit et masquer `/functions/v1`.

### Plateforme et Clariprint

Des ports existent déjà sous `src/platform` et un `ClariprintAdapter` existe sous `src/server`. Ces frontières sont utiles, mais leur composition et certains contrats connaissent encore directement `SupabaseClient`, une clé anonyme ou une URL Edge. Ils doivent devenir des adaptateurs terminaux et non des dépendances exposées aux consommateurs.

### Anthropic

`supabase/functions/_shared/anthropicClient.ts` constitue un début d'adaptateur partagé. La fonction historique conserve toutefois un second appel direct à `api.anthropic.com`, ce qui permet aux comportements de diverger.

## 4. Fuites architecturales prioritaires

### 4.1 Bootstrap de l'application

Les contexts globaux chargent directement `user_preferences`, `tenants`, `tenant_members`, `shops`, `quotes`, `quote_templates`, le PIM, les bibliothèques et les conversations. C'est la cause des appels Supabase visibles dès un simple rafraîchissement du dashboard.

Ces lectures doivent être remplacées en premier par une API de session/bootstrap, par exemple :

```http
GET /api/v1/session
GET /api/v1/me/preferences
GET /api/v1/me/tenants
GET /api/v1/tenants/{tenantId}/workspace
```

Une réponse agrégée de bootstrap peut éviter la rafale actuelle, sans créer une API générique qui exposerait à nouveau les tables.

### 4.2 Authentification

Le navigateur utilise directement Supabase Auth pour la session, la connexion, l'inscription, la réinitialisation et la mise à jour du compte. Même après migration des données, cela maintiendrait le SDK et le fournisseur dans l'UX.

La cible réversible est un BFF d'identité :

- session applicative portée par un cookie `HttpOnly`, `Secure`, `SameSite` ;
- endpoints Magrit de connexion, déconnexion, inscription et récupération ;
- port serveur `IdentityProvider` ;
- premier adaptateur `SupabaseIdentityProvider`, remplaçable par OIDC ou un autre fournisseur.

La migration de l'authentification est plus sensible que celle des lectures et doit être réalisée après la façade API, avec coexistence temporaire des jetons.

### 4.3 Données et transactions

Les composants construisent actuellement des requêtes PostgREST et orchestrent parfois plusieurs écritures. Ils connaissent les noms de tables, les colonnes et les détails RLS. Chaque domaine doit exposer des opérations métier atomiques : commandes, devis, boutiques, catalogue/PIM, bibliothèques, conversations et gestion commerciale.

La base peut rester PostgreSQL/Supabase. Les repositories serveur doivent recevoir un port SQL ou transactionnel interne ; aucun type `SupabaseClient` ne doit franchir la composition d'infrastructure.

### 4.4 Stockage et URL publiques

Les uploads et les URL de buckets Supabase sont construits dans l'UI. Une API d'assets doit fournir des commandes d'upload et des URL applicatives stables :

```http
POST /api/v1/shops/{shopId}/assets/uploads
POST /api/v1/shops/{shopId}/mockups
GET  /assets/{assetId}
```

Le port `ObjectStorage` pourra être implémenté par Supabase Storage, S3 ou un stockage compatible. Les clés physiques de bucket ne doivent pas devenir des identifiants métier.

### 4.5 Temps réel

`PublicShop` crée directement un canal Supabase Realtime. Le frontend doit dépendre d'un flux Magrit (`SSE` ou WebSocket) exprimant des événements métier, par exemple `shop.catalog.updated`, sans connaître les tables ni le protocole du fournisseur.

### 4.6 Fonctions historiques

`make-server-e3db71a4` regroupe santé, IA, Clariprint, sauvegarde produit, email et éditorial. Son nom technique et ses responsabilités multiples empêchent une migration indépendante. Ses routes doivent être remplacées progressivement par les API des modules propriétaires, puis la fonction supprimée.

## 5. Architecture cible

```text
Navigateur
  -> domaine Magrit : /api/v1, /assets, /events
      -> handlers API contractuels
          -> cas d'usage des modules
              -> ports sémantiques
                  -> adaptateurs fournisseurs
                      - PostgreSQL / Supabase
                      - Supabase Auth / OIDC
                      - Supabase Storage / S3
                      - Supabase Edge / Node conteneurisé
                      - Anthropic / autre LLM
                      - Resend / SMTP / autre email
                      - Clariprint
```

Il ne faut pas créer un « module services externes » central contenant toute la logique. Chaque module métier possède ses ports sémantiques ; une couche de composition `server/integrations` sélectionne les adaptateurs selon la configuration.

## 6. Règles mécaniques à ajouter

Les contrôles actuels empêchent l'augmentation de la dette Supabase selon une baseline. Ils doivent évoluer vers les règles suivantes :

1. aucun import `@supabase/*` ou `utils/supabase` sous `src/app` et `src/modules/*/ui` à l'issue de la migration ;
2. aucun hostname fournisseur ni `/functions/v1` dans le code UI ;
3. aucun appel `fetch` direct dans un composant ou context, sauf client HTTP typé d'infrastructure UI ;
4. aucun type SDK fournisseur dans les ports, domaines, applications et contrats API ;
5. liste blanche des domaines sortants côté serveur, testée en architecture ;
6. secrets uniquement dans la composition de déploiement ;
7. tests de contrat communs exécutés contre chaque adaptateur ;
8. budget de dette décroissant : toute migration doit réduire les compteurs de la baseline, qui ne peut jamais augmenter.

## 7. Plan de sortie progressif

| Étape | Résultat vérifiable | Priorité |
|---|---|---|
| E0 — Garde-fous | registre des fournisseurs, détection des URL/imports/appels directs, baseline non croissante | Immédiate |
| E1 — Façade et bootstrap | le chargement du dashboard n'interroge plus les tables Supabase depuis le navigateur | Critique |
| E2 — Access Management | API déployée derrière `/api/v1`, activation et droits administrables sans console Supabase | Critique |
| E3 — APIs métier | contexts historiques remplacés domaine par domaine : tenant/préférences, boutiques/catalogue, devis, commandes, PIM, bibliothèques/conversations | Haute |
| E4 — Assets et événements | aucun Storage ni Realtime Supabase dans le navigateur | Haute |
| E5 — Intégrations sortantes | ports uniques Anthropic, Resend et Clariprint ; suppression des appels dupliqués | Haute |
| E6 — Runtime portable | handlers exécutables sur Edge ou serveur Node/conteneur sans modifier les modules ni l'OpenAPI | Moyenne |
| E7 — Plan de réversibilité des données | export restaurable, répétition de migration, inventaire RLS/Auth/Storage, objectifs RTO/RPO | Moyenne |

L'ordre recommandé pour E1 est `TenantContext` et `PreferencesContext`, puis les providers globaux `Shops`, PIM et bibliothèques, puis devis et conversations. C'est ce qui réduira immédiatement le nombre d'appels vus au rafraîchissement.

## 8. Critères de réussite

- l'onglet Réseau du navigateur ne montre aucun domaine Supabase, Anthropic, Resend ou Clariprint ;
- le frontend ne contient aucune clé ni aucun identifiant de projet fournisseur ;
- les OpenAPI Magrit restent identiques lors du remplacement d'un adaptateur ;
- chaque fournisseur externe possède un port, un adaptateur, des tests de contrat, un timeout et une politique d'erreur ;
- une panne Anthropic, Resend ou Clariprint est isolée et ne bloque pas le bootstrap Magrit ;
- une restauration PostgreSQL et des objets est testée hors du projet Supabase courant ;
- le runtime API peut être déplacé sans modification des modules métier.

## 9. Décision recommandée

Conserver Supabase à court terme comme premier adaptateur et hébergeur, mais interdire qu'il soit une API publique de Magrit. Démarrer par E0/E1, poursuivre le déploiement d'Access Management derrière la façade `/api/v1`, puis extraire les domaines historiques par tranches verticales. Cette trajectoire donne une indépendance réelle sans imposer une réécriture simultanée de l'authentification, des données, du stockage et du runtime.

## 10. Supabase local et auto-hébergé

Deux usages doivent être distingués :

### Stack locale de développement

La CLI Supabase lance via Docker PostgreSQL, Auth, Storage, Realtime, PostgREST, Studio et le runtime des fonctions. Elle permet de rejouer les migrations et de tester sans dépendre du projet cloud. C'est une première preuve de portabilité et cela doit devenir l'environnement de développement et de CI de référence.

État du dépôt au 2026-08-11 :

- les 65 migrations et les fonctions sont présentes ;
- `supabase/config.toml` est absent ;
- la CLI Supabase n'est pas installée dans le projet ;
- le client Docker est installé, mais le daemon n'est pas démarré.

Travail nécessaire : ajouter une version épinglée de la CLI, initialiser la configuration sans écraser le dossier existant, définir un seed minimal non sensible, exécuter `db reset`, lancer les fonctions, puis faire tourner les tests RLS et API contre la stack locale.

### Supabase auto-hébergé en production

La distribution Docker officielle peut être installée sur une infrastructure maîtrisée. Cela retire la dépendance au SaaS Supabase, mais pas la dépendance technique à l'écosystème Supabase. L'équipe devient responsable de la sécurité, des mises à jour, de PostgreSQL, de la haute disponibilité, de la sauvegarde, de la restauration, de la supervision et de la capacité.

Certaines fonctions de la plateforme managée ne sont pas présentes en auto-hébergement, notamment les sauvegardes/PITR gérées, le branching, certaines métriques et API de gestion. Il faut donc évaluer le coût d'exploitation avant de retenir cette cible.

### Recommandation

1. adopter immédiatement Supabase local pour le développement et les tests reproductibles ;
2. conserver provisoirement le Supabase managé pour la production ;
3. maintenir la façade `/api/v1` et les adaptateurs, car l'auto-hébergement seul ne corrige pas le couplage du frontend ;
4. réaliser ensuite un exercice de restauration sur une instance auto-hébergée isolée ;
5. décider sur mesures si l'exploitation autonome apporte assez de contrôle pour compenser son coût.

Le test décisif de réversibilité n'est pas seulement que Supabase démarre en local : c'est que le frontend reste inchangé lorsque l'URL, l'hébergement ou l'adaptateur de données change.
