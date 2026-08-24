import { describe, expect, it } from 'vitest';
import { parseId } from '@/kernel/ids';
import { InvitationsService } from '@/modules/invitations/application/invitations-service';
import {
  InvitationRejectedError,
  type InvitationsRepository,
} from '@/modules/invitations/application/invitations-repository';
import { createApiV1Application } from '@/server/api/composition';
import { createInvitationsRoutes } from '@/server/api/invitations-routes';

const actorId = parseId<'UserId'>('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
if (!actorId.ok) throw new Error('fixture actor invalide');

const body = {
  email: 'buyer@example.com',
  tenantId: '11111111-1111-4111-8111-111111111111',
  baseUrl: 'http://localhost:5177',
  role: 'member',
  roleDefinitionIds: ['33333333-3333-4333-8333-333333333333'],
};

function createHandler(repository: InvitationsRepository) {
  return createApiV1Application({
    routes: createInvitationsRoutes(new InvitationsService(repository)),
    actorResolver: { async resolve() { return { kind: 'user', userId: actorId.value }; } },
    requestIdFactory: () => 'request-invitations-test',
  });
}

function repository(overrides: Partial<InvitationsRepository>): InvitationsRepository {
  return {
    async activation() { throw new InvitationRejectedError('invalid_request', 'Invitation invalide'); },
    async create() { throw new Error('not implemented'); },
    async options() { return { roles: [], shops: [] }; },
    async pending() { return []; },
    async resend() { return { sent: false, link: 'http://localhost:5177/invitations/token' }; },
    async revoke() {},
    ...overrides,
  };
}

describe('activation publique d une invitation', () => {
  it('retourne l email imposé et indique si le compte existe', async () => {
    const token = 'abcdefghijklmnopqrstuvwxyzABCDE_1234567890-token';
    const handler = createHandler(repository({
      async activation(receivedToken) {
        expect(receivedToken).toBe(token);
        return {
          email: 'invitee@example.com',
          tenantName: 'Imprimerie Exemple',
          accountExists: false,
          expiresAt: '2026-09-07T12:00:00.000Z',
        };
      },
    }));

    const response = await handler(new Request(
      `http://localhost/api/v1/invitations/${token}/activation`,
    ));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      email: 'invitee@example.com',
      tenantName: 'Imprimerie Exemple',
      accountExists: false,
      expiresAt: '2026-09-07T12:00:00.000Z',
    });
  });
});

describe('POST /api/v1/invitations', () => {
  it('refuse explicitement l ancien contrat shop_only', async () => {
    const response = await createHandler(repository({}))(new Request('http://localhost/api/v1/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...body,
        accessScope: 'shop_only',
        allowedShopIds: ['22222222-2222-4222-8222-222222222222'],
      }),
    }));
    expect(response.status).toBe(422);
  });

  it('dérive l’inviteur de l’acteur authentifié', async () => {
    let receivedActor = '';
    const handler = createHandler(repository({
      async create(userId) {
        receivedActor = userId;
        return {
          invitationId: '44444444-4444-4444-8444-444444444444',
          sent: true,
          link: 'http://localhost:5177/invitations/token',
        };
      },
    }));

    const response = await handler(new Request('http://localhost/api/v1/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }));

    expect(response.status).toBe(201);
    expect(receivedActor).toBe(actorId.value);
  });

  it('traduit un doublon en problem+json 409', async () => {
    const handler = createHandler(repository({
      async create() {
        throw new InvitationRejectedError('duplicate_pending', 'duplicate_pending');
      },
    }));

    const response = await handler(new Request('http://localhost/api/v1/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }));
    const problem = await response.json();

    expect(response.status).toBe(409);
    expect(problem.code).toBe('invitations.duplicate_pending');
  });

  it('refuse de réinviter un utilisateur déjà membre', async () => {
    const handler = createHandler(repository({
      async create() {
        throw new InvitationRejectedError('already_member', 'already_member');
      },
    }));

    const response = await handler(new Request('http://localhost/api/v1/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'invitations.already_member',
      title: 'Utilisateur déjà membre',
    });
  });
});

describe('administration des invitations', () => {
  it('liste les invitations du tenant demandé', async () => {
    let receivedTenant = '';
    const handler = createHandler(repository({
      async pending(_actor, tenantId) { receivedTenant = tenantId; return []; },
    }));
    const response = await handler(new Request(`http://localhost/api/v1/tenants/${body.tenantId}/invitations`));
    expect(response.status).toBe(200);
    expect(receivedTenant).toBe(body.tenantId);
  });

  it('révoque avec l’identité serveur et l’id du chemin', async () => {
    let received = '';
    const invitationId = '44444444-4444-4444-8444-444444444444';
    const handler = createHandler(repository({
      async revoke(userId, id) { expect(userId).toBe(actorId.value); received = id; },
    }));
    const response = await handler(new Request(`http://localhost/api/v1/invitations/${invitationId}`, { method: 'DELETE' }));
    expect(response.status).toBe(200);
    expect(received).toBe(invitationId);
  });

  it('renvoie une invitation via le dépôt qui régénère son lien', async () => {
    const invitationId = '44444444-4444-4444-8444-444444444444';
    let receivedBaseUrl = '';
    const handler = createHandler(repository({
      async resend(userId, id, baseUrl) {
        expect(userId).toBe(actorId.value);
        expect(id).toBe(invitationId);
        receivedBaseUrl = baseUrl;
        return { sent: true, link: `${baseUrl}/invitations/nouveau-token` };
      },
    }));

    const response = await handler(new Request(
      `http://localhost/api/v1/invitations/${invitationId}/resend`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl: 'https://magrit.test' }),
      },
    ));

    expect(response.status).toBe(200);
    expect(receivedBaseUrl).toBe('https://magrit.test');
  });
});
