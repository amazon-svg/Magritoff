# Changement de domaine et envoi avec Mailtrap

Le site passe de `magritt.clariprint.fr` a `preprod.magritapp.com`. L'adresse
S3 reste `fichiers-magritt.clariprint.fr` ; aucun objet ni volume n'est deplace.
Les emails sont envoyes par Mailtrap Email Sending, depuis
`Magrit <noreply@magritapp.com>`, sur le domaine valide par le proprietaire.

## DNS et certificat

Creer l'entree A `preprod.magritapp.com` vers `151.80.58.131`. N'ajouter une
entree AAAA que si elle dessert effectivement ce VPS. Verifier depuis le VPS :

```bash
getent ahostsv4 preprod.magritapp.com
getent ahostsv6 preprod.magritapp.com
```

Conserver les anciens vhosts pendant la preparation. Sauvegarder `/etc/apache2`
et `.env.preprod.local` dans un repertoire root protege avant la bascule.
Ajouter un vhost HTTP dedie `preprod.magritapp.com` avec
`DocumentRoot /var/www/magritoff-acme`, comme lors de l'installation initiale.
Activer le site, verifier `apache2ctl configtest`, puis recharger Apache.

Le fichier `/.well-known/acme-challenge/test` doit etre servi sur ce nouveau
domaine. Ensuite seulement :

```bash
sudo certbot certonly --webroot -w /var/www/magritoff-acme \
  --cert-name preprod.magritapp.com -d preprod.magritapp.com
```

Conserver ce vhost HTTP pour les renouvellements et le hook de rechargement
Apache deja installe.

## Configuration SMTP et URL applicative

Mettre a jour le checkout de la branche de preprod, sans remplacer ni regenerer
le fichier `.env.preprod.local`. Modifier ce fichier sur le VPS avec un editeur :

```dotenv
APP_BASE_URL=https://preprod.magritapp.com
MAGRIT_FROM_EMAIL=Magrit <noreply@magritapp.com>
MAIL_HOST=live.smtp.mailtrap.io
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=api
MAIL_PASSWORD=VALEUR_DU_TABLEAU_DE_BORD_MAILTRAP
```

Remplacer la derniere valeur avec les identifiants du flux Transactional, dans
Mailtrap Sending Domains, Integrations, SMTP. Adapter host et utilisateur si le
tableau de bord fournit d'autres valeurs. Utiliser Email Sending, pas Email
Sandbox. Le port 587 utilise STARTTLS ; `MAIL_SECURE=false` ne desactive pas
STARTTLS dans Nodemailer. Le compte SMTP doit avoir le droit d'envoyer depuis
`magritapp.com`, et le VPS doit pouvoir joindre le serveur sur le port choisi.

Ne pas afficher ce fichier, mettre le mot de passe dans une commande shell,
utiliser `source`, ni executer `docker compose config` sans `--quiet`.
Si le mot de passe comporte `$`, l'entourer de quotes simples dans le fichier
dotenv pour conserver sa valeur litterale. Conserver `chmod 600` sur le fichier.
Les secrets PostgreSQL, S3 et d'authentification existants restent identiques.

Le Compose transmet ces cinq variables SMTP a l'API et aux workers. Sans
configuration SMTP explicite, son comportement reste la capture dans Mailpit.
La modification du fichier env seule ne modifie pas les conteneurs deja demarres.

## Bascule Apache et conteneurs

Apres obtention du certificat, adapter le vhost proxy a partir de
`infra/preprod/apache.conf.example` : nouveau ServerName et certificat pour
l'application, et origine CORS `https://preprod.magritapp.com` pour le vhost S3.
Verifier les ports locaux et toute personnalisation avant de remplacer un
fichier de configuration existant. Tester la syntaxe avant rechargement Apache.

Creer un vhost HTTPS explicite pour l'ancien domaine avec son certificat encore
valide et une redirection vers `https://preprod.magritapp.com/`. Cela evite que
les requetes vers l'ancien domaine tombent sur le site Apache par defaut. Ne pas
redirectionner le domaine des fichiers. Les sessions du navigateur ne sont pas
transferees entre domaines : les utilisateurs devront se reconnecter. Generer
de nouveaux emails de verification et de recuperation apres la bascule.

Pour appliquer les variables avec les images deja installees, sans reconstruire
ni changer de version applicative :

```bash
cd /opt/magritoff-preprod
preprod_release="$(sudo docker inspect magritoff-preprod-api-1 \
  --format '{{.Config.Image}}' | sed 's/.*://')"
test -n "$preprod_release" || exit 1
sudo env MAGRIT_RELEASE="$preprod_release" docker compose \
  --env-file .env.preprod.local -f compose.preprod.yml config --quiet
sudo env MAGRIT_RELEASE="$preprod_release" docker compose \
  --env-file .env.preprod.local -f compose.preprod.yml \
  up -d --no-build --wait api notifications outbox exports purge
```

La preparation et le rechargement Apache doivent etre coordonnes avec cette
recreation : pendant la transition, les anciens liens et nouvelles origines
peuvent ne pas correspondre. Ne pas lancer une livraison CI en parallele.
Mailpit peut rester demarre pour conserver les messages historiques, mais les
nouveaux emails partent vers leurs vrais destinataires via Mailtrap.

## Validation et retour arriere

Verifier HTTPS sans ignorer les certificats, `/api/v1/health`, la connexion, les
uploads et telechargements signes. Tester une verification de compte ou une
recuperation de mot de passe avec une boite de test controlee ; confirmer la
reception, l'expediteur et l'URL en `preprod.magritapp.com`, ainsi que le statut
dans Mailtrap Email Logs. Verifier ensuite les notifications produites par les
workers : un simple etat de conteneur sain ne prouve pas l'envoi SMTP.

Le controle HTTPS de la CI utilise desormais `preprod.magritapp.com` par defaut.
La variable GitHub `PREPROD_APP_URL`, si definie, doit avoir la meme valeur.
La publication de cette configuration ne modifie ni DNS, ni Apache, ni le fichier
env du VPS et n'active pas le deploiement automatique.

En cas de probleme, restaurer les valeurs env et vhosts sauvegardes, puis
recreer les conteneurs avec le meme tag. Les volumes de la base et du stockage
sont conserves. Aucun changement de schema n'est necessaire a cette bascule.

Reference : [integration SMTP Mailtrap](https://docs.mailtrap.io/email-api-smtp/setup/smtp-integration).
