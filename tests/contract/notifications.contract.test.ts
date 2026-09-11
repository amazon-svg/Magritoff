/**
 * Module Notifications (socle configurable) contre le contrat (story
 * E10.15a).
 *
 * Exerce reellement `createNotificationTemplatesRoutes()` via
 * `createGescomApiHandler`, avec un `NotificationTemplatesRepository` en
 * memoire (`InMemoryNotificationTemplatesRepository`, aucune dependance a
 * Supabase). Chaque reponse est confrontee au contrat via
 * `checkResponseAgainstContract`.
 *
 * Le plafond de 100 modeles, l immuabilite de `event_name`/`channel`, la RLS
 * et le trigger `commercial_settings_guard_notification_fields` — tenus EN
 * BASE — sont verifies reellement par
 * `tests/sql/gescom-e10-15a-notification-templates.sql` : ce fichier valide
 * la FORME HTTP/JSON (enveloppe, ETag, codes d erreur, gardes) contre le
 * contrat, pas l implementation SQL sous-jacente.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { parseId, type TenantId, type UserId } from '@/kernel';
import {
  InMemoryIdempotencyStore,
  type ApiPrincipal,
  type PrincipalVerifier,
} from '@/modules/_shared/application';
import { NotificationTemplatesService } from '@/modules/notifications/application/notification-templates-service';
import type { NotificationTemplateDto } from '@/modules/notifications/api/contracts';
import { createNotificationTemplatesRoutes } from '@/server/api/notification-templates-routes';
import { createGescomApiHandler } from '@/server/api';
import {
  InMemoryNotificationTemplatesRepository,
  fakeTemplateUuid,
} from './_fakes/notification-templates-repository.fake.ts';
import { checkResponseAgainstContract } from './_harness.ts';

const TENANT = brand<TenantId>('7f0d2a1e-1c4b-4f8a-9c3d-5b6e7a8f9012');
const USER = brand<UserId>('a1b2c3d4-e5f6-4708-8910-1a2b3c4d5e6f');

function brand<T extends string>(value: string): T {
  const parsed = parseId(value);
  if (!parsed.ok) throw new Error('identifiant de test invalide');
  return parsed.value as T;
}

const userPrincipal: ApiPrincipal = Object.freeze({ kind: 'user', userId: USER, tenantId: TENANT });

const verifier: PrincipalVerifier = {
  async verify(credential) {
    if (credential.kind === 'bearer') {
      return credential.token === 'jeton-valide' ? userPrincipal : null;
    }
    return null;
  },
};

let sequence = 0;
/** `[A-Za-z0-9_.:-]{8,255}` (contrat `IdempotencyKey`) : le prefixe seul est trop court. */
function idempotencyKey(): string {
  sequence += 1;
  return `idem-notif-${sequence}`;
}

let repository: InMemoryNotificationTemplatesRepository;
let handler: (request: Request) => Promise<Response>;

beforeEach(() => {
  repository = new InMemoryNotificationTemplatesRepository();
  const service = new NotificationTemplatesService({ repository });
  handler = createGescomApiHandler({
    routes: createNotificationTemplatesRoutes(service),
    principalVerifier: verifier,
    idempotencyStore: new InMemoryIdempotencyStore(),
    requestIdFactory: () => 'req-e10-15a',
  });
});

function call(path: string, init: RequestInit = {}): Promise<Response> {
  return handler(new Request(`https://magrit.test${path}`, init));
}

const asUser = { Authorization: 'Bearer jeton-valide' };
const jsonHeaders = { ...asUser, 'Content-Type': 'application/json' };

async function expectContract(
  response: Response,
  expectation: Readonly<{ status: number; dataSchema?: string }>,
): Promise<void> {
  const check = await checkResponseAgainstContract(response, expectation);
  expect(check.errors, check.errors.join(' | ')).toEqual([]);
}

function seedTemplate(overrides: Partial<NotificationTemplateDto> = {}): NotificationTemplateDto {
  const now = new Date().toISOString();
  const template: NotificationTemplateDto = {
    id: fakeTemplateUuid(),
    event_name: 'order.step_changed',
    channel: 'email',
    audience: 'customer',
    recipients: null,
    production_step_id: null,
    name: 'Notification étape',
    subject: 'Votre commande {{order.number}} a avancé',
    body: 'Étape atteinte : {{step.label}}.',
    is_active: true,
    created_at: now,
    created_by: USER,
    updated_at: now,
    updated_by: USER,
    ...overrides,
  };
  repository.seedForTest(TENANT, template);
  return template;
}

