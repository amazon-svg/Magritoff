/**
 * Fix BCP-6 (recette navigateur 2026-09-15/16, docs/api/CONVENTIONS.md
 * §8.25 lot 6 point 5.2) : preuve, par execution du VRAI `cn()`
 * (tailwind-merge + clsx, src/shared/ui/utils.ts) sur les VRAIES classes en
 * jeu, que `PRODUCT_OVERLAY_SUBTITLE_CLASSNAME` neutralise correctement le
 * `text-sm` impose par le wrapper partage `SheetDescription`
 * (src/shared/ui/sheet.tsx : `cn("text-muted-foreground text-sm", className)`),
 * sans en introduire un autre (ex. `leading-*`) qui fixerait une hauteur de
 * ligne differente de celle heritee.
 *
 * Constat recette : hauteur de ligne mesuree a 17.14px (imposee par
 * `text-sm`) au lieu de 18px (heritee du contexte ambiant, comme avant
 * BCP-6 — cf. commit efc52207 ou le sous-titre etait un <p> brut hors du
 * wrapper SheetDescription).
 *
 * On ne suppose RIEN de memoire sur le comportement de tailwind-merge : le
 * test importe le vrai `cn` et le vrai `PRODUCT_OVERLAY_SUBTITLE_CLASSNAME`,
 * reproduit exactement l'appel fait par `SheetDescription`, et inspecte la
 * chaine de classes qui en resulte.
 */

import { describe, it, expect } from 'vitest';
import { cn } from '@/shared/ui/utils';
import { SHEET_DESCRIPTION_BASE_CLASSNAME } from '@/shared/ui/sheet';
import { PRODUCT_OVERLAY_SUBTITLE_CLASSNAME } from '@/modules/catalog/ui/storefront/ProductOverlay.helpers';

// Fix D3a (qa-review round 2, 2026-09-16) : la classe de base n'est plus
// recopiee en dur ici — elle est importee depuis le wrapper partage
// (src/shared/ui/sheet.tsx), pour ne jamais diverger silencieusement si son
// implementation change.

describe('PRODUCT_OVERLAY_SUBTITLE_CLASSNAME neutralise text-sm au point d appel (BCP-6 5.2)', () => {
  const merged = cn(SHEET_DESCRIPTION_BASE_CLASSNAME, PRODUCT_OVERLAY_SUBTITLE_CLASSNAME);
  const tokens = merged.split(/\s+/).filter(Boolean);

  it("le resultat ne contient plus text-sm (sinon la hauteur de ligne du wrapper s applique, bug BCP-6)", () => {
    expect(tokens).not.toContain('text-sm');
  });

  it("le resultat ne fixe pas de hauteur de ligne explicite (aucune classe leading-*) : elle reste heritee, comme avant BCP-6", () => {
    expect(tokens.some((t) => t.startsWith('leading-'))).toBe(false);
  });

  it("le resultat conserve la couleur text-ink-muted (text-muted-foreground du wrapper est bien ecrase)", () => {
    expect(tokens).toContain('text-ink-muted');
    expect(tokens).not.toContain('text-muted-foreground');
  });

  it("le resultat conserve les marges m-0 mt-1 (identiques a efc52207)", () => {
    expect(tokens).toContain('m-0');
    expect(tokens).toContain('mt-1');
  });

  it("le neutraliseur choisi (text-[12px]) ne fixe QUE la taille, pas de hauteur de ligne accolee", () => {
    // Vérifie la forme précise choisie (arbitrary value sans "/", donc pas de
    // line-height pair) — si un jour la constante change de stratégie (ex.
    // `text-base`), ce test échoue et documente le changement de mécanisme.
    expect(tokens).toContain('text-[12px]');
  });

  it("PRODUCT_OVERLAY_SUBTITLE_CLASSNAME est stable (pas de derive silencieuse du point d appel)", () => {
    expect(PRODUCT_OVERLAY_SUBTITLE_CLASSNAME).toBe('text-ink-muted m-0 mt-1 text-[12px]');
  });

  // Garde-fou anti-faux-positif : si SHEET_DESCRIPTION_BASE_CLASSNAME ne
  // contient plus text-sm (le wrapper a change), les assertions ci-dessus
  // passeraient pour une mauvaise raison. On verifie explicitement la
  // premisse du test.
  it("premisse : le wrapper porte bien text-sm avant neutralisation", () => {
    expect(SHEET_DESCRIPTION_BASE_CLASSNAME.split(/\s+/)).toContain('text-sm');
  });
});
