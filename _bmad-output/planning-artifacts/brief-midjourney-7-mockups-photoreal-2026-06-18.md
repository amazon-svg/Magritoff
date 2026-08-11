# Brief Midjourney/Placeit — 7 PNG photo-réalistes pour P18 (compositing)

> **Émetteur** : Arnaud Mazon (PDG AGE Dvt., porteur Magrit IA)
> **Date** : 2026-06-18
> **Destinataire** : générateur d'images (Midjourney v6 / Imagen 3 / Flux / ou outil Placeit / Smartmockups)
> **Objectif** : produire 7 PNG photo-réalistes "templates vides" servant de fond au compositing P18

---

## 1. Contexte technique

Magrit refond complètement son approche mockup en P18 : on abandonne le SVG vectoriel stylisé (P15→P17) au profit d'un **compositing PNG photo-réaliste + SVG overlay dynamique**.

L'edge function `mockup-generator` va :
1. Fetch un PNG photo-réaliste de base depuis le bucket Supabase (= **ce que tu vas produire**)
2. Générer un SVG overlay personnalisé (`Magrit` italic + marguerite + tagline + `productName`)
3. Composer les 2 via resvg-wasm et retourner le PNG composite

Tu dois donc produire **7 PNG photo-réalistes "vides"** où la zone d'impression du produit est visible mais **vierge** (sans marquage Magrit). Le branding sera incrusté dynamiquement par l'edge function en overlay SVG.

---

## 2. Specs communes aux 7 PNG

| Spec | Valeur |
|---|---|
| **Dimensions** | 1024×1024 px (carré, cohérent avec viewBox edge function) |
| **Format** | PNG RGBA (transparence non requise mais OK) |
| **Poids cible** | ≤ 500 Ko par fichier (compresser via TinyPNG/Squoosh si > 500 Ko) |
| **Style** | Photo-réaliste, light pro, **sans branding** sur la zone d'impression |
| **Cohérence** | Même direction artistique entre les 7 (lighting, palette, ambiance) |
| **Fond contextuel** | Pro/élégant (surface bois, marbre, béton clair, surface blanche brillante, etc.) — pas de fond uni plat |
| **Zone d'impression** | Repérable, plate ou perspective simple, **vide** (blanche ou tonalité crème uniforme) |

⚠️ **Crucial** : la zone où le branding s'incrustera dynamiquement doit être :
- **Plate** (pas de pli, pas d'angle complexe — sinon overlay SVG aura l'air collé)
- **Uniforme** (pas de motifs, texture forte, dégradé complexe — sinon le branding sera illisible)
- **Identifiable visuellement** (Arnaud me les indiquera après réception via coordonnées x/y/w/h)

---

## 3. Les 7 prompts Midjourney v6 (copy-paste)

Tu peux les jouer dans Midjourney avec `--ar 1:1 --v 6 --style raw --q 2`. Génère 4 variantes par prompt, sélectionne la meilleure.

### A) `carteVisite`

```
Stack of professional business cards on a clean white marble surface, soft natural lighting from the left, slight shadow under the stack, top card slightly angled showing a blank white front (no branding visible), 85x55mm format, photorealistic product mockup, premium feel, minimalist composition, top-down 3/4 angle view, depth of field --ar 1:1 --v 6 --style raw --q 2
```

### B) `flyer`

```
Single A5 portrait flyer laying flat on a light wooden desk surface, blank white front (no logo, no text), soft warm lighting from above, subtle paper texture visible, minimalist scandinavian style, top-down view slightly angled, photorealistic stationery mockup, premium paper quality, very clean blank canvas --ar 1:1 --v 6 --style raw --q 2
```

### C) `brochure`

```
Open A4 brochure with 3 panels visible, laying flat on a clean concrete surface, blank white pages (no text, no graphics), soft diffused studio lighting, slight perspective from above, photorealistic print product mockup, premium matte paper feel, minimalist composition, ample negative space around --ar 1:1 --v 6 --style raw --q 2
```

### D) `depliant`

```
Tri-fold leaflet partially opened showing 3 panels, on a soft beige fabric background, blank white panels (completely vierge), soft natural light, photorealistic product mockup, premium folded brochure, slight 3D perspective, depth of field, minimalist aesthetic --ar 1:1 --v 6 --style raw --q 2
```

### E) `etiquette`

```
Sheet of 12 round adhesive stickers 40mm diameter on white backing paper, one sticker peeling off at the corner, photorealistic die-cut stickers mockup, all stickers completely blank white (no logo, no text), soft studio lighting, top-down view, premium adhesive label product --ar 1:1 --v 6 --style raw --q 2
```

