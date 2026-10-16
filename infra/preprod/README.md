# Preprod sur le VPS Apache existant

Destination : `https://preprod.magritapp.com`. Le stockage conserve son sous-domaine
`fichiers-magritt.clariprint.fr` ; la migration du domaine applicatif ne change
pas les adresses des objets. Pour une installation existante, suivre
[la procedure de changement de domaine et SMTP](domain-mailtrap-migration.md).
Les deux noms doivent pointer vers ce VPS (A, et AAAA uniquement si IPv6 fonctionne).

## 1. Audit avant installation

Executer `bash scripts/preprod/audit-vps.sh` sur le VPS. Le diagnostic ne modifie
aucun service. Verifier les ports 18080, 18787, 18333, 18025 et l'absence de conflit
avec le reseau Docker propose `172.29.80.0/24`. Adapter `.env.preprod.local` si besoin.
Conserver une copie des vhosts Apache et une sauvegarde des services PHP existants.

Installer Docker Engine et le plugin Compose depuis le depot officiel pour
Ubuntu 24.04 : <https://docs.docker.com/engine/install/ubuntu/>. Ne pas remplacer
Apache et ne pas modifier son vhost par defaut. Docker peut modifier les regles
de pare-feu ; les seuls ports publies par notre Compose sont lies a 127.0.0.1.

## 2. Checkout et secrets

Le depot GitHub est prive : utiliser sur le VPS une cle de deploiement GitHub
en lecture seule pour le cloner. Cette cle est distincte de celle utilisee par
la CI pour se connecter au VPS. Ne jamais partager les cles privees dans le chat.

Copier `infra/preprod/env.example` vers `.env.preprod.local`, puis `chmod 600`.
Remplir chaque secret vide avec une valeur distincte de `openssl rand -hex 32`.
Les mots de passe PostgreSQL doivent ici etre hexadecimaux pour rester valides
dans une URL sans encodage supplementaire. Ne jamais lancer `compose config`
sans `--quiet` sur une configuration contenant des secrets.

Le compte `magrit_owner` cree par l'image PostgreSQL est un superutilisateur,
reserve aux migrations et a l'administration de cette base dediee. Son secret
n'est pas transmis a l'API ni aux workers. Les connexions runtime n'ont ni
SUPERUSER ni BYPASSRLS. L'API peut adopter `magrit_api` et herite des privileges
`magrit_auth` pour Better Auth ; les workers peuvent adopter `magrit_worker`.
Les migrations versionnees existantes ne sont pas modifiees.

## 3. Apache et HTTPS

Preparer deux vhosts et les certificats selon la methode deja utilisee sur ce
VPS. `apache.conf.example` est un exemple HTTPS, pas un fichier a activer avant
que les certificats existent. Les ports de l'exemple doivent correspondre au
Compose. Tester `sudo apache2ctl configtest` avant tout rechargement Apache.
Verifier les autres sites apres le rechargement.

Le stockage requiert son URL publique comme `S3_ENDPOINT` : une adresse interne
Docker produirait des URL signees inaccessibles au navigateur. Le proxy preserve
le Host et le chemin pour les signatures. Valider un upload et un telechargement
depuis le navigateur, ainsi que CORS et les politiques des buckets. Seuls trois
buckets de visuels sont ouverts en lecture par le script d'initialisation ; les
documents sont prives et accessibles par URL signee. Le sous-domaine S3 n'a pas
d'authentification Apache supplementaire.

## 4. Premiere livraison

Depuis le checkout sur le VPS : `bash scripts/preprod/deploy.sh` (avec un compte
autorise a utiliser Docker). Le script construit les images, demarre les services
de stockage, applique les migrations, prepare les comptes runtime et les buckets,
puis demarre l'API, le front et les quatre workers. Il ne configure pas Apache.
Le referentiel des 81 gammes PIM est synchronise apres les migrations, avant
le remplacement des conteneurs. Il n'importe pas les donnees de demonstration
et n'active aucune categorie pour un tenant.
Les volumes existants sont conserves. Ne jamais utiliser `down -v`.

Verifier `/api/v1/health`, puis le parcours inscription / verification de l'email /
session, les fichiers et un export. Aucune donnee de developpement n'est importee
automatiquement. Le statut sain de l'API ne garantit pas que les integrations
externes et les workers ont execute tous les parcours fonctionnels.

Par defaut, les emails sont captures dans Mailpit : un tunnel SSH vers
`127.0.0.1:18025` permet de consulter les liens d'activation. Pour l'envoi reel
avec Mailtrap Email Sending, reporter les valeurs de `env.mailtrap.example`
dans `.env.preprod.local`, avec le mot de passe SMTP fourni par Mailtrap.
Le domaine d'expedition doit etre valide. Apres recreation des conteneurs,
les nouveaux messages sont envoyes aux destinataires ; Mailpit reste disponible
mais ne recoit plus les messages tant que cette configuration SMTP est active.
Clariprint, HopeStudio et les autres integrations restent a configurer separement
avec leurs variables exactes ; ne pas recopier les secrets de developpement.

