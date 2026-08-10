# Brief Gemini — 10 visuels de gamme Magrit manquants

> **Émetteur** : Arnaud Mazon (PDG AGE Dvt., porteur Magrit IA)
> **Date** : 2026-08-10
> **Destinataire** : Gemini (génération d'images)
> **Suite de** : `brief-gemini-v2-mockups-prebrandes-2026-06-21.md` (les 6 visuels en service)

---

## Résumé exécutif

Le visuel d'un produit est désormais une **propriété de sa gamme** dans le PIM
(refonte du 2026-08-09). Le PIM compte **16 familles racines** ; **6** ont un
visuel, **10 n'en ont pas** et affichent aujourd'hui un simple pictogramme.

Ce brief produit ces 10 visuels, dans le **même système graphique** que les 6
existants — c'est la contrainte n°1 : ils cohabitent sur la même grille de
catalogue.

**Trois actions, dans cet ordre :**

1. Ouvrir une conversation Gemini et y **joindre les 6 visuels en service**
   (§3) comme référence de style, avant tout prompt.
2. Coller les 10 prompts du §4, un par un, 2–4 variantes chacun.
3. Renommer selon le §5 et me notifier « visuels gammes prêts » — je fais le
   reste (compression, dépôt, mise à jour du PIM).

---

## 1. Ce qui a motivé ce brief

Deux défauts constatés en production le 2026-08-09 :

- le visuel servi pour une **brochure** était en réalité **un dépliant plié
  ouvert à plat** — pas un livret relié ;
- le visuel servi pour un **calendrier** était **une feuille plate** qui se lit
  comme une affiche.

Le second venait d'un défaut de code, corrigé : 10 familles sans visuel dédié
recevaient silencieusement celui des flyers. **Le premier vient de l'image
elle-même** : `magrit-brochure.jpg` a donc été retiré plutôt que reconduit.

> ⚠️ **Conséquence directe sur ce brief.** Pour chaque visuel, ce qui compte
> n'est pas qu'il soit beau : c'est qu'un imprimeur reconnaisse **la famille**
> au premier coup d'œil et ne puisse pas la confondre avec une autre. Chaque
> prompt ci-dessous porte donc une ligne « ce qui doit être indubitable » et,
> quand le risque existe, une ligne « à ne surtout pas produire ».

---

## 2. Identité visuelle Magrit (à reproduire fidèlement)

> Source de vérité : composant `src/app/components/brand/MagritLogo.tsx`
> (dérivé de `.design-handoff/designs/Logo.html`). **Le vault ne contient
> aucune référence d'identité Magrit** — tout ce qui suit est la spec complète.

### Logo « La Marguerite »

- **18 pétales blancs**, régulièrement espacés (20° d'écart), ellipses fines
- **Cœur central pollen** : dégradé radial `#FFE066` (centre) → `#F5B529` →
  `#C68708` (bord), légèrement granuleux (texture pollen)
- Variante « lockup » : marguerite posée sur un **tile bleu pastel arrondi**,
  dégradé 135° `#E5F0FC` → `#B7D3F2`

### Typographie

- **« Magrit »** : *italique*, Inter, graisse 500–600, `#0F172A`, chasse serrée
- **Tagline** : `IMPRIMERIE · IA` en capitales, Inter 400–500, interlettrage
  aéré, `#0F172A` à 60–70 % d'opacité

### Couleurs canoniques

| Rôle | Hex |
|---|---|
| Tile bleu pastel — clair | `#E5F0FC` |
| Tile bleu pastel — foncé | `#B7D3F2` |
| Pollen clair (cœur) | `#FFE066` |
| Pollen médian (liseré accent) | `#F5B529` |
| Pollen sombre (bord du cœur) | `#C68708` |
| Encre | `#0F172A` |
| Pétales | `#FFFFFF` |

### Liseré pollen

Bandeau `#F5B529`, 8–12 px, en accent — pied de page, base d'un support,
tranche. Présent sur la quasi-totalité des visuels existants.

### Direction artistique

- **Photo-réaliste** : éclairage studio doux, ombres naturelles, profondeur de champ
- **Premium pro** : aucune couleur criarde, aucun effet cartoon
- **Branding imprimé, pas incrusté** : le logo doit ressembler à de l'encre sur
  le support (absorption sur kraft, brillance sur adhésif, mat sur papier
  offset), jamais à un calque collé par-dessus une photo
- **Perspective** : le branding suit la géométrie du support — incliné si le
  support est incliné, courbé si le support est courbé

---

## 3. À joindre à la conversation Gemini AVANT les prompts

**Les 6 visuels en service** — ils fixent le style bien mieux qu'une
description. Fichiers (repo Magrit) :

```
public/visuels-produits/magrit-carte-visite.jpg
public/visuels-produits/magrit-flyer.jpg
public/visuels-produits/magrit-depliant.jpg
public/visuels-produits/magrit-etiquette.jpg
public/visuels-produits/magrit-kakemono.jpg
public/visuels-produits/magrit-packaging.jpg
```

**Message d'amorce à coller avant le premier prompt :**

```
Voici 6 visuels produits d une même collection. Je vais te demander d en
générer 10 autres qui doivent s intégrer sans rupture dans cette collection :
même qualité photo-réaliste, même éclairage studio doux, même traitement du
branding imprimé sur le support, même niveau de finition premium.

Observe et conserve : le type de fond, la douceur des ombres, la profondeur de
champ, la façon dont le logo est imprimé sur le produit en suivant sa
perspective. Ne change pas de direction artistique entre les images.

Confirme que tu as bien analysé ces 6 références, puis attends mes prompts.
```

**Sources complémentaires** (facultatives, si l'agent a accès au dépôt ou au vault) :

| Source | Chemin | Apport |
|---|---|---|
| Brief des 6 visuels en service | `_bmad-output/planning-artifacts/brief-gemini-v2-mockups-prebrandes-2026-06-21.md` | Prompts d'origine, à imiter |
| Logo, spec technique | `src/app/components/brand/MagritLogo.tsx` | 18 pétales, dégradés exacts |
| Story de la refonte | `_bmad-output/implementation-artifacts/story-refacto-visuels-2026-08-09.md` | Pourquoi ces 10 manquent |
| Vault — dossier Magrit | `03_MAGRIT/` | Contexte projet. **Ne contient aucune charte visuelle Magrit** |

---

## 4. Les 10 prompts copy-paste

Un bloc = un prompt. Générer **2 à 4 variantes** par prompt, retenir la
meilleure. Ordre indifférent, sauf **A) Brochure** à traiter en premier : c'est
celui qui a échoué, c'est le plus surveillé.

### A) `magrit-brochure.jpg` — Brochures

*Ce qui doit être indubitable : un LIVRET RELIÉ, avec une épaisseur et un dos visibles.*
*À ne surtout pas produire : un dépliant plié, une feuille pliée en trois, un document à plat.*

```
Génère un visuel photo-réaliste carré 1024x1024 d une brochure A4 reliée dos
carré collé, posée sur une surface en béton clair. La brochure est vue en
perspective 3/4 : on voit nettement la COUVERTURE, et surtout la TRANCHE du dos
carré qui révèle une épaisseur d environ 8 mm et l empilement des pages
intérieures. Un second exemplaire, ouvert au milieu à plat derrière le premier,
montre une double page intérieure avec une mise en page éditoriale.

Sur la couverture, imprimé en offset mat de haute qualité :
- au centre haut, une marguerite stylisée à 18 pétales blancs avec un coeur
  dégradé jaune vers orange brun, posée sur une pastille bleu pastel
- sous la marguerite, le mot "Magrit" en italique, police Inter, bleu très
  foncé presque noir (#0F172A), taille proéminente
- sous "Magrit", la tagline "IMPRIMERIE · IA" en capitales espacées, plus
  petite, même bleu foncé en opacité réduite
- en pied de couverture, un fin liseré horizontal jaune orangé (#F5B529)

La double page intérieure visible porte du contenu factice : blocs de texte
gris pâle, un graphique en barres gris bleuté, une image rectangulaire grise.
Aucun logo dans les pages intérieures.

Eclairage studio diffus, ombre portée douce, texture papier mat. Le pli du dos
et l épaisseur du bloc de pages doivent être parfaitement lisibles : c est un
LIVRET RELIE, pas un document plié.
```

### B) `magrit-affiche.jpg` — Affiches

*Ce qui doit être indubitable : le GRAND FORMAT. Un indice d échelle est obligatoire.*
*À ne surtout pas produire : une feuille A5 posée sur un bureau — ce serait un flyer.*

```
Génère un visuel photo-réaliste carré 1024x1024 d une affiche grand format A1
en orientation portrait, fixée à plat sur un mur de galerie en béton clair.
Une seconde affiche du même format, roulée, est appuyée contre le mur au sol,
et une chaise en bois clair est visible en partie basse du cadre : ces éléments
donnent l ECHELLE et rendent évident qu il s agit d un grand format, pas d une
petite feuille.

Sur l affiche, imprimée en quadri haute définition sur papier 170g mat :
- dans le tiers supérieur, une marguerite stylisée à 18 pétales blancs, coeur
  dégradé jaune vers orange brun, sur un aplat bleu pastel dégradé
- au centre, en très grandes lettres, "Magrit" en italique Inter, bleu très
  foncé presque noir (#0F172A)
- sous le titre, la tagline "IMPRIMERIE · IA" en capitales largement espacées
- en pied d affiche, un bandeau horizontal jaune orangé (#F5B529)

Léger relief du papier sur le mur, ombre portée fine sur les bords, lumière
naturelle rasante venant de la gauche. Rendu galerie premium.
```

### C) `magrit-banderole.jpg` — Banderoles / Bâches

*Ce qui doit être indubitable : une BÂCHE SOUPLE très allongée, avec des ŒILLETS métalliques et des ourlets.*

```
Génère un visuel photo-réaliste carré 1024x1024 d une banderole publicitaire en
bâche PVC, format très allongé horizontal (ratio environ 3 mètres sur 1 mètre),
tendue entre deux poteaux en extérieur devant une façade claire légèrement
floue. La bâche présente une très légère ondulation due au vent.

Détails techniques qui doivent être nettement visibles :
- des OEILLETS métalliques ronds sertis régulièrement le long des bords
  supérieur et inférieur, avec les tendeurs qui les traversent
- les ourlets soudés sur tout le pourtour de la bâche
- la matière PVC légèrement satinée, qui accroche la lumière différemment du
  papier

Impression sur la bâche :
- à gauche, une marguerite à 18 pétales blancs, coeur dégradé jaune vers orange
  brun, sur pastille bleu pastel
- au centre, "Magrit" en très grandes lettres italiques Inter, bleu très foncé
  presque noir (#0F172A)
- à droite du titre, la tagline "IMPRIMERIE · IA" en capitales espacées
- le long du bord inférieur, un liseré jaune orangé (#F5B529)

Lumière du jour naturelle, ciel légèrement couvert, ombre portée au sol. Le
graphisme suit l ondulation de la toile.
```

### D) `magrit-drapeau.jpg` — Drapeaux / Beach flags

*Ce qui doit être indubitable : une VOILE VERTICALE sur MÂT, en goutte d eau, avec son pied lesté.*

```
Génère un visuel photo-réaliste carré 1024x1024 d un beach flag (oriflamme
publicitaire) en forme de goutte d eau, monté sur son mât en fibre de verre,
planté dans un pied lesté circulaire noir posé sur un parvis en pierre claire
en extérieur. La voile est légèrement gonflée par le vent, ce qui lui donne une
courbure douce sur toute sa hauteur.

Impression sur la voile en tissu polyester, sublimation haute définition :
- en haut de la voile, une marguerite à 18 pétales blancs avec coeur dégradé
  jaune vers orange brun, sur pastille bleu pastel
- au centre, "Magrit" en grandes lettres italiques Inter, bleu très foncé
  presque noir (#0F172A), le texte épousant la courbure du tissu
- sous le titre, la tagline "IMPRIMERIE · IA" en capitales espacées
- vers le bas de la voile, un bandeau jaune orangé (#F5B529)

Le mât et le pied lesté doivent être nettement visibles pour identifier le
produit. Lumière naturelle de fin de journée, arrière-plan urbain doux et
flou, faible profondeur de champ. Le tissu montre une trame textile fine, pas
un rendu papier.
```

### E) `magrit-panneau.jpg` — Panneaux rigides

*Ce qui doit être indubitable : la RIGIDITÉ et l ÉPAISSEUR du matériau — la tranche doit se voir.*

```
Génère un visuel photo-réaliste carré 1024x1024 de deux panneaux publicitaires
rigides en Dibond (aluminium composite) format rectangulaire, appuyés contre un
mur d atelier gris clair, légèrement en biais l un devant l autre. Le cadrage
met en valeur la TRANCHE des panneaux : on voit distinctement l épaisseur du
matériau, environ 3 mm, et la coupe nette de l aluminium composite sur le
chant. Les angles sont vifs, la surface parfaitement plane et légèrement
satinée, sans aucune ondulation.

Impression directe UV sur le panneau de devant :
- en haut, une marguerite à 18 pétales blancs, coeur dégradé jaune vers orange
  brun, sur pastille bleu pastel
- au centre, "Magrit" en grandes lettres italiques Inter, bleu très foncé
  presque noir (#0F172A)
- dessous, la tagline "IMPRIMERIE · IA" en capitales espacées
- en pied de panneau, un liseré jaune orangé (#F5B529)

Eclairage studio latéral qui révèle la planéité de la surface et fait ressortir
la tranche. Ombre portée nette au sol. Rendu industriel premium.
```

### F) `magrit-adhesif.jpg` — Adhésifs / Vitrophanie

*Ce qui doit être indubitable : de l ADHÉSIF SUR VERRE, avec la transparence de la vitrine.*
*À ne surtout pas produire : une planche de stickers — c est déjà le visuel « Étiquettes ».*

```
Génère un visuel photo-réaliste carré 1024x1024 d une vitrophanie adhésive
appliquée sur la VITRINE VITREE d un commerce, photographiée depuis le
trottoir. On voit clairement qu il s agit d un film adhésif posé sur du verre :
la transparence laisse deviner l intérieur de la boutique en arrière-plan flou,
et un reflet doux de la rue glisse sur la surface vitrée.

Dans le coin inférieur droit, un angle du film est en cours de pose : il est
légèrement soulevé et une raclette de pose en feutre est visible, ce qui montre
sans ambiguïté qu il s agit d un adhésif et non d une impression sur le verre.

Le motif adhésif, en découpe et impression blanche et couleur :
- une marguerite à 18 pétales blancs avec coeur dégradé jaune vers orange brun
- à côté, "Magrit" en grandes lettres italiques Inter, bleu très foncé presque
  noir (#0F172A)
- dessous, la tagline "IMPRIMERIE · IA" en capitales espacées
- une bande jaune orangé (#F5B529) qui court sous le lettrage

Lumière du jour, reflets maîtrisés qui n empêchent pas la lecture du lettrage.
Rendu commerce urbain premium.
```

### G) `magrit-plv.jpg` — PLV / Displays

*Ce qui doit être indubitable : un PRÉSENTOIR EN CARTON AUTOPORTANT, dans un contexte de vente.*

```
Génère un visuel photo-réaliste carré 1024x1024 d un présentoir de comptoir en
carton compact (PLV), autoportant, posé sur le comptoir en bois clair d une
boutique. Le présentoir a une structure en gradins avec deux niveaux de
réceptacles, et un panneau de tête (topper) dressé à l arrière qui dépasse
au-dessus de la structure. On voit la découpe du carton, ses plis de montage et
l épaisseur des cannelures sur les tranches.

Impression quadri sur le carton :
- sur le panneau de tête, une marguerite à 18 pétales blancs avec coeur dégradé
  jaune vers orange brun, sur pastille bleu pastel, puis "Magrit" en italique
  Inter bleu très foncé presque noir (#0F172A), et la tagline "IMPRIMERIE · IA"
  en capitales espacées
- sur la façade du gradin inférieur, un bandeau jaune orangé (#F5B529)

Les réceptacles contiennent quelques dépliants neutres gris pâle sans
marquage. Arrière-plan de boutique doux et flou. Lumière chaude de commerce,
faible profondeur de champ. Rendu retail premium.
```

### H) `magrit-papeterie.jpg` — Papeterie commerciale

*Ce qui doit être indubitable : une SUITE de papeterie de bureau — plusieurs pièces coordonnées.*

```
Génère un visuel photo-réaliste carré 1024x1024 d un ensemble de papeterie
commerciale disposé en flat lay soigné sur un bureau en chêne clair, vu du
dessus à la verticale. L ensemble comprend, disposés avec un léger chevauchement
maîtrisé :
- une feuille de papier à en-tête A4
- une enveloppe blanche format DL posée en biais
- une chemise à rabats fermée, légèrement décalée sous la feuille
- un bloc-notes A5 avec sa bande de collage visible en tête

Chaque pièce porte le même branding, imprimé en offset mat :
- une marguerite à 18 pétales blancs avec coeur dégradé jaune vers orange brun,
  sur pastille bleu pastel
- "Magrit" en italique Inter, bleu très foncé presque noir (#0F172A)
- la tagline "IMPRIMERIE · IA" en capitales espacées
- un fin liseré jaune orangé (#F5B529) en pied de chaque pièce

Le branding est proportionné à chaque support : discret en tête de la feuille
A4, plus présent sur la chemise à rabats. Un stylo noir sobre complète la
composition. Lumière naturelle douce venant du haut à gauche, ombres portées
courtes, texture papier visible. Rendu identité de marque premium.
```

### I) `magrit-calendrier.jpg` — Calendriers

*Ce qui doit être indubitable : une GRILLE DE DATES et une RELIURE SPIRALE.*
*À ne surtout pas produire : une affiche ou une feuille imprimée sans grille de jours.*

```
Génère un visuel photo-réaliste carré 1024x1024 d un calendrier mural à reliure
spirale, format portrait, accroché à un mur de bureau blanc par son crochet.
Le calendrier est ouvert sur une page de mois.

Deux éléments doivent être parfaitement lisibles et non ambigus :
- la RELIURE SPIRALE métallique en haut, avec ses boucles régulières bien
  visibles et la perforation du carton
- la GRILLE DU MOIS dans la moitié basse : 7 colonnes pour les jours de la
  semaine et 5 rangées de cases numérotées, les numéros de jours étant nets et
  réguliers, avec les fins de semaine dans une teinte légèrement différente

La moitié haute de la page porte une image d ambiance douce et le branding,
imprimé en quadri sur papier 250g :
- une marguerite à 18 pétales blancs avec coeur dégradé jaune vers orange brun,
  sur aplat bleu pastel
- "Magrit" en italique Inter, bleu très foncé presque noir (#0F172A)
- la tagline "IMPRIMERIE · IA" en capitales espacées
- un liseré jaune orangé (#F5B529) qui sépare l image de la grille des dates

Les pages des mois suivants apparaissent en léger décalage sous la page
courante, ce qui donne l épaisseur du bloc. Lumière de bureau douce, ombre
portée discrète sur le mur. Rendu produit premium.
```

### J) `magrit-restauration.jpg` — Menus / Restauration

*Ce qui doit être indubitable : un CONTEXTE DE TABLE DE RESTAURANT — menu + set de table.*

```
Génère un visuel photo-réaliste carré 1024x1024 d une table de bistrot dressée,
vue en légère plongée. Sur la table :
- un SET DE TABLE en papier, posé à plat, occupant la largeur du cadre
- posé dessus, un MENU de restaurant au format A4 portrait, en carte rigide
  légèrement satinée, dressé debout appuyé contre un verre, ou posé à plat en
  léger biais
- un couvert simple et un verre à eau complètent la scène, en arrière-plan
  légèrement flou

Le menu porte, imprimé en quadri sur carte 350g :
- en tête, une marguerite à 18 pétales blancs avec coeur dégradé jaune vers
  orange brun, sur pastille bleu pastel
- sous la marguerite, "Magrit" en italique Inter, bleu très foncé presque noir
  (#0F172A)
- la tagline "IMPRIMERIE · IA" en capitales espacées
- une liste de plats factice en deux colonnes, texte gris pâle non lisible,
  avec des filets de séparation fins
- un liseré jaune orangé (#F5B529) en pied de menu

Le set de table reprend discrètement la marguerite et un liseré jaune orangé
sur son bord. Lumière chaude de fin de journée venant d une fenêtre latérale,
faible profondeur de champ, nappe en tissu clair. Rendu restauration premium.
```

---

## 5. Nommage et livraison

**Nommer chaque fichier exactement ainsi** — le nom porte le *slug* de la gamme,
c'est lui qui relie l'image au PIM :

| Famille (PIM) | Fichier attendu |
|---|---|
| Brochures | `magrit-brochure.jpg` |
| Affiches | `magrit-affiche.jpg` |
| Banderoles / Bâches | `magrit-banderole.jpg` |
| Drapeaux / Beach flags | `magrit-drapeau.jpg` |
| Panneaux rigides | `magrit-panneau.jpg` |
| Adhésifs / Vitrophanie | `magrit-adhesif.jpg` |
| PLV / Displays | `magrit-plv.jpg` |
| Papeterie commerciale | `magrit-papeterie.jpg` |
| Calendriers | `magrit-calendrier.jpg` |
| Menus / Restauration | `magrit-restauration.jpg` |

**Où les déposer** : `public/visuels-produits/` du dépôt Magrit, à côté des 6
existants. Peu importe la dimension et le poids en sortie de Gemini — je
recadre, redimensionne en 1024×1024 et compresse.

**Puis me notifier « visuels gammes prêts ».** Je prends la suite :
compression, dépôt, migration de mise à jour des `image_url`, recette visuelle
sur la boutique, commit.

---

## 6. Critères d'acceptation

À vérifier sur chaque image **avant** de la retenir :

| # | Contrôle |
|---|---|
| 1 | **La famille est reconnaissable sans légende** — c'est le critère n°1, celui qui a été manqué sur la brochure |
| 2 | Le marqueur distinctif de la famille est présent et net (dos carré, œillets, spirale + grille de dates, tranche du panneau, raclette sur le verre…) |
| 3 | La marguerite a bien **18 pétales blancs** et un cœur dégradé jaune → orange |
| 4 | « Magrit » est en **italique**, bleu très foncé, **correctement orthographié** |
| 5 | La tagline « IMPRIMERIE · IA » est présente, lisible et correcte |
| 6 | Le branding suit la **perspective et la courbure** du support |
| 7 | L'éclairage du branding correspond à celui de la scène (pas d'effet « collé ») |
| 8 | L'image tient dans la collection des 6 existants — même DA, même qualité |

⚠️ **Hallucination de texte.** Les générateurs se trompent régulièrement sur les
lettres. Vérifier au zoom que c'est bien **« Magrit »** — pas « Margrit »,
« Magrid » ou « Marigt » — et **« IMPRIMERIE · IA »** — pas « IMPRIMERIE · LA ».
Une image parfaite avec un logo mal orthographié est à jeter.

⚠️ **Le piège des grands formats.** Affiche, banderole, drapeau, panneau et PLV
n'existent qu'à l'échelle : sans indice de taille dans la scène (mur, mobilier,
poteaux, sol, comptoir), une affiche A1 se lit comme un flyer A5. Si la variante
générée ne « fait pas grand », la rejeter même si elle est belle.

