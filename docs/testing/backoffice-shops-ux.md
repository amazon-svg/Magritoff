# Recette UX du back-office boutiques

Dans `/Users/xpech/dev/Magritoff`, sur la branche `codex/ux-backoffice-boutiques`.
Utiliser le serveur habituel lancé avec `pnpm dev` ; le garder sous votre contrôle.
Actualiser `http://localhost:5176`, puis ouvrir Boutiques dans le menu.

## Vérification manuelle

1. Vérifier les états et accès des boutiques. Ouvrir « Créer une boutique », saisir
   un nom, fermer puis rouvrir : la saisie est conservée.
2. Ouvrir une fiche : Catalogue, Accès et clients, Informations et Apparence.
3. Modifier le nom dans Informations, changer d’onglet puis revenir : le nom reste.
4. Cliquer « Toutes les boutiques » : choisir de rester conserve les changements.
5. Enregistrer : le succès reste affiché et le bouton devient inactif jusqu’à une
   nouvelle modification. Recharger la fiche pour vérifier la persistance réelle.
6. Sur mobile, ouvrir et fermer le menu. Au clavier, parcourir les onglets avec
   les flèches et vérifier le retour du focus après fermeture des modales.

La création et l’enregistrement manuels modifient vos données locales. La suppression
est irréversible : vérifier la confirmation puis annuler pour cette recette.

## Recette automatisée sans écriture métier réelle

Serveur existant sur 5176 :

```sh
E2E_BASE_URL=http://localhost:5176 pnpm exec playwright test tests/e2e/backoffice-shops-ux.spec.ts
```

Quatre tests avec session et API simulées, trois largeurs (375, 768 et 1280 px),
erreurs/reprises, confirmations, clavier, absence de débordement et scans axe.
Aucune boutique réelle ni session réelle créée. Les captures se trouvent dans
`test-results/`. Cette recette UX ne remplace pas les tests API/persistance métier.
