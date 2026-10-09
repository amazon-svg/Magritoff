# Recette de gestion des clients boutique

Utiliser `/Users/xpech/dev/Magritoff` et le serveur habituel `pnpm dev` (5176).
Aucun workspace séparé ou serveur supplémentaire requis. Migration 0096 : deux
index de pagination, appliqués à la base locale de développement.

## Vérification manuelle

1. Ouvrir Boutiques → une boutique → Clients. La liste présente au plus 20 comptes ;
   naviguer avec Précédente/Suivante lorsqu’il existe plus de 20 comptes.
2. Cliquer sur un nom : la fiche affiche informations générales, CA HT et commandes.
3. Modifier le nom puis cliquer Retour : la confirmation protège la saisie.
   Rester, enregistrer, recharger et vérifier la persistance.
4. Vérifier le CA : commandes validées et étapes suivantes, hors brouillons et
   annulations, une ligne par devise. Ce total couvre toutes les commandes du
   compte dans cette boutique, pas uniquement la page d’historique visible.
5. Ouvrir une commande par son lien. Sur une fiche de test, désactiver puis
   réactiver l’accès. La désactivation révoque les sessions et conserve l’historique ;
   le client doit se reconnecter après réactivation. Si jamais activé, renvoyer
   l’invitation depuis la liste.

Les modifications manuelles agissent sur votre base locale. Utiliser un compte de
test pour la désactivation, qui déconnecte effectivement ses sessions.

## Vérification automatisée

```sh
# PostgreSQL local disponible : base temporaire créée puis supprimée
node scripts/test-shop-customer-management.mjs

# Vite habituel déjà lancé, session et API simulées : aucune donnée réelle modifiée
E2E_BASE_URL=http://localhost:5176 pnpm exec playwright test tests/e2e/backoffice-shops-ux.spec.ts tests/e2e/shop-customer-management.spec.ts
```

La recette PostgreSQL vérifie pagination avec dates égales, insertion entre pages,
CA exact par devise, isolation, permissions, suspension/réactivation et révocation
persistante des sessions. Chromium vérifie les interactions, les erreurs/reprises,
les confirmations, l’absence de débordement et axe à 375, 768 et 1280 px.
Captures dans `test-results/`.
