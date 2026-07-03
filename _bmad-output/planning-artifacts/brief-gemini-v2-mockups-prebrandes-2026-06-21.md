# Brief Gemini v2 — 7 mockups vitrine Magrit PRÉ-BRANDÉS (P18)

> **Émetteur** : Arnaud Mazon (PDG AGE Dvt., porteur Magrit IA)
> **Date** : 2026-06-21
> **Destinataire** : Gemini (Imagen 3 / Gemini Generate)
> **Objectif** : produire 7 PNG photo-réalistes avec le branding Magrit DÉJÀ INTÉGRÉ dans le visuel (perspective + éclairage cohérents avec le produit)

---

## 1. Pourquoi cette v2 ?

La v1 fonctionnait techniquement (visuels Gemini photo-réalistes + overlay SVG par-dessus) mais le résultat était **plat et collé** : le branding overlay ne respectait pas la perspective du produit, ne suivait pas l'éclairage de la scène, et apparaissait comme un sticker Photoshop par-dessus la photo.

**Nouvelle approche** : tu intègres le branding Magrit **directement dans le visuel généré**, avec perspective et lighting cohérents. L'edge function se contente ensuite de servir les 7 PNG figés en proxy + cache. Plus de compositing dynamique, plus de personnalisation par tenant — c'est une **vitrine vendeur Magrit**, identique pour toutes les boutiques B2B.

---

## 2. Identité visuelle Magrit (à reproduire fidèlement)

### Logo "La Marguerite"

- **18 pétales blancs** disposés en cercle (ellipses fines)
- **Cœur central jaune/orange** (radial gradient : centre jaune clair `#FFE066` → mid orange `#F5B529` → outer brun `#C68708`)
- Variante "lockup" : marguerite **dans un tile bleu pastel arrondi** (gradient `#E5F0FC → #B7D3F2`)

### Typographie

- **"Magrit"** : italic, font Inter, weight 500-600, couleur slate-900 `#0F172A`, letter-spacing très serré
- **Tagline** : `IMPRIMERIE · IA` en uppercase, font Inter, weight 400-500, letter-spacing aéré 0.08em, couleur slate-900 opacity 0.6-0.7

### Couleurs canoniques

| Token | Hex | Usage |
|---|---|---|
| Tile bleu pastel start | `#E5F0FC` | Gradient tile clair |
| Tile bleu pastel end | `#B7D3F2` | Gradient tile fonce |
| Pollen jaune clair | `#FFE066` | Cœur marguerite |
| Pollen jaune mid | `#F5B529` | Liseré accent / cœur mid |
| Pollen jaune sombre | `#C68708` | Cœur outer |
| Ink slate-900 | `#0F172A` | Texte principal |
| Pétales blanc | `#FFFFFF` | Pétales marguerite |

### Liseré pollen accent

