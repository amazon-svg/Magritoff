import { describe, expect, it } from 'vitest';
import { InvitationSessionExpiredError } from '../../../src/modules/members/ui';

describe('useMagritInvitationManagement', () => {
  it('expose une erreur dédiée quand la session ne peut pas être renouvelée', () => {
    const error = new InvitationSessionExpiredError();
    expect(error.name).toBe('InvitationSessionExpiredError');
    expect(error.message).toContain('session a expiré');
  });
});
