# Recette des produits à coût unitaire fixe

Le prix saisi dans la bibliothèque est un **coût unitaire HT**. Magrit applique
les règles de marge côté serveur ; le prix publié est le prix de vente HT.
Le marqueur explicite `config.pricing_mode: fixed_unit` réserve ce comportement
aux nouvelles fiches fixes, sans requalifier les anciens produits.

## Reproduction

Démarrer l'infrastructure locale (`pnpm infra:dev:up`), puis exécuter :

```sh
pnpm test:e2e:fixed-price
```

Le lanceur refuse un PostgreSQL distant, crée une base aléatoire locale,
applique les migrations et prépare uniquement des comptes de recette. Il
exécute les dix tests PostgreSQL puis lance sa propre API sur 8788 et Vite
sur 5180. Les ports sont configurables via `MAGRIT_RECIPE_API_PORT` et
`MAGRIT_RECIPE_WEB_PORT`. Il arrête ses processus et supprime sa base à la fin.
Les données de développement existantes restent indépendantes de cette recette.

La recette Chromium effectue les gestes utilisateur : connexion au back-office,
création d'une fiche à coût 100 € HT, association de sa bibliothèque à la boutique,
lecture du prix 125 € HT avec une marge de 25 %, ajout de trois unités,
identification boutique, confirmation à 375 € HT (450 € TTC), puis lecture
back-office du résultat persisté. Aucun mock API ni appel de chiffrage fournisseur.

Les tests PostgreSQL vérifient aussi l'idempotence, les coûts invalides, les prix
falsifiés/périmés, la priorité des marges de catégorie, les remises client avec
marge par défaut, les surcharges de prix final et les produits inactifs/exclus.
Les traces et captures se trouvent dans `test-results/` et `playwright-report/`.

## Mise à disposition

Déployer la migration `0095_fixed_unit_storefront_pricing.sql` avant le code
serveur qui l'utilise. La bibliothèque, les fiches produits et l'association à
la boutique utilisent les routes API existantes. Une surcharge boutique reste
un prix de vente final, sans seconde application de marge.

Le parcours configurable garde son fonctionnement actuel ; la connexion des
prix variables à HopeStudio annoncée pour cet après-midi n'est pas validée ici.
