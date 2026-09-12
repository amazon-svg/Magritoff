/**
 * `SupabaseNotificationSendRepository` — cote ENVOI du drain (E10.15c),
 * etendu par E10.15d-2 (§8.23 point 11) : le mappage de `occurrence_count`/
 * `deferred_render` (jsonb brut -> `DeferredRenderPayload | null`, forme DE
 * CONFIANCE MOINDRE puisque non typee par le contrat), et le SCEAU
 * (`markSent`/`markFailed` n ecrivent `subject`/`body`/`deferred_render` QUE
 * si un sceau est fourni — comportement E10.15c/d-1 INCHANGE sinon).
 */
import { describe, expect, it } from 'vitest';
import { SupabaseNotificationSendRepository } from '@/adapters/supabase/notification-send-repository';
import type { TenantId } from '@/kernel';

const TENANT = 'tenant-1' as TenantId;

function fakeServiceRoleClient(options: {
  claimedRows?: readonly Record<string, unknown>[];
}) {
  const updates: Array<{ table: string; patch: Record<string, unknown>; id: string }> = [];

  const client = {
    updates,
    async rpc(_fn: string, _args: unknown) {
      return { data: options.claimedRows ?? [], error: null };
    },
    from(table: string) {
      return {
        update(patch: Record<string, unknown>) {
          return {
            eq: async (_column: string, id: string) => {
              updates.push({ table, patch, id });
              return { error: null };
            },
          };
        },
      };
    },
  };

  return client;
}

function claimedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'message-1',
    tenant_id: TENANT,
    channel: 'email',
    recipient: 'client@example.test',
    subject: 'Sujet',
    body: 'Corps',
    attempts: 1,
    occurrence_count: 1,
    deferred_render: null,
    ...overrides,
  };
}

describe('SupabaseNotificationSendRepository.claim — mappage occurrence_count/deferred_render (E10.15d-2)', () => {
  it('deferred_render null -> deferredRender null, occurrenceCount recopie tel quel', async () => {
    const client = fakeServiceRoleClient({ claimedRows: [claimedRow({ occurrence_count: 1, deferred_render: null })] });
    const repository = new SupabaseNotificationSendRepository(client as any);

    const [message] = await repository.claim({ limit: 25, maxAttempts: 5, maxAgeSeconds: 86400 });

    expect(message!.occurrenceCount).toBe(1);
    expect(message!.deferredRender).toBeNull();
  });

  it('deferred_render VALIDE (jsonb, forme attendue) -> DeferredRenderPayload typee, occurrenceCount arrete a la reclamation', async () => {
    const client = fakeServiceRoleClient({
      claimedRows: [
        claimedRow({
          occurrence_count: 4,
          deferred_render: {
            subject: null,
            body: [
              { kind: 'literal', text: 'Vous avez déposé ' },
              { kind: 'tag', id: 'files.count' },
              { kind: 'literal', text: ' fichier(s).' },
            ],
          },
        }),
      ],
    });
    const repository = new SupabaseNotificationSendRepository(client as any);

    const [message] = await repository.claim({ limit: 25, maxAttempts: 5, maxAgeSeconds: 86400 });

    expect(message!.occurrenceCount).toBe(4);
    expect(message!.deferredRender).toEqual({
      subject: null,
      body: [
        { kind: 'literal', text: 'Vous avez déposé ' },
        { kind: 'tag', id: 'files.count' },
        { kind: 'literal', text: ' fichier(s).' },
      ],
    });
  });

  it('deferred_render MALFORME (forme inattendue) -> rendu null, DEFENSIF, jamais une exception', async () => {
    const client = fakeServiceRoleClient({
      claimedRows: [claimedRow({ deferred_render: { subject: null, body: 'pas-un-tableau' } })],
    });
    const repository = new SupabaseNotificationSendRepository(client as any);

    const [message] = await repository.claim({ limit: 25, maxAttempts: 5, maxAgeSeconds: 86400 });

    expect(message!.deferredRender).toBeNull();
  });

  it('segment de type inconnu dans deferred_render -> rendu null, DEFENSIF', async () => {
    const client = fakeServiceRoleClient({
      claimedRows: [
        claimedRow({ deferred_render: { subject: null, body: [{ kind: 'unknown', text: 'x' }] } }),
      ],
    });
    const repository = new SupabaseNotificationSendRepository(client as any);

    const [message] = await repository.claim({ limit: 25, maxAttempts: 5, maxAgeSeconds: 86400 });

    expect(message!.deferredRender).toBeNull();
  });
});

describe('SupabaseNotificationSendRepository.markSent/markFailed — LE SCEAU (E10.15d-2, §8.23 point 11.3 §7)', () => {
  it('markSent SANS sceau (seal=null) -> UPDATE ne touche PAS subject/body/deferred_render (chemin E10.15c/d-1 inchange)', async () => {
    const client = fakeServiceRoleClient({});
    const repository = new SupabaseNotificationSendRepository(client as any);

    await repository.markSent('message-1', 'provider-1', null);

    expect(client.updates).toHaveLength(1);
    const patch = client.updates[0]!.patch;
    expect(patch).toMatchObject({ status: 'sent', provider_message_id: 'provider-1' });
    expect(patch).not.toHaveProperty('subject');
    expect(patch).not.toHaveProperty('body');
    expect(patch).not.toHaveProperty('deferred_render');
  });

  it('markSent AVEC sceau -> LA MEME UPDATE ecrit subject/body FINAUX et deferred_render=null', async () => {
    const client = fakeServiceRoleClient({});
    const repository = new SupabaseNotificationSendRepository(client as any);

    await repository.markSent('message-1', 'provider-1', { subject: null, body: 'Vous avez déposé 4 fichier(s).' });

    expect(client.updates).toHaveLength(1);
    const patch = client.updates[0]!.patch;
    expect(patch).toMatchObject({
      status: 'sent',
      provider_message_id: 'provider-1',
      subject: null,
      body: 'Vous avez déposé 4 fichier(s).',
      deferred_render: null,
    });
  });

  it('markFailed AVEC sceau -> meme discipline que markSent (verdict TERMINAL)', async () => {
    const client = fakeServiceRoleClient({});
    const repository = new SupabaseNotificationSendRepository(client as any);

    await repository.markFailed('message-1', 'Resend 422: destinataire invalide', {
      subject: null,
      body: 'Vous avez déposé 2 fichier(s).',
    });

    const patch = client.updates[0]!.patch;
    expect(patch).toMatchObject({
      status: 'failed',
      subject: null,
      body: 'Vous avez déposé 2 fichier(s).',
      deferred_render: null,
    });
  });

  it('markFailed SANS sceau -> UPDATE ne touche PAS subject/body/deferred_render', async () => {
    const client = fakeServiceRoleClient({});
    const repository = new SupabaseNotificationSendRepository(client as any);

    await repository.markFailed('message-1', 'Resend 500: erreur temporaire', null);

    const patch = client.updates[0]!.patch;
    expect(patch).toMatchObject({ status: 'failed' });
    expect(patch).not.toHaveProperty('subject');
    expect(patch).not.toHaveProperty('body');
    expect(patch).not.toHaveProperty('deferred_render');
  });
});
