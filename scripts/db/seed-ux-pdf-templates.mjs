import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

/** Gabarit local utilisable aussi pour l'apercu et les envois des devis UX. */
export async function seedUxPdfTemplates(client, tenantSlugs) {
  const buckets = JSON.parse(await readFile(new URL('../../config/storage-buckets.json', import.meta.url), 'utf8'));
  const storage = new S3Client({
    endpoint: process.env.S3_ENDPOINT ?? process.env.MAGRIT_DEV_S3_ENDPOINT ?? `http://127.0.0.1:${process.env.MAGRIT_DEV_S3_PORT ?? '58333'}`,
    region: process.env.S3_REGION ?? process.env.MAGRIT_DEV_S3_REGION ?? 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? process.env.MAGRIT_DEV_S3_ACCESS_KEY_ID ?? 'magrit-local',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? process.env.MAGRIT_DEV_S3_SECRET_ACCESS_KEY ?? 'magrit-local-secret',
    },
  });
  try {
    const tenants = await client.query('select id,name from public.tenants where slug=any($1)', [tenantSlugs]);
    for (const tenant of tenants.rows) {
      const hash = createHash('md5').update(`ux-pdf-template:${tenant.id}`).digest('hex');
      const id = `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20)}`;
      const existing = await client.query('select id from public.document_pdf_templates where id=$1', [id]);
      if (existing.rows.length) {
        await client.query("update public.document_pdf_template_fields set width=300 where template_id=$1 and field='quote.number' and width=90", [id]);
        continue;
      }
      const document = await PDFDocument.create();
      const page = document.addPage([595.28, 841.89]);
      const font = await document.embedFont(StandardFonts.Helvetica);
      const bold = await document.embedFont(StandardFonts.HelveticaBold);
      const text = (value, x, y, size=10, isBold=false) => page.drawText(value, { x,y,size,font:isBold ? bold : font,color:rgb(0.12,0.16,0.23) });
      text(tenant.name, 44, 794, 22, true);
      text('DEVIS', 44, 748, 17, true);
      text('Date :', 44, 710); text('Validite :', 310, 710);
      text('Client', 44, 674, 11, true);
      text('Designation', 44, 551, 10, true); text('Quantite', 380, 551, 10, true); text('Prix HT', 480, 551, 10, true);
      text('Total HT', 350, 194); text('TVA', 350, 166); text('Total TTC', 350, 138, 12, true);
      text('DONNEES SYNTHETIQUES - Demonstration UX uniquement', 44, 44, 9);
      const bytes = await document.save();
      const path = `${tenant.id}/${id}.pdf`;
      await storage.send(new PutObjectCommand({ Bucket:buckets.document_pdf_templates,Key:path,Body:bytes,ContentType:'application/pdf' }));
      await client.query('begin');
      try {
        await client.query("select pg_advisory_xact_lock(hashtext('magrit:ux-pdf-template-seed'))");
        const placements = [
          ['quote.number', 180,748,16], ['quote.issued_at',90,710,10],
          ['quote.valid_until',365,710,10], ['customer.company_name',44,651,11],
          ['customer.contact_name',44,631,11], ['customer.billing_address_block',44,611,10],
          ['totals.net_total',455,194,11], ['totals.vat_amount',455,166,11],
          ['totals.total_incl_tax',455,138,12],
        ];
        const linesBlock = { page_index:0,first_row_baseline_y:524,row_height:32,rows_per_page:8,
          columns: [ ['line.label',44,310,'left'], ['line.quantity',380,70,'right'], ['line.price',470,80,'right'] ]
            .map(([field,x,width,align])=>({field,x,width,align,font:'helvetica',font_size:10,color:'#1e293b'})),
        };
        await client.query(`insert into public.document_pdf_templates
          (id,tenant_id,name,document_type,status,storage_path,byte_size,sha256,page_count,pages,lines_block,is_default)
          values ($1,$2,'[UX] Devis demonstration','quote','ready',$3,$4,$5,1,$6,$7,
            not exists(select 1 from public.document_pdf_templates where tenant_id=$2 and document_type='quote' and is_default))
          on conflict(id) do nothing`, [id,tenant.id,path,bytes.length,createHash('sha256').update(bytes).digest('hex'),
            JSON.stringify([{index:0,width_pt:595.28,height_pt:841.89}]),JSON.stringify(linesBlock)]);
        for (const [field,x,y,size] of placements) {
          await client.query(`insert into public.document_pdf_template_fields
            (template_id,tenant_id,field,page_index,x,y,width,max_lines,align,font,font_size,color)
            values($1,$2,$3,0,$4,$5,$6,$7,'left','helvetica',$8,'#1e293b')
            on conflict(template_id,field) do nothing`, [id,tenant.id,field,x,y,field==='quote.number'||x<100?300:90,field==='customer.billing_address_block'?2:1,size]);
        }
        await client.query('commit');
      } catch(error) { await client.query('rollback'); throw error; }
    }
  } finally { storage.destroy(); }
}
