# Diagnostic de reprise — 5 octobre 2026

Statut : draft. Mandat : reprise du développement demandée par Xavier dans le chat. Référence du code vérifié : `b8dc8c6f`. Ce rapport ne vaut ni approbation de story ni preuve de déploiement.

## Conclusion

Le socle portable démarre et les contrôles exécutés passent sur un environnement de test isolé. Le premier lot recommandé est la fiabilisation de la recette et de la CI. Le parcours complet boutique → devis → commande dans le navigateur reste à construire et à exécuter avant une validation fonctionnelle globale.

## Preuves obtenues

| Contrôle | Résultat |
|---|---|
| Environnement | Node 22.14.0, pnpm 11.15.1, Docker disponible |
| `pnpm typecheck` | Réussi, périmètre modulaire par défaut ; `typecheck:all` non exécuté |
| `pnpm build` | Réussi |
| `pnpm test` | 315 fichiers réussis, 50 ignorés ; 3 166 tests réussis, 142 ignorés |
| `pnpm project:validate` | Réussi : 18 epics, 24 fonctionnalités, 201 stories |
| `pnpm specs:validate` | Réussi, mais zéro spécification importée : aucune preuve de conformité produit par ce contrôle |
| `pnpm dev:local` | Réussi : PostgreSQL, S3, Mailpit, API Node et Vite ; 82 migrations déjà appliquées, neuf buckets prêts |
| `/api/v1/health`, `/api/v1/readiness` | HTTP 200 ; PostgreSQL disponible |
| Suite PostgreSQL sur base dédiée | 47 fichiers, 138 tests réussis ; 82 migrations appliquées depuis une base vide |
| Playwright local | Sept tests réussis : entrée anonyme, connexion Better Auth, absence de panier en atelier/dashboard, trois scans sans violation critique |

Les tests de commandes boutique (`postgres-orders-repository.test.ts`) et de conversion devis → commande (`postgres-commercial-order-conversion.test.ts`) font partie des intégrations réussies. Ils vérifient les repositories, pas le parcours complet dans l'interface. Les scans d'accessibilité ne constituent pas une certification WCAG.

La suite unitaire a été rejouée avec les sockets locaux autorisés après un premier essai interrompu dans le bac à sable. Les cinq échecs HTTP de ce premier essai ne sont pas des régressions applicatives.

## Défaut d'isolation découvert

Sur la base de développement existante, quatre tests échouent :

- Trois dans `postgres-catalog-automation.test.ts` : l'ingestion et le compteur portent sur la file PIM globale, alors que les assertions supposent uniquement leurs fixtures.
- Un dans `postgres-local-authentication.test.ts` : l'assertion attend un seul espace pour le compte seed, qui en possède plusieurs dans les données locales.

Les mêmes tests passent tous sur une base vide migrée. La commande actuelle d'intégration n'est donc pas fiable sur une base peuplée et peut modifier des données hors de ses fixtures.

Le premier passage a rejeté 200 candidats PIM locaux existants. Ce changement a été compensé par une transaction ciblée : exactement les 200 rejets sans relecteur, portant le motif du test et horodatés entre 11:40:55 et 11:41:15 UTC, ont été remis en `pending`. Une note conserve la trace de l'annulation ; les métadonnées de relecture ne sont pas restaurées à leur état antérieur, qui n'avait pas été sauvegardé. Aucun candidat n'a été supprimé. Aucun reset de volumes n'a été exécuté.

La base temporaire `magrit_reprise_20261005_1143`, créée exclusivement pour le second passage, a été supprimée après les tests. L'application locale reste démarrée sur `http://localhost:5176`.

## Lot de reprise proposé

1. **Isoler les intégrations locales.** Ajouter un lanceur qui crée une base temporaire, applique les migrations et nettoie uniquement cette base après exécution. Identifier explicitement la cible locale et empêcher le lancement accidentel sur la base de développement. Acceptation : les 138 tests passent même quand la base de développement contient des fixtures de volume ; aucune donnée de cette dernière n'est modifiée.
2. **Exécuter la suite complète en CI.** Ajouter `pnpm test` sur les PR vers `main`, en conservant les contrôles d'architecture, de contrat et PostgreSQL existants. Acceptation : un test métier en échec bloque le job ; les intégrations ignorées restent explicitement distinguées des tests exécutés.
3. **Rejouer l'accessibilité sur le runtime actuel.** Remplacer le ciblage exclusif de `beta/v5` par `main` et exploiter les tests Playwright portables déjà vérifiés. Acceptation : connexion et scans atelier/dashboard réellement exécutés, échecs de navigation bloquants.

Puis préparer une fixture de recette acheteur complète : compte boutique, produit tarifé, commande, accès atelier et devis, selon le parcours produit à confirmer. Le seed développeur ne crée aucune boutique dans `magrit-development` ; les anciennes recettes de devis dépendent encore d'un espace QA historique. Éviter de les présenter comme une recette locale immédiatement reproductible.

