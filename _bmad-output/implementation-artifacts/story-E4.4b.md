# E4.4b — Liste commune paginée des commandes

Story canonique : [E4.4b](../../project/backlog/stories/E4.4b.md).
Décision : [PD-2026-10-05-COMMANDES-UNIQUE](../../project/decisions/product/PD-2026-10-05-commandes-objet-unique.md).

## Lot du 6 octobre 2026

À la demande de Xavier : poursuivre la liste unique, les filtres et la pagination.
Le routeur réserve chaque chemin à une seule façade : `/orders` reste la
création historique, `/order-summaries` porte la nouvelle projection commune.
Contrat additif `GET /api/v1/order-summaries`, enveloppe commune et contexte tenant de la
façade commerciale. Une projection PostgreSQL des deux origines joint les noms
clients et boutiques. Pagination par date puis UUID ; filtres appliqués avant
la limite : origine, statut, client (identifiant ou recherche littérale), boutique,
étape de production et jours civils Europe/Paris.

Le dashboard utilise cette lecture et des pages de 50 commandes. Il conserve
les liens de fiche commande/client et les transitions existantes sur les fiches.
Les routes historiques, la lecture de détail et les exports restent en place.
Ce lot couvre AC-01 et la partie filtres d'AC-03 ; le détail commun (AC-02),
l'export de la sélection commune et la politique de retrait des routes restent
à livrer. Aucun changement de droits ou de montants engagés.

## Vérifications

Vérifications locales du 6 octobre 2026 :

- `pnpm test` : 317 fichiers, 3 190 tests réussis ; 149 tests désactivés
  (dont les intégrations PostgreSQL lancées séparément et les tests live).
- `pnpm test:postgres:integration` : 49 fichiers, 145 tests réussis dans une
  base locale temporaire supprimée à la fin. Cinq nouveaux tests couvrent
  les deux origines, les relations facultatives, les montants figés, les filtres,
  l'isolation tenant et les curseurs à microsecondes distinctes.
- `pnpm typecheck`, `pnpm build`, `pnpm gen:api:check`,
  `pnpm project:refresh`, `pnpm project:validate`, `pnpm specs:validate`
  et `git diff --check` réussis.

Les tests de contrat refusent les filtres, dates et curseurs invalides avant
lecture SQL et vérifient que la position SQL interne ne fuit pas dans le DTO.
Le test de transport vérifie une seule requête par page, sans chargement client
complémentaire. Le contrat reste réservé aux utilisateurs Magrit ; les clés de
service et les sessions boutique ne reçoivent pas cette nouvelle lecture.

Recette : ouvrir le back-office Commandes, parcourir Suivante/Précédente,
appliquer chacun des filtres puis Réinitialiser ; vérifier une commande boutique
et une commande issue de devis, leurs montants et les liens commande/client.
La recette navigateur automatisée a été réalisée le 6 octobre (voir ci-dessous).
La revue distincte et la validation humaine restent à effectuer. Ce document
reste une preuve de développement en brouillon, pas une validation utilisateur.
Les changements restent locaux, sans commit, push, fusion ni déploiement.


## Recette navigateur du 6 octobre 2026

Commande : `E2E_BASE_URL=http://localhost:5176 pnpm exec playwright test tests/e2e/unified-orders-list.spec.ts --reporter=list`.
Deux tests Chromium passent sur les données existantes d'Atelier Lumière, avec
le compte de développement. Aucune commande ni donnée métier n'est créée ou
modifiée par ces tests ; ils établissent une session de consultation.

La recette couvre deux pages de 50 commandes sans doublon, retour à la première
page, filtres origine, client, statut, boutique, étape et jour civil, liste vide,
réinitialisation et désactivation de Suivante après la dernière page. Elle ouvre
et recharge une fiche boutique et une fiche issue de devis sous leurs adresses
canoniques, puis ouvre le client CRM depuis la liste. Aucun incident JavaScript
n'est relevé dans le parcours liste.

La vérification visuelle a révélé un chevauchement du numéro commercial et du
statut long avec les colonnes voisines. Les colonnes référence et statut ont été
élargies ; le tableau garde son défilement horizontal. Les tests navigateur
vérifient désormais que ces textes ne dépassent pas dans la colonne suivante.
Le portail conserve ses largeurs et sa présentation.

