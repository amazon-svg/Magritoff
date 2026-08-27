# Story — Intégration HopeStudio dans Magrit

## Statut

Implémentée pour le socle tenant, le chat Magrit et le montage de l’UX headless.

Commits de référence :

- `c2dbffb` — `feat(hopstudio): add tenant-aware backend integration` ;
- `bf5978e` — `feat(hopstudio): mount headless workspace UX`.

## Objectif

Intégrer HopeStudio comme module métier de Magrit sans exposer ses secrets au
navigateur. Lorsqu’un tenant active Clariprint Studio, l’accueil Magrit charge
l’UX headless HopeStudio et les appels émis par cette UX sont relayés par le
backend Magrit vers `/json.wcl`.

L’intégration doit également permettre au chat Magrit historique d’utiliser
HopeStudio, tout en conservant un repli vers le fournisseur existant lorsque le
module est désactivé.

## Périmètre livré

### Module et configuration par tenant

- module `hopstudio` déclaré dans le registre des applications Magrit ;
- entrée « Clariprint Studio » dans les paramètres du workspace, réservée aux
  administrateurs du tenant ;
- écran de configuration avec activation, URL HopeStudio, identifiant,
  mot de passe et URL Clariprint ;
- identifiant et mot de passe Clariprint optionnels ;
- routes tenant-scoped `GET` et `PUT` pour lire et modifier la configuration ;
- persistance dans `tenant_hopstudio_settings`, isolée par tenant et protégée
  par RLS ;
- chiffrement AES-256-GCM du mot de passe avant stockage ;
- le mot de passe n’est jamais renvoyé au navigateur : l’API expose uniquement
  l’indicateur `clariprintPasswordConfigured`.

### Sécurité et identité

- authentification et appartenance au tenant vérifiées par Magrit avant tout
  appel HopeStudio ;
- `tenantId` et `userId` sont déterminés par le backend puis imposés dans les
  requêtes sortantes ;
- les valeurs fournies par le navigateur ne peuvent pas changer l’identité
  effective de la requête ;
- injection backend de `X-CLARIPRINT-USER`, `X-CLARIPRINT-PASS` et
  `X-CLARIPRINT-URL` lorsqu’ils sont configurés ;
- aucun secret Clariprint n’est transmis à l’UX headless ni enregistré dans les
  traces d’appels externes.

La sécurité Magrit complète celle de HopeStudio : Magrit contrôle l’accès au
tenant et HopeStudio reste responsable de l’autorisation sur ses propres
sessions et données métier.

### Adaptateur chat Magrit

- contrats Zod pour les requêtes, réponses et configurations produit ;
- port applicatif `HopeStudioChatGateway` et adaptateur HTTP `CallAI` ;
- requête envoyée en `application/x-www-form-urlencoded` avec
  `action=CallAI`, `id=hopes-chat-to-product-UI-full-lib` et
  `parameters_value` ;
- sélection automatique de HopeStudio pour `/api/v1/assistant/chat` lorsque le
  module est activé pour le tenant ;
- repli vers l’assistant historique lorsque HopeStudio est désactivé ;
- normalisation des cartes et événements HopeStudio vers le contrat Magrit
  `{ clariprint, display, hopStudio }` ;
- suppression du mode démo dans les résultats HopeStudio : la réponse indique
  explicitement `provider: "hopstudio"` et `demoMode: false` ;
- support des réponses JSON et SSE avec événement final `done` ;
- confinement des références techniques `UID` et `DBK` derrière
  `sessionRef` et `sessionDataRef` ;
- réutilisation de ces références pendant la session active du chat Magrit.

### UX headless HopeStudio dans l’accueil Magrit

- chargement du runtime `sugarcrepeHLUX.mjs` depuis
  `/vendor/hopstudio/1.0.0/` ;
- montage dans un conteneur dédié de l’accueil/configurateur Magrit lorsque le
  tenant a activé Clariprint Studio ;
- initialisation de `window.HChat` avec `tenant_id`, `user_id` et la session par
  défaut ;
- configuration des chemins headless, templates EJS, images, langues et CSS ;
- feuille `sugarcrepeHLUX.magrit.css` dédiée à l’adaptation graphique dans
  Magrit ;