## Suite fonctionnelle et décisions

`US-CONV-02` reste le candidat fonctionnel prioritaire proposé, après vérification du parcours JavaScript HopeStudio existant. La décision UM doit également être formalisée et propagée aux sept stories signalées dans la note du 4 octobre. Aucun de ces arbitrages n'est pris par ce rapport.

## Sortie de tâche

- Modules applicatifs et contrats API modifiés : aucun.
- Dérogations R5 introduites : aucune.
- Livraison : ce rapport uniquement, sur `codex/diagnostic-reprise` ; aucun push, déploiement ni changement de statut produit.
- Logs locaux : `/tmp/magrit-reprise-tests-local.log`, `/tmp/magrit-reprise-postgres.log`, `/tmp/magrit-reprise-postgres-isolated.log`, `/tmp/magrit-reprise-e2e.log`, `/tmp/magrit-reprise-typecheck.log`, `/tmp/magrit-reprise-build.log`, `/tmp/magrit-reprise-dev.log`. Ces fichiers temporaires ne sont pas des preuves archivées en CI.

## Complément — catalogue Atelier Lumière, 5 octobre 2026

Après récupération et import des gammes, l'utilisateur a généré des produits PIM dans Atelier Lumière. Au diagnostic suivant, 82 produits actifs existaient dans ce tenant, sans bibliothèque ; la bibliothèque « test » était vide. La boutique `atelier-lumiere-ux` n'avait ni bibliothèque liée ni mode PIM activé, ce qui expliquait son catalogue vide.

Correction locale : activation de `pim_catalog_mode` et sélection des 81 slugs du JSON dans `pim_gamme_slugs`. La gamme technique de test `pricing_*` est restée hors de cette sélection. Les anciens réglages sont sauvegardés dans `/tmp/magrit-atelier-lumiere-catalogue-avant.json`. Aucun produit, prix, droit, API ou module applicatif n'a été modifié ; aucune dérogation R5 introduite.

Vérifications réussies : l'API publique de cette boutique renvoie HTTP 200 et 81 produits ; Playwright affiche « Flyer A5 » sur `/shop/atelier-lumiere-ux/catalog`, sans erreur JavaScript. Le mécanisme existant `buildPimGeneratedProducts` produit des cartes avec un prix initial nul et un chiffrage prévu à la configuration ; le chiffrage Clariprint et l'achat n'ont pas été vérifiés par cette correction. Cette sélection locale n'est pas une décision d'imposer la hiérarchie aux autres boutiques.

## Reprise du processus — suite du 5 octobre 2026

### 1. Socle et recette

Le build et le typage modulaire ont été rejoués avec succès. La suite standard compte 3 166 tests réussis et 144 ignorés ; ces derniers ne sont pas présentés comme validés. Les 140 tests PostgreSQL, dont ceux du seed PIM, passent sur une base temporaire. Sept tests navigateur passent : connexion, atelier/dashboard, absence du panier interne et absence de violations critiques sur trois routes internes.

Xavier a également confirmé une commande passée en boutique et visible dans la liste du back-office. Cela ne prouve pas encore un parcours navigateur complet incluant devis, commande et consultation détaillée. Le besoin de fiche est enregistré sous `E4.4a`. Les intégrations de conversion devis → commande sont vertes, mais ne remplacent pas cette recette utilisateur complète.

### 2. Sécurisation des développements

- `.github/workflows/architecture.yml` exécute désormais le build et `pnpm test` sur les PR/push concernés, en complément des contrôles existants.
- `.github/workflows/a11y.yml` cible `main`, démarre le runtime portable et exécute les sept tests Playwright cités ci-dessus. Les erreurs de navigation ne sont plus absorbées par `|| true`. Ce lot ne prétend pas couvrir une recette d'accessibilité exhaustive des boutiques.
- `pnpm test:postgres:integration` utilise `scripts/db/test-postgres-isolated.mjs` : cible locale uniquement, nom de base aléatoire, migrations, tests et nettoyage dans un `finally`. Les variables de connexion sont explicitement transmises aux enfants pour empêcher `.env.test` de détourner les tests vers une autre base. Une interruption forcée peut laisser une base temporaire, comme documenté dans le quickstart.
- Les deux workflows sont du YAML valide ; les commandes et tests ont été exécutés localement. Les jobs GitHub Actions eux-mêmes n'ont pas encore été exécutés sur une PR.
- Après les deux exécutions de diagnostic du lanceur, aucun `magrit_test_*` ne restait sur l'instance locale. Les données de développement n'ont pas été utilisées par cette suite.

### 3. Droits utilisateurs

