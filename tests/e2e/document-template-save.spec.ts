import {test,expect} from '@playwright/test';
import {fixture} from './fixtures/backoffice-shops';
import {TEST_IDS} from '../../src/shared/presentation/testIds';
import {PDFDocument} from 'pdf-lib';

for(const withBackground of [false,true]) {
test(`place et déplace les champs après aperçu et redimensionnement (${withBackground?'fond PDF':'page blanche'})`,async({page})=>{
 await fixture(page);
 const backgroundUrl=new URL('/placement-fixture.pdf',process.env.E2E_BASE_URL??'http://localhost:5177').href;
 if(withBackground) {
  const pdf=await PDFDocument.create();pdf.addPage([595.28,841.89]);
  const bytes=Buffer.from(await pdf.save());
  await page.route('**/placement-fixture.pdf',route=>route.fulfill({contentType:'application/pdf',body:bytes}));
 }
 const id='70000000-0000-4000-8000-000000000011';
 const prefix=`/api/v1/document-pdf-templates/${id}`;
 await page.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  const ok=(data:unknown)=>route.fulfill({json:{data,meta:{request_id:'placement'}},headers:{etag:'"fields"'}});
  if(path.endsWith('/access-profile')) return route.fulfill({json:{tenantId:'20000000-0000-4000-8000-000000000001',userId:id,membership:'admin',isAdmin:true,surfaces:['workspace','backoffice'],capabilities:['can_manage_document_templates','document-templates.manage']}});
  if(path===prefix) return ok({id,name:'Placement',document_type:'order',status:'ready',is_default:true,is_active:true,page_count:1,byte_size:100,created_at:'2026-10-09T10:00:00Z',updated_at:'2026-10-09T10:00:00Z',pages:[{index:0,width_pt:595.28,height_pt:841.89}],sha256:'a'.repeat(64),has_field_map:false,background_url:withBackground?backgroundUrl:null,background_url_expires_at:withBackground?'2026-10-09T20:00:00Z':null});
  if(path===`${prefix}/fields`){
   if(route.request().method()==='PUT') {
    const placement=route.request().postDataJSON().placements[0];
    expect(Math.abs(placement.x-595.28*0.4)).toBeLessThan(2);
    expect(Math.abs(placement.y-841.89*0.4)).toBeLessThan(2);
    const second=route.request().postDataJSON().placements[1];
    expect(second.field).toBe('order.created_at');
    expect(Math.abs(second.x-595.28*0.7)).toBeLessThan(2);
    expect(Math.abs(second.y-841.89*0.8)).toBeLessThan(2);
    return ok({template_id:id,...route.request().postDataJSON()});
   }
   return ok({template_id:id,placements:[],lines_block:null});
  }
  return route.fallback();
 });
 await page.goto(`/t/magrit-development/dashboard/document-templates/${id}/fields`);
 const canvas=page.getByTestId(TEST_IDS.documentTemplateFields.canvas);
 await expect(canvas).toBeVisible();
 await expect.poll(async()=> (await canvas.boundingBox())!.height/(await canvas.boundingBox())!.width).toBeCloseTo(841.89/595.28,2);
 if(withBackground) await expect.poll(()=>canvas.locator('canvas').evaluate(node=>(node as HTMLCanvasElement).height)).toBeGreaterThan(500);
 await page.locator('button[data-field-id="order.number"]').click();
 let box=(await canvas.boundingBox())!;
 await canvas.click({position:{x:box.width*0.25,y:box.height*0.3}});
 const label=page.getByTestId(TEST_IDS.documentTemplateFields.placementLabel).filter({hasText:'Numéro de commande'});
 let position=(await label.boundingBox())!;
 expect(Math.abs(position.x-box.x-box.width*0.25)).toBeLessThan(3);
 expect(position.y-box.y).toBeGreaterThan(box.height*0.25);
 await page.getByTestId(TEST_IDS.documentTemplateFields.previewBtn).click();
 await page.getByTestId(TEST_IDS.documentTemplateFields.exitPreviewBtn).click();
 await page.setViewportSize({width:1440,height:1000});
 await expect.poll(async()=> (await canvas.boundingBox())!.height/(await canvas.boundingBox())!.width).toBeCloseTo(841.89/595.28,2);
 box=(await canvas.boundingBox())!;
 await label.dragTo(canvas,{targetPosition:{x:box.width*0.4,y:box.height*0.6}});
 position=(await label.boundingBox())!;
 expect(Math.abs(position.x-box.x-box.width*0.4)).toBeLessThan(3);
 expect(position.y-box.y).toBeGreaterThan(box.height*0.55);
 await page.getByRole('button',{name:'Ajouter un autre champ',exact:true}).click();
 await page.locator('button[data-field-id="order.created_at"]').dragTo(canvas,{targetPosition:{x:box.width*0.7,y:box.height*0.2}});
 await expect(page.getByTestId(TEST_IDS.documentTemplateFields.placementLabel)).toHaveCount(2);
 await page.getByTestId(TEST_IDS.documentTemplateFields.saveBtn).click();
 await expect(page.getByTestId(TEST_IDS.documentTemplateFields.saveBtn)).toBeDisabled();
 await expect(page.getByTestId(TEST_IDS.documentTemplateFields.errorBanner)).toHaveCount(0);
});
}

test('enchaîne deux champs puis conserve les modifications après une erreur de sauvegarde',async({page})=>{
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
    expect(route.request().postDataJSON().placements.map((placement:{field:string})=>placement.field)).toEqual(['order.number','order.created_at']);
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
 await page.getByRole('button',{name:'Ajouter un autre champ',exact:true}).click();
 await expect(page.getByTestId(TEST_IDS.documentTemplateFields.tabFields)).toBeFocused();
 await expect(page.getByTestId(TEST_IDS.documentTemplateFields.placementLabel)).toHaveCount(1);
 await expect(page.locator('button[data-field-id="order.number"]')).toHaveCount(0);
 await page.getByTestId(TEST_IDS.documentTemplateFields.tabTable).click();
 await page.getByTestId(TEST_IDS.documentTemplateFields.tabFields).click();
 const nextField=page.locator('[data-field-id="order.created_at"]').first();
 await nextField.focus();await nextField.press('Enter');
 await expect(page.getByTestId(TEST_IDS.documentTemplateFields.placementLabel)).toHaveCount(2);
 await page.getByTestId(TEST_IDS.documentTemplateFields.saveBtn).click();
 await expect(page.getByTestId(TEST_IDS.documentTemplateFields.errorBanner)).toContainText('HTTP 500');
 await expect(page.getByText('Numéro de commande',{exact:true}).first()).toBeVisible();
 await page.getByTestId(TEST_IDS.documentTemplateFields.saveBtn).click();
 await expect(page.getByTestId(TEST_IDS.documentTemplateFields.errorBanner)).toHaveCount(0);
 await expect(page.getByTestId(TEST_IDS.documentTemplateFields.saveBtn)).toBeDisabled();
 await expect(page.getByTestId(TEST_IDS.documentTemplateFields.previewBtn)).toHaveText(/commande/);
});
