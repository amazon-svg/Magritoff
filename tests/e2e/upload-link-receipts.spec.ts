import { test, expect } from '@playwright/test';
import { fixture } from './fixtures/backoffice-shops';
import { TEST_IDS } from '../../src/shared/presentation/testIds';

for (const width of [375,1280]) test(`conserve les reçus des dépôts et les erreurs de reprise (${width}px)`, async ({ page }) => {
  await page.setViewportSize({ width,height:900 }); await fixture(page);
  const token = 'x'.repeat(43);
  const prefix = '/api/v1/order-upload-links/current';
  let tickets = 0; let confirmations = 0; let failThird = true;
  await page.route('**/recipe-deposit', route => route.fulfill({ status:200 }));
  await page.route('**/api/v1/order-upload-links/current**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    expect(request.headers()['x-magrit-upload-link']).toBe(token);
    expect(request.headers()['authorization']).toBeUndefined();
    const ok = (data:unknown,status=200) => route.fulfill({ status,json:{data,meta:{request_id:'receipts'}} });
    if(path === prefix) return ok({ printer_name:'Atelier Lumière',shop_name:'Boutique',shop_logo_url:null,order_number:'81419E86',label:'Vos fichiers',expires_at:'2030-10-09T10:00:00Z',max_files:3,deposited_count:0,max_byte_size:52428800,accepted_content_types:['application/pdf'] });
    if(path === `${prefix}/file-upload-urls`) return ok({file_id:`70000000-0000-4000-8000-${String(++tickets).padStart(12,'0')}`,url:'http://localhost:5176/recipe-deposit',token:'fixture',path:'fixture',max_byte_size:52428800,accepted_content_types:['application/pdf'],expires_at:'2030-10-09T10:00:00Z'});
    if(path === `${prefix}/files`) {
      if(confirmations === 2 && failThird) { failThird=false; return route.fulfill({status:503,json:{type:'about:blank',title:'Service indisponible',status:503,code:'recipe.unavailable',request_id:'receipts'}}); }
      const command=request.postDataJSON();
      return ok({ file_id:command.file_id,filename:command.filename,content_type:'application/pdf',byte_size:100,deposited_at:'2026-10-09T10:00:00Z',deposited_count:++confirmations,max_files:3 },201);
    }
    return route.fallback();
  });
  await page.goto(`/depot/${token}`);
  for(const [index,name] of ['recto.pdf','verso.pdf'].entries()) {
    await page.locator('input[type="file"]').setInputFiles({name,mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7 fixture')});
    await expect(page.getByTestId(TEST_IDS.uploadLinkDepot.successBanner)).toHaveCount(index+1);
  }
  await expect(page.getByText('recto.pdf',{exact:true})).toBeVisible();
  await expect(page.getByText('verso.pdf',{exact:true})).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({name:'annexe.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7 fixture')});
  await expect(page.getByTestId(TEST_IDS.uploadLinkDepot.depositErrorBanner)).toBeVisible();
  await expect(page.getByTestId(TEST_IDS.uploadLinkDepot.successBanner)).toHaveCount(2);
  await page.getByTestId(TEST_IDS.uploadLinkDepot.retryBtn).click();
  await expect(page.getByTestId(TEST_IDS.uploadLinkDepot.successBanner)).toHaveCount(3);
  await expect(page.getByRole('heading',{name:'Fichiers envoyés (3)'})).toBeVisible();
  await expect(page.getByTestId(TEST_IDS.uploadLinkDepot.dropzone)).toHaveCount(0);
  await page.screenshot({path:test.info().outputPath(`receipts-${width}.png`),fullPage:true});
});
