/**
 * BCP-5 (docs/api/CONVENTIONS.md §8.25 point 5.1) — textes du panier.
 *
 * Trois textes trompeurs corrigés :
 *  - « Vous recevrez un email de confirmation. » : SUPPRIMÉ, pas reformulé
 *    (`send-order-notification` n'écrit qu'aux administrateurs du tenant,
 *    constat 1(6) du cadrage).
 *  - « Envoi direct atelier · Validation hiérarchique à venir. » (+ son
 *    infobulle qui promettait un circuit N+1 « dans une prochaine
 *    version ») : remplacé, infobulle retirée.
 *  - Le badge « Prix marché » ne mentionne plus Clariprint (détail
 *    technique et faux : le prix marché est déjà affiché quand Clariprint
 *    a répondu, pas seulement quand il n'est « pas encore intégré »).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'src/modules/orders/ui/storefront/PortalCart.tsx'),
  'utf8',
);

describe('PortalCart — textes corrigés (BCP-5)', () => {
  it('ne promet plus un email de confirmation à l acheteur', () => {
    expect(source).not.toContain('Vous recevrez un email de confirmation');
  });

  it('annonce la transmission à l imprimeur, sans infobulle sur un circuit N+1 à venir', () => {
    expect(source).toContain("Votre commande sera transmise à l'imprimeur, qui la validera.");
    expect(source).not.toContain('Envoi direct atelier');
    expect(source).not.toContain('Validation hiérarchique à venir');
    expect(source).not.toContain("Le workflow d'approbation hierarchique N+1 sera disponible");
  });

  it('le badge prix marché ne mentionne plus Clariprint et engage l imprimeur à la validation', () => {
    expect(source).toContain(
      "Prix marché</strong> — au moins une ligne est une estimation Magrit. Le prix définitif sera confirmé par l&apos;imprimeur à la validation de la commande.",
    );
    expect(source).not.toContain('Clariprint pas encore intégré');
  });
});
