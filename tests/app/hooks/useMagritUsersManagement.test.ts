import { describe, expect, it } from 'vitest';
import type { PendingInvitation } from '../../../src/modules/invitations';
import type { TenantMember } from '../../../src/modules/members';
import {
  toMagritInvitationRow,
  toMagritMemberRow,
} from '../../../src/modules/members/ui';

describe('useMagritUsersManagement helpers', () => {
  it('adapte un membre Magrit sans perdre son scope legacy', () => {
    const member = {
      userId: 'user-1', email: 'x@example.test', role: 'member', joinedAt: '2026-08-20',
      accessScope: 'shop_only', allowedShopIds: ['shop-1'],
      permissions: { canQuote: true, canOrder: false, canInvite: false },
    } as TenantMember;
    expect(toMagritMemberRow(member)).toMatchObject({
      user_id: 'user-1', access_scope: 'shop_only', allowed_shop_ids: ['shop-1'],
      permissions: { can_quote: true, can_order: false, can_invite: false },
    });
  });

  it('adapte une invitation en attente pour la vue', () => {
    const invitation = {
      id: 'invitation-1', email: 'invite@example.test', role: 'member',
      expiresAt: '2026-08-30', createdAt: '2026-08-20', accessScope: 'magrit_full',
      allowedShopIds: [], permissions: { canQuote: true, canOrder: true, canInvite: false },
    } as PendingInvitation;
    expect(toMagritInvitationRow(invitation)).toMatchObject({
      id: 'invitation-1', expires_at: '2026-08-30', access_scope: 'magrit_full',
      permissions: { can_quote: true, can_order: true, can_invite: false },
    });
  });
});