## 5. CI/CD et sauvegardes

Le workflow `.github/workflows/preprod.yml` teste les commits pousses sur
`codex/preprod-compose` (typage, Vitest et build). Le deploiement sur le VPS
reste desactive tant que la variable de depot `PREPROD_AUTO_DEPLOY` ne vaut
pas exactement `true`. Les migrations ne sont pas interrompues par un nouveau
push : les executions sont serialisees et le script pose un verrou sur le VPS.
La CI livre uniquement le SHA teste, qui doit encore etre la tete de la branche.

### Preparation SSH de la CI

La cle de la CI est differente de `~/.ssh/magritoff_github`, utilisee par le VPS
pour lire GitHub. Generer une nouvelle cle Ed25519 sans phrase de passe sur le
poste d'administration (ne pas reutiliser une cle personnelle). Transmettre
uniquement la partie publique au VPS.

Mettre a jour le checkout sur le VPS vers la branche publiee, en conservant
`.env.preprod.local`. Dans `~ubuntu/.ssh/authorized_keys`, ajouter la cle publique
de la CI sur une seule ligne, precedee de :

```text
restrict,command="/usr/bin/bash /opt/magritoff-preprod/scripts/preprod/ssh-entrypoint.sh" ssh-ed25519 CLE_PUBLIQUE commentaire
```

Cette cle accepte uniquement `deploy SHA_COMPLET`. L'entree SSH rejette les
commandes shell, tunnels et sessions interactives. Le compte ubuntu doit deja
avoir un sudo sans mot de passe permettant de lancer le script (`sudo -n true`
est un premier controle). L'acces Docker permet d'administrer le serveur ; le
depot et les personnes qui peuvent modifier sa branche restent de confiance.

Lire la cle publique d'hote directement depuis la session SSH existante :
`sudo cat /etc/ssh/ssh_host_ed25519_key.pub`. Construire la ligne known_hosts
`151.80.58.131 ssh-ed25519 CLE_PUBLIQUE_HOTE`. Ne pas utiliser un ssh-keyscan
non verifie comme preuve de l'identite du VPS.

Dans les secrets Actions du depot, enregistrer :

- `PREPROD_SSH_PRIVATE_KEY` : cle privee dediee de la CI ;
- `PREPROD_SSH_KNOWN_HOSTS` : ligne known_hosts verifiee ci-dessus.

Les secrets applicatifs et les mots de passe PostgreSQL restent sur le VPS.
La variable optionnelle `PREPROD_HOST` permet de remplacer `151.80.58.131`.
`PREPROD_APP_URL` permet de remplacer l'URL utilisee par le controle HTTPS final.
Le workflow utilise les secrets du depot, sans dependance aux fonctions
d'environnements proteges qui varient selon l'abonnement GitHub d'un depot prive.

### Activation

Verifier d'abord la sauvegarde/restauration et une livraison manuelle. Configurer
les deux secrets puis mettre `PREPROD_AUTO_DEPLOY=true` pour deployer les prochains
pushes de la branche de preprod. Remettre cette variable a `false` pour suspendre
les livraisons automatiques ; les tests continuent a fonctionner.

Le lancement manuel avec `workflow_dispatch` et l'option `deploy` est aussi
prevu, mais le bouton GitHub `Run workflow` exige que ce fichier existe sur la
branche par defaut. Tant que le workflow reste uniquement sur la branche de
preprod, utiliser les pushes sur cette branche comme declencheur. Modifier les
variables seul ne declenche pas une livraison.

Sauvegarder PostgreSQL par `pg_dump`, les objets S3 et le fichier de secrets vers
un stockage hors de ce VPS chez le meme hebergeur. Verifier une restauration.
Un snapshot seul de fichiers PostgreSQL en cours d'utilisation ne remplace pas
une sauvegarde coherente. Les changements de mot de passe dans le fichier env
ne changent pas automatiquement le mot de passe owner d'un volume deja initialise.

Chaque livraison utilise le SHA court Git comme tag. Conserver les images de la
livraison precedente ; pour revenir aux images, definir `MAGRIT_RELEASE` au tag
precedent et lancer `docker compose --env-file .env.preprod.local -f compose.preprod.yml up -d --no-build api web notifications outbox exports purge`.
Ce retour ne restaure pas la base : migrations compatibles obligatoires. Si une
migration echoue, le script s'arrete avant de remplacer les conteneurs applicatifs.
