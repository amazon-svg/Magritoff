import { expect, test } from '@playwright/test';
import { loginAs } from './_helpers/auth';
import type { ImportHopeStudioBasketItemCommand, ProjectItemDto } from '../../src/modules/projects/api/contracts';

/** Real vendor bundle and production workspace; provider and project writes are simulated. */
test('HopeStudio orchestre le brief puis importe le prix de l’offre sélectionnée', async ({ page, context }) => {
  test.setTimeout(60_000);
  const projectId = '10000000-0000-4000-8000-000000000001';
  const project = {
    id: projectId, tenant_id: '10000000-0000-4000-8000-000000000002',
    customer_id: '10000000-0000-4000-8000-000000000003', name: 'Recette HopeStudio simulée',
    status: 'active', hopstudio_session_id: null as string | null, tags: [], created_by: null,
    created_at: '2026-10-05T12:00:00Z', updated_at: '2026-10-05T12:00:00Z',
  };
  const card = {
    UID: 'fixture-card', DBK: 'fixture-card-data', selected: 'flyer',
    prompt: 'Je veux 500 flyers A5', message: 'Flyer A5, recto verso, 500 exemplaires.',
    configuration: { quantity: 500 }, fields: [], infos: { name: 'flyer', title: 'Flyer A5' },
    ui_event: { event: 'fixture-product' },
    clicked_intent: { getPrice: { response: 80, all_process: [
      { printer: 'Offre B simulée', total: 125.5, delais: 5 },
      { printer: 'Offre A simulée', total: 80, delais: 7 },
    ], quote_process: '', quote_process_key: '' } },
  };
  const actions: string[] = [];
  const imports: { body: ImportHopeStudioBasketItemCommand; key: string | undefined }[] = [];
  const items: ProjectItemDto[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  // No provider request can leave the browser, including fallback calls.
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== new URL(test.info().project.use.baseURL as string).origin) {
      await route.abort();
      return;
    }
    if (/\/integrations\/hopstudio\/workflow$/.test(url.pathname)) {
      const command = route.request().postDataJSON();
      const action = new URLSearchParams(command.context.body).get('action') ?? '';
      actions.push(action);
      let response: unknown;
      if (action === 'CallAI') response = { response: {
        session: { UID: 'fixture-session', DBK: 'fixture-session-data', history: [], events: [] },
        event: { prompt: card.prompt, message: 'Offres simulées', deck: [card.DBK] },
      } };
      else if (['loadSession', 'newSession'].includes(action)) response = { status: 'ok', datas: {
        UID: 'fixture-session', DBK: 'fixture-session-data', history: [], events: [],
      } };
      else if (action === 'loadSessionParts') response = { status: 'ok', datas: card };
      else if (action === 'getSessionTitle') response = { session_title: 'Recette simulée' };
      else if (action === 'GetSVG_List') response = { response: [], warnings: [] };
      else if (['loadBasket', 'GetPublicAlias'].includes(action)) response = { datas: [], response: {} };
      else throw new Error(`Action HopeStudio inattendue : ${action}`);
      await route.fulfill({ json: response });
      return;
    }
    if (/\/integrations\/hopstudio$/.test(url.pathname)) {
      await route.fulfill({ json: { enabled: true, hopeStudioUrl: null,
        clariprintUser: null, clariprintPasswordConfigured: false, clariprintUrl: null } });
      return;
    }
    if (url.pathname === '/api/v1/projects') {
      await route.fulfill({ json: { data: [project], meta: { request_id: 'fixture-request' } } });
      return;
    }
    if (url.pathname === `/api/v1/projects/${projectId}/hopstudio-items`) {
      const body = route.request().postDataJSON() as ImportHopeStudioBasketItemCommand;
      imports.push({ body, key: route.request().headers()['idempotency-key'] });
      const item = { id: '10000000-0000-4000-8000-000000000004', project_id: projectId,
        label: 'Flyer A5 simulé', description_html: body.description_html ?? null,
        quote_payload: body.card, clariprint_config: body.card.configuration,
        position: 0, created_at: project.created_at };
      items.push(item);
      await route.fulfill({ json: { data: item, meta: { request_id: 'fixture-request' } } });
      return;
    }
    if (url.pathname === `/api/v1/projects/${projectId}`) {
      if (route.request().method() === 'PATCH') {
        project.hopstudio_session_id = route.request().postDataJSON().hopstudio_session_id;
      }
      await route.fulfill({ headers: { ETag: '"fixture-1"' }, json: {
        data: route.request().method() === 'PATCH' ? project : { ...project, items }, meta: { request_id: 'fixture-request' },
      } });
      return;
    }
    // Fail closed if the workspace accidentally switches to the direct assistant.
    if (url.pathname.includes('/assistant/')) throw new Error('Appel direct de l’assistant inattendu');
    await route.continue();
  });
  await loginAs(page, process.env.E2E_USER_EMAIL ?? 'developer@magrit.local',
    process.env.E2E_USER_PASSWORD ?? 'magrit-development-only');
  await page.goto(`/t/${process.env.E2E_TENANT_SLUG ?? 'magrit-development'}`);
  await page.getByRole('button', { name: /Recette HopeStudio simulée/ }).click();
  await page.locator('#magrit-configurator-prompt').fill(card.prompt);
  await page.getByRole('button', { name: 'Envoyer', exact: true }).click();
  await expect(page.locator('[data-card-uid="fixture-card"]')).toBeVisible({ timeout: 25_000 });
  await page.locator('[data-card-uid="fixture-card"] .u-btn-price').click();
  const offer = page.locator('#chat-modal tr').filter({ hasText: 'Offre B simulée' });
  await offer.getByRole('button', { name: 'Ajouter au panier' }).click();
  await expect(page.getByText('Chiffrage ajouté au projet.', { exact: true })).toBeVisible();
  expect(imports).toHaveLength(1);
  expect(imports[0].body.card.clicked_intent.getPrice.response).toBe(125.5);
  expect(imports[0].body.card.configuration).toEqual(card.configuration);
  expect(imports[0].key).toBeTruthy();
  expect(actions).toContain('CallAI');
  expect(actions).toContain('loadSessionParts');
  expect(actions).toContain('GetSVG_List');
  expect(actions.filter(action => action === 'newSession')).toHaveLength(1);
  await page.getByRole('button', { name: /Éléments du projet/ }).click();
  await expect(page.getByText('Flyer A5 simulé', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  await test.info().attach('recette-hopstudio-simulee', { contentType: 'application/json',
    body: JSON.stringify({ provider: 'simulated', projectPersistence: 'simulated',
      runtime: '/vendor/hopstudio/1.0.0/sugarcrepeHLUX.mjs', actions, importedPrice: 125.5 }),
  });
});
