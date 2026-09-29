# Fichiers commerciaux issus de HopeStudio

## Objectif

Un fichier commercial est associé à une ligne métier et suit cette ligne lors
des transformations suivantes :

```text
project_item -> commercial_quote_line -> commercial_order_line
```

Les octets ne sont pas recopiés. Un fichier canonique immuable est stocké une
seule fois dans le bucket privé `commercial_line_files`, puis relié aux trois
types de lignes par des tables d'association.

## Modèle ajouté

- `commercial_files` : métadonnées, chemin de stockage, MIME et type métier ;
- `project_item_files` : association à la ligne de projet ;
- `commercial_quote_line_files` : association à la ligne de devis ;
- `commercial_order_line_files` : association à la ligne de commande.

Les types métier initiaux sont :

- `supplier_quote` ;
- `cutting_template` ;
- `folding_template` ;
- `technical_template` ;
- `artwork` ;
- `proof` ;
- `other`.

Le type métier `kind` est indépendant de `content_type`. Par exemple, le PDF
de prix HopeStudio porte `kind = supplier_quote` et
`content_type = application/pdf`.

Chaque fichier porte aussi une visibilité explicite, selon le vocabulaire déjà
utilisé par les fichiers de commande :

- `customer` : fichier communicable au client ;
- `internal` : fichier réservé aux équipes internes et à la production.

Le bucket privé accepte notamment `image/svg+xml`. La visibilité ne rend
jamais l'objet public anonymement : l'accès reste accordé par l'application au
moyen d'une URL signée après contrôle du contexte.

## Propagation

Des triggers PostgreSQL couvrent les deux ordres possibles :

1. le fichier existe avant la ligne suivante : la création de la ligne hérite
   des associations existantes ;
2. le fichier arrive après la ligne suivante : la création de l'association
   propage le fichier vers les lignes déjà dérivées.

Le même `commercial_files.id` est donc associé aux lignes projet, devis et
commande. Les octets et le chemin de stockage restent uniques.

## Gestion dans l'interface

Les lignes projet, devis et commande utilisent le même bouton `Fichiers` et
la même fenêtre de gestion. Cette fenêtre permet de :

- consulter les fichiers déjà associés à la ligne ;
- choisir leur type métier avant l'ajout ;
- ajouter un PDF, une archive ZIP, un fichier PostScript ou une image ;
- prévisualiser les PDF et images au moyen d'une URL signée temporaire ;
- télécharger chaque fichier avec son nom d'origine.

Les URL de lecture expirent après cinq minutes. L'accès est vérifié à partir
du tenant et de la ligne demandée avant toute signature.

## Intégration HopeStudio

Lors de `window.HChat.callbackAddToBasket(card, rankSelected)` :

1. le prix du processus choisi est placé dans `getPrice.response` ;
2. la card reçue par le callback est passée à
   `window.hopes_suite.chat.getCardClearResume(card)` ; le résumé obtenu est
   sécurisé puis enregistré dans `project_items.description_html` ;
3. si `quote_process_key` existe, le callback appelle la fonction HopeStudio
   `HChat.getAttachment` ;
4. le callback appelle également
   `window.hopes_suite.chat.getCardSvgs(card, callback)` ; pour chaque entrée de
   `data.response` (`sources` est un tableau), le SVG brut est exclusivement
   confié aux deux filtres HopeStudio. L'ancien format `data.reponses` avec
   `sources` textuel reste accepté pour les runtimes en cache ;
5. `getDesignerSVG(svg)` produit le fichier `*-pao.svg`, marqué `customer`,
   tandis que `getPrinterSVG(svg)` produit `*-production.svg`, marqué
   `internal` ; les deux fichiers ont le type métier `technical_template` et
   le MIME `image/svg+xml` ;
6. le PDF et tous les gabarits SVG filtrés sont envoyés avec la commande
   d'import de la ligne ;
7. le backend crée la ligne, stocke les fichiers dans le bucket privé et crée
   les associations `project_item_files` ;
8. une réponse de gabarits absente, invalide ou trop tardive affiche un
   avertissement mais ne bloque pas la création de la ligne ;
9. si le stockage d'un fichier effectivement transmis échoue, la ligne
   nouvellement créée est retirée afin de ne pas laisser un chiffrage incomplet.

Cet échange n'appelle jamais `CallAI` directement. `getAttachment` reste une
fonction fournie et pilotée par HopeStudio.

## Payload de la card

La card HopeStudio complète est conservée comme JSON dans :

```text
project_items.quote_payload.hopstudio.card
```

Les octets des fichiers ne sont jamais placés dans `quote_payload`. La
configuration et le payload suivent le mécanisme existant de copie du
`project_item` vers la ligne de devis puis la ligne de commande.

## Sélection depuis l'accueil

Après la sélection d'un projet sans session HopeStudio, l'accueil reste affiché.
Un projet possédant déjà une session ouvre directement HopeStudio. Depuis
l'accueil, le bouton `Éléments du projet` :

1. charge les lignes du projet courant ;
2. permet de sélectionner une ou plusieurs lignes ;
3. crée le devis avec `CommercialQuotesApiClient.createFromProject` ;
4. ouvre le devis créé dans l'éditeur.

Les associations de fichiers des lignes sélectionnées, notamment le PDF
HopeStudio typé `supplier_quote`, sont propagées vers les lignes du devis par
le mécanisme SQL décrit plus haut.

## Description commerciale des lignes

Chaque ligne possède désormais un champ `description_html`, distinct du
libellé court, de la configuration technique et du payload HopeStudio :

```text
project_items.description_html
  -> commercial_quote_lines.description_html
  -> commercial_order_lines.description_html
```

La description est initialisée depuis le chiffrage du projet. Elle peut être
modifiée sur une ligne de devis uniquement tant que celui-ci est en brouillon,
puis elle est figée et recopiée lors de la conversion en commande. Une
duplication de devis conserve également la description de chaque ligne.

Le HTML autorisé est volontairement limité aux balises sans attribut `p`,
`br`, `strong`, `em`, `ul`, `ol` et `li`, sur 20 000 caractères maximum. La
validation est effectuée par l'API et par des contraintes PostgreSQL. Cette
description est utilisée dans l'éditeur de devis, le portail client, la fiche
commande et la génération documentaire.

Le configurateur n'affiche plus la recherche ni les résultats PIM. Après
l'envoi du prompt initial, HopeStudio utilise toute la surface disponible.

## Fichiers principaux

- `supabase/migrations/20260925000100_commercial_line_files.sql` ;
- `supabase/migrations/20260928000100_commercial_line_description_html.sql` ;
- `src/modules/hopstudio/ui/HopeStudioWorkspace.tsx` ;
- `src/modules/catalog/ui/workspace/ActiveProjectItemsDrawer.tsx` ;
- `src/modules/catalog/ui/workspace/MagritConfiguratorHome.tsx` ;
- `src/modules/projects/api/contracts.ts` ;
- `src/modules/projects/application/projects-service.ts` ;
- `src/adapters/supabase/projects-repository.ts` ;
- `tests/sql/gescom-commercial-line-files.sql`.

## Vérifications réalisées

- validation et génération du contrat OpenAPI ;
- typecheck modulaire TypeScript ;
- tests HopStudio, contrat Projets et adaptateur Projets ;
- application de la migration sur Supabase local ;
- test SQL réel de propagation projet -> devis -> commande, exécuté dans une
  transaction annulée en fin de test.
