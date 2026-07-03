# Magrit — Visuels produits ProductCard (handoff Claude Code)

Visuels produits **finis, branding Magrit intégré**, à afficher dans les cards produit de la boutique.
Plus de génération de template à la volée : ce sont des **illustrations fixes**, une par famille de produit.

## Provenance

Découpés depuis la planche de référence livrée `uploads/Gemini_Generated_Image_.png`
(contact sheet 1408×768, 7 cellules). **Seuls les titres** (« Carte de visite », « Flyer »…)
**et les références** (« Ref: … ») ont été effacés, fond reconstruit par échantillonnage du fond
adjacent. **Le produit lui-même n'est pas retouché** — chaque visuel est seul sur son fond.

## Assets (`product-cards/`)

| Produit | Fichier | Dim. (px) |
|---|---|---|
| Carte de visite | `magrit-carte-visite.jpg` | 452×368 |
| Flyer | `magrit-flyer.jpg` | 455×368 |
| Brochure | `magrit-brochure.jpg` | 454×368 |
| Dépliant | `magrit-depliant.jpg` | 452×368 |
| Étiquette | `magrit-etiquette.jpg` | 246×368 |
| Kakémono | `magrit-kakemono.jpg` | 199×368 |
| Packaging | `magrit-packaging.jpg` | 454×368 |

Le mapping **kind Clariprint → asset** est dans `manifest.json` (clé `kinds` par produit, plus `fallback`).

## Intégration suggérée

1. Copier le dossier `product-cards/` dans les assets statiques du front (ex. `public/products/` ou `src/assets/products/`).
2. Dans `src/app/components/shop/ShopProductCard.helpers.ts`, dériver l'asset depuis le `kind` produit
   (réutiliser la logique `KIND_TO_TEMPLATE` / `inferTemplateFromText` : même clés, valeur = chemin du PNG).
3. `ShopProductCard.tsx` : afficher l'image en `object-fit: contain` sur fond clair. Les cellules incluent
   déjà leur fond gris doux et leur ombre — un fond de card neutre (#F5F5F2 → #FFFFFF) s'accorde bien.
4. `fallback` (`magrit-flyer.jpg`) pour tout `kind` non mappé.

```ts
// exemple de résolution
import manifest from "@/assets/products/manifest.json";

const KIND_TO_ASSET: Record<string, string> = Object.fromEntries(
  manifest.products.flatMap((p) => p.kinds.map((k) => [k, p.asset]))
);

export function productImage(kind: string): string {
  const file = KIND_TO_ASSET[kind] ?? manifest.fallback;
  return `/products/${file}`;
}
```

## Notes

- **Titres et références effacés** : le produit (mockup + branding Magrit) est intact, seul sur son fond.
- Le fond conserve la teinte/ombre douce d'origine de chaque cellule — pose-les sur un fond de card clair.
- Aucune dépendance externe : ce sont des PNG sRGB autonomes.
