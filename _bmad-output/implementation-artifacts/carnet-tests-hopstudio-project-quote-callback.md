# Carnet de tests — PR HopeStudio, projet et devis

## Référence

- Branche : `feat/hopstudio-project-quote-callback`
- Base de comparaison : `origin/main`
- Date de rédaction : 29/09/2026
- Stories : [HSPQ-1](./story-HSPQ-1-session-hopstudio-par-projet.md),
  [HSPQ-2](./story-HSPQ-2-import-card-hopstudio.md),
  [HSPQ-3](./story-HSPQ-3-fichiers-lignes-commerciales.md) et
  [HSPQ-4](./story-HSPQ-4-edition-et-pdf-devis.md)

Ce carnet est la preuve locale liée à la PR. Il ne remplace pas le cahier de
tests fonctionnels Notion et n’affirme pas que les scénarios navigateur marqués
`À jouer` ont été exécutés.

## Préconditions fonctionnelles

- un tenant avec HopeStudio activé et correctement configuré ;
- un utilisateur membre du tenant ;
- un client et au moins deux projets actifs ;
- un projet sans session HopeStudio et un projet avec session existante ;
- un gabarit PDF de devis éligible ;
- une card HopeStudio comportant un prix, un PDF fournisseur et au moins un
  gabarit SVG ;
- accès aux outils réseau du navigateur pour vérifier l’absence d’appel
  `CallAI` émis directement par Magrit.

## Légende

| Statut | Signification |
|---|---|
| Automatisé | Couvert par un test versionné dans la PR |
| Validé | Exécuté pendant le développement et résultat connu |
| À jouer | Contrôle manuel ou environnemental encore nécessaire |
| Bloqué | Impossible tant qu’une dépendance documentée n’est pas levée |

## HSPQ-1 — Sessions par projet

| ID | Cas | Résultat attendu | Couverture | Statut |
|---|---|---|---|---|
| CT-HSPQ-001 | Ouvrir un projet sans session | L’accueil reste visible ; aucune ancienne conversation n’apparaît | `configurator-workspace.test.ts` | Automatisé |
| CT-HSPQ-002 | Envoyer le premier prompt | HopeStudio reçoit `initial_prompt`, crée sa session et Magrit la rattache au projet | Test unitaire partiel + navigateur | À jouer |
| CT-HSPQ-003 | Rouvrir ce projet | HopeStudio s’ouvre directement sur la session enregistrée | `configurator-workspace.test.ts` | Automatisé |
| CT-HSPQ-004 | Passer d’un projet A à un ancien projet B | La session globale de A est effacée avant l’initialisation de B ; B n’affiche jamais A | Navigateur | À jouer |
| CT-HSPQ-005 | Associer la session de A à B | Rejet `project.hopstudio_session_already_assigned` | `projects.contract.test.ts` | Automatisé |
| CT-HSPQ-006 | Remplacer une session déjà définie | Rejet `project.hopstudio_session_locked` et valeur inchangée | `projects.contract.test.ts` | Automatisé |
| CT-HSPQ-007 | Inspecter les requêtes du premier prompt | Aucun `CallAI` construit ou envoyé par Magrit ; le runtime HopeStudio pilote l’appel | `workflow-transport.test.ts` + réseau navigateur | À jouer |

## HSPQ-2 — Import d’une card dans le projet

| ID | Cas | Résultat attendu | Couverture | Statut |
|---|---|---|---|---|
| CT-HSPQ-008 | Ajouter le processus sélectionné | La ligne utilise le prix correspondant à `rankSelected` | `workflow-transport.test.ts` | Automatisé |
| CT-HSPQ-009 | Importer le résumé clair | Le détail rendu correspond à `getCardClearResume(card)` après sécurisation | `workflow-transport.test.ts` | Automatisé |
| CT-HSPQ-010 | Conserver la card | `quote_payload.hopstudio.card` contient le payload transmis au callback | `projects.contract.test.ts` | Automatisé |
| CT-HSPQ-011 | Récupérer le PDF fournisseur | Un fichier `supplier_quote` PDF est associé à la ligne | `workflow-transport.test.ts` + contrôle API | Automatisé |
| CT-HSPQ-012 | Réponse SVG au format courant | Chaque entrée de `response`, y compris `sources[]`, produit les fichiers attendus | `workflow-transport.test.ts` | Automatisé |
| CT-HSPQ-013 | Réponse SVG historique | `reponses` et `sources` textuel restent acceptés | `workflow-transport.test.ts` | Automatisé |
| CT-HSPQ-014 | Réponse SVG invalide ou absente | Avertissement visible ; la ligne reste ajoutée | `workflow-transport.test.ts` + navigateur | Automatisé |
| CT-HSPQ-015 | Rejouer la même clé d’import | Une seule ligne de projet existe | `projects.contract.test.ts` | Automatisé |
| CT-HSPQ-016 | Vérifier le retour utilisateur | Confirmation visible et compteur d’éléments incrémenté sans rechargement | Navigateur | À jouer |

## HSPQ-3 — Fichiers des lignes commerciales

