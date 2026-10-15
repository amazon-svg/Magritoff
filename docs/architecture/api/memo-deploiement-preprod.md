# Mémo sur le déploiement de la préprod Magritoff

**Date : 14 octobre 2026.** Observations issues de la préparation et du déploiement réalisés à partir du 12 octobre 2026.

La préprod a été installée sur un VPS OVH existant, avec Docker Compose derrière Apache. Cette solution conserve les sites PHP déjà hébergés, donne la maîtrise des rôles PostgreSQL et évite de souscrire un nouvel hébergement. Les tests CI fonctionnent ; le déploiement automatique attend encore la validation de son accès SSH.

## Contraintes de départ

- Héberger l'application et ses données en France, ou à défaut en Europe.
- Garder un coût raisonnable, évalué sur le tarif récurrent et les options nécessaires.
- Utiliser un seul fournisseur d'hébergement pour l'application, PostgreSQL et les fichiers. GitHub reste le service de code et de CI.
- Pouvoir déployer la stack à partir d'un Docker Compose et automatiser les livraisons.
- Conserver les rôles PostgreSQL et les règles de sécurité de l'application.
- Préserver les services existants sur le VPS.

L'expérience antérieure chez OVH et l'existence de services chez Clever Cloud étaient des éléments de contexte, sans préférence imposée pour un fournisseur.

## Prérequis de Magritoff

### Application et traitements

La stack comprend un front React construit avec Vite, une API Node et quatre workers : notifications, outbox, exports et purge des fichiers. Elle nécessite aussi PostgreSQL, un stockage compatible S3 et un transport d'emails. L'image applicative utilise Node 22 ; les migrations doivent précéder le démarrage de la nouvelle version.

Le front appelle l'API sur la même origine, sous `/api/v1`. Le proxy doit transmettre les uploads, préserver les informations nécessaires à HTTPS et fournir une adresse cliente exploitable par la limitation des tentatives d'authentification.

### PostgreSQL et données initiales

La base doit permettre de créer les rôles applicatifs et d'autoriser les comptes de connexion à les adopter. L'API utilise `SET LOCAL ROLE magrit_api` et les workers `SET LOCAL ROLE magrit_worker`. L'authentification locale utilise également les droits `magrit_auth`. Les comptes runtime doivent rester sans `SUPERUSER` ni `BYPASSRLS`.

L'absence d'un accès superutilisateur sur une base managée ne suffit donc pas à conclure à son incompatibilité : il faut vérifier les opérations réellement nécessaires, notamment la création des rôles, leurs appartenances et `SET ROLE`. Sur la base Docker dédiée, le compte propriétaire privilégié est réservé aux migrations et à l'administration.

Les migrations créent la structure de la base, mais ne chargent pas automatiquement tout le référentiel métier. Les **81 gammes PIM et leurs 16 familles racines** nécessitent un import distinct. Cet import ne crée pas de produits de démonstration et n'active pas les catégories pour un tenant.

### Fichiers et emails

Le stockage S3 nécessite des volumes persistants et une adresse HTTPS publique : les URL signées sont utilisées par le navigateur. Un endpoint interne tel que `http://s3:8333` ne convient pas comme adresse des URL destinées aux utilisateurs. Le proxy doit conserver le Host et le chemin nécessaires aux signatures, et autoriser les échanges CORS depuis l'application.

La vérification des comptes nécessite un email accessible. Pour cette préprod, Mailpit capture les messages sans envoi réel. Aucun compte applicatif par défaut n'a été créé : l'utilisateur s'inscrit et utilise le lien reçu dans Mailpit.

## Contraintes observées chez les fournisseurs

