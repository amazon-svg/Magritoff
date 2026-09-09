/**
 * Module Gabarits PDF de documents contre le contrat (story E10.10b-4a).
 *
 * Exerce reellement `createDocumentTemplatesRoutes()` via
 * `createGescomApiHandler`, avec un `DocumentTemplatesRepository` en memoire
 * (`InMemoryDocumentTemplatesRepository`, aucune dependance a Supabase ni a
 * `pdf-lib`). Chaque reponse est confrontee au contrat via
 * `checkResponseAgainstContract`.
 *
 * Les REGLES TENUES EN BASE (unicite, plafond, bascule `is_default`,
 * `geometry_changed`) sont verifiees REELLEMENT par
 * `tests/sql/gescom-e10-10b-4a-document-pdf-templates.sql` — ce fichier
 * valide la FORME HTTP/JSON (enveloppe, ETag, codes d erreur, gardes) contre
 * le contrat, pas l implementation SQL sous-jacente. L inspection PDF elle-
 * meme (`pdf-lib`) a son propre test unitaire, execute pour de vrai :
 * `tests/modules/document-templates/pdf-template-inspector.test.ts`.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { parseId, type TenantId, type UserId } from '@/kernel';
import {
  InMemoryIdempotencyStore,
  type ApiPrincipal,
  type PrincipalVerifier,
} from '@/modules/_shared/application';
import { DocumentTemplatesService } from '@/modules/document-templates/application/document-templates-service';
import type { DocumentPdfTemplateDetailDto, DocumentPdfTemplateDto } from '@/modules/document-templates/api/contracts';
import { createDocumentTemplatesRoutes } from '@/server/api/document-templates-routes';
import { createGescomApiHandler } from '@/server/api';
import {
  InMemoryDocumentTemplatesRepository,
  fakeTemplateUuid,
} from './_fakes/document-templates-repository.fake.ts';
import { checkResponseAgainstContract } from './_harness.ts';

const TENANT = brand<TenantId>('7f0d2a1e-1c4b-4f8a-9c3d-5b6e7a8f9013');
const USER = brand<UserId>('a1b2c3d4-e5f6-4708-8910-1a2b3c4d5e70');

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
  return `idem-doc-tpl-${sequence}`;
}

let repository: InMemoryDocumentTemplatesRepository;
let handler: (request: Request) => Promise<Response>;

beforeEach(() => {
  repository = new InMemoryDocumentTemplatesRepository();
  const service = new DocumentTemplatesService({ repository });
  handler = createGescomApiHandler({
    routes: createDocumentTemplatesRoutes(service),
    principalVerifier: verifier,
    idempotencyStore: new InMemoryIdempotencyStore(),
    requestIdFactory: () => 'req-e10-10b-4a',
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

function seedTemplate(overrides: Partial<Parameters<InMemoryDocumentTemplatesRepository['seedForTest']>[0]> = {}) {
  const id = overrides.id ?? fakeTemplateUuid();
  repository.seedForTest({ id, tenant_id: TENANT, ...overrides });
  return id;
}

const PAGE_A4 = [{ index: 0, width_pt: 595.28, height_pt: 841.89 }];

describe('module Gabarits PDF de documents (E10.10b-4a) contre le contrat', () => {
  it('listDocumentPdfTemplates : liste vide legitime, puis triee par nom, sans ETag ni pagination', async () => {
    const empty = await call('/api/v1/document-pdf-templates', { headers: asUser });
    await expectContract(empty, { status: 200 });
    expect(empty.headers.get('etag')).toBeNull();
    const { data: emptyData } = (await empty.json()) as { data: DocumentPdfTemplateDto[] };
    expect(emptyData).toEqual([]);

    seedTemplate({ name: 'Papier B' });
    seedTemplate({ name: 'Papier A' });

    const response = await call('/api/v1/document-pdf-templates', { headers: asUser });
    await expectContract(response, { status: 200 });
    const { data } = (await response.json()) as { data: DocumentPdfTemplateDto[] };
    expect(data.map((t) => t.name)).toEqual(['Papier A', 'Papier B']);
  });

  it('createDocumentPdfTemplate : cree awaiting_upload + billet d import, capability requise', async () => {
    repository.setActorCapabilityForTest(TENANT, USER, 'can_manage_document_templates', false);
    const forbidden = await call('/api/v1/document-pdf-templates', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({ name: 'Papier à en-tête' }),
    });
    expect(forbidden.status).toBe(403);

    repository.setActorCapabilityForTest(TENANT, USER, 'can_manage_document_templates', true);
    const response = await call('/api/v1/document-pdf-templates', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({ name: 'Papier à en-tête' }),
    });
    await expectContract(response, { status: 201, dataSchema: 'DocumentPdfTemplateCreated' });
    expect(response.headers.get('etag')).toBeTruthy();
    const { data } = (await response.json()) as { data: { template: DocumentPdfTemplateDetailDto; upload: unknown } };
    expect(data.template.status).toBe('awaiting_upload');
    expect(data.template.is_default).toBe(false);
    expect(data.upload).toBeTruthy();
  });

  it('updateDocumentPdfTemplate/deleteDocumentPdfTemplate/issueDocumentPdfTemplateUploadUrl/confirmDocumentPdfTemplateUpload : 403 sans can_manage_document_templates (qa-review N2)', async () => {
    repository.setActorCapabilityForTest(TENANT, USER, 'can_manage_document_templates', false);

    const id = seedTemplate({ status: 'awaiting_upload' });
    const fresh = await call(`/api/v1/document-pdf-templates/${id}`, { headers: asUser });
    const etag = fresh.headers.get('etag')!;

    const update = await call(`/api/v1/document-pdf-templates/${id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({ name: 'Renomme sans droit' }),
    });
    expect(update.status).toBe(403);

    const issueUploadUrl = await call(`/api/v1/document-pdf-templates/${id}/upload-urls`, {
      method: 'POST',
      headers: asUser,
    });
    expect(issueUploadUrl.status).toBe(403);

    const confirm = await call(`/api/v1/document-pdf-templates/${id}/uploads`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({}),
    });
    expect(confirm.status).toBe(403);

    const remove = await call(`/api/v1/document-pdf-templates/${id}`, { method: 'DELETE', headers: asUser });
    expect(remove.status).toBe(403);
  });

  it('createDocumentPdfTemplate : nom deja pris (normalise) pour le meme type -> 409 name_conflict', async () => {
    seedTemplate({ name: 'Papier' });

    const response = await call('/api/v1/document-pdf-templates', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({ name: '  PAPIER  ' }),
    });
    expect(response.status).toBe(409);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('document_pdf_template.name_conflict');
  });

  it('createDocumentPdfTemplate : plafond de 20 gabarits atteint -> 422 limit_reached', async () => {
    for (let index = 0; index < 20; index += 1) {
      seedTemplate({ name: `Papier ${index}` });
    }

    const response = await call('/api/v1/document-pdf-templates', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({ name: 'Papier de trop' }),
    });
    expect(response.status).toBe(422);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('document_pdf_template.limit_reached');
  });

  it('getDocumentPdfTemplate : fiche + ETag ; 404 si introuvable dans ce tenant', async () => {
    const id = seedTemplate();

    const response = await call(`/api/v1/document-pdf-templates/${id}`, { headers: asUser });
    await expectContract(response, { status: 200, dataSchema: 'DocumentPdfTemplateDetail' });
    expect(response.headers.get('etag')).toBeTruthy();

    const missing = await call(`/api/v1/document-pdf-templates/${fakeTemplateUuid()}`, { headers: asUser });
    expect(missing.status).toBe(404);
    const missingBody = (await missing.json()) as { code: string };
    expect(missingBody.code).toBe('document_pdf_template.not_found');
  });

  it('updateDocumentPdfTemplate : If-Match exige (428 si absent, 409 si perime), renommage/desactivation appliques', async () => {
    const id = seedTemplate({ name: 'Ancien nom' });

    const withoutIfMatch = await call(`/api/v1/document-pdf-templates/${id}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ name: 'Nouveau nom' }),
    });
    expect(withoutIfMatch.status).toBe(428);

    const staleIfMatch = await call(`/api/v1/document-pdf-templates/${id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': '"perime"' },
      body: JSON.stringify({ name: 'Nouveau nom' }),
    });
    expect(staleIfMatch.status).toBe(409);

    const fresh = await call(`/api/v1/document-pdf-templates/${id}`, { headers: asUser });
    const etag = fresh.headers.get('etag')!;

    const updated = await call(`/api/v1/document-pdf-templates/${id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({ name: 'Nouveau nom', is_active: false }),
    });
    await expectContract(updated, { status: 200, dataSchema: 'DocumentPdfTemplateDetail' });
    const { data } = (await updated.json()) as { data: DocumentPdfTemplateDetailDto };
    expect(data.name).toBe('Nouveau nom');
    expect(data.is_active).toBe(false);
  });

  it('updateDocumentPdfTemplate : is_default=true refuse tant que le gabarit n est pas ready -> 409 default_requires_ready', async () => {
    const id = seedTemplate({ status: 'awaiting_upload' });
    const fresh = await call(`/api/v1/document-pdf-templates/${id}`, { headers: asUser });
    const etag = fresh.headers.get('etag')!;

    const response = await call(`/api/v1/document-pdf-templates/${id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({ is_default: true }),
    });
    expect(response.status).toBe(409);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('document_pdf_template.default_requires_ready');
  });

  it('updateDocumentPdfTemplate : is_default=true retire le drapeau au gabarit precedent DANS LA MEME operation', async () => {
    const previousDefault = seedTemplate({
      name: 'Ancien defaut',
      status: 'ready',
      is_default: true,
      page_count: 1,
      pages: PAGE_A4,
    });
    const candidate = seedTemplate({ name: 'Nouveau defaut', status: 'ready', page_count: 1, pages: PAGE_A4 });

    const fresh = await call(`/api/v1/document-pdf-templates/${candidate}`, { headers: asUser });
    const etag = fresh.headers.get('etag')!;

    const response = await call(`/api/v1/document-pdf-templates/${candidate}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({ is_default: true }),
    });
    await expectContract(response, { status: 200, dataSchema: 'DocumentPdfTemplateDetail' });
    const { data } = (await response.json()) as { data: DocumentPdfTemplateDetailDto };
    expect(data.is_default).toBe(true);

    const previous = await call(`/api/v1/document-pdf-templates/${previousDefault}`, { headers: asUser });
    const { data: previousData } = (await previous.json()) as { data: DocumentPdfTemplateDetailDto };
    expect(previousData.is_default).toBe(false);
  });

  it('deleteDocumentPdfTemplate : reussit ; 404 hors tenant', async () => {
    const id = seedTemplate();

    const missing = await call(`/api/v1/document-pdf-templates/${fakeTemplateUuid()}`, {
      method: 'DELETE',
      headers: asUser,
    });
    expect(missing.status).toBe(404);

    const deleted = await call(`/api/v1/document-pdf-templates/${id}`, { method: 'DELETE', headers: asUser });
    await expectContract(deleted, { status: 200 });
    const { data } = (await deleted.json()) as { data: { deleted: true } };
    expect(data.deleted).toBe(true);
  });

  it('issueDocumentPdfTemplateUploadUrl : 200 sans Idempotency-Key, rend un billet NEUF a chaque appel', async () => {
    const id = seedTemplate();

    const first = await call(`/api/v1/document-pdf-templates/${id}/upload-urls`, {
      method: 'POST',
      headers: asUser,
    });
    await expectContract(first, { status: 200, dataSchema: 'DocumentPdfTemplateUploadTicket' });
    const { data: firstTicket } = (await first.json()) as { data: { token: string } };

    const second = await call(`/api/v1/document-pdf-templates/${id}/upload-urls`, {
      method: 'POST',
      headers: asUser,
    });
    const { data: secondTicket } = (await second.json()) as { data: { token: string } };
    expect(secondTicket.token).not.toBe(firstTicket.token);
  });

  it('confirmDocumentPdfTemplateUpload : fait passer le gabarit a ready, geometrie enregistree', async () => {
    const id = seedTemplate({ status: 'awaiting_upload' });
    repository.stagePdfForTest(id, 1, PAGE_A4);

    const response = await call(`/api/v1/document-pdf-templates/${id}/uploads`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({}),
    });
    await expectContract(response, { status: 201, dataSchema: 'DocumentPdfTemplateDetail' });
    const { data } = (await response.json()) as { data: DocumentPdfTemplateDetailDto };
    expect(data.status).toBe('ready');
    expect(data.page_count).toBe(1);
    expect(data.pages).toEqual(PAGE_A4);
    expect(data.background_url).toBeTruthy();
  });

  it('confirmDocumentPdfTemplateUpload : aucun fichier depose -> 404 upload_missing', async () => {
    const id = seedTemplate({ status: 'awaiting_upload' });

    const response = await call(`/api/v1/document-pdf-templates/${id}/uploads`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(404);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('document_pdf_template.upload_missing');
  });

  it('confirmDocumentPdfTemplateUpload : fichier illisible -> 422 invalid_pdf', async () => {
    const id = seedTemplate({ status: 'awaiting_upload' });
    repository.stageInvalidPdfForTest(id);

    const response = await call(`/api/v1/document-pdf-templates/${id}/uploads`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(422);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('document_pdf_template.invalid_pdf');
  });

  it('confirmDocumentPdfTemplateUpload : geometrie modifiee sur un gabarit READY avec carte non vide -> 409, sauf reset_fields', async () => {
    const id = seedTemplate({
      status: 'ready',
      page_count: 1,
      pages: PAGE_A4,
      lines_block: { anchor_x: 10, anchor_y: 10, row_height: 12, rows_per_page: 20, columns: [] },
    });
    const newGeometry = [{ index: 0, width_pt: 612, height_pt: 792 }];
    repository.stagePdfForTest(id, 1, newGeometry);

    const refused = await call(`/api/v1/document-pdf-templates/${id}/uploads`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({}),
    });
    expect(refused.status).toBe(409);
    const refusedBody = (await refused.json()) as { code: string };
    expect(refusedBody.code).toBe('document_pdf_template.geometry_changed');

    repository.stagePdfForTest(id, 1, newGeometry);
    const accepted = await call(`/api/v1/document-pdf-templates/${id}/uploads`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({ reset_fields: true }),
    });
    await expectContract(accepted, { status: 201, dataSchema: 'DocumentPdfTemplateDetail' });
    const { data } = (await accepted.json()) as { data: DocumentPdfTemplateDetailDto };
    expect(data.pages).toEqual(newGeometry);
    expect(data.has_field_map).toBe(false);
  });

  it('createDocumentPdfTemplate is_default -> applique SEULEMENT a la confirmation d import (contrat)', async () => {
    const existingDefault = seedTemplate({ name: 'Defaut actuel', status: 'ready', page_count: 1, pages: PAGE_A4, is_default: true });

    const created = await call('/api/v1/document-pdf-templates', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({ name: 'Futur defaut', is_default: true }),
    });
    const { data: createdData } = (await created.json()) as { data: { template: DocumentPdfTemplateDetailDto } };
    // Toujours awaiting_upload : le drapeau n est pas encore applique.
    expect(createdData.template.is_default).toBe(false);

    const stillDefault = await call(`/api/v1/document-pdf-templates/${existingDefault}`, { headers: asUser });
    const { data: stillDefaultData } = (await stillDefault.json()) as { data: DocumentPdfTemplateDetailDto };
    expect(stillDefaultData.is_default).toBe(true);

    repository.stagePdfForTest(createdData.template.id, 1, PAGE_A4);
    const confirmed = await call(`/api/v1/document-pdf-templates/${createdData.template.id}/uploads`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({}),
    });
    const { data: confirmedData } = (await confirmed.json()) as { data: DocumentPdfTemplateDetailDto };
    expect(confirmedData.is_default).toBe(true);

    const previousDefault = await call(`/api/v1/document-pdf-templates/${existingDefault}`, { headers: asUser });
    const { data: previousDefaultData } = (await previousDefault.json()) as { data: DocumentPdfTemplateDetailDto };
    expect(previousDefaultData.is_default).toBe(false);
  });

  it('lecture (list/get) ouverte a tout membre du tenant, SANS can_manage_document_templates', async () => {
    repository.setActorCapabilityForTest(TENANT, USER, 'can_manage_document_templates', false);
    const id = seedTemplate();

    const list = await call('/api/v1/document-pdf-templates', { headers: asUser });
    expect(list.status).toBe(200);

    const get = await call(`/api/v1/document-pdf-templates/${id}`, { headers: asUser });
    expect(get.status).toBe(200);
  });

  // ── E10.10b-4b — GET/PUT .../fields ─────────────────────────────────────

  it('getDocumentPdfTemplateFields : carte VIDE legitime sur un gabarit fraichement pret, ETag distinct du gabarit, lecture ouverte a tout membre', async () => {
    repository.setActorCapabilityForTest(TENANT, USER, 'can_manage_document_templates', false);
    const id = seedTemplate({ status: 'ready', page_count: 1, pages: PAGE_A4 });

    const response = await call(`/api/v1/document-pdf-templates/${id}/fields`, { headers: asUser });
    await expectContract(response, { status: 200, dataSchema: 'DocumentPdfTemplateFieldMap' });
    const fieldsEtag = response.headers.get('etag')!;
    expect(fieldsEtag).toBeTruthy();
    const { data } = (await response.json()) as { data: { placements: unknown[]; lines_block: unknown } };
    expect(data.placements).toEqual([]);
    expect(data.lines_block).toBeNull();

    const templateResponse = await call(`/api/v1/document-pdf-templates/${id}`, { headers: asUser });
    expect(templateResponse.headers.get('etag')).not.toBe(fieldsEtag);
  });

  it('getDocumentPdfTemplateFields : 404 hors tenant', async () => {
    const response = await call(`/api/v1/document-pdf-templates/${fakeTemplateUuid()}/fields`, { headers: asUser });
    expect(response.status).toBe(404);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('document_pdf_template.not_found');
  });

  it('replaceDocumentPdfTemplateFields : capability requise, If-Match exige (428 si absent, 409 si perime)', async () => {
    const id = seedTemplate({ status: 'ready', page_count: 1, pages: PAGE_A4 });
    const command = { placements: [], lines_block: null };

    repository.setActorCapabilityForTest(TENANT, USER, 'can_manage_document_templates', false);
    // If-Match SYNTAXIQUEMENT valide mais non lu : la garde de capability est
    // verifiee AVANT toute lecture de la ressource qui alimenterait l ETag
    // (meme ordre que updateDocumentPdfTemplate), donc un 403 doit sortir
    // meme sans connaitre l ETag courant.
    const forbidden = await call(`/api/v1/document-pdf-templates/${id}/fields`, {
      method: 'PUT',
      headers: { ...jsonHeaders, 'If-Match': '"peu-importe"' },
      body: JSON.stringify(command),
    });
    expect(forbidden.status).toBe(403);
    repository.setActorCapabilityForTest(TENANT, USER, 'can_manage_document_templates', true);

    const withoutIfMatch = await call(`/api/v1/document-pdf-templates/${id}/fields`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify(command),
    });
    expect(withoutIfMatch.status).toBe(428);

    const staleIfMatch = await call(`/api/v1/document-pdf-templates/${id}/fields`, {
      method: 'PUT',
      headers: { ...jsonHeaders, 'If-Match': '"perime"' },
      body: JSON.stringify(command),
    });
    expect(staleIfMatch.status).toBe(409);
  });

  it('replaceDocumentPdfTemplateFields : remplace la carte ENTIERE (placement simple + tableau de lignes), rendue par une lecture ulterieure', async () => {
    const id = seedTemplate({ status: 'ready', page_count: 1, pages: PAGE_A4 });
    const fresh = await call(`/api/v1/document-pdf-templates/${id}/fields`, { headers: asUser });
    const etag = fresh.headers.get('etag')!;

    const command = {
      placements: [
        {
          field: 'totals.total_incl_tax',
          page_index: 0,
          x: 400,
          y: 700,
          width: 150,
          max_lines: 1,
          align: 'right',
          font: 'helvetica-bold',
          font_size: 14,
          color: '#111111',
        },
      ],
      lines_block: {
        page_index: 0,
        first_row_baseline_y: 600,
        row_height: 16,
        rows_per_page: 20,
        continuation_page_index: null,
        columns: [
          { field: 'line.label', x: 50, width: 300, align: 'left', font: 'helvetica', font_size: 10, color: '#111111' },
          { field: 'line.price', x: 400, width: 100, align: 'right', font: 'helvetica', font_size: 10, color: '#111111' },
        ],
      },
    };

    const response = await call(`/api/v1/document-pdf-templates/${id}/fields`, {
      method: 'PUT',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify(command),
    });
    await expectContract(response, { status: 200, dataSchema: 'DocumentPdfTemplateFieldMap' });
    const { data } = (await response.json()) as { data: { placements: unknown[]; lines_block: unknown } };
    expect(data.placements).toHaveLength(1);
    expect(data.lines_block).toBeTruthy();

    // Rendue par une lecture ULTERIEURE (relue, pas rejouee depuis la commande).
    const reread = await call(`/api/v1/document-pdf-templates/${id}/fields`, { headers: asUser });
    const { data: rereadData } = (await reread.json()) as { data: { placements: unknown[] } };
    expect(rereadData.placements).toHaveLength(1);

    // has_field_map (D1) COMPLETE : un placement suffit, meme sans avoir
    // besoin du tableau de lignes.
    const template = await call(`/api/v1/document-pdf-templates/${id}`, { headers: asUser });
    const { data: templateData } = (await template.json()) as { data: { has_field_map: boolean } };
    expect(templateData.has_field_map).toBe(true);
  });

  it('replaceDocumentPdfTemplateFields : gabarit non ready -> 409 upload_required', async () => {
    const id = seedTemplate({ status: 'awaiting_upload' });
    // ETag de la carte d un gabarit non ready (carte forcement vide) — via
    // getFields, qui reste lisible meme si le gabarit n est pas encore pret
    // (la lecture n est jamais conditionnee par le statut).
    const fresh = await call(`/api/v1/document-pdf-templates/${id}/fields`, { headers: asUser });
    const etag = fresh.headers.get('etag')!;

    const response = await call(`/api/v1/document-pdf-templates/${id}/fields`, {
      method: 'PUT',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({ placements: [], lines_block: null }),
    });
    expect(response.status).toBe(409);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('document_pdf_template.upload_required');
  });

  it('replaceDocumentPdfTemplateFields : page inexistante -> 422 invalid_field_map avec le detail par champ', async () => {
    const id = seedTemplate({ status: 'ready', page_count: 1, pages: PAGE_A4 });
    const fresh = await call(`/api/v1/document-pdf-templates/${id}/fields`, { headers: asUser });
    const etag = fresh.headers.get('etag')!;

    const response = await call(`/api/v1/document-pdf-templates/${id}/fields`, {
      method: 'PUT',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({
        placements: [
          {
            field: 'quote.number',
            page_index: 5,
            x: 10,
            y: 10,
            align: 'left',
            font: 'helvetica',
            font_size: 10,
            color: '#111111',
          },
        ],
        lines_block: null,
      }),
    });
    expect(response.status).toBe(422);
    const body = (await response.json()) as { code: string; errors?: Array<{ field: string }> };
    expect(body.code).toBe('document_pdf_template.invalid_field_map');
    expect(body.errors?.length).toBeGreaterThan(0);
  });

  it('replaceDocumentPdfTemplateFields : champ place deux fois -> 422 invalid_field_map', async () => {
    const id = seedTemplate({ status: 'ready', page_count: 1, pages: PAGE_A4 });
    const fresh = await call(`/api/v1/document-pdf-templates/${id}/fields`, { headers: asUser });
    const etag = fresh.headers.get('etag')!;

    const placement = {
      field: 'quote.number',
      page_index: 0,
      x: 10,
      y: 10,
      align: 'left',
      font: 'helvetica',
      font_size: 10,
      color: '#111111',
    };
    const response = await call(`/api/v1/document-pdf-templates/${id}/fields`, {
      method: 'PUT',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({ placements: [placement, { ...placement, x: 20 }], lines_block: null }),
    });
    expect(response.status).toBe(422);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('document_pdf_template.invalid_field_map');
  });

  it('replaceDocumentPdfTemplateFields : un champ order.* sur un gabarit quote -> 422 invalid_field_map (E10.19a, sous-ensemble par type)', async () => {
    const id = seedTemplate({ document_type: 'quote', status: 'ready', page_count: 1, pages: PAGE_A4 });
    const fresh = await call(`/api/v1/document-pdf-templates/${id}/fields`, { headers: asUser });
    const etag = fresh.headers.get('etag')!;

    const response = await call(`/api/v1/document-pdf-templates/${id}/fields`, {
      method: 'PUT',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({
        placements: [
          { field: 'order.number', page_index: 0, x: 10, y: 10, align: 'left', font: 'helvetica', font_size: 10, color: '#111111' },
        ],
        lines_block: null,
      }),
    });
    expect(response.status).toBe(422);
    const body = (await response.json()) as { code: string; errors?: Array<{ field: string }> };
    expect(body.code).toBe('document_pdf_template.invalid_field_map');
    expect(body.errors?.length).toBeGreaterThan(0);
  });

  it('replaceDocumentPdfTemplateFields : un champ order.* sur un gabarit order -> accepte (E10.19a)', async () => {
    const id = seedTemplate({ document_type: 'order', status: 'ready', page_count: 1, pages: PAGE_A4 });
    const fresh = await call(`/api/v1/document-pdf-templates/${id}/fields`, { headers: asUser });
    const etag = fresh.headers.get('etag')!;

    const response = await call(`/api/v1/document-pdf-templates/${id}/fields`, {
      method: 'PUT',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({
        placements: [
          { field: 'order.number', page_index: 0, x: 10, y: 10, align: 'left', font: 'helvetica', font_size: 10, color: '#111111' },
        ],
        lines_block: null,
      }),
    });
    await expectContract(response, { status: 200, dataSchema: 'DocumentPdfTemplateFieldMap' });
  });

  it('replaceDocumentPdfTemplateFields : un champ quote.* sur un gabarit order -> 422 invalid_field_map (E10.19a)', async () => {
    const id = seedTemplate({ document_type: 'order', status: 'ready', page_count: 1, pages: PAGE_A4 });
    const fresh = await call(`/api/v1/document-pdf-templates/${id}/fields`, { headers: asUser });
    const etag = fresh.headers.get('etag')!;

    const response = await call(`/api/v1/document-pdf-templates/${id}/fields`, {
      method: 'PUT',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({
        placements: [
          { field: 'quote.number', page_index: 0, x: 10, y: 10, align: 'left', font: 'helvetica', font_size: 10, color: '#111111' },
        ],
        lines_block: null,
      }),
    });
    expect(response.status).toBe(422);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('document_pdf_template.invalid_field_map');
  });

  it('replaceDocumentPdfTemplateFields : alignement centre sans largeur -> 422 invalid_field_map', async () => {
    const id = seedTemplate({ status: 'ready', page_count: 1, pages: PAGE_A4 });
    const fresh = await call(`/api/v1/document-pdf-templates/${id}/fields`, { headers: asUser });
    const etag = fresh.headers.get('etag')!;

    const response = await call(`/api/v1/document-pdf-templates/${id}/fields`, {
      method: 'PUT',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({
        placements: [
          {
            field: 'quote.number',
            page_index: 0,
            x: 10,
            y: 10,
            align: 'center',
            font: 'helvetica',
            font_size: 10,
            color: '#111111',
          },
        ],
        lines_block: null,
      }),
    });
    expect(response.status).toBe(422);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('document_pdf_template.invalid_field_map');
  });

  it('replaceDocumentPdfTemplateFields : bloc de lignes sans colonne -> refuse (schema Zod, minItems 1)', async () => {
    const id = seedTemplate({ status: 'ready', page_count: 1, pages: PAGE_A4 });
    const fresh = await call(`/api/v1/document-pdf-templates/${id}/fields`, { headers: asUser });
    const etag = fresh.headers.get('etag')!;

    const response = await call(`/api/v1/document-pdf-templates/${id}/fields`, {
      method: 'PUT',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({
        placements: [],
        lines_block: {
          page_index: 0,
          first_row_baseline_y: 100,
          row_height: 12,
          rows_per_page: 5,
          continuation_page_index: null,
          columns: [],
        },
      }),
    });
    expect(response.status).toBe(422);
  });
});