---

## 7. Spec interne (côté Claude Code, pour mémoire)

*Cette section ne sert pas à Gemini.*

- **Chaîne de résolution** : `produit > définition PIM > gamme > ancêtres (parent_slug) > null`.
  Ces 10 fichiers alimentent le niveau **gamme racine** ; les 50+ sous-gammes en
  héritent automatiquement. Aucune sous-gamme ne doit être seedée.
- **Mise à jour** : migration `update public.product_gammes set image_url = ...`
  sur le modèle de `20260809000100_gamme_visuals.sql`, idempotente (n'écrase que
  les valeurs vides, ne perd jamais une curation admin).
- **URL** : `/visuels-produits/<fichier>` — chemin public stable. Ne jamais
  référencer un asset importé depuis `src/` dans `image_url` : Vite le hache au
  build, la valeur en base serait invalide au build suivant.
- **Contrôle après migration** : le bandeau en tête de `/dashboard/admin/pim`
  doit afficher **16/16 familles couvertes** et ne plus lister aucune famille
  manquante.
- **Dette non traitée par ce brief** : `shop_template_mockups` (visuels
  téléversés par boutique) reste clé sur les 7 anciennes familles « mockup » au
  lieu des 16 gammes racines. Une boutique ne peut donc pas encore surcharger le
  visuel d'un calendrier ou d'un panneau.