| Fournisseur ou offre | Observation pendant la recherche | Conséquence pour ce déploiement |
| --- | --- | --- |
| Clever Cloud PostgreSQL managé | L'utilisateur a constaté que son offre empêchait la création des rôles requis. | Offre écartée pour la stack envisagée. Cela décrit le blocage rencontré, pas une impossibilité universelle d'héberger toute application chez Clever Cloud. |
| Scaleway Serverless Containers | Le parcours documenté déploie des images de conteneurs ; aucune prise en charge directe de notre stack Compose complète n'a été établie. | Une VM avec Compose restait une option. Le manque initial de solution identifiée ne prouvait pas une incompatibilité de Scaleway. |
| Scaleway PostgreSQL managé | La documentation prévoit des comptes administrateurs capables de créer des utilisateurs. Les migrations et changements de rôle Magritoff n'ont pas été testés sur cette offre. | Compatibilité à vérifier avant une souscription ; aucune validation de cette architecture n'a été obtenue. |
| OVH VPS neuf | Le configurateur proposait une offre adaptée, mais l'utilisateur a rencontré une absence de stock en Europe au moment de commander. | La présence d'une offre au catalogue ne garantissait pas sa disponibilité. Recherche d'une alternative, puis réutilisation du VPS existant. |
| OVH image Docker sur Debian 12 | Docker était annoncé préinstallé, sans détail technique trouvé sur les versions, dépôts et réglages de cette image. | Choix d'une distribution seule, puis installation explicite de Docker depuis son dépôt officiel. |
| LWS VPS M | Le panier affichait 4,99 € HT pour le premier mois, puis 19,99 € HT par mois au renouvellement. | Comparaison fondée sur le prix récurrent : 23,99 € TTC par mois avec TVA à 20 %, et non sur les 5,99 € TTC d'appel. Offre non retenue. |
| Hetzner | Offre européenne envisagée pour son coût. Aucun serveur n'a été commandé ou testé. | Alternative étudiée, sans disponibilité ni fonctionnement confirmés pour Magritoff. |
| Elestio | Une offre Custom Docker Compose et des cibles CI/CD sur VM gérée étaient documentées. | Piste pour déléguer l'administration ; région, coût final et périmètre de sauvegarde restaient à vérifier. Offre non utilisée. |

Les prix ci-dessus sont ceux observés pendant la comparaison du 12 octobre, pas un devis actuel. La disponibilité et les conditions doivent être revérifiées lors d'une commande.

