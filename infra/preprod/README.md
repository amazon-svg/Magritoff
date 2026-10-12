# Preprod sur le VPS Apache existant

Destination : `https://magritt.clariprint.fr`. Le stockage utilise le sous-domaine
propose `fichiers-magritt.clariprint.fr`, a creer ou remplacer avant de deployer.
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
Les volumes existants sont conserves. Ne jamais utiliser `down -v`.

Verifier `/api/v1/health`, puis le parcours inscription / verification de l'email /
session, les fichiers et un export. Aucune donnee de developpement n'est importee
automatiquement. Le statut sain de l'API ne garantit pas que les integrations
externes et les workers ont execute tous les parcours fonctionnels.

Les emails sont captures dans Mailpit : un tunnel SSH vers `127.0.0.1:18025`
permet de consulter les liens d'activation. La preprod n'envoie pas d'emails reels.
Clariprint, HopeStudio et les autres integrations restent a configurer separement
avec leurs variables exactes ; ne pas recopier les secrets de developpement.

## 5. CI/CD et sauvegardes

La CI devra tester le commit avant livraison, puis se connecter au VPS avec une
cle dediee et un `known_hosts` verifie pour demander le checkout du commit et
l'execution de `deploy.sh`. Ne pas activer le deploiement automatique tant que
la premiere livraison manuelle et les sauvegardes n'ont pas ete validees. Le
workflow sera raccorde une fois le chemin du checkout et l'acces SSH connus.

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
