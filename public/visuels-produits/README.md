# Visuels produits Magrit — valeurs par défaut des gammes du PIM

**REFACTO-VISUELS (2026-08-09, arbitrage Arnaud).** Le visuel d'un produit est
une **propriété de sa gamme dans le PIM**, jamais une inférence sur son nom.

Ces fichiers sont servis à une **URL stable** (`/visuels-produits/<nom>.jpg`,
Vite copie `public/` verbatim dans `dist/`) parce qu'ils sont référencés depuis
la **base** : `product_gammes.image_url`, posé par la migration
`20260809000100_gamme_visuals.sql`. Un asset importé depuis `src/` aurait une
URL hachée au build, donc invalide en base au build suivant.

Chaque valeur est **modifiable gamme par gamme depuis l'admin PIM** sans
redéploiement — ces fichiers ne sont que le point de départ.

## Couverture au 2026-08-10 : 16 familles racines sur 16 ✅

| Famille racine | Visuel | Marqueur qui rend la famille non confondable |
|---|---|---|
| `carterie` | `magrit-carte-visite.jpg` | pile de cartes, tranche visible |
| `flyer` | `magrit-flyer.jpg` | feuille A5 a plat |
| `depliant` | `magrit-depliant.jpg` | 3 volets, plis visibles |
| `etiquette` | `magrit-etiquette.jpg` | planche, sticker decolle |
| `kakemono` | `magrit-kakemono.jpg` | enrouleur, base alu |
| `packaging` | `magrit-packaging.jpg` | boite kraft, rabats releves |
| `brochure` | `magrit-brochure.jpg` | **dos carre colle + bloc de pages** |
| `affiche` | `magrit-affiche.jpg` | **grand format + indice d echelle** (tabourets, rouleau) |
| `banderole` | `magrit-banderole.jpg` | **oeillets metalliques + ourlets** |
| `drapeau` | `magrit-drapeau.jpg` | **voile goutte d eau + mat + pied leste** |
| `panneau` | `magrit-panneau.jpg` | **tranche du Dibond** (ame visible) |
| `adhesif` | `magrit-adhesif.jpg` | **pose sur verre + raclette** |
| `plv` | `magrit-plv.jpg` | **presentoir carton, cannelures apparentes** |
| `papeterie` | `magrit-papeterie.jpg` | **suite coordonnee** (en-tete, enveloppe, chemise, bloc) |
| `calendrier` | `magrit-calendrier.jpg` | **spirale + grille de dates** |
| `restauration` | `magrit-restauration.jpg` | **menu + set de table** sur table de bistrot |

> Le visuel `brochure` du 2026-06 a ete **remplace**, pas restaure : l ancien
> montrait un depliant plie ouvert a plat. C est ce defaut qui a declenche
> toute la refonte.

Les 65 sous-gammes **heritent** de leur famille (`resolveGammeImage`). Le taux
de couverture reel est mesure et affiche en tete de l admin PIM.

## Serie unique « scene » (2026-08-10)

Les 6 visuels de juin etaient des produits **detoures sur fond blanc**, les 10
d aout des **scenes avec decor**. L ecart se voyait sur la grille. Les 6 ont
donc ete regeneres au format scene : la collection est desormais homogene, tous
les visuels en 1024x1024 sur fond beton.

L ancienne serie de juin est conservee hors du dossier publie, dans
`_bmad-output/Visuels produits/serie-juin-2026/`. **Ne pas la remettre dans
`public/`** : tout ce qui vit ici est copie verbatim dans `dist/` et donc
deploye.

### ⚠️ Une exception : `magrit-kakemono.jpg`

C est **le seul visuel encore au format detoure de juin** (346x631). Sa
regeneration d aout a ete **ecartee** : elle montrait une banniere suspendue a
une traverse sur un mat a socle rond — c est-a-dire une **oriflamme**, soit
exactement l objet de la famille `drapeau`. Deux familles racines distinctes
seraient devenues indiscernables sur la grille du catalogue.

Le fichier ecarte est conserve pour reference dans
`_bmad-output/Visuels produits/a-revoir/`.

**Ce qu il faut pour le remplacer** : un roll-up, et le marqueur qui le rend
non confondable est la **cassette enrouleur en aluminium** a la base, avec ses
pieds, et le mat de soutien a l arriere. Pas de socle rond, pas de traverse
haute. C est ce que montre l ancien visuel, qui reste donc juste.

## Sous-gammes

Aucune sous-gamme n'est seedée : elle **hérite** du visuel de sa famille par
remontée `parent_slug` (`resolveGammeImage`). On ne pose une `image_url` sur une
sous-gamme que pour s'écarter volontairement du visuel de sa famille.

## Provenance

Visuels pré-brandés générés via Gemini (P18 v2, 2026-06-23/24), découpés depuis
une planche de référence — cf. `_bmad-output/planning-artifacts/brief-gemini-v2-mockups-prebrandes-2026-06-21.md`.
Branding intégré dans l'image, fond neutre, `object-fit: contain`.