Après ce correctif : typage réussi, 13 tests d'architecture ciblés réussis et
build réussi. La capture de la grille a été inspectée visuellement.
La recette automatisée ne vaut pas approbation humaine de la story entière ;
le détail API commun, l'export commun et la revue distincte restent à poursuivre.


## Validation d'affichage et lot de détail commun du 6 octobre 2026

Xavier valide dans ce chat les corrections visuelles de la grille : les boutons
Appliquer et Réinitialiser restent groupés, les champs sont alignés, la page
utilise toute la largeur disponible et les pastilles de statut passent à la ligne
sans chevaucher les actions. Vérification à six largeurs dans Chromium ; le
lancement automatisé de Firefox a échoué dans cet environnement. Cette validation
humaine est limitée aux ajustements d'affichage.

À sa demande de continuer, AC-02 est développé avec la lecture additive
`GET /api/v1/order-summaries/{orderId}`. Une seule requête de détail identifie
l'origine, rend les références facultatives, dates, état, devise et montants
communs, puis le détail complet adapté à cette origine. Les projections
historiques et la nouvelle projection partagent les mêmes lecteurs PostgreSQL.
Les lignes boutique gardent configuration et provenance des prix ; les lignes
devis gardent copie tarifaire, remises, marges et ventilation. Une commande
absente du tenant renvoie un 404 unique `order.not_found`.

La fiche canonique utilise ce détail préchargé et ses rafraîchissements utilisent
également la lecture commune. Les ressources annexes (client, devis, documents,
fichiers, journal des étapes) et les écritures restent sur leurs contrats
existants. L'API commune reste réservée aux utilisateurs Magrit. La vérification
de contrat a aussi corrigé l'échappement excessif du point décimal dans les
schémas de montants des routes historiques boutique.

Vérifications de ce lot :

- Suite générale : 317 fichiers, 3 197 tests réussis, 151 désactivés, avec les
  permissions de ports locaux nécessaires aux tests HTTP.
- PostgreSQL isolé : 49 fichiers, 147 tests réussis ; la base temporaire est
  supprimée. Le détail des deux origines, les relations absentes, la conservation
  exacte du détail devis après conversion et l'isolation tenant sont vérifiés.
- Deux tests Chromium réussis sur Atelier Lumière : navigation, rechargement,
  filtres et client CRM. Les requêtes de détail passent uniquement par
  `/order-summaries/{orderId}`, sans sondage `/orders/{orderId}` ni
  `/commercial-orders/{orderId}`. Aucune donnée métier de recette n'est modifiée.

Typage, build, types API générés, gouvernance et spécifications valides ;
`git diff --check` réussi. Après branchement des rafraîchissements, 37 tests
ciblés de contrat, transport et architecture réussissent.

AC-02 reste en attente de recette humaine et de revue distincte. Ce lot ne
termine pas E4.4b : l'export commun et la fenêtre de compatibilité restent ouverts.
Les changements sont locaux, sans commit, push ni déploiement.

## Lot d'export commun du 6 octobre 2026

À la demande de poursuivre, AC-03 est développé avec `GET/POST
/api/v1/order-exports` et `GET /api/v1/order-exports/{exportId}`. L'interface
réutilise le panneau d'export existant depuis la grille commune. La demande
enregistre les filtres appliqués, indépendamment des saisies non appliquées et
de la page courante ; le worker parcourt toute la sélection côté serveur.

La migration additive `0087_unified_order_exports.sql` est appliquée à la base
locale. Les nouvelles demandes utilisent `layout_version: 2` et ajoutent les
colonnes Origine et Boutique. CSV/XLSX et granularités commande/ligne couvrent
les deux origines. Les anciens endpoints et demandes gardent la version 1,
leur périmètre devis et leur catalogue de colonnes. Les références absentes
restent vides ; les valeurs décimales sont conservées et les montants devis
proviennent de leur copie tarifaire. Les totaux boutique suivent la projection
de la grille. Les cellules Excel sont numériques pour les montants.

La nouvelle lecture conserve les contrôles `can_export_orders`, l'isolation
tenant, l'idempotence, le plafond de trois demandes actives par utilisateur,
la limite existante de 2 500 lignes et les téléchargements signés réservés au
demandeur. Les clés de service restent refusées. Les filtres client, boutique,
origine, état, étape et jours civils sont appliqués avant la pagination du
worker ; les recherches `%` restent littérales. La grille utilise désormais
le minuit suivant exclusif pour inclure les dernières microsecondes du jour,
comme l'export.

Vérifications :

