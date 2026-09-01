/**
 * `sanitizeSearchTerm` du module Projets (E10.1/E10.2, qa-review).
 *
 * Meme fonction que le module Clients, meme piege corrige : remplacer une
 * virgule par une espace SANS compacter les espaces multiples resultants
 * laisse passer un terme qui ne matche plus JAMAIS en `ILIKE` — pas un
 * crash (500), un resultat VIDE silencieux, plus insidieux que la virgule
 * d E10.4 qu il reprend.
 */
import { describe, expect, it } from 'vitest';
import { sanitizeSearchTerm, toProjectTagDtos } from '@/adapters/supabase/projects-repository';
import { computeEntityTag } from '@/modules/_shared/application';

describe('sanitizeSearchTerm (module Projets) — neutralise la grammaire de filtre PostgREST', () => {
  it('laisse une recherche ordinaire intacte', () => {
    expect(sanitizeSearchTerm('Salon Imprim Expo')).toBe('Salon Imprim Expo');
  });

  it('retire les virgules qui casseraient un .or(...) en 500', () => {
    expect(sanitizeSearchTerm('Dupont, Martin')).toBe('Dupont Martin');
  });

  it('compacte les suites d espaces issues de la neutralisation (qa-review E10.2)', () => {
    // Sans compaction : "Dupont,  Martin" -> "Dupont   Martin" (espaces
    // multiples), qui ne matche plus jamais "Dupont Martin Impression" en
    // `ILIKE '%...%'` — verifie ici par containment litteral, exactement le
    // test que ferait Postgres.
    const sanitized = sanitizeSearchTerm('Dupont,  Martin');
    expect(sanitized).toBe('Dupont Martin');
    expect('Dupont Martin Impression'.toLowerCase()).toContain(sanitized.toLowerCase());
  });

  it('retire les parentheses (grammaire and()/or())', () => {
    expect(sanitizeSearchTerm('Flyer (A5)')).toBe('Flyer A5');
  });

  it('supprime les espaces superflus en tete et en fin apres neutralisation', () => {
    expect(sanitizeSearchTerm(',Salon,')).toBe('Salon');
  });
});

/**
 * `toProjectTagDtos` — stabilite d ordre de l embed (qa-review E10.2).
 *
 * Postgres ne garantit AUCUN ordre pour les lignes d un embed agrege sans
 * `ORDER BY` (`project_tag_links(project_tags(...))`) : il peut changer
 * entre deux lectures du MEME projet (HOT update, plan different...). Or
 * `computeEntityTag` (src/modules/_shared/application/concurrency.ts) trie
 * les CLES d objet mais PAS les elements de tableau — deux lectures avec les
 * memes tags dans un ordre different produisaient donc deux ETags
 * differents, et un commercial qui archive un projet juste apres l avoir
 * ouvert pouvait se voir refuser en 409 sans qu aucune ecriture concurrente
 * n ait eu lieu.
 */
describe('toProjectTagDtos — ordre canonique (qa-review E10.2)', () => {
  const tagUrgent = {
    project_tags: {
      id: '00000000-0000-4000-8000-000000000001',
      tenant_id: '00000000-0000-4000-8000-000000000000',
      label: 'Urgent',
      color: 'red',
      created_at: '2026-09-01T10:00:00.000Z',
    },
  };
  const tagPresse = {
    project_tags: {
      id: '00000000-0000-4000-8000-000000000002',
      tenant_id: '00000000-0000-4000-8000-000000000000',
      label: 'Presse',
      color: 'blue',
      created_at: '2026-09-01T10:00:00.000Z',
    },
  };

  it('rend le MEME ordre quel que soit l ordre des lignes de l embed', () => {
    const orderA = toProjectTagDtos([tagUrgent, tagPresse]);
    const orderB = toProjectTagDtos([tagPresse, tagUrgent]);
    expect(orderA).toEqual(orderB);
    expect(orderA.map((tag) => tag.id)).toEqual([tagUrgent.project_tags.id, tagPresse.project_tags.id]);
  });

  it('deux ordres d embed differents pour le MEME projet produisent le MEME ETag', async () => {
    // Reproduit exactement le scenario signale : le meme etat metier (memes
    // tags), lu deux fois avec un ordre d embed different -> l ETag calcule
    // sur la representation `Project` doit rester IDENTIQUE, sinon un
    // If-Match a jour cote client est refuse a tort (409) sans ecriture
    // concurrente reelle.
    const base = {
      id: '00000000-0000-4000-9000-000000000001',
      tenant_id: '00000000-0000-4000-8000-000000000000',
      customer_id: '00000000-0000-4000-8000-000000000099',
      name: 'Projet Test',
      status: 'active' as const,
      created_by: null,
      created_at: '2026-09-01T10:00:00.000Z',
      updated_at: '2026-09-01T10:00:00.000Z',
    };
    const readOne = { ...base, tags: toProjectTagDtos([tagUrgent, tagPresse]) };
    const readTwo = { ...base, tags: toProjectTagDtos([tagPresse, tagUrgent]) };

    const etagOne = await computeEntityTag(readOne);
    const etagTwo = await computeEntityTag(readTwo);
    expect(etagOne).toBe(etagTwo);
  });
});
