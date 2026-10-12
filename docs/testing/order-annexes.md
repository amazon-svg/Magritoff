# Recette — annexes des commandes boutique

Dans le dossier habituel, sur les serveurs déjà lancés, actualiser :
http://localhost:5176/t/atelier-lumiere/dashboard/orders/81419e86-4e1a-4316-aafa-2c28beb627cc

## États vides

Avant tout dépôt, cette commande ne contient aucune annexe. Vérifier :

- Fichiers : « Aucun fichier déposé sur cette commande. »
- Bon de commande : « Aucun bon de commande produit pour cette commande. »
  Le bouton « Produire le bon de commande » est disponible.
- Liens de dépôt : « Aucun lien de dépôt actif pour cette commande. »
- Aucune erreur rouge de chargement ou « Commande introuvable ».

## PDF et pièces jointes

1. Dans « Gabarits PDF », configurer un gabarit de type bon de commande : PDF
   importé, champs positionnés, actif et par défaut. Un gabarit devis ne suffit pas.
2. Sur la commande boutique, cliquer « Produire le bon de commande », puis
   « Télécharger ». Vérifier acheteur, lignes, montants et référence complète.
   Le bouton disparaît une fois le document produit ; le PDF reste conservé.
3. Sans gabarit admissible, vérifier le message ; après configuration, réessayer.
   Un PDF importé et actif ne suffit pas : ouvrir « Positionner les champs »,
   placer au moins un champ ou un tableau de lignes, puis « Enregistrer ».
4. Déposer un fichier via « Parcourir », puis le télécharger depuis sa ligne.
5. Créer un lien de dépôt et le copier. Dans un navigateur sans session, ouvrir
   ce lien et déposer un fichier. Revenir à la commande et actualiser les fichiers.
6. Révoquer le lien et vérifier qu’il ne fonctionne plus. L’expiration et le quota
   sont aussi contrôlés côté serveur et couverts par la recette isolée.

Les actions manuelles ci-dessus créent des pièces réelles sur la commande choisie.
La recette automatisée utilise uniquement ses fixtures temporaires.

Les vrais problèmes réseau ou droits restent affichés comme erreurs.
La génération PDF des deux origines et le téléchargement d’un
PDF déjà présent restent disponibles selon les droits existants.

## Vérifications reproductibles

```sh
node scripts/test-order-annexes.mjs
E2E_BASE_URL=http://localhost:5176 pnpm exec playwright test tests/e2e/order-annexes-empty.spec.ts tests/e2e/order-annexes-actions.spec.ts
pnpm test
pnpm typecheck:modular
pnpm build
```

Le script PostgreSQL exige une base locale, crée une base temporaire dédiée,
y applique les migrations et la supprime après les tests. Le navigateur utilise
les serveurs existants et simule les réponses métier sans modifier de commande.
