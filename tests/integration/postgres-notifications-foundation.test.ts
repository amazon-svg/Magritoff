import { randomUUID } from 'node:crypto';
import { afterAll,beforeAll,describe,expect,it } from 'vitest';
import type { Pool } from 'pg';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import { PostgresNotificationTemplatesRepository } from '../../src/adapters/postgres/notification-templates-repository.ts';
import { PostgresNotificationLogsRepository } from '../../src/adapters/postgres/notification-logs-repository.ts';
import type { TenantId,UserId } from '../../src/kernel/ids/index.ts';

const enabled=process.env['MAGRIT_POSTGRES_INTEGRATION']==='1';
(enabled?describe:describe.skip)('socle PostgreSQL des notifications',()=>{
  let pool:Pool; const tenantId=randomUUID() as TenantId; const actorId=randomUUID() as UserId; const templateId=randomUUID(); const aggregateId=randomUUID();
  beforeAll(async()=>{pool=createPostgresPool();await pool.query("insert into public.app_users(id,email_normalized) values($1,$2)",[actorId,`notifications-${actorId}@example.invalid`]);await pool.query("insert into public.tenants(id,slug,name) values($1,$2,'Notifications')",[tenantId,`notifications-${tenantId}`]);await pool.query("insert into public.tenant_members(tenant_id,user_id,role) values($1,$2,'owner')",[tenantId,actorId]);await pool.query(`insert into public.notification_templates(id,tenant_id,event_name,channel,audience,recipients,name,subject,body,is_active)
    values($1,$2,'order.files_submitted','email','explicit',array['client@example.test'],'Fichiers','Sujet','Corps',true)`,[templateId,tenantId]);});
  afterAll(async()=>{if(pool){await pool.query('delete from public.tenants where id=$1',[tenantId]);await pool.query('delete from public.app_users where id=$1',[actorId]);await pool.end();}});

  it('rend la mise en file idempotente puis regroupe une autre occurrence',async()=>{
    const worker=new PostgresTransactionRunner(pool,'magrit_worker'); const event1=randomUUID();
    const enqueue=(eventId:string)=>worker.run({},client=>client.query(`select * from magrit.enqueue_notification_message(
      $1,$2,'order.files_submitted','order',$3,$4,'email','pending','client@example.test','Sujet','Corps',null,10,null
    )`,[tenantId,eventId,aggregateId,templateId]));
    const first=(await enqueue(event1)).rows[0]; const replay=(await enqueue(event1)).rows[0];
    expect(replay.id).toBe(first.id); expect(replay.occurrence_count).toBe(1);
    const grouped=(await enqueue(randomUUID())).rows[0];
    expect(grouped.id).toBe(first.id); expect(grouped.occurrence_count).toBe(2);
  });

  it('interdit enqueue au rôle API et scelle le contenu',async()=>{
    const api=new PostgresTransactionRunner(pool,'magrit_api');
    await expect(api.run({},client=>client.query(`select magrit.enqueue_notification_message(
      $1,$2,'order.files_submitted','order',$3,$4,'email','pending','x@example.test','S','B',null,0,null
    )`,[tenantId,randomUUID(),aggregateId,templateId]))).rejects.toMatchObject({code:'42501'});
    await expect(pool.query("update public.notification_logs set body='altéré' where tenant_id=$1",[tenantId]))
      .rejects.toMatchObject({code:'42501'});
  });

  it('sert les modèles et le journal via les repositories tenant-scopés',async()=>{
    const tx=new PostgresTransactionRunner(pool,'magrit_api');
    const templates=new PostgresNotificationTemplatesRepository(tx);
    expect(await templates.actorHasCapability(tenantId,actorId,'can_manage_notifications')).toBe(true);
    await expect(templates.list(tenantId,{eventName:null,channel:null,status:'active'})).resolves.toHaveLength(1);
    await expect(templates.update(tenantId,actorId,templateId,{body:'Corps modifié'})).resolves.toMatchObject({body:'Corps modifié'});
    const logs=new PostgresNotificationLogsRepository(tx);
    const rows=await logs.list(tenantId,{eventName:null,channel:null,status:null,templateId:null,aggregateId:null,size:20,cursor:null});
    expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({template_id:templateId,occurrence_count:2});
  });
});
