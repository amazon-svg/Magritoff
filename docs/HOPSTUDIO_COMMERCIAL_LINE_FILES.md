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

## Propagation

Des triggers PostgreSQL couvrent les deux ordres possibles :

1. le fichier existe avant la ligne suivante : la création de la ligne hérite
   des associations existantes ;
2. le fichier arrive après la ligne suivante : la création de l'association
   propage le fichier vers les lignes déjà dérivées.

Le même `commercial_files.id` est donc associé aux lignes projet, devis et
commande. Les octets et le chemin de stockage restent uniques.

## Intégration HopeStudio

Lors de `window.HChat.callbackAddToBasket(card, rankSelected)` :

1. le prix du processus choisi est placé dans `getPrice.response` ;
2. si `quote_process_key` existe, le callback appelle la fonction HopeStudio
   `HChat.getAttachment` ;
3. le PDF retourné est envoyé avec la commande d'import de la ligne ;
4. le backend crée la ligne, stocke le PDF dans le bucket privé et crée
   l'association `project_item_files` ;
5. en cas d'échec du fichier, la ligne nouvellement créée est retirée afin de
   ne pas laisser un chiffrage incomplet.

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

Après la sélection d'un projet, l'accueil reste affiché, y compris lorsque le
projet possède déjà une session HopeStudio. Le bouton `Éléments du projet` :

1. charge les lignes du projet courant ;
2. permet de sélectionner une ou plusieurs lignes ;
3. crée le devis avec `CommercialQuotesApiClient.createFromProject` ;
4. ouvre le devis créé dans l'éditeur.

Les associations de fichiers des lignes sélectionnées, notamment le PDF
HopeStudio typé `supplier_quote`, sont propagées vers les lignes du devis par
le mécanisme SQL décrit plus haut.

Le configurateur n'affiche plus la recherche ni les résultats PIM. Après
l'envoi du prompt initial, HopeStudio utilise toute la surface disponible.

## Fichiers principaux

- `supabase/migrations/20260925000100_commercial_line_files.sql` ;
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
