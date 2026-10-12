# Recette navigateur du parcours boutique

La suite `tests/e2e/storefront-purchase-flow.spec.ts` couvre la recherche,
la configuration, le panier, l'identification et la confirmation d'une
commande. Elle s'exécute sans base de données ni fournisseur : toutes les
API consommées sont interceptées par Playwright, et les requêtes API
inattendues font échouer la recette d'achat.

## Exécution locale

Dans un premier terminal :

```bash
pnpm dev:web
```

Dans un second terminal :

```bash
E2E_BASE_URL=http://localhost:5176 pnpm exec playwright test tests/e2e/storefront-purchase-flow.spec.ts
```

Chromium doit être installé avec `pnpm exec playwright install chromium`.
Si l'interface est déjà lancée sur un autre port, adapter `E2E_BASE_URL`.

## Ce qui est vérifié

- La recherche du header ouvre la fiche du produit au clavier.
- La configuration affiche le chiffrage simulé de 125 € HT puis ajoute au panier.
- Un acheteur anonyme peut rejoindre l'identification ; « Commander » reste
  désactivé avant sa connexion propre à la boutique.
- La commande transmet un pack de 500 exemplaires et le prix décimal
  `125.00`, avec une clé d'idempotence, puis affiche la confirmation.
- Le champ du catalogue possède un nom accessible ; les recherches mobile et
  desktop utilisent des identifiants de menu distincts, chacun relié au
  bon champ par `aria-controls` (largeurs 390 et 1280 pixels).
- L'absence du service éditorial IA conserve le parcours déterministe.

La capture de confirmation est enregistrée dans `test-results/`. Le workflow
`.github/workflows/a11y.yml` inclut cette suite et archive les preuves navigateur.

## Portée des preuves

La session, le prix et la persistance de commande sont simulés. Cette recette
ne prouve ni un chiffrage réel Clariprint/HopeStudio, ni la création d'une
commande PostgreSQL, ni sa consultation dans le back-office. Ces vérifications
restent à réaliser séparément sur une fixture isolée. Aucun compte, email ou
commande réelle n'est créé par cette suite.
