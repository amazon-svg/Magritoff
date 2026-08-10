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

## Couverture au 2026-08-09 : 6 familles racines sur 16

| Famille racine | Visuel | État |
|---|---|---|
| `carterie` | `magrit-carte-visite.jpg` | ✅ |
| `flyer` | `magrit-flyer.jpg` | ✅ |
| `depliant` | `magrit-depliant.jpg` | ✅ |
| `etiquette` | `magrit-etiquette.jpg` | ✅ |
| `kakemono` | `magrit-kakemono.jpg` | ✅ |
| `packaging` | `magrit-packaging.jpg` | ✅ |
| `brochure` | — | ❌ **à produire** — l'ancien `magrit-brochure.jpg` montrait un dépliant plié ouvert à plat, pas un livret relié à dos carré. Il a été retiré plutôt que reconduit : un visuel faux est pire qu'une absence de visuel. |
| `affiche` | — | ❌ à produire |
| `banderole` | — | ❌ à produire |
| `drapeau` | — | ❌ à produire |
| `panneau` | — | ❌ à produire |
| `adhesif` | — | ❌ à produire |
| `plv` | — | ❌ à produire |
| `papeterie` | — | ❌ à produire |
| `calendrier` | — | ❌ à produire |
| `restauration` | — | ❌ à produire |

Les gammes sans visuel affichent le **repère de famille** (pictogramme +
tonalité, `ProductVisualPlaceholder`). Le taux de couverture réel est mesuré et
affiché en tête de l'admin PIM.

## Sous-gammes

Aucune sous-gamme n'est seedée : elle **hérite** du visuel de sa famille par
remontée `parent_slug` (`resolveGammeImage`). On ne pose une `image_url` sur une
sous-gamme que pour s'écarter volontairement du visuel de sa famille.

## Provenance

Visuels pré-brandés générés via Gemini (P18 v2, 2026-06-23/24), découpés depuis
une planche de référence — cf. `_bmad-output/planning-artifacts/brief-gemini-v2-mockups-prebrandes-2026-06-21.md`.
Branding intégré dans l'image, fond neutre, `object-fit: contain`.