- nettoyage des instances détachées et du widget lors du démontage React ;
- écran `/dev/hopstudio` conservé comme banc d’intégration du runtime headless.

### Callbacks et workflow HLUX

- déclaration de `HLUX.customApiFetch` immédiatement après
  `newInstanceFromElem` ;
- enveloppe de callback compatible avec le modèle du `WorkflowController` :
  `hook`, `event`, `provider` et `context` ;
- route backend
  `POST /api/v1/tenants/{tenantId}/integrations/hopstudio/workflow` ;
- relais générique des actions `CallAI`, sessions, panier et autres actions
  produites par HLUX vers le serveur HopeStudio configuré ;
- l’URL distante et les en-têtes d’authentification sont toujours construits
  côté serveur ;
- propagation d’un identifiant de corrélation `X-Request-Id` et réponses
  d’erreur au format `application/problem+json`.

### Traçabilité des services externes

- registre générique `external_service_requests` pour les appels sortants ;
- enregistrement du tenant, de l’utilisateur lorsqu’il est connu, du provider,
  de l’opération, de l’URL expurgée, des entrées/sorties métier, du statut HTTP,
  de la durée, de l’état et du message d’erreur ;
- enregistrement des tokens d’entrée et de sortie lorsqu’ils sont présents dans
  la réponse HopeStudio ;
- limites de taille à 512 Kio pour les payloads et expiration par défaut à
  90 jours ;
- accès en lecture protégé par RLS et purge réservée au `service_role` ;
- commandes `logs:hopstudio`, `logs:hopstudio:recent` et documentation du test
  live en ligne de commande.

### Documentation et tests

- documentation OpenAPI des routes chat, configuration et workflow ;
- tests des adaptateurs chat/workflow, de la normalisation, du chiffrement, des
  repositories, des routes, de la navigation et du montage d’intégration ;
- test live HopeStudio optionnel via un fichier `.env.hopstudio.test` ignoré par
  Git ;
- validation effectuée par TypeScript, tests Vitest ciblés et build Vite de
  production.

## Continuité des conversations

Le couple stable `tenantId` / `userId` est envoyé dans toutes les requêtes
HopeStudio. Il permet à HopeStudio de partitionner l’historique par utilisateur
et tenant.

`UID` ou `session_id` identifie une session HopeStudio précise. `DBK` identifie
sa clé de données technique et ne doit pas être confondu avec l’identifiant de
session. Magrit les expose uniquement sous les noms `sessionRef` et
`sessionDataRef`.

La réutilisation fonctionne actuellement pendant la vie du composant de chat.
La persistance durable de cette correspondance dans les conversations Magrit
reste à réaliser.

## Reste à faire

- effectuer la passe UX sur les templates et la CSS HopeStudio dans le contexte
  réel de l’accueil Magrit ;
- ajouter un écran d’administration pour explorer facilement le registre
  `external_service_requests` ;
- persister durablement `sessionRef` et `sessionDataRef` avec la conversation
  Magrit ;
- permettre à un produit PIM d’embarquer optionnellement une configuration
  HopeStudio ;
- charger l’UX de fiche produit HopeStudio lorsqu’une telle configuration est
  présente ;
- intégrer le calcul de prix HopeStudio et son résultat dans les parcours PIM,
  boutique, devis et panier ;
- rendre les primitives d’affichage HopeStudio réutilisables dans les boutiques ;
- définir, si nécessaire, une façade MCP au-dessus des API métier HopeStudio ;
- préparer la stratégie de déploiement et de rétention/purge automatisée des
  traces en production.

## Critères d’acceptation couverts

- un administrateur peut activer et configurer HopeStudio pour son tenant ;
- les secrets restent exclusivement côté backend et sont chiffrés au repos ;
- l’identifiant et le mot de passe Clariprint peuvent être omis ;
- l’accueil Magrit charge HLUX lorsque HopeStudio est activé ;
- `HLUX.customApiFetch` relaie les callbacks via le backend Magrit ;
- le chat Magrit utilise les réponses réelles de HopeStudio sans mode démo ;
- tenant, utilisateur, durée, statut, entrées et sorties sont traçables pour les
  appels externes ;
- l’application compile, les tests ciblés passent et le build de production est
  généré.