| ID | Cas | Résultat attendu | Couverture | Statut |
|---|---|---|---|---|
| CT-HSPQ-017 | Ajouter et lister un fichier | Le même fichier est retourné avec type, MIME, visibilité et URL signées | `commercial-line-files.contract.test.ts` | Automatisé |
| CT-HSPQ-018 | Importer les deux SVG HopeStudio | `*-pao.svg` est `customer`, `*-production.svg` est `internal`, MIME `image/svg+xml` | `workflow-transport.test.ts` | Automatisé |
| CT-HSPQ-019 | Créer un devis après le fichier projet | L’association du fichier est propagée à la ligne de devis | `gescom-commercial-line-files.sql` | Validé |
| CT-HSPQ-020 | Ajouter un fichier après création du devis | La ligne de devis existante reçoit l’association | Test SQL à compléter explicitement | À jouer |
| CT-HSPQ-021 | Convertir le devis en commande | Le même `commercial_files.id` est associé à la ligne de commande | `gescom-commercial-line-files.sql` | Validé |
| CT-HSPQ-022 | Ouvrir la fenêtre sur projet, devis et commande | Même liste et mêmes actions ; aperçu image/PDF et téléchargement fonctionnels | Navigateur | À jouer |
| CT-HSPQ-023 | Tenter une lecture avec une clé de service | L’API refuse la clé de service | `commercial-line-files.contract.test.ts` | Automatisé |
| CT-HSPQ-024 | Vérifier l’accès client | Seuls les fichiers `customer` sont éligibles à une future surface client ; aucun accès anonyme n’est créé ici | Revue de contrat E10.17/E10.20 | À jouer |

## HSPQ-4 — Devis, description et PDF

| ID | Cas | Résultat attendu | Couverture | Statut |
|---|---|---|---|---|
| CT-HSPQ-025 | Ouvrir les éléments du projet | Le compteur et la liste correspondent au projet courant | `configurator-workspace.test.ts` + navigateur | Automatisé |
| CT-HSPQ-026 | Sélectionner plusieurs lignes | Le devis créé contient uniquement les lignes cochées et s’ouvre dans l’éditeur | `configurator-workspace.test.ts` + navigateur | Automatisé |
| CT-HSPQ-027 | Modifier le détail HTML d’un brouillon | Le rendu direct reflète la sauvegarde ; les balises autorisées sont conservées | `safe-description-html.test.ts` + navigateur | Automatisé |
| CT-HSPQ-028 | Injecter attribut, script ou balise interdite | Le contenu est refusé ou échappé ; aucun script ne s’exécute | `safe-description-html.test.ts` | Automatisé |
| CT-HSPQ-029 | Modifier une ligne d’un devis non brouillon | L’écriture est refusée par la garde d’état | Contrats devis existants | Automatisé |
| CT-HSPQ-030 | Dupliquer puis convertir le devis | `description_html` reste identique sur la copie puis la commande | Migration/contrats + contrôle métier | À jouer |
| CT-HSPQ-031 | Générer un aperçu | Réponse 201, PDF valide, lien temporaire et filigrane `DRAFT` sur chaque page | `quote-documents.contract.test.ts`, `quote-document-renderer.test.ts` | Automatisé |
| CT-HSPQ-032 | Régénérer l’aperçu | Le nouvel aperçu remplace le précédent sans créer un document définitif | `quote-documents-service.test.ts` | Automatisé |
| CT-HSPQ-033 | Télécharger le document définitif | Le document généré après envoi est téléchargeable ; un brouillon sans document rend l’erreur prévue | `quote-documents.contract.test.ts` + navigateur | Automatisé |

## Commandes de non-régression

```bash
pnpm vitest run \
  tests/modules/hopstudio/workflow-transport.test.ts \
  tests/modules/catalog/configurator-workspace.test.ts \
  tests/contract/projects.contract.test.ts \
  tests/contract/commercial-line-files.contract.test.ts \
  tests/modules/commercial-quotes/safe-description-html.test.ts \
  tests/modules/commercial-quotes/commercial-quotes-service.test.ts \
  tests/contract/quote-documents.contract.test.ts \
  tests/modules/quote-documents/quote-documents-service.test.ts \
  tests/modules/quote-documents/quote-document-renderer.test.ts

pnpm typecheck:modular
pnpm openapi:validate
pnpm gen:api:check
pnpm build
```

Test SQL ciblé, sur une base locale ayant reçu les migrations de la branche :

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f tests/sql/gescom-commercial-line-files.sql
```

Le fichier SQL ouvre une transaction et termine par `ROLLBACK` : il ne conserve
pas ses fixtures.

## Résultats de la remise

| Vérification | Résultat |
|---|---|
| Tests Vitest ciblés | 9 fichiers, 81 tests passés le 29/09/2026 |
| Typecheck modulaire | Réussi le 29/09/2026 |
| Validation OpenAPI et types générés | 210 opérations valides ; types alignés le 29/09/2026 |
| Validation des spécifications | Réussie le 29/09/2026 |
| Build Vite | Réussi le 29/09/2026 ; avertissement Rollup préexistant sur le cycle de réexport `CheckoutPage` |
| Migration `20260929000100` | SQL validé transactionnellement ; application globale bloquée par l’historique local antérieur |
| Parcours navigateur complet | À jouer |

## Anomalies et limites connues

1. L’application globale des migrations locales rencontre encore la version
   orpheline `20260417000000`. Ce point ne remet pas en cause la validation SQL
   transactionnelle de la migration de visibilité, mais bloque un reset/push
   global fiable tant que l’historique n’est pas réparé.
2. La visibilité `customer` est persistée et propagée ; l’exposition au client
   final reste gouvernée par les surfaces E10.17/E10.20.
3. Les scénarios marqués `À jouer` exigent une session authentifiée et un
   serveur HopeStudio réel ou un environnement de recette représentatif.
4. L’avertissement gabarit ne doit jamais transformer un ajout de ligne réussi
   en erreur bloquante.
5. `git diff --check` global signale deux espaces présents dans le bundle
   fournisseur `sugarcrepeHLUX.umd.js`. Les documents ajoutés par ce carnet
   passent le même contrôle ciblé ; le bundle tiers n’a pas été reformaté.