describe('module Notifications — socle configurable (E10.15a) contre le contrat', () => {
  it('CA1/CA4 — GET /notification-events : catalogue des 5 evenements notifiables, sans SMS si l espace ne l a pas arme', async () => {
    repository.setSmsEnabledForTest(false);
    const response = await call('/api/v1/notification-events', { headers: asUser });
    await expectContract(response, { status: 200 });
    const { data } = (await response.json()) as { data: Array<{ event_name: string; channels: string[] }> };
    expect(data).toHaveLength(5);
    expect(data.map((e) => e.event_name).sort()).toEqual(
      ['customer.created', 'order.files_submitted', 'order.step_changed', 'quote.converted', 'quote.sent'].sort(),
    );
    for (const descriptor of data) {
      expect(descriptor.channels).toEqual(['email']);
    }
  });

  it('CA4 — le canal sms apparait au catalogue quand notification_sms_enabled est arme', async () => {
    repository.setSmsEnabledForTest(true);
    const response = await call('/api/v1/notification-events', { headers: asUser });
    const { data } = (await response.json()) as { data: Array<{ channels: string[] }> };
    for (const descriptor of data) {
      expect(descriptor.channels).toEqual(['email', 'sms']);
    }
  });

  it('CA1 — GET /notification-templates : liste triee, filtres event_name/channel/status', async () => {
    seedTemplate({ event_name: 'quote.sent', channel: 'email', name: 'B', is_active: true });
    seedTemplate({ event_name: 'customer.created', channel: 'email', name: 'A', is_active: false });

    const all = await call('/api/v1/notification-templates', { headers: asUser });
    await expectContract(all, { status: 200 });
    const { data: allData } = (await all.json()) as { data: NotificationTemplateDto[] };
    expect(allData.map((t) => t.event_name)).toEqual(['customer.created', 'quote.sent']);

    const activeOnly = await call('/api/v1/notification-templates?status=active', { headers: asUser });
    const { data: activeData } = (await activeOnly.json()) as { data: NotificationTemplateDto[] };
    expect(activeData).toHaveLength(1);
    expect(activeData[0]!.event_name).toBe('quote.sent');
  });

  it('CA2/CA5 — POST /notification-templates cree desactive par defaut, capability requise', async () => {
    repository.setActorCapabilityForTest(TENANT, USER, 'can_manage_notifications', false);
    const forbidden = await call('/api/v1/notification-templates', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({
        event_name: 'customer.created',
        channel: 'email',
        audience: 'customer',
        name: 'Bienvenue',
        subject: 'Bienvenue {{customer.company_name}}',
        body: 'Merci de votre confiance.',
      }),
    });
    expect(forbidden.status).toBe(403);
    const forbiddenBody = (await forbidden.json()) as { code: string };
    expect(forbiddenBody.code).toBe('identity.role_required');

    repository.setActorCapabilityForTest(TENANT, USER, 'can_manage_notifications', true);
    const response = await call('/api/v1/notification-templates', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({
        event_name: 'customer.created',
        channel: 'email',
        audience: 'customer',
        name: 'Bienvenue',
        subject: 'Bienvenue {{customer.company_name}}',
        body: 'Merci de votre confiance.',
      }),
    });
    await expectContract(response, { status: 201, dataSchema: 'NotificationTemplate' });
    const { data } = (await response.json()) as { data: NotificationTemplateDto };
    expect(data.is_active).toBe(false);
  });

  it('CA5 — 422 notification_template.unknown_tag sur une balise absente du catalogue de l evenement', async () => {
    const response = await call('/api/v1/notification-templates', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({
        event_name: 'customer.created',
        channel: 'email',
        audience: 'customer',
        name: 'Bienvenue',
        subject: 'Bonjour',
        // step.label n est valide QUE sur order.step_changed.
        body: 'Étape : {{step.label}}.',
      }),
    });
    expect(response.status).toBe(422);
    const body = (await response.json()) as { code: string; errors?: unknown[] };
    expect(body.code).toBe('notification_template.unknown_tag');
    expect(body.errors?.length).toBeGreaterThan(0);
  });

  it('CA5 — une variante de grammaire ({{ order.number }}, avec espaces) est refusee comme balise inconnue, pas acceptee comme texte litteral', async () => {
    const response = await call('/api/v1/notification-templates', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({
        event_name: 'order.step_changed',
        channel: 'email',
        audience: 'customer',
        name: 'Étape',
        subject: 'Suivi',
        body: 'Commande {{ order.number }} mise à jour.',
      }),
    });
    expect(response.status).toBe(422);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('notification_template.unknown_tag');
  });

  it('422 notification_template.recipients_required — audience explicit sans destinataire, et audience customer AVEC destinataire', async () => {
    const withoutRecipients = await call('/api/v1/notification-templates', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({
        event_name: 'order.files_submitted',
        channel: 'email',
        audience: 'explicit',
        name: 'Atelier',
        subject: 'Fichiers reçus',
        body: '{{files.count}} fichier(s) reçu(s).',
      }),
    });
    expect(withoutRecipients.status).toBe(422);
    expect(((await withoutRecipients.json()) as { code: string }).code).toBe('notification_template.recipients_required');

    const withRecipientsOnCustomer = await call('/api/v1/notification-templates', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({
        event_name: 'order.files_submitted',
        channel: 'email',
        audience: 'customer',
        recipients: ['production@imprimerie.example'],
        name: 'Atelier',
        subject: 'Fichiers reçus',
        body: '{{files.count}} fichier(s) reçu(s).',
      }),
    });
    expect(withRecipientsOnCustomer.status).toBe(422);
    expect(((await withRecipientsOnCustomer.json()) as { code: string }).code).toBe(
      'notification_template.recipients_required',
    );
  });

  it('422 notification_template.step_filter_not_applicable — production_step_id hors order.step_changed', async () => {
    const response = await call('/api/v1/notification-templates', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({
        event_name: 'customer.created',
        channel: 'email',
        audience: 'customer',
        production_step_id: fakeTemplateUuid(),
        name: 'Bienvenue',
        subject: 'Bonjour',
        body: 'Merci.',
      }),
    });
    expect(response.status).toBe(422);
    expect(((await response.json()) as { code: string }).code).toBe('notification_template.step_filter_not_applicable');
  });

  it('qa-review B2 — 422 api.validation_failed sur un production_step_id INEXISTANT (jamais une violation de FK brute)', async () => {
    const response = await call('/api/v1/notification-templates', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({
        event_name: 'order.step_changed',
        channel: 'email',
        audience: 'customer',
        production_step_id: fakeTemplateUuid(),
        name: 'Étape fantôme',
        subject: 'Sujet',
        body: '{{step.label}}',
      }),
    });
    expect(response.status).toBe(422);
    const body = (await response.json()) as { code: string; errors?: Array<{ field: string }> };
    expect(body.code).toBe('api.validation_failed');
    expect(body.errors?.[0]?.field).toBe('production_step_id');
  });

  it('qa-review B2 (MAJEUR) — 422 api.validation_failed sur un production_step_id d un AUTRE TENANT, jamais accepte silencieusement', async () => {
    const otherTenantStepId = fakeTemplateUuid();
    // L etape existe reellement, mais dans un AUTRE tenant que TENANT — le
    // fake simule production_steps filtre par tenant, exactement comme la
    // RLS/le trigger EN BASE (notification_templates_assert_same_tenant).
    repository.seedProductionStepForTest('7f0d2a1e-1c4b-4f8a-9c3d-5b6e7a8f9999', otherTenantStepId);

    const response = await call('/api/v1/notification-templates', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({
        event_name: 'order.step_changed',
        channel: 'email',
        audience: 'customer',
        production_step_id: otherTenantStepId,
        name: 'Étape d’un autre tenant',
        subject: 'Sujet',
        body: '{{step.label}}',
      }),
    });
    expect(response.status).toBe(422);
    const body = (await response.json()) as { code: string; errors?: Array<{ field: string }> };
    expect(body.code).toBe('api.validation_failed');
    expect(body.errors?.[0]?.field).toBe('production_step_id');

    // Aucun modele n a ete cree avec ce production_step_id — le refus est
    // reel, pas seulement un code d erreur affiche.
    const list = await call('/api/v1/notification-templates', { headers: asUser });
    const { data } = (await list.json()) as { data: NotificationTemplateDto[] };
    expect(data.some((t) => t.production_step_id === otherTenantStepId)).toBe(false);
  });

  it('production_step_id VALIDE (meme tenant) est accepte sur order.step_changed', async () => {
    const stepId = fakeTemplateUuid();
    repository.seedProductionStepForTest(TENANT, stepId);

    const response = await call('/api/v1/notification-templates', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({
        event_name: 'order.step_changed',
        channel: 'email',
        audience: 'customer',
        production_step_id: stepId,
        name: 'Étape valide',
        subject: 'Sujet',
        body: '{{step.label}}',
      }),
    });
    await expectContract(response, { status: 201, dataSchema: 'NotificationTemplate' });
    const { data } = (await response.json()) as { data: NotificationTemplateDto };
    expect(data.production_step_id).toBe(stepId);
  });

  it('422 notification_template.limit_reached — 100 modeles deja portes par le tenant', async () => {
    repository.seedCountForTest(TENANT, 100);
    const response = await call('/api/v1/notification-templates', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({
        event_name: 'customer.created',
        channel: 'email',
        audience: 'customer',
        name: 'Le 101e',
        subject: 'Bonjour',
        body: 'Merci.',
      }),
    });
    expect(response.status).toBe(422);
    expect(((await response.json()) as { code: string }).code).toBe('notification_template.limit_reached');
  });

  it('getNotificationTemplate : fiche + ETag ; 404 si introuvable dans ce tenant', async () => {
    const template = seedTemplate();

    const response = await call(`/api/v1/notification-templates/${template.id}`, { headers: asUser });
    await expectContract(response, { status: 200, dataSchema: 'NotificationTemplate' });
    expect(response.headers.get('etag')).toBeTruthy();

    const missing = await call(`/api/v1/notification-templates/${fakeTemplateUuid()}`, { headers: asUser });
    expect(missing.status).toBe(404);
  });

  it('updateNotificationTemplate : If-Match exige (428 si absent, 409 si perime), event_name/channel absents de la commande', async () => {
    const template = seedTemplate();

    const withoutIfMatch = await call(`/api/v1/notification-templates/${template.id}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ is_active: false }),
    });
    expect(withoutIfMatch.status).toBe(428);

    const staleIfMatch = await call(`/api/v1/notification-templates/${template.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': '"perime"' },
      body: JSON.stringify({ is_active: false }),
    });
    expect(staleIfMatch.status).toBe(409);

    const fresh = await call(`/api/v1/notification-templates/${template.id}`, { headers: asUser });
    const etag = fresh.headers.get('etag')!;

    const updated = await call(`/api/v1/notification-templates/${template.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({ name: 'Étape (renommée)', is_active: false }),
    });
    await expectContract(updated, { status: 200, dataSchema: 'NotificationTemplate' });
    const { data } = (await updated.json()) as { data: NotificationTemplateDto };
    expect(data.name).toBe('Étape (renommée)');
    expect(data.is_active).toBe(false);
  });

  it('updateNotificationTemplate — capability requise avant toute autre garde (403 avant 409)', async () => {
    const template = seedTemplate();
    repository.setActorCapabilityForTest(TENANT, USER, 'can_manage_notifications', false);

    const response = await call(`/api/v1/notification-templates/${template.id}`, {
      method: 'PATCH',
      // If-Match volontairement PERIME (present, mais faux) : sans la garde
      // de capability EN PREMIER, ce serait un 409 qui sortirait avant le
      // 403 attendu (428 est un cas structurel distinct, deja couvert par le
      // test precedent, testable seul quand l acteur A le droit).
      headers: { ...jsonHeaders, 'If-Match': '"peu-importe"' },
      body: JSON.stringify({ is_active: false }),
    });
    expect(response.status).toBe(403);
  });

  it('qa-review B1 (MAJEUR) — updateNotificationTemplate revalide la forme par canal sur l ETAT RESULTANT (jamais un 500)', async () => {
    const template = seedTemplate({ channel: 'email', subject: 'Sujet initial', body: 'Corps initial' });
    const fresh1 = await call(`/api/v1/notification-templates/${template.id}`, { headers: asUser });
    const etag1 = fresh1.headers.get('etag')!;

    // Retirer le sujet d un modele EMAIL doit etre refuse (422), jamais un
    // 500 : avant correctif, `merged` ne portait pas `channel` et
    // `assertBusinessRules` ne revalidait donc jamais cette regle au PATCH.
    const subjectRemoved = await call(`/api/v1/notification-templates/${template.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag1 },
      body: JSON.stringify({ subject: null }),
    });
    expect(subjectRemoved.status).toBe(422);
    const subjectBody = (await subjectRemoved.json()) as { code: string; errors?: Array<{ field: string }> };
    expect(subjectBody.code).toBe('api.validation_failed');
    expect(subjectBody.errors?.some((e) => e.field === 'subject')).toBe(true);

    // Le modele n a PAS ete modifie par la tentative refusee.
    const unchanged = await call(`/api/v1/notification-templates/${template.id}`, { headers: asUser });
    const { data: unchangedData } = (await unchanged.json()) as { data: NotificationTemplateDto };
    expect(unchangedData.subject).toBe('Sujet initial');
  });

  it('qa-review B1 — updateNotificationTemplate refuse un corps SMS > 480 caracteres, sur un modele DEJA sms', async () => {
    const smsTemplate = seedTemplate({ channel: 'sms', subject: null, body: 'Corps sms initial' });
    const fresh = await call(`/api/v1/notification-templates/${smsTemplate.id}`, { headers: asUser });
    const etag = fresh.headers.get('etag')!;

    const tooLong = await call(`/api/v1/notification-templates/${smsTemplate.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({ body: 'x'.repeat(600) }),
    });
    expect(tooLong.status).toBe(422);
    const body = (await tooLong.json()) as { code: string; errors?: Array<{ field: string }> };
    expect(body.code).toBe('api.validation_failed');
    expect(body.errors?.some((e) => e.field === 'body')).toBe(true);
  });

  it('qa-review B1 — updateNotificationTemplate refuse d ajouter un sujet a un modele SMS', async () => {
    const smsTemplate = seedTemplate({ channel: 'sms', subject: null, body: 'Corps sms' });
    const fresh = await call(`/api/v1/notification-templates/${smsTemplate.id}`, { headers: asUser });
    const etag = fresh.headers.get('etag')!;

    // `subject` sur `sms` n est meme pas dans le schema de mise a jour tel
    // quel ? Si — `UpdateNotificationTemplateCommand.subject` existe (nullable),
    // et sa presence EST le cas a couvrir : poser un sujet sur un modele sms.
    const response = await call(`/api/v1/notification-templates/${smsTemplate.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({ subject: 'Interdit sur sms' }),
    });
    expect(response.status).toBe(422);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('api.validation_failed');
  });

  it('previewNotificationTemplate : 200 (jamais 201), rend le jeu d exemple, AUCUN envoi', async () => {
    const template = seedTemplate({
      channel: 'email',
      subject: 'Commande {{order.number}}',
      body: 'Étape atteinte : {{step.label}}, précédemment {{step.previous_label}}.',
    });

    const response = await call(`/api/v1/notification-templates/${template.id}/previews`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({}),
    });
    await expectContract(response, { status: 200, dataSchema: 'NotificationPreview' });
    const { data } = (await response.json()) as {
      data: { subject: string | null; body: string; character_count: number; sms_segment_count: number | null };
    };
    expect(data.subject).toContain('CDE-');
    expect(data.body).not.toContain('{{');
    expect(data.character_count).toBe(data.body.length);
    expect(data.sms_segment_count).toBeNull();
  });

  it('previewNotificationTemplate : une balise inconnue dans le texte SOUMIS (ecran) est refusee, jamais rendue', async () => {
    const template = seedTemplate({ event_name: 'customer.created', channel: 'email' });

    const response = await call(`/api/v1/notification-templates/${template.id}/previews`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ subject: 'Bonjour', body: 'Étape : {{step.label}}.' }),
    });
    expect(response.status).toBe(422);
    expect(((await response.json()) as { code: string }).code).toBe('notification_template.unknown_tag');
  });

  it('renderNotificationTags — une valeur substituee n est jamais re-balayee (une raison sociale contenant {{order.number}} n est pas interpretee)', async () => {
    const template = seedTemplate({
      event_name: 'customer.created',
      channel: 'email',
      subject: 'Bonjour {{customer.company_name}}',
      body: 'Bienvenue.',
    });

    const response = await call(`/api/v1/notification-templates/${template.id}/previews`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({}),
    });
    const { data } = (await response.json()) as { data: { subject: string | null } };
    // L exemple du catalogue pour customer.company_name est une chaine fixe
    // ("Client Exemple SARL"), sans accolade : ce test verifie surtout que le
    // moteur ne relit jamais sa propre sortie (voir le test unitaire dedie du
    // moteur de rendu pour le cas explicite d une valeur contenant `{{}}`).
    expect(data.subject).toBe('Bonjour Client Exemple SARL');
  });
});
