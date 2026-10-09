import {test,expect} from '@playwright/test';
import {fixture} from './fixtures/backoffice-shops';
import {TEST_IDS} from '../../src/shared/presentation/testIds';

test('conserve le champ après une erreur de sauvegarde puis enregistre un gabarit commande',async({page})=>{
 await fixture(page);
 const tenantId='20000000-0000-4000-8000-000000000001';
 const id='70000000-0000-4000-8000-000000000011';
 const prefix=`/api/v1/document-pdf-templates/${id}`;
 let map={template_id:id,placements:[] as unknown[],lines_block:null}; let failed=false;
 await page.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path===`/api/v1/tenants/${tenantId}/access-profile`) return route.fulfill({json:{tenantId,userId:id,membership:'admin',isAdmin:true,surfaces:['workspace','backoffice'],capabilities:['can_manage_document_templates','document-templates.manage']}});
  const ok=(data:unknown)=>route.fulfill({json:{data,meta:{request_id:'save'}},headers:{etag:'"fields"'}});
  if(path===prefix) return ok({id,name:'BC 2026',document_type:'order',status:'ready',is_default:true,is_active:true,page_count:1,byte_size:100,created_at:'2026-10-09T10:00:00Z',updated_at:'2026-10-09T10:00:00Z',pages:[{index:0,width_pt:595.28,height_pt:841.89}],sha256:'a'.repeat(64),has_field_map:false,background_url:null,background_url_expires_at:null});
  if(path===`${prefix}/fields`){
   if(route.request().method()==='PUT'){
    expect(route.request().headers()['if-match']).toBe('"fields"');
    expect(route.request().postDataJSON().placements[0].field).toBe('order.number');
    if(!failed){failed=true;return route.fulfill({status:500,json:{type:'about:blank',title:'Erreur API',status:500,code:'server.error',request_id:'save'}});}
    map={...map,...route.request().postDataJSON()};
   }
   return ok(map);
  }
  return route.fallback();
 });
 await page.goto(`/t/magrit-development/dashboard/document-templates/${id}/fields`);
 const field=page.locator('[data-field-id="order.number"]').first();
 await field.focus();await field.press('Enter');
 await page.getByTestId(TEST_IDS.documentTemplateFields.saveBtn).click();
 await expect(page.getByTestId(TEST_IDS.documentTemplateFields.errorBanner)).toContainText('HTTP 500');
 await expect(page.getByText('Numéro de commande',{exact:true}).first()).toBeVisible();
 await page.getByTestId(TEST_IDS.documentTemplateFields.saveBtn).click();
 await expect(page.getByTestId(TEST_IDS.documentTemplateFields.errorBanner)).toHaveCount(0);
 await expect(page.getByTestId(TEST_IDS.documentTemplateFields.saveBtn)).toBeDisabled();
 await expect(page.getByTestId(TEST_IDS.documentTemplateFields.previewBtn)).toHaveText(/commande/);
});
