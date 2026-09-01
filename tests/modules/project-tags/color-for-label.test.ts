/**
 * `colorForLabel` (E10.2, CA1) — assignation deterministe d une couleur de la
 * palette fermee a partir du libelle normalise. Fonction pure, sans
 * dependance a Supabase ni au HTTP : testee isolement.
 */
import { describe, expect, it } from 'vitest';
import { colorForLabel } from '@/modules/project-tags/application/project-tags-service';
import { PROJECT_TAG_COLORS } from '@/modules/project-tags/api/contracts';

describe('colorForLabel', () => {
  it('rend toujours une couleur de la palette fermee', () => {
    for (const label of ['Urgent', 'Presse offset', '', 'À livrer avant vendredi', '日本語']) {
      expect(PROJECT_TAG_COLORS).toContain(colorForLabel(label));
    }
  });

  it('est deterministe : le meme libelle rend toujours la meme couleur', () => {
    expect(colorForLabel('Urgent')).toBe(colorForLabel('Urgent'));
    expect(colorForLabel('Urgent')).toBe(colorForLabel('Urgent'));
  });

  it('normalise le libelle (trim, casse insensible) avant de calculer la couleur', () => {
    // CA2 : deux creations concurrentes du meme libelle normalise DOIVENT
    // calculer la MEME couleur avant meme de savoir laquelle gagne la
    // course d insertion cote base — sinon le tag rejoue (celui qui relit
    // l existant) pourrait afficher une couleur differente selon l ordre
    // d arrivee des deux requetes.
    expect(colorForLabel('Urgent')).toBe(colorForLabel('  urgent  '));
    expect(colorForLabel('URGENT')).toBe(colorForLabel('urgent'));
  });

  it('deux libelles distincts peuvent rendre des couleurs distinctes (repartition sur la palette)', () => {
    const colors = new Set(
      ['Urgent', 'Presse', 'Standard', 'Express', 'Archive', 'Prioritaire'].map(colorForLabel),
    );
    // Pas d exigence d unicite (6 libelles, 6 couleurs possibles) : juste la
    // preuve que la fonction ne retombe pas systematiquement sur une seule
    // couleur pour des libelles differents.
    expect(colors.size).toBeGreaterThan(1);
  });
});
