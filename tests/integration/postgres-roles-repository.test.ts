import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresRolesRepository } from '../../src/adapters/postgres/roles-repository.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import type { TenantId, UserId } from '../../src/kernel/ids/index.ts';

const enabled=process.env['MAGRIT_POSTGRES_INTEGRATION']==='1';
(enabled?describe:describe.skip)('PostgresRolesRepository — PostgreSQL reel',()=>{
  let pool:Pool;let repo:PostgresRolesRepository;
  const tenant=randomUUID() as TenantId, admin=randomUUID() as UserId, user=randomUUID() as UserId, shop=randomUUID();
  beforeAll(async()=>{pool=createPostgresPool();repo=new PostgresRolesRepository(new PostgresTransactionRunner(pool,'magrit_api'));
    await pool.query("insert into public.app_users(id,email_normalized,display_name) values($1,$2,'Admin'),($3,$4,'User')",[admin,`roles-${admin}@example.invalid`,user,`roles-${user}@example.invalid`]);
    await pool.query("insert into public.tenants(id,slug,name) values($1,$2,'Roles')",[tenant,`roles-${tenant}`]);
    await pool.query("insert into public.tenant_members(tenant_id,user_id,role) values($1,$2,'owner'),($1,$3,'member')",[tenant,admin,user]);
    await pool.query("insert into public.shops(id,tenant_id,owner_user_id,slug,name) values($1,$2,$3,$4,'Boutique')",[shop,tenant,admin,`shop-${shop}`]);
  });
  afterAll(async()=>{if(!pool)return;await pool.query('delete from public.tenants where id=$1',[tenant]);await pool.query('delete from public.app_users where id=any($1::uuid[])',[[admin,user]]);await pool.end();});
  it('initialise les options et calcule les capabilities assignees',async()=>{
    const overview=await repo.overview(admin,tenant);expect(overview.roles.map(r=>r.systemKey)).toEqual(['option_shops','option_orders']);
    const option=overview.roles.find(r=>r.systemKey==='option_shops')!;
    await repo.setAssignment(admin,tenant,user,option.id,true);
    await expect(repo.userCapability(user,tenant,'can_manage_shops')).resolves.toBe(true);
    await expect(repo.accessProfile(user,tenant)).resolves.toMatchObject({membership:'member',capabilities:['can_manage_shops']});
    await repo.setAssignment(admin,tenant,user,option.id,false);
    await expect(repo.userCapability(user,tenant,'can_manage_shops')).resolves.toBe(false);
  });
  it('gere une definition scopee boutique, son ordre et son archivage',async()=>{
    const command={name:'Responsable BAT',description:'Valide les BAT',capabilities:{can_validate:true},notifyPolicy:'chain_next' as const,scope:'shop' as const,scopeShopId:shop,orderingIndex:30};
    const created=await repo.createDefinition(admin,tenant,command);expect(created).toMatchObject({scope:'shop',scopeShopId:shop});
    const updated=await repo.updateDefinition(admin,tenant,created.id,{...command,name:'Responsable validation',orderingIndex:35});expect(updated.name).toBe('Responsable validation');
    const option=(await repo.overview(admin,tenant)).roles[0]!;await repo.reorderDefinitions(admin,tenant,created.id,option.id);
    await expect(repo.setAssignment(admin,tenant,user,created.id,true)).rejects.toMatchObject({code:'invalid_definition'});
    await repo.archiveDefinition(admin,tenant,created.id);expect((await repo.catalog(admin,tenant)).roles.find(r=>r.id===created.id)?.archivedAt).not.toBeNull();
  });
  it('ferme l administration aux membres ordinaires',async()=>{await expect(repo.catalog(user,tenant)).rejects.toMatchObject({code:'permission_denied'});});
});