`PD-2026-10-05-UM` formalise en `draft` / `proposed` la séparation des populations, les options UM et les écarts constatés sur la stack portable. Les sept stories E9.1, E9.2, E9.3, E9.9, E9.10, E9.13 et E10.11 y sont reliées avec un cadrage propre à leur besoin. E9.3 est `contradictory` : l'ancien contrat d'étendue d'accès est encore éditable par un repository portable, et la restriction historique des assignations n'est pas intégralement portée par le trigger portable. Ces divergences doivent être résolues avant d'approuver un modèle cible ou de modifier des droits réels.

`OQ-UM-PORTABLE` consigne le point ouvert. Aucun artefact n'est passé à `approved`, aucune attribution de rôle n'a été effectuée. Les exigences historiques d'E9.3 sont explicitement signalées comme non applicables telles quelles.

### 4. HopeStudio et US-CONV-02

Xavier précise que Studio désigne Clariprint Studio / HopeStudio et que l'intégration est déjà avancée. La question générale sur le sens de l'API a été retirée comme préalable. US-CONV-02 référence le runtime headless, le relais de workflow, les callbacks, la session par projet et l'import de cartes et fichiers fournisseur. La prochaine livraison doit partir de ces éléments et du critère exact « brief → carte tarifée hors conversation », sans imposer une nouvelle API généraliste ou des clés de service comme prérequis.

Le test réel existant `pnpm test:hopstudio:live` est configuré pour `https://sugar-test.clariprint.com/json.wcl` avec le brief de test « Je veux 500 depliants 2 volets A4 quadri recto verso sur papier couche demi-mat 170g ». Aucun credential explicite n'est renseigné dans ce fichier et la continuation n'est pas activée. Le test transmet également des identifiants techniques tenant/utilisateur. L'appel peut créer une session et déclencher un traitement IA côté serveur.

L'appel a été refusé **avant exécution** par le contrôle d'approbation automatique, qui exige l'autorisation explicite de cet envoi externe. Aucun contournement ni nouvel appel n'a été tenté. Xavier a ensuite précisé que cet appel direct ne correspond pas au parcours attendu : son exécution est abandonnée. La recette retenue passe par la bibliothèque JavaScript HopeStudio ; aucune preuve de réponse réelle n'est revendiquée.

### Sortie de tâche

Changements : CI, lanceur de tests local, documentation et artefacts de gestion de projet. Aucun module métier, contrat API ou droit utilisateur modifié ; aucune dérogation R5. Validation documentaire : 10 tests projet réussis, dashboard régénéré, contrôle de structure vert, `git diff --check` vert. Aucun push ni déploiement effectué.


### Correction du cadrage HopeStudio

La bibliothèque JavaScript orchestre les actions et les sessions. Magrit fournit un relais authentifié et importe les cartes reçues par callback. US-CONV-02 a été corrigée pour retirer les exigences ajoutées lors de la migration : nouvelle API Magrit pour appelants tiers, clés de service obligatoires et interdiction des sessions techniques. Le critère historique « hors couche conversationnelle » est conservé comme point de relecture produit, sans imposer cette interprétation technique.

Le chemin d’assistant serveur direct existe encore dans le dépôt : il est distingué de la recette du widget, sans suppression ni modification de comportement à ce stade.


Validation du recadrage : 18 tests réussis dans cinq fichiers ciblant le transport, le client API, le handler, le gateway et le montage. Vérification navigateur sur `/dev/hopstudio` : le vrai bundle se monte, puis son bouton de test déclenche `CallAI` et `loadSessionParts` après les actions d’initialisation. Les réponses métier sont simulées. Tous les domaines externes sont bloqués dans ce navigateur (seule une requête de police Google a été interceptée). Cette preuve porte sur le montage et le déclenchement par la bibliothèque, pas sur le chiffrage fournisseur ni l’import complet au projet.


### Recette du widget jusqu’à l’ajout au projet

Ajout de `tests/e2e/hopstudio-project-import.spec.ts` : le vrai bundle HopeStudio tourne dans le configurateur de production. Le fournisseur et les écritures projet sont simulés ; aucun domaine externe n’est autorisé par ce test. Le parcours passe par les contrôles de l’interface : choix du projet, brief, carte, détail des offres et ajout de la seconde offre. Le callback transmet 125,50 € avec la configuration et une clé d’idempotence. La confirmation et la ligne du projet sont visibles. Le runtime crée lui-même une session (`newSession`) puis appelle `CallAI`, `loadSessionParts` et `GetSVG_List`.

Les huit tests du job navigateur portable passent localement, ainsi que 29 tests de contrat projet et de callbacks HopeStudio. Le contrat d’import vérifie notamment le prix normalisé, les métadonnées fournisseur, les fichiers et le rejeu sans doublon. Ses repositories sont simulés ; ce résultat n’est pas une preuve de persistance PostgreSQL ou de réponse réelle du fournisseur. Le job CI inclut désormais cette recette, mais n’a pas été exécuté sur GitHub. La story reste en brouillon jusqu’à relecture de « hors couche conversationnelle » et recette fournisseur réelle au travers de la bibliothèque.
