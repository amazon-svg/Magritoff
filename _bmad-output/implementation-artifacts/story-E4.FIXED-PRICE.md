# E4.FIXED-PRICE — preuve d'implémentation

Source fonctionnelle : [story canonique](../../project/backlog/stories/E4.FIXED-PRICE.md).
Branche locale : `codex/produits-prix-fixe`, issue de `codex/recette-boutique`.
Spécification en brouillon ; validation humaine et fusion restent distinctes.

## Changements

Création manuelle dans le détail d'une bibliothèque, saisie du coût HT dans la modale accessible partagée avec
validation serveur, marqueur explicite `fixed_unit` et libellé de coût en édition.
Le catalogue et les commandes utilisent le même PricingEngine à partir du coût,
de la catégorie et du client boutique. Les règles client et les marges par défaut
sont résolues côté serveur ; une surcharge boutique reste un prix final.

La fiche et les cartes fixes ajoutent directement au panier, sans configuration.
La quantité désigne des unités dans le panier et le récapitulatif. Le serveur
contrôle le prix à la création, modification du brouillon et validation ; les
options envoyées par le navigateur ne peuvent pas détourner une fiche fixe.
Un ancien chiffrage fournisseur dans la configuration ne supplante pas le prix
fixe publié. Le tiroir panier dispose de colonnes adaptées à sa largeur.

Modules : libraries, catalog, shops, orders, clariprint (résolution d'affichage),
pricing via son interface publique ; adaptateurs PostgreSQL. Routes et schémas
HTTP existants réutilisés, sans nouvel endpoint ni nouveau champ de contrat.
Le mode utilise le champ config extensible existant. Aucune dérogation R5.

## Vérification du 9 octobre 2026

`node scripts/test-fixed-price-purchase.mjs` : dix tests PostgreSQL réussis,
puis un parcours Chromium complet réussi, avec API et persistance réelles.
Coût 100 €, marge 25 %, vente 125 € HT, trois unités = 375 € HT / 450 € TTC.
La création passe par le formulaire back-office ; la publication passe par
l'association de bibliothèque dans l'éditeur de boutique. Le résultat est relu
par l'API de commandes du back-office. Aucun appel de chiffrage fournisseur.

Les tests ciblés de résolution de prix, alignement de configuration et routes
bibliothèque passent (28 tests). La régression générale passe : 3 143 tests
réussis, 175 ignorés. Typage modulaire et build passent. La suite
PostgreSQL globale compte 168 tests réussis sur 169 au deuxième passage : son
unique échec concerne une lecture S3 après suppression d'export, indépendante du
parcours fixe ; au premier passage, la même attente échouait sur la purge de
fichiers. La suite globale n'est donc pas revendiquée entièrement verte.

Reproduction : [recette complète](../../docs/testing/fixed-price-purchase.md).
Les captures panier et confirmation sont générées dans `test-results/`.

## Opérations et limites

Migration `0095_fixed_unit_storefront_pricing.sql` requise avant démarrage du
nouveau serveur. Fonction SQL interne réservée à `magrit_api`, montants exacts
transmis au moteur de prix existant. Aucun déploiement ni push effectué.
La copie principale et sa base n'ont pas été modifiées par la recette.

L'intégration des prix variables HopeStudio reste hors périmètre de cette livraison.
La revue indépendante et l'approbation humaine restent à réaliser. Les trois tests Chromium
simulés du parcours configurable passent également comme contrôle de régression.
Les contrôles de pilotage et d’architecture passent (226 tests).