Sources consultées : [PostgreSQL Clever Cloud](https://www.clever-cloud.com/developers/doc/addons/postgresql/), [déploiement des conteneurs Scaleway](https://www.scaleway.com/en/docs/serverless-containers/how-to/deploy-container/), [utilisateurs des bases Scaleway](https://www.scaleway.com/en/docs/managed-databases-for-postgresql-and-mysql/how-to/manage-users/), [images VPS OVH](https://www.ovhcloud.com/fr/vps/os/), [VPS Ubuntu LWS](https://www.lws.fr/vps-ubuntu.php), [CI/CD Elestio](https://docs.elest.io/developer-tools/elestio-cli/cicd/).

## Architecture retenue sur le VPS existant

Le diagnostic a identifié **Ubuntu 24.04 LTS**, **4 vCPU**, environ **8 Go de RAM**, dont **6,3 Gio disponibles**, et **83 Go de disque disponibles** au moment du contrôle. Ces ressources constituent un point de départ pour une préprod peu sollicitée ; la consommation pendant les builds, les exports et l'accumulation des fichiers reste à suivre.

Apache sert déjà plusieurs domaines. Le serveur héberge aussi Nginx sur 8080, deux PostgreSQL locaux sur 5432 et 5433, MariaDB, Redis, un service Node, Postfix et Webmin. Le faible trafic des sites PHP ne signifie donc pas que le serveur est vide.

La nouvelle stack s'appelle `magritoff-preprod`. Ses seuls ports publiés sont liés à `127.0.0.1` :

| Service | Port local | Accès |
| --- | --- | --- |
| Front | 18080 | Apache, domaine `magritt.clariprint.fr` |
| API | 18787 | Apache, chemins `/api/` |
| S3 | 18333 | Apache, domaine `fichiers-magritt.clariprint.fr` |
| Mailpit | 18025 | Tunnel SSH depuis le poste d'administration |
| PostgreSQL | Aucun port publié | Réseau Docker privé |

Le réseau proposé est `172.29.80.0/24`, sans chevauchement avec les routes affichées lors du diagnostic. Les PostgreSQL existants restent indépendants de la base de préprod.

Docker a été installé depuis son dépôt APT officiel. Le test `hello-world` et Compose ont fonctionné ; Apache est resté actif. Les deux DNS pointent vers le VPS et les certificats Let's Encrypt ont été délivrés. Un hook recharge Apache après renouvellement. Des vhosts temporaires ont permis de valider HTTPS avant le raccordement aux conteneurs.

**Dokploy n'est pas utilisé.** Son proxy aurait nécessité une adaptation pour cohabiter avec Apache sur 80 et 443. Le choix retenu est Compose pour la stack et GitHub Actions pour les livraisons. Portainer a été évoqué comme interface de supervision, mais aucune installation n'a été réalisée dans cette session.

## Difficultés rencontrées et corrections

### Accès au dépôt privé

L'ajout de la clé de lecture du VPS exigeait l'intervention du propriétaire du dépôt GitHub. Cette dépendance a interrompu temporairement le déploiement. La préparation DNS et HTTPS a pu continuer pendant l'attente. Après ajout de la clé, `git ls-remote` a confirmé l'accès au dépôt privé.

### Référentiel PIM absent

L'écran des catégories affichait `0 / 0` après le premier déploiement. Le script de livraison avait omis le seed PIM et l'image Docker n'incluait pas son fichier JSON. Une commande d'import avec montage du référentiel a été fournie pour corriger la base existante. Le commit suivant ajoute le JSON à l'image et synchronise les gammes après les migrations. Le résultat de l'import correctif sur le VPS reste à confirmer.

### Deux clés SSH aux usages différents

La clé `magritoff_github` permet au VPS de lire le dépôt. La clé `magritoff_ci` permet à GitHub Actions de joindre le VPS. La seconde clé doit être autorisée dans `authorized_keys` avec une commande forcée limitée à `deploy` suivi du SHA Git complet.

Une commande `pbcopy` a été exécutée sur le VPS alors qu'elle était destinée au Mac. La clé privée de la CI reste sur le poste où elle a été générée et est copiée directement dans le secret GitHub, jamais dans le chat.

Le test SSH de la CI a ensuite demandé un mot de passe. La configuration SSH du Mac proposait plusieurs clés ; un essai avec `-F /dev/null`, `IdentitiesOnly=yes` et `BatchMode=yes` a été proposé pour isoler la clé voulue. Sur le VPS, aucune ligne n'a été retrouvée avec le commentaire `github-actions-magritoff`. Il reste à confirmer la correspondance de la clé et son autorisation après correction.

### Installation et exploitation

Les ports Apache existants ont imposé un raccordement par reverse proxy plutôt qu'un second proxy sur 80 et 443. Les vhosts ont été sauvegardés avant modification, et leur syntaxe testée avant rechargement.

Les migrations, les seeds et l'application ne doivent pas tous utiliser le compte propriétaire. Des comptes runtime distincts ont été créés et leurs changements de rôle testés. Les secrets ont été générés directement sur le VPS dans `.env.preprod.local`, avec permissions restrictives et exclusion de Git.

## État de la livraison et travail restant

La branche dédiée est `codex/preprod-compose`. Le commit `80795b95` prépare la stack et les scripts ; `8a35cfa6` ajoute le workflow CI/CD, la restriction SSH, le verrou de livraison et le seed PIM.

Les images du premier déploiement ont été construites sur le VPS. L'API locale a répondu `status: ok`, le front local HTTP 200, PostgreSQL et S3 étaient sains, et les quatre workers étaient démarrés. Un processus worker démarré ne prouve pas encore le succès de tous ses traitements.

Le [premier workflow CI](https://github.com/amazon-svg/Magritoff/actions/runs/38262390738) a réussi le typage, les tests, le build et la validation shell. Son job de déploiement a été ignoré, conformément au réglage initial. Les secrets `PREPROD_SSH_PRIVATE_KEY` et `PREPROD_SSH_KNOWN_HOSTS` ont été ajoutés ; leur présence ne valide pas à elle seule la connexion.

Avant de considérer la préprod et sa livraison automatique comme opérationnelles :

1. Terminer le test de la clé CI et de sa commande forcée sur le VPS.
2. Valider le parcours inscription, email Mailpit, session et création d'un espace.
3. Confirmer la présence des 81 catégories, puis leur activation pour le tenant.
4. Tester upload, téléchargement signé et export depuis le domaine public.
5. Vérifier les sites PHP existants et les logs des workers.
6. Mettre en place des sauvegardes PostgreSQL, objets S3 et secrets hors du VPS, chez le même fournisseur, puis tester une restauration.
7. Effectuer une première livraison CI contrôlée avant d'activer `PREPROD_AUTO_DEPLOY=true`.

Les migrations doivent rester compatibles avec les images précédentes : revenir à une image ne restaure pas la base. Le lancement manuel GitHub Actions exige aussi que le workflow soit disponible sur la branche par défaut ; tant qu'il reste uniquement sur la branche de préprod, les pushes sur cette branche sont le déclencheur prévu.

## Points à conserver pour les futurs choix

Une comparaison d'hébergement doit vérifier ensemble le stock dans la région voulue, le prix récurrent complet, la possibilité de gérer les rôles PostgreSQL et la prise en charge réelle d'une stack Compose. Un catalogue de conteneurs ne garantit ni l'orchestration de Compose ni l'hébergement persistant d'une base.

La solution retenue réduit le coût de souscription, mais conserve une charge d'exploitation : mises à jour du système et des conteneurs, sauvegardes, suivi du disque, certificats et diagnostic des traitements. Un hébergement managé peut déléguer une partie de cette charge, à condition que ses permissions et son périmètre de service correspondent à l'application.

La procédure technique est conservée sur la branche de préprod dans `infra/preprod/README.md`, avec le Compose et les scripts associés.
