/**
 * Q14-a round 2 (docs/api/CONVENTIONS.md §8.25 point 3.7) — DÉFAUT D2 de la
 * qa-review, corrigé.
 *
 * Constat de la qa-review round 1 : les fonctions pures `canAddAsIs` et
 * `addToCartButtonState` sont testées cas par cas, mais RIEN dans le dépôt ne
 * lit `ShopProductCard.tsx` — le câblage entre ces fonctions pures et le JSX
 * pouvait donc être cassé sans qu'aucun test ne rougisse. La qa a démontré
 * six mutations (W1-W6), toutes vertes à `pnpm typecheck` et à la suite
 * complète.
 *
 * Ces tests suivent le pattern déjà en usage dans ce dossier
 * (`PublicShop.submitCart.test.ts`, `PublicShop.productConfigurationAlignment.test.ts`,
 * `portal/PortalCart.text.test.ts`) : assertions texte sur les fichiers
 * sources, pour une classe de défaut (câblage entre composants) qu'un test
 * de rendu isolé ne verrait pas plus sûrement — le dépôt n'a de toute façon
 * aucune bibliothèque de rendu React ni environnement DOM dans `vitest`
 * (vérifié dans `package.json`).
 *
 * **Défaut D5 (round 3, qa-review), corrigé.** Round 2 lisait le texte BRUT
 * des fichiers sources : une ligne commentée (`// disabled={...}`) contient
 * toujours, comme sous-chaîne, le texte que la regex cherchait — le test
 * restait vert alors que l'attribut réel avait disparu du bouton. Même faille
 * pour un spread mis en commentaire de bloc. `read()` retire donc les
 * commentaires (bloc ET ligne) AVANT de chercher un motif : seul ce qui est
 * réellement exécuté compte. Deux assertions positives sont aussi resserrées
 * pour ne plus matcher n'importe où dans le fichier : l'`id` doit être posé
 * sur le `<p>` lui-même (pas un `<div>` conteneur, évasion E6), et
 * `clariprintQuote` doit être une constante dérivée de `product.config`, pas
 * une valeur figée (évasion E7).
 *
 * Chaque test ci-dessous a été rejoué manuellement contre la mutation
 * correspondante (W1 à W6, adaptées au câblage de chaque round — voir
 * story-Q14a.md pour le verdict de chacune, y compris les évasions E1, E1b,
 * E6, E7, E9 du round 3) : toutes rougissent.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../../..');
/**
 * Retire les commentaires de bloc (`/* ... *‍/`) et de ligne (`// ...`,
 * lignes ENTIÈREMENT commentées) avant de chercher un motif — seul le code
 * réellement exécuté doit pouvoir satisfaire une assertion (défaut D5).
 * Ne retire PAS un commentaire de fin de ligne collé à du code réel
 * (`code(); // note`) : aucune ligne de ce dépôt n'en a besoin pour les
 * motifs testés ici, et une regex plus agressive risquerait de manger du
 * code contenant `//` dans une chaîne (URL, par exemple).
 */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (relPath: string) => stripComments(readFileSync(resolve(root, relPath), 'utf-8'));

const CARD_PATH = 'src/modules/catalog/ui/storefront/ShopProductCard.tsx';
const LIFECYCLE_PATH = 'src/modules/orders/ui/hooks/useStorefrontOrderLifecycle.ts';
const CART_PATH = 'src/modules/orders/ui/storefront/PortalCart.tsx';
const PUBLIC_SHOP_PATH = 'src/modules/shops/ui/storefront/PublicShop.tsx';

