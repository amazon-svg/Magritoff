# Recette — annexes des commandes boutique

Dans le dossier habituel, sur les serveurs déjà lancés, actualiser :
http://localhost:5176/t/atelier-lumiere/dashboard/orders/81419e86-4e1a-4316-aafa-2c28beb627cc

Cette commande ne contient aucune annexe. Vérifier :

- Fichiers : « Aucun fichier déposé sur cette commande. »
- Bon de commande : « Aucun bon de commande produit pour cette commande. »
  La génération PDF boutique est indiquée comme indisponible.
- Liens de dépôt : « Aucun lien de dépôt actif pour cette commande. »
- Aucune erreur rouge de chargement ou « Commande introuvable ».

Les vrais problèmes réseau ou droits restent affichés comme erreurs.
La génération PDF des commandes issues de devis et le téléchargement d’un
PDF déjà présent restent disponibles selon les droits existants.

## Vérifications reproductibles

```sh
node scripts/test-order-annexes.mjs
E2E_BASE_URL=http://localhost:5176 pnpm exec playwright test tests/e2e/order-annexes-empty.spec.ts
pnpm test
pnpm typecheck:modular
pnpm build
```

Le script PostgreSQL exige une base locale, crée une base temporaire dédiée,
y applique les migrations et la supprime après les tests. Le navigateur utilise
les serveurs existants et simule les réponses métier sans modifier de commande.
