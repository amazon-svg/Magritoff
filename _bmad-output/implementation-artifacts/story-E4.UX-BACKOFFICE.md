# E4.UX-BACKOFFICE — preuve d’implémentation

Source : [story canonique](../../project/backlog/stories/E4.UX-BACKOFFICE.md).
Référence : [guidelines UX](../../docs/UX_GUIDELINES.md).
Branche locale : `codex/ux-backoffice-boutiques`, dans le dossier habituel.
Spécification en brouillon ; aucune approbation humaine ou fusion revendiquée.

## Changements

La liste indique l’état et le mode d’accès de chaque boutique, avec des actions
nommées. Les modales partagées gèrent création et suppression, retour du focus,
erreur persistante et nouvelle tentative sans perdre la saisie. Une panne de
chargement est distincte d’une liste vide.

L’éditeur répartit les réglages en Catalogue, Accès et clients, Informations et
Apparence, avec sélection dans l’URL et navigation clavier. Les formulaires restent
montés entre les onglets. L’enregistrement affiche un état durable ; quitter avec
une saisie non enregistrée demande une confirmation, recharger protège aussi la
saisie. Les champs ont des labels associés et les prix négociés des identifiants
uniques. Les coûts des articles fixes sont explicitement distingués.

Le back-office dispose d’un menu mobile partagé accessible, sans colonne latérale
qui écrase le contenu. Palette et lignes produits s’adaptent aux petites largeurs ;
le fil d’Ariane de la fiche boutique utilise un libellé humain.

Modules : UI shops et disposition DashboardLayout ; composants partagés Dialog,
AlertDialog, Tabs, Sheet et Button. Aucun nouveau contrat HTTP, aucune modification
serveur, permission, tarif ou migration. Aucune dérogation R5.

## Vérification du 9 octobre 2026

- Quatre tests Chromium réussis : création, erreur et reprise, enregistrement,
  conservation de saisie entre onglets, confirmation de sortie, confirmation de
  suppression et maintien de son erreur, navigation clavier et retour de focus.
- Largeurs 375, 768 et 1280 px : absence de débordement horizontal et contrôles
  axe WCAG 2 A/AA et 2.1 AA sur les quatre panneaux et la liste des produits.
  Captures relues dans `test-results/`.
- Régression générale : 320 fichiers et 3 143 tests réussis, 175 tests ignorés.
- Typage modulaire et build de production réussis.

Les tests navigateur simulent session, lectures et écritures métier. Ils valident
les interactions UX, sans constituer une nouvelle recette de persistance réelle.
Aucun serveur supplémentaire lancé ; le serveur de développement de Xavier est
réutilisé. Suite ajoutée au workflow d’accessibilité ; exécution CI non revendiquée.
Reproduction : [recette UX](../../docs/testing/backoffice-shops-ux.md).

## Limites

La pagination serveur des collections boutiques/produits reste une dette existante.
Les parcours non ciblés (import de visuels, clients, retrait de produit de bibliothèque)
restent soumis à leur recette métier propre. Les scans automatisés et cette revue
visuelle ne constituent pas un audit exhaustif de conformité accessibilité.
Aucun push, déploiement ou fusion réalisé ; revue indépendante à effectuer.