- **Bandeau jaune `#F5B529`** souvent présent comme accent visuel (bordure horizontale, base d'un kakémono, etc.) — épaisseur 8-12px

### Direction artistique

- **Photo-réaliste** : éclairage studio doux, ombres naturelles, profondeur de champ
- **Premium pro** : pas de couleurs criardes, pas de gradients flashy, pas d'effets cartoon
- **Branding "imprimé"** : le logo + le texte sur le produit doivent ressembler à une vraie impression (encre sur papier, gravure sur kraft), pas à un calque numérique
- **Cohérence inter-images** : même lighting, même qualité, même direction artistique pour les 7

---

## 3. Specs communes aux 7 PNG

| Spec | Valeur |
|---|---|
| **Dimensions** | 1024×1024 px (carré) — Gemini peut générer en 2048×2048 puis on rescale |
| **Format** | PNG |
| **Poids cible** | ≤ 500 Ko après compression (on le fera côté Claude au pipeline) |
| **Style** | Photo-réaliste, lighting studio, depth of field |
| **Background** | Surface élégante (marbre clair, bois clair, béton clair, tissu beige, sol studio) selon produit |
| **Branding** | Magrit COMPLET et LISIBLE, intégré au produit avec perspective + lighting cohérents |

---

## 4. Les 7 prompts Gemini copy-paste

Copier chaque bloc entre les ``` dans Gemini Generate (l'un après l'autre, ou en parallèle). Demande à Gemini de produire 2-4 variantes par prompt et sélectionne la meilleure.

### A) `bg-carteVisite.png` — Carte de visite

```
Génère un visuel photo-réaliste 1024x1024 représentant une pile de cartes de visite professionnelles posées sur une surface en marbre blanc clair. La carte du dessus, légèrement décalée, montre le branding suivant imprimé en haute qualité :

- Au centre haut : un logo en forme de marguerite stylisée à 18 pétales blancs avec un cœur central jaune-orange dégradé (radial gradient du jaune clair vers l'orange brun)
- Sous la marguerite : le mot "Magrit" écrit en italique, police Inter, couleur bleu foncé presque noir (#0F172A), taille proéminente
- Sous "Magrit" : la tagline "IMPRIMERIE · IA" en lettres capitales, espacement aéré, plus petite, couleur même bleu foncé en opacity réduite
- En bas de la carte, sur deux lignes : "email@magrit.io" et "+33 5 56 00 00 00" en petits caractères discrets
- En bas à droite, ultra-discret : la référence "CV-MAGRIT-85-55"

Format de la carte : 85×55mm, perspective top-down 3/4, lumière naturelle douce venant de la gauche, légère ombre portée sous la pile. Style premium minimaliste, qualité commerciale type Smartmockups.
```

### B) `bg-flyer.png` — Flyer A5

```
Génère un visuel photo-réaliste 1024x1024 d'un flyer A5 portrait posé à plat sur un bureau en bois clair. Le flyer affiche le branding Magrit imprimé en haute qualité :

- Bandeau supérieur 30% : fond bleu pastel dégradé (du #E5F0FC en haut au #B7D3F2 en bas) avec au centre la marguerite Magrit blanche à 18 pétales et cœur jaune-orange, puis "Magrit" en italique Inter taille importante, et la tagline "IMPRIMERIE · IA" en capitales espacées
- Corps central blanc avec mock content : un rectangle gris-clair simulant une image produit, suivi de 4 lignes de texte placeholder gris pâle
- Bas du flyer : un fin liseré horizontal jaune-orange (#F5B529) puis "Flyer A5 Magrit" en référence discrète

Format flyer A5 portrait, légèrement de biais (perspective top-down 15°), texture papier mat visible, lumière chaude douce venant du haut. Style scandinave minimaliste, qualité premium.
```

### C) `bg-brochure.png` — Brochure A4

```
Génère un visuel photo-réaliste 1024x1024 d'une brochure A4 dépliée à plat sur une surface en béton clair, montrant 3 panneaux ouverts (intérieur + couverture face avant repliée sur le côté droit). Le branding Magrit est imprimé en haute qualité sur les panneaux :

- Panneaux intérieurs gauche et centre : mise en page éditoriale avec mock content : graphiques barres et lignes en gris-bleu, blocs visuels gris-clair (#F1F5F9), 4-5 lignes de texte placeholder gris (#E2E8F0). Pas de marquage Magrit dans les panneaux intérieurs.
- Couverture face avant (panneau droit ou bloc séparé visible) : fond blanc avec au centre la marguerite Magrit blanche à 18 pétales sur tile bleu pastel circulaire, puis "Magrit" en italique Inter, et la tagline "IMPRIMERIE · IA" en capitales. En bas de la couverture, un fin liseré jaune-orange (#F5B529).

Format A4, perspective 3/4 légèrement de biais, lumière studio diffuse, ombre portée douce. Style éditorial premium, qualité commerciale type Placeit.
```

### D) `bg-depliant.png` — Dépliant 3 volets plié en 2

```
Génère un visuel photo-réaliste 1024x1024 d'un dépliant 3 volets format A4 partiellement plié en deux sur un fond de tissu beige texturé, avec 2 panneaux visibles côte à côte (volet central + volet droit). Le branding Magrit est imprimé en haute qualité :

- Volet gauche (visible) : fond bleu pastel dégradé tile Magrit, avec au centre la marguerite blanche 18 pétales et cœur jaune-orange, puis "Magrit" en italique Inter en taille moyenne, et tagline "IMPRIMERIE · IA"
- Volet droit (visible) : fond blanc avec mock content : 3-4 lignes de texte placeholder gris pâle, et un bandeau jaune-orange (#F5B529) accent en bas

Format A4 plié en 2 visible en 3/4 perspective, lumière naturelle douce, ombre portée. Texture papier mat, qualité premium impression offset.
```

### E) `bg-etiquette.png` — Planche d'étiquettes rondes

```
Génère un visuel photo-réaliste 1024x1024 d'une planche de 12 étiquettes adhésives rondes de 40mm de diamètre disposées en grille 3 colonnes × 4 rangées sur un fond gris-clair. Une étiquette du coin bas-droite est partiellement décollée pour révéler le backing paper.

Chaque étiquette ronde affiche le branding Magrit imprimé en haute qualité :

- Au centre : la marguerite Magrit blanche à 18 pétales sur fond légèrement bleu pastel
- Sous la marguerite : "MAGRIT" en lettres capitales serrées
- Au-dessus de la marguerite : "STICKER" en très petites capitales discrètes

L'impression sur chaque sticker doit être petite mais nette et lisible. Format planche A4 verticale, vue top-down légèrement de biais, lumière studio douce, le sticker décollé montre la profondeur 3D. Style premium impression numérique.
```

### F) `bg-kakemono.png` — Roll-up

```
Génère un visuel photo-réaliste 1024x1024 d'un roll-up vertical (kakémono) déployé devant un mur de studio en béton gris clair, base aluminium polie visible au sol. Le roll-up affiche le branding Magrit imprimé en haute qualité :

- En haut du roll-up : la marguerite Magrit blanche 18 pétales avec cœur jaune-orange, sur fond bleu pastel circulaire
- Au centre du roll-up, occupant une large portion : "Magrit" écrit en très grandes lettres italiques bleu foncé presque noir (#0F172A), Inter italic weight 600
- Sous "Magrit" : la tagline "IMPRIMERIE · IA" en lettres capitales aérées de taille moyenne
- Tout en bas du roll-up, avant la base alu : un bandeau jaune-orange (#F5B529) accent horizontal

Format très vertical (ratio 850×2000mm), lumière naturelle venant d'une fenêtre à gauche, ombre portée au sol. Style trade show premium professionnel.
```

### G) `bg-packaging.png` — Boîte kraft d'expédition

```
Génère un visuel photo-réaliste 1024x1024 d'une boîte kraft d'expédition ouverte avec les rabats du haut relevés, posée en perspective 3/4 sur un fond studio blanc cassé. La face avant kraft (couleur naturelle carton brun clair) affiche le branding Magrit imprimé en haute qualité par impression sur kraft :

- Au centre de la face avant : la marguerite Magrit blanche à 18 pétales avec cœur jaune-orange (dans un médaillon circulaire bleu pastel pour faire ressortir les pétales blancs sur le kraft brun)
- Sous le médaillon : "Magrit" en italique Inter weight 500-600, taille proéminente, couleur bleu foncé presque noir
- Sous "Magrit" : la tagline "IMPRIMERIE · IA" en lettres capitales espacées
- En bas de la face avant : un bandeau jaune-orange (#F5B529) accent

L'impression sur le kraft doit ressembler à une vraie impression sur carton (légère absorption, pas brillant). Boîte kraft format e-commerce premium, vue 3/4, lumière chaude douce, ombre portée naturelle, depth of field.
```

---

## 5. Critères d'acceptation

Pour chaque PNG, vérifier visuellement que :

1. ✅ Le branding Magrit est **clairement lisible** sans zoomer
2. ✅ Le branding suit la **perspective du produit** (incliné si la carte est inclinée, plié si la brochure est pliée)
3. ✅ L'éclairage du branding match l'éclairage de la scène (pas de "flatness")
4. ✅ La marguerite a bien **18 pétales blancs** + cœur jaune-orange
5. ✅ "Magrit" est en italique, couleur ink slate-900
6. ✅ La tagline "IMPRIMERIE · IA" est présente et lisible
7. ✅ Pas de fautes d'orthographe sur les textes (Gemini peut halluciner sur le texte)
8. ✅ Cohérence visuelle entre les 7 (même qualité, même direction artistique)

⚠️ **Attention texte Gemini** : les générateurs d'images peuvent halluciner les textes. Vérifier que "Magrit" est bien orthographié, pas "Margrit" ou "Marigt", et que "IMPRIMERIE · IA" est correct, pas "IMPRIMERIE · LA" ou autre déformation. Si Gemini se trompe, regénérer avec un prompt plus précis.

---

## 6. Workflow de livraison

1. Tu colles les 7 prompts dans Gemini, génère 2-4 variantes par prompt, sélectionne la meilleure de chaque
2. Tu télécharges les 7 PNG (peu importe la dimension cible, je rescale + compresse)
3. Tu places les 7 fichiers dans `src/assets/templates/v2/` (à créer)
4. Nomenclature : `bg-{template}.png` identique à v1 :
   - `bg-carteVisite.png`
   - `bg-flyer.png`
   - `bg-brochure.png`
   - `bg-depliant.png`
   - `bg-etiquette.png`
   - `bg-kakemono.png`
   - `bg-packaging.png`
5. Tu me notifies "P18 v2 source PNG prêts"
6. Je :
   - Compresse → 1024×1024 JPG quality 85 (cible ≤ 200 Ko/fichier)
   - Upload bucket Supabase `mockup_templates_v2/`
   - Refonds l'edge function en mode proxy + cache (retourne directement le PNG fixe selon `template`)
   - Cache bump `_v8 → _v9`
   - Adapte les UI catalog si nécessaire
   - Smoke + deploy + commit

---

## 7. Architecture cible côté code

Une fois les 7 PNG livrés, l'edge function devient un simple proxy :

```typescript
// supabase/functions/mockup-generator/index.ts (P18 v2)
const TEMPLATE_BUCKET = "mockup_templates_v2";

async function handleGenerate(url: URL): Promise<Response> {
  const template = url.searchParams.get("template");
  if (!template || !SUPPORTED_TEMPLATES.includes(template)) {
    return jsonResponse({ error: "unsupported_template" }, 400);
  }
  // Redirect direct vers le bucket public (CDN Supabase fait le cache)
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${TEMPLATE_BUCKET}/bg-${template}.jpg`;
  return Response.redirect(publicUrl, 302);
}
```

Plus simple, plus rapide (zero rendering), zero coût compute.

---

## 8. Compromis acceptés par Arnaud (2026-06-21)

- ❌ **Plus de personnalisation par tenant** : tous les tenants Magrit (Manitou, ERAM, Groupe ICI, etc.) verront les mêmes 7 mockups vitrine
- ❌ **Plus d'affichage `productName` dans le mockup** : le nom du produit est affiché en titre HTML au-dessus de la card, pas dans l'image
- ❌ **Plus d'utilisation de `primaryColor`** dans le mockup (sera utilisé ailleurs sur la card si pertinent)
- ✅ **Visuel parfait conforme moodboard** : photo-réaliste avec branding intégré naturellement
- ✅ **Latence < 50ms** : pas de rendering, juste fetch fichier statique CDN
- ✅ **Zero coût compute** : pas de resvg-wasm, pas de génération à la volée
- ✅ **Cohérence garantie** : 7 PNG figés validés une fois par Arnaud, identiques pour tous

---

## Annexe — Pourquoi v1 ne marchait pas

Récap diagnostique 2026-06-21 :

L'approche v1 (compositing PNG photo-réaliste de base + SVG overlay branding Magrit par-dessus via resvg-wasm) produisait un résultat **plat** car :

1. Le SVG overlay reste **rectangulaire et droit** alors que les produits dans les photos sont en perspective (cartes inclinées, boîte en 3/4, brochure pliée)
2. Le SVG overlay est **uniforme** alors que la photo a un éclairage directionnel et des ombres
3. La transparence du médaillon bleu pastel ne s'intègre pas au texture (marbre, kraft, bois) sous le branding

Conclusion : le compositing 2D plat ne peut pas reproduire une vraie impression physique sur produit. Il faudrait un smart object warp (Photoshop / Placeit API) qui dépasse le scope du projet pour les bénéfices visuels.

→ Le pivot v2 = laisser Gemini intégrer le branding dans le visuel généré (Gemini sait gérer perspective + lighting parce qu'il génère le tout en une passe), et l'edge function devient un simple proxy.