describe('ShopProductCard — le cablage du bouton + Panier lit REELLEMENT les fonctions pures (W1-W5)', () => {
  it('W1 — disabled est pose depuis addToCartState.disabled, jamais un litteral', () => {
    const src = read(CARD_PATH);
    expect(src).toMatch(/disabled=\{addToCartState\.disabled\}/);
    // Un litteral fige (mutation W1) ne doit jamais apparaitre sur ce bouton.
    expect(src).not.toMatch(/disabled=\{false\}/);
  });

  it('W2 — aria-describedby est pose depuis addToCartState.describedBy, sous condition', () => {
    const src = read(CARD_PATH);
    expect(src).toMatch(/"aria-describedby":\s*addToCartState\.describedBy/);
  });

  it('W3 — addToCartButtonState recoit EXACTEMENT addAsIsReasonId, et le libelle (le <p>, pas un conteneur) porte le MEME identifiant en id', () => {
    const src = read(CARD_PATH);
    expect(src).toMatch(/addToCartButtonState\(addAsIsEligibility,\s*addAsIsReasonId\)/);
    // Round 3 (evasion E6, qa-review) : l'id doit etre porte par le <p> DU
    // LIBELLE lui-meme, pas par un <div> conteneur plus haut dans l'arbre —
    // ce dernier ferait pointer aria-describedby vers un element qui englobe
    // aussi le prix et les boutons, pas seulement le motif.
    expect(src).toMatch(/<p\s+id=\{addAsIsReasonId\}/);
  });

  it('W4 — canAddAsIs est appele avec le quote extrait du produit, jamais un null fige', () => {
    const src = read(CARD_PATH);
    expect(src).toMatch(/canAddAsIs\(product,\s*clariprintQuote\)/);
    // Round 3 (evasion E7, qa-review) : `clariprintQuote` doit etre une
    // constante DERIVEE de `product.config`, jamais une valeur figee
    // (`const clariprintQuote = null;` compilerait, passerait la regex
    // ci-dessus au niveau du site d'appel, et casserait quand meme C2).
    expect(src).toMatch(/const clariprintQuote = \(\s*product\.config as/);
  });

  it('W5 — le libelle est rendu conditionnellement sur addToCartState.label', () => {
    const src = read(CARD_PATH);
    expect(src).toMatch(/\{addToCartState\.label && \(/);
  });

  it('onConfigure est REQUIS (reserve qa-review, repli sur onAddToCart supprime)', () => {
    const src = read(CARD_PATH);
    expect(src).toMatch(/onConfigure:\s*\(product: ShopProduct\) => void;/);
    expect(src).not.toMatch(/onConfigure\?:/);
    // Le repli n a plus de raison d exister dans le gestionnaire de clic.
    expect(src).not.toMatch(/if \(onConfigure\)/);
  });
});

describe('Volet renouvellement — le cablage D1 (deux canaux separes) tient de bout en bout (W6 adaptee)', () => {
  it('le hook appelle REELLEMENT collectPriceNotFirmProductNames et pose son resultat dans renewalPriceNotFirm', () => {
    const src = read(LIFECYCLE_PATH);
    expect(src).toMatch(/setRenewalPriceNotFirm\(collectPriceNotFirmProductNames\(lines\)\)/);
    // Round 3 (evasion E9, qa-review) : `renewalWarnings` doit recevoir
    // EXACTEMENT `warnings` (la liste brute de `rebuildCartFromOrderItems`),
    // jamais une variable intermediaire qui aurait pu re-fusionner les deux
    // canaux (ex. `const merged = [...warnings, ...collectPriceNotFirmProductNames(lines)];
    // setRenewalWarnings(merged);` — meme resultat visible pour W6, mais D1
    // reviendrait). Assertion positive ET negative pour fermer les deux sens.
    expect(src).toMatch(/setRenewalWarnings\(warnings\);/);
    expect(src).not.toMatch(/setRenewalWarnings\(\[\.\.\.warnings/);
    expect(src).not.toMatch(/setRenewalWarnings\(merged\)/);
  });

  it('dismissRenewalWarnings et submitCart vident les DEUX canaux, jamais un seul', () => {
    const src = read(LIFECYCLE_PATH);
    const setPriceNotFirmCalls = (src.match(/setRenewalPriceNotFirm\(\[\]\)/g) ?? []).length;
    const setWarningsCalls = (src.match(/setRenewalWarnings\(\[\]\)/g) ?? []).length;
    // Trois sites de remise a zero : changement de slug, submitCart reussi,
    // dismissRenewalWarnings — les deux etats doivent etre vides aux TROIS.
    expect(setPriceNotFirmCalls).toBe(3);
    expect(setWarningsCalls).toBe(3);
  });

  it('PublicShop transmet REELLEMENT renewalPriceNotFirm a PortalCart (pas seulement destructure)', () => {
    const src = read(PUBLIC_SHOP_PATH);
    expect(src).toMatch(/renewalPriceNotFirm,/); // destructure du hook
    expect(src).toMatch(/renewalPriceNotFirm=\{renewalPriceNotFirm\}/); // prop transmise au JSX
  });

  it('PortalCart calcule les sections par la fonction pure, ne compose aucun texte lui-meme', () => {
    const src = read(CART_PATH);
    expect(src).toMatch(/renewalBannerSections\(renewalWarnings,\s*renewalPriceNotFirm\)/);
    // Le titre du round 1 ("N produit(s) indisponible(s)...") ne doit plus
    // etre COMPOSE dans PortalCart : seule renewalBannerSections le fait.
    expect(src).not.toMatch(/indisponible\$\{/);
    expect(src).not.toMatch(/\{renewalWarnings\.length\} produit/);
  });

  it('PortalCart rend les DEUX data-testid de section, associes au bon kind, jamais inverses', () => {
    const src = read(CART_PATH);
    expect(src).toMatch(
      /section\.kind === 'not-added'\s*\n?\s*\?\s*TEST_IDS\.shop\.cartRenewalNotAddedSection\s*\n?\s*:\s*TEST_IDS\.shop\.cartRenewalPriceNotFirmSection/,
    );
  });

  it('la section prix-non-ferme rend sa phrase secondaire (section.detail), jamais composee en dur', () => {
    const src = read(CART_PATH);
    expect(src).toMatch(/\{section\.detail && \(/);
  });

  it('le bandeau entier est conditionne sur renewalSections.length, jamais sur un seul des deux canaux', () => {
    const src = read(CART_PATH);
    expect(src).toMatch(/\{renewalSections\.length > 0 && \(/);
    // Round 1 conditionnait sur renewalWarnings.length seul : un retour a
    // cette forme masquerait la section prix-non-ferme quand aucun produit
    // n est indisponible.
    expect(src).not.toMatch(/\{renewalWarnings\.length > 0 && \(/);
  });
});