### F) `kakemono`

```
Vertical roll-up banner standing on a polished concrete floor, against a soft gray studio wall, blank white banner fabric (no text, no logo, no branding), aluminum base visible, soft natural lighting from a window on the left, photorealistic trade show display mockup, 850x2000mm proportions, premium professional setup --ar 1:1 --v 6 --style raw --q 2
```

### G) `packaging`

```
Open kraft cardboard shipping box with flaps lifted, photographed in 3/4 perspective view, on a white studio surface, blank kraft cardboard color (no logo, no labels on the front face), soft warm lighting, photorealistic packaging mockup, premium e-commerce shipping box, clean composition, depth of field --ar 1:1 --v 6 --style raw --q 2
```

---

## 4. Alternative Placeit/Smartmockups (recommandée pour précision)

Si tu préfères des templates "smart object" avec zone d'impression précisément cadrée :

| Plateforme | Avantages | Inconvénients |
|---|---|---|
| **Placeit** | 30 000+ templates, zone smart object precise, $14.95/mois | Catalogue généraliste, branding Magrit à incruster une seule fois puis exporter |
| **Smartmockups** | Intégration avec Canva, $9/mois | Moins de templates packaging/banderole |
| **Dynamic Mockups** | API REST, à partir de $19/mois | Coût récurrent, peu de mockups packaging |
| **Mediamodifier** | Bibliothèque PSD téléchargeable | Workflow PSD = pas d'automatisation |

→ **Recommandation** : Placeit (1 mois d'abonnement = ~15$) pour générer les 7 mockups proprement, exporter en PNG 1024×1024, puis on upload dans le bucket Supabase.

---

## 5. Coordonnées zone d'impression (à valider après réception)

Une fois les 7 PNG en main, on devra définir pour chacun la **printable area** = le rectangle (ou polygone) où l'edge function va incruster le branding Magrit dynamique.

Format que je vais stocker :

```typescript
interface PrintableArea {
  x: number;        // coin haut-gauche zone, en px sur PNG 1024
  y: number;
  width: number;
  height: number;
  rotation?: number;   // si l'objet est en perspective (degrés)
  perspective?: 'none' | 'top-down' | 'tilted-right' | 'tilted-left';
}
```

Exemple cible pour la `carteVisite` (à valider visuellement) :
```typescript
carteVisite: { x: 250, y: 380, width: 480, height: 290, perspective: 'top-down' }
```

→ Une fois les 7 PNG livrés, je te montrerai un calque visuel pour chaque PNG avec la zone proposée, et tu valideras visuellement (ou ajusteras à la souris).

---

## 6. Workflow de livraison

1. Tu génères les 7 PNG via Midjourney **OU** Placeit
2. Tu places les 7 fichiers dans `.design-handoff/p18-source/` (à créer)
3. Nomenclature : `bg-{template}.png` (`bg-carteVisite.png`, `bg-flyer.png`, etc.)
4. Tu me notifies "P18 source PNG prêts"
5. Je :
   - Upload les 7 PNG dans le bucket Supabase `mockup_templates_bg/`
   - Définis les coordonnées zone d'impression par calque (te montre 7 PNG annotés)
   - Tu valides ou ajustes
   - Je refonds l'edge function en mode compositing
   - Smoke + deploy + push P18

---

## 7. Annexe — Pourquoi pas tout fait à l'IA en backend ?

Tentation : utiliser Imagen 3 / Flux à la volée dans l'edge function pour générer un mockup par produit. Pourquoi on **n'a pas choisi** cette voie :

- **Coût** : ~0.04$/image × milliers de produits/jour = facture mensuelle élevée
- **Latence** : 5-30s par génération = mauvaise UX (les cards boutique doivent être instantanées)
- **Reproductibilité** : Midjourney/Imagen produisent différemment à chaque appel → cohérence visuelle non garantie
- **Qualité** : un PNG validé par Arnaud est meilleur qu'un PNG aléatoire IA non-revu

→ Le compositing **fond fixe + overlay personnalisé** est le bon compromis : cohérence garantie + personnalisation tenant + coût compute négligeable + latence < 1s.

---

## Annexe technique — preuve de concept resvg-wasm validée 2026-06-18

J'ai vérifié que resvg-wasm 2.6.2 sait composer un PNG inline base64 sous un overlay SVG avec opacity. Cf. `/tmp/test-resvg-image-inline.png` (carré jaune = PNG de base, carré bleu transparent = overlay). Le compositing fonctionne, on garde la stack.
