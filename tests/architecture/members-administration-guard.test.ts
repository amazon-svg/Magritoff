/**
 * TF-16 — « Un utilisateur non admin n accède ni à la page Utilisateurs ni à
 * l API d invitation ».
 *
 * Pourquoi ce fichier existe. Ce cas était tenu dans Notion comme une recette
 * manuelle, jouée pour la dernière fois le 24/08/2026 et laissée au statut KO.
 * Notion est sorti du jeu le 03/10/2026 : le cas n est donc plus rejouable, et
 * un statut KO que personne ne peut ni reproduire ni infirmer vaut moins que
 * rien — il entretient le doute sur une garde d accès.
 *
 * Vérification faite, la garde existe aux deux niveaux. Ce qui manquait n est
 * pas la garde, c est la preuve : rien n empêchait de la retirer sans que
 * personne s en aperçoive. Ce fichier la fige.
 *
 * Il contrôle trois choses, et rien d autre :
 *   1. l écran Utilisateurs est monté sous une capacité requise, pas en accès
 *      libre ;
 *   2. cette capacité n est accordée par aucun socle implicite — un membre
 *      ordinaire ne l a pas ;
 *   3. les cinq opérations d invitation passent par une garde serveur avant
 *      toute écriture, et cette garde interroge la base, pas l interface.
 *
 * La garde d interface n est pas une sécurité : elle évite d afficher un écran
 * inutile. La seule barrière opposable est celle du point 3.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { UserAccessProfile } from '@/modules/roles';
import { resolveCapability } from '@/modules/roles/ui/runtime/accessProfile.helpers';
import { membersWorkspaceContribution } from '@/modules/members/surface-contributions';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const MEMBERS_CAPABILITY = 'members.manage';
const INVITATION_GUARD = 'requireCanInvite';
const INVITATION_OPERATIONS = ['create', 'options', 'pending', 'resend', 'revoke'] as const;

describe('TF-16 — administration des utilisateurs réservée', () => {
  it('monte l écran Utilisateurs sous une capacité requise', () => {
    const route = membersWorkspaceContribution.routes
      .find((candidate) => candidate.path === 'users');
    expect(route, 'la route users doit exister').toBeDefined();
    expect(
      route?.requiredCapabilities,
      'retirer requiredCapabilities rendrait l écran Utilisateurs accessible à tout membre',
    ).toEqual([MEMBERS_CAPABILITY]);
  });

  it('refuse cette capacité à un membre ordinaire', () => {
    const member: UserAccessProfile = {
      tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      membership: 'member',
      isAdmin: false,
      surfaces: ['workspace'],
      capabilities: ['can_manage_shops'],
    };
    expect(
      resolveCapability(member, false, false, MEMBERS_CAPABILITY),
      'members.manage ne doit être couverte par aucun socle implicite',
    ).toBe(false);
    expect(resolveCapability({ ...member, isAdmin: true }, false, false, MEMBERS_CAPABILITY)).toBe(true);
  });

  it('garde les cinq opérations d invitation côté serveur, avant toute écriture', () => {
    const source = read('src/adapters/postgres/invitations-repository.ts');
    // Les méthodes ne sont pas toutes déclarées `async` : certaines rendent la
    // promesse de la transaction directement. On repère donc l en-tête de
    // méthode, pas le mot-clé.
    const offsetOf = (name: string) => {
      const match = new RegExp(`\\n  (?:async )?${name}\\(`).exec(source);
      return match === null ? -1 : match.index;
    };
    const offsets = INVITATION_OPERATIONS.map((name) => [name, offsetOf(name)] as const);
    for (const [operation, start] of offsets) {
      expect(start, `l opération ${operation} doit exister`).toBeGreaterThan(-1);
      const next = offsets
        .map(([, index]) => index)
        .filter((index) => index > start)
        .sort((a, b) => a - b)[0] ?? source.indexOf(`function ${INVITATION_GUARD}`);
      const body = source.slice(start, next);
      const guardOffset = body.indexOf(INVITATION_GUARD);
      expect(
        guardOffset,
        `l opération ${operation} doit appeler ${INVITATION_GUARD} avant d agir`,
      ).toBeGreaterThan(-1);

      const firstWrite = new RegExp(
        String.raw`\b(?:insert\s+into|update\s+(?!of\b)(?:public\.)?[a-z_][a-z0-9_.]*|delete\s+from)\b`,
        'i',
      ).exec(body);
      if (firstWrite !== null) {
        expect(
          guardOffset,
          `l opération ${operation} doit vérifier la capacité avant sa première écriture SQL`,
        ).toBeLessThan(firstWrite.index);
      }
    }
  });

  it('fait porter la garde par la base, pas par l interface', () => {
    const source = read('src/adapters/postgres/invitations-repository.ts');
    const guard = source.slice(source.indexOf(`function ${INVITATION_GUARD}`));
    expect(guard).toContain("magrit.actor_has_capability");
    expect(guard).toContain("'can_invite'");
    expect(
      guard.includes('permissionDenied()'),
      'une capacité absente doit produire un refus explicite, pas un passage silencieux',
    ).toBe(true);
  });
});
