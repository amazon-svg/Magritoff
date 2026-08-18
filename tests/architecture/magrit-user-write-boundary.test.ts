import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const invite = readFileSync(resolve(
  process.cwd(), 'src/app/components/dashboard/InviteUserModalV2.tsx',
), 'utf8');
const edit = readFileSync(resolve(
  process.cwd(), 'src/app/components/dashboard/EditUserRolesModal.tsx',
), 'utf8');
const users = readFileSync(resolve(
  process.cwd(), 'src/app/components/dashboard/DashboardUsers.tsx',
), 'utf8');
const invitationContract = readFileSync(resolve(
  process.cwd(), 'src/modules/invitations/api/contracts.ts',
), 'utf8');
const memberContract = readFileSync(resolve(
  process.cwd(), 'src/modules/members/api/contracts.ts',
), 'utf8');

describe('UM8.1 frontière d écriture des utilisateurs Magrit', () => {
  it('ne propose plus de créer un acheteur shop_only depuis la modale Magrit', () => {
    expect(invite).toContain('ne crée que des utilisateurs Magrit');
    expect(invite).toContain('Les comptes clients sont créés séparément');
    expect(invite).not.toContain("setScope('shop_only')");
    expect(invite).not.toContain('allowedShopIds:');
  });

  it('limite un compte legacy à une conversion à sens unique vers Magrit', () => {
    expect(edit).toContain("detail.accessScope === 'shop_only'");
    expect(edit).toContain("accessScope: 'magrit_full', allowedShopIds: []");
    expect(edit).toContain('Convertir en utilisateur Magrit');
    expect(edit).not.toContain("setScope('shop_only')");
    expect(users).not.toContain('ScopeAndPermissionsFieldset');
    expect(users).not.toContain('EditPermissionsModal');
    expect(users).not.toContain("nextScope === 'shop_only'");
    expect(users).not.toContain('value="shop_only"');
  });

  it('refuse le modèle legacy dans les contrats de commande', () => {
    const createCommand = invitationContract.slice(
      invitationContract.indexOf('createInvitationCommandSchema'),
      invitationContract.indexOf('createInvitationResultSchema'),
    );
    expect(createCommand).not.toContain('accessScope');
    expect(createCommand).not.toContain('allowedShopIds');
    expect(memberContract).toContain("accessScope: z.literal('magrit_full')");
    expect(memberContract).toContain('allowedShopIds: z.array(z.string().uuid()).max(0)');
  });
});