- Suite générale avant le dernier ajustement de borne temporelle : 318 fichiers,
  3 211 tests réussis, 154 désactivés. Les contrats et rendus ont ensuite été
  rejoués : neuf fichiers, 116 tests réussis.
- PostgreSQL isolé après ce correctif : 49 fichiers, 151 tests réussis ; base
  temporaire supprimée. Comparaison des identifiants et montants exportés avec
  la grille pour onze sélections, lignes des deux origines, compatibilité
  historique et dernière microseconde du jour. Les quatre combinaisons
  CSV/XLSX et commande/ligne sont générées avec le worker et le stockage réels ;
  le contenu des CSV et du XML des classeurs est vérifié.
- Trois tests Chromium réussis sur Atelier Lumière : liste, deux fiches et
  téléchargement réel du CSV. Le troisième vérifie les filtres enregistrés,
  l'exclusion d'une recherche non appliquée, la version 2 et le contenu du
  fichier téléchargé. Les commandes de recette ne sont pas modifiées ; des
  demandes d'export et leurs fichiers sont créés.
- Typage, build et types API générés vérifiés. Le script de lancement local
  est vérifié par `bash -n` et lance désormais le worker d'export avec la même
  configuration S3 que l'API.

`pnpm project:refresh`, `pnpm project:validate`, `pnpm specs:validate` et
`git diff --check` réussissent également.

La recette a d'abord révélé une configuration S3 absente sur les processus
locaux ; l'API et le worker ont été relancés avec le stockage de développement.
Les demandes échouées restent visibles dans le registre, sans suppression
de l'historique. Les nouveaux téléchargements fonctionnent.

L'export et le détail communs attendent leur recette humaine et une revue
distincte. La fenêtre de retrait des anciennes routes reste ouverte ; la story
reste en cours. Les changements sont locaux, sans commit, push ni déploiement.

## Palier de compatibilité des anciennes routes

La poursuite d'E4.4b formalise le premier palier d'AC-05. Les anciennes pages
de liste et de fiche rendent déjà la surface canonique. Les opérations
historiques de liste, détail et export portent désormais `deprecated: true`
dans OpenAPI. Leurs réponses réussies publient la date de dépréciation du
6 octobre 2026 dans l'en-tête `Deprecation` au format RFC 9745, ainsi qu'un
lien `successor-version` vers `order-summaries` ou `order-exports`.

Aucune date `Sunset` n'est inventée. Les changements d'étape, documents,
fichiers et liens de dépôt restent sous le préfixe historique et ne sont pas
dépréciés tant qu'ils n'ont pas de remplaçant commun. Le retrait est conditionné
à la migration des écrans et intégrations connus, puis à l'annonce explicite
d'une échéance. La réponse future après retrait est cadrée en `410 Gone` avec
le code `api.version_retired`, sans être activée prématurément. La politique et
l'inventaire sont consignés dans `docs/api/COMMANDES_COMPATIBILITE.md`.

La boîte de changement d'étape ne lit plus l'ancien détail : elle obtient
l'étape courante par `GET /order-summaries/{orderId}` et conserve seulement les
sous-ressources actives sous leur chemin existant. Le composant de liste devis
historique n'est plus monté par le routeur et a été retiré du bundle. Ses
helpers et tests de chargement ont été supprimés ; les seules conversions
requises par l'export version 1 sont isolées sans appel à l'ancienne lecture.

Vérifications : cinq fichiers ciblés, 69 tests réussis ; typage, génération et
validation OpenAPI, gouvernance projet et spécifications réussis. Ce palier ne
fixe pas la date de retrait et ne termine donc pas AC-05.

Le nettoyage interne qui suit supprime l'ancien composant de liste, ses helpers
de chargement et leurs tests devenus sans appelant. Les conversions encore
nécessaires à l'export historique sont isolées dans
`legacy-order-export-filters.ts`. La suite complète passe après suppression :
317 fichiers et 3 126 tests réussis, 155 désactivés. Le typage et le build
réussissent également ; le build conserve un avertissement Rollup préexistant
sur le cycle de chunks autour de `CheckoutPage`.

Les méthodes internes `CommercialOrdersApiClient.list()` et `getDetail()` et
leurs quatre tests de sérialisation ont ensuite été retirés : elles n'avaient
plus d'appelant. La façade HTTP historique reste servie aux intégrations. Après
ce retrait, 122 tests ciblés, le typage et le build réussissent.
