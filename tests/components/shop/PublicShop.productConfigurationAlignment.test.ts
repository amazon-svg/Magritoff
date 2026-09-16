/**
 * BCP-10 (docs/api/CONVENTIONS.md §8.25 point 3.5) — alignement des deux
 * parcours de configuration produit.
 *
 * Défaut corrigé : `PortalProduct.tsx:446` passait `selectedOpts` en
 * troisième argument à `onAddToCart`, mais `addToCart(product, qty = 1)`
 * (`PublicShop.tsx:176`) n'avait que deux paramètres — la sélection de la
 * fiche produit était silencieusement jetée. Le correctif retire le
 * troisième argument (et tout ce qui le produisait) au lieu d'en ajouter un
 * quatrième : le compilateur garantit alors la non-régression (point (f)).
 *
 * Ces tests suivent le pattern déjà en usage dans ce dossier
 * (PublicShop.submitCart.test.ts) : assertions texte sur les fichiers
 * sources, pour une classe de défaut (câblage entre composants, signature de
 * callback) qu'un test de rendu isolé ne verrait pas plus sûrement.
 *
 * BCP-11 (docs/api/CONVENTIONS.md §8.25 point 3.6) — deux assertions ci-dessous
 * ont été mises à jour pour suivre la nouvelle forme de `addToCart` et
 * `handleOverlayConfirm` : la conversion exemplaires → paquet ne s'écrit plus
 * en littéral ici, elle passe par le point unique `toPackLine`
 * (`orders/ui/storefront/cartLine.ts`). L'INTENTION des tests d'origine
 * (QA-M9 : la quantité choisie par l'acheteur, pas une valeur périmée ;
 * QA-M11 : jamais un nombre d'exemplaires nu en second argument d'`addToCart` ;
 * D2 : le câblage appelle le gestionnaire réel, pas un wrapper qui jette
 * l'argument) est préservée, sous une forme qui suit la nouvelle signature.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../../..');
const read = (relPath: string) => readFileSync(resolve(root, relPath), 'utf-8');

describe('BCP-10 — la fiche produit ne configure, ne chiffre et n ajoute plus rien elle-même', () => {
  it("PortalProduct n'a plus de bloc d'options mort (listes en dur, chiffrage propre)", () => {
    const src = read('src/modules/catalog/ui/storefront/PortalProduct.tsx');

    // Les trois listes écrites en dur (point (c)).
    expect(src).not.toMatch(/paperOptions/);
    expect(src).not.toMatch(/finishOptions/);
    expect(src).not.toMatch(/cornerOptions/);
    // La valeur inventée qui n'existe dans aucun vocabulaire Clariprint réel.
    expect(src).not.toMatch(/Soft touch/);
    // Le chiffrage et la mise à l'échelle propres à la fiche (point (g)).
    expect(src).not.toMatch(/calculatePrice/);
    expect(src).not.toMatch(/qty\s*\/\s*500/);
    expect(src).not.toMatch(/computeClariprintQuoteSafe/);
    // Le sélecteur de quantité éditable disparaît avec le configurateur.
    expect(src).not.toMatch(/setQty/);
  });

  it("le troisième argument d'onAddToCart a disparu — pas remplacé par un quatrième", () => {
    const src = read('src/modules/catalog/ui/storefront/PortalProduct.tsx');

    // Le défaut exact du rapport : une sélection en objet, jetée par le récepteur.
    expect(src).not.toMatch(/opts:\s*Record<string,\s*string>/);
    expect(src).not.toMatch(/selectedOpts/);
    // La fiche n'ajoute plus au panier : elle ouvre la surcouche.
    expect(src).not.toMatch(/onAddToCart/);
    expect(src).toMatch(/onConfigure:\s*\(product:\s*ShopProduct\)\s*=>\s*void/);
    expect(src).toMatch(/onConfigure\(product\)/);
  });

  it("addToCart garde EXACTEMENT sa signature à deux paramètres (point (f), forme BCP-11 round 2)", () => {
    const src = read('src/modules/shops/ui/storefront/PublicShop.tsx');

    // BCP-11 (docs/api/CONVENTIONS.md §8.25 point 3.6) : le second paramètre
    // est désormais un PackCount typé (jamais un nombre nu) — mais la forme
    // à DEUX paramètres, elle, ne bouge pas : aucun troisième paramètre, ni
    // ajouté ni réintroduit. Round 2 (qa-review, défaut 5) : la signature
    // est portée par le type exporté `AddToCartFn` (pour que
    // `PublicShop.typecheck.ts` teste le contrat sans code mort dans le
    // composant), donc le littéral de type inline a disparu de la
    // déclaration elle-même — c'est `AddToCartFn` qui doit garder EXACTEMENT
    // deux paramètres.
    expect(src).toContain(
      'export type AddToCartFn = (product: ShopProduct, packCount?: PackCount) => void;',
    );
    expect(src).not.toMatch(
      /export type AddToCartFn = \(product: ShopProduct, packCount\?: PackCount, [^)]+\) => void;/,
    );
    expect(src).toMatch(/const addToCart: AddToCartFn = \(product, packCount = ONE_PACK\) => \{/);
    expect(src).not.toMatch(
      /const addToCart: AddToCartFn = \(product, packCount = ONE_PACK, [^)]+\) => \{/,
    );
  });

  it('PublicShop est l HÔTE UNIQUE de ProductOverlay (une seule instance, un seul onConfirm)', () => {
    const publicShop = read('src/modules/shops/ui/storefront/PublicShop.tsx');
    const catalog = read('src/modules/catalog/ui/storefront/PortalCatalog.tsx');

    expect(publicShop.match(/<ProductOverlay/g)?.length).toBe(1);
    expect(publicShop).toContain('const [overlayProduct, setOverlayProduct] = useState<ShopProduct | null>(null);');
    expect(publicShop).toContain('const onConfigure = (product: ShopProduct) => setOverlayProduct(product);');

    // La duplication qui a produit le défaut (point (b)) : la règle "qty =
    // exemplaires, on ajoute 1 paquet" ne doit plus vivre dans PortalCatalog.
    expect(catalog).not.toMatch(/<ProductOverlay/);
    expect(catalog).not.toMatch(/setOverlayProduct/);
  });

  it(
    "handleOverlayConfirm applique la règle du paquet EXACTEMENT " +
      '(qa-review round 2, QA-M9 / QA-M11, forme BCP-11 via toPackLine) : ' +
      "quantité choisie typée CopyCount, 1 paquet ajouté au panier — jamais qty tel quel",
    () => {
      const publicShop = read('src/modules/shops/ui/storefront/PublicShop.tsx');

      // QA-M9, forme BCP-11 : le snapshot doit construire la ligne à partir
      // de LA QUANTITÉ CHOISIE dans l'overlay (`qty`, le paramètre reçu de
      // `ProductOverlay.onConfirm`), pas une quantité déjà stockée sur le
      // produit — sinon la commande repart avec l'ancienne quantité,
      // silencieusement. `copies(qty)` est la SEULE conversion possible :
      // un nombre nu ne compile plus (cartLine.typecheck.ts, T8/T9). Round 3
      // (qa-review, deuxième correction) : `packCount` est désormais
      // OBLIGATOIRE dans `toPackLine`, ce geste normal déclare `ONE_PACK`
      // explicitement en troisième argument.
      expect(publicShop).toContain('toPackLine(productConfigured, copies(qty), ONE_PACK)');

      // QA-M11, forme BCP-11 : le panier ne reçoit jamais `qty` (nombre
      // d'exemplaires) en deuxième argument d'`addToCart` — ce serait le
      // retour exact du bug #5 (`cartPricing.ts:27` multiplie
      // `priceHT * line.qty`, un forfait à 35 € pour 500 ex afficherait
      // 17 500 €). Seul `ONE_PACK` (garanti par `toPackLine`, prouvé par
      // cartLine.test.ts T1) est correct.
      expect(publicShop).toContain('addToCart(line.product, ONE_PACK)');
      expect(publicShop).not.toMatch(/addToCart\(productConfigured,\s*qty\)/);
      expect(publicShop).not.toMatch(/addToCart\(line\.product,\s*qty\)/);

      // D2 (qa-review round 2, quatrieme porte) : le cablage lui-meme doit
      // passer le gestionnaire TEL QUEL. Sans cette assertion, un point
      // d appel du type onConfirm={(p, q) => handleOverlayConfirm(p, 500)}
      // laisse handleOverlayConfirm intact caractere pour caractere, passe
      // les assertions ci-dessus, et jette pourtant la quantite choisie par
      // l acheteur : QA-M9 deplace de trois lignes.
      expect(publicShop).toContain('onConfirm={handleOverlayConfirm}');

      // Verrou de non-contournement : `handleOverlayConfirm` est la SEULE
      // fonction du fichier à appeler `toPackLine` — si un jour un second
      // gestionnaire réécrit la même règle ailleurs dans ce fichier (la
      // troisième copie que BCP-11 ferme dans GammePage.tsx ne doit pas
      // renaître ici), ce test ne le verrait plus filer par ce nom précis,
      // donc autant fixer aussi le nombre d'occurrences.
      expect(publicShop.match(/const handleOverlayConfirm = /g)?.length).toBe(1);
      expect(publicShop.match(/toPackLine\(/g)?.length).toBe(1);
    },
  );

  it(
    "GammePage.handleAdd applique la règle du paquet EXACTEMENT " +
      '(qa-review round 2, défaut 3) : la ligne construite par toPackLine ' +
      "est bien celle transmise, avec LA quantité choisie — pas jetée, pas figée à 1",
    () => {
      const gamme = read('src/modules/catalog/ui/storefront/gamme/GammePage.tsx');

      // Défaut 3a (qa-review round 2) : `toPackLine` est appelé mais son
      // résultat (`line.product`, qui porte `config.quantity` à jour) est
      // jeté au profit de `result.productConfigured` (le produit catalogue
      // NON configuré). L'acheteur qui choisit 5000 ex. repart avec la
      // quantité périmée du catalogue, gravée ensuite dans une table
      // append-only (tenant_order_items via submitCart). Seul `line.product`
      // transmis à `onAddToCart` est correct.
      expect(gamme).toContain('onAddToCart(line.product)');
      expect(gamme).not.toMatch(/onAddToCart\(result\.productConfigured\)/);

      // Défaut 3b (qa-review round 2) : le résidu nommé au cadrage (point
      // 3.6 (d)) — un site qui passerait `copies(1)` au lieu de
      // `copies(result.qty)` compilerait toujours, puisque `CopyCount` est
      // un `number` marqué, pas une valeur vérifiée. Seule une assertion
      // texte peut le voir ici (le compilateur ne peut pas). Round 3
      // (qa-review, deuxième correction) : `packCount` est désormais
      // OBLIGATOIRE dans `toPackLine`, ce geste normal déclare `ONE_PACK`
      // explicitement en troisième argument.
      expect(gamme).toContain('toPackLine(result.productConfigured, copies(result.qty), ONE_PACK)');
      expect(gamme).not.toMatch(/toPackLine\(result\.productConfigured,\s*copies\(1\)/);

      // Verrou de non-contournement, même logique que pour PublicShop.
      expect(gamme.match(/const handleAdd = /g)?.length).toBe(1);
      expect(gamme.match(/toPackLine\(/g)?.length).toBe(1);
    },
  );

  it(
    'la grille du catalogue (chemin de référence, déjà correct avant BCP-10) ' +
      'ouvre toujours la surcouche via onConfigure (qa-review round 2, QA-M13)',
    () => {
      const catalog = read('src/modules/catalog/ui/storefront/PortalCatalog.tsx');

      // Défaut symétrique à celui de PortalHome/GammePage (bloc précédent) :
      // recâbler la grille principale sur `onSelectProduct` ferait régresser
      // le SEUL chemin qui fonctionnait déjà avant ce lot.
      expect(catalog).not.toMatch(/onConfigure=\{onSelectProduct\}/);
      expect(catalog).toMatch(
        /onCardClick=\{onSelectProduct\}\s*\n\s*onAddToCart=\{onAddToCart\}\s*\n\s*onConfigure=\{onConfigure\}/,
      );
    },
  );

  it("les cartes des cinq autres surfaces ouvrent la surcouche, pas la fiche, pour le geste Configurer", () => {
    const home = read('src/modules/catalog/ui/storefront/PortalHome.tsx');
    const gamme = read('src/modules/catalog/ui/storefront/gamme/GammePage.tsx');
    const landing = read('src/modules/catalog/ui/storefront/PortalCategoryLanding.tsx');
    const catalog = read('src/modules/catalog/ui/storefront/PortalCatalog.tsx');

    // Défaut exact relevé par l'architecte : `onConfigure={onSelectProduct}`
    // envoyait le clic "Configurer" vers la fiche (bloc mort) au lieu de la
    // surcouche. Aucune des surfaces ne doit plus faire ce câblage.
    for (const src of [home, gamme]) {
      expect(src).not.toMatch(/onConfigure=\{onSelectProduct\}/);
    }
    expect(home).toMatch(/onConfigure=\{onConfigure\}/);
    expect(gamme).toMatch(/onConfigure=\{onConfigure\}/);

    // Landing : la tuile "Les plus demandés" n'a pas de bouton séparé, le
    // clic entier doit désormais ouvrir la surcouche (point (b)).
    expect(landing).not.toMatch(/onClick=\{\(\) => onSelectProduct\(p\)\}/);
    expect(landing).toMatch(/onClick=\{\(\) => onConfigure\(p\)\}/);

    // Suggestions de Magrit (résultats IA) : bouton "Configurer" dédié.
    expect(catalog).not.toMatch(/onClick=\{\(e\) => \{\s*e\.stopPropagation\(\);\s*onSelectProduct\(p\);/);
  });
});
