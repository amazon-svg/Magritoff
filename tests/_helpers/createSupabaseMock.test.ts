/**
 * Tests vitest pour la factory `createSupabaseMock` (R8 ADR-R5).
 *
 * Verifie que le mock reproduit les patterns Supabase utilises par Magrit :
 *   - from('table').select() / .insert() / .update() / .delete() / .eq()
 *   - functions.invoke()
 *   - rpc()
 *   - auth.getUser() / getSession()
 */

import { describe, it, expect } from 'vitest';
import { createSupabaseMock } from './createSupabaseMock';

describe('createSupabaseMock - from(table).select()', () => {
  it('1. select() retourne le stub configure', async () => {
    const supabase = createSupabaseMock({
      tables: { shops: { select: [{ id: 's1', name: 'Eram' }] } },
    });
    const { data, error } = await supabase.from('shops').select('*');
    expect(error).toBeNull();
    expect(data).toEqual([{ id: 's1', name: 'Eram' }]);
  });

  it('2. select() sans stub → tableau vide', async () => {
    const supabase = createSupabaseMock();
    const { data, error } = await supabase.from('inconnu').select('*');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('3. .eq().select() chaine OK', async () => {
    const supabase = createSupabaseMock({
      tables: { shops: { select: [{ id: 's1', tenant_id: 't1' }] } },
    });
    const { data } = await supabase.from('shops').eq('tenant_id', 't1').select('*');
    expect(data).toBeTruthy();
  });

  it('4. .single() retourne le premier element', async () => {
    const supabase = createSupabaseMock({
      tables: { shops: { select: [{ id: 's1' }, { id: 's2' }] } },
    });
    const { data } = await supabase.from('shops').single();
    expect(data).toEqual({ id: 's1' });
  });

  it('5. Table en erreur → error retourne', async () => {
    const supabase = createSupabaseMock({
      tables: { shops: { error: { message: 'RLS denied' } } },
    });
    const { data, error } = await supabase.from('shops').select('*');
    expect(data).toBeNull();
    expect(error?.message).toBe('RLS denied');
  });
});

describe('createSupabaseMock - mutations (insert/update/delete)', () => {
  it('6. insert() retourne le stub', async () => {
    const supabase = createSupabaseMock({
      tables: {
        shop_orders: { insert: { data: { id: 'order-1' }, error: null } },
      },
    });
    const { data, error } = await supabase.from('shop_orders').insert({ shop_id: 's1' });
    expect(error).toBeNull();
    expect((data as { id: string }).id).toBe('order-1');
  });

  it('7. update() retourne le stub', async () => {
    const supabase = createSupabaseMock({
      tables: {
        tenants: { update: { data: { id: 't1', name: 'Updated' }, error: null } },
      },
    });
    const { data } = await supabase.from('tenants').update({ name: 'Updated' });
    expect((data as { name: string }).name).toBe('Updated');
  });

  it('8. delete() retourne le stub', async () => {
    const supabase = createSupabaseMock({
      tables: { clients: { delete: { data: null, error: null } } },
    });
    const { error } = await supabase.from('clients').delete().eq('id', 'c1');
    expect(error).toBeNull();
  });
});

describe('createSupabaseMock - functions.invoke()', () => {
  it('9. invoke() retourne le stub configure', async () => {
    const supabase = createSupabaseMock({
      functions: {
        'pim-generate': () => ({ data: { generated: { title: 'Test' } }, error: null }),
      },
    });
    const { data, error } = await supabase.functions.invoke('pim-generate', { body: {} });
    expect(error).toBeNull();
    expect(data).toEqual({ generated: { title: 'Test' } });
  });

  it('10. invoke() recoit le body en parametre', async () => {
    let receivedBody: unknown = null;
    const supabase = createSupabaseMock({
      functions: {
        'echo': (body) => {
          receivedBody = body;
          return { data: body, error: null };
        },
      },
    });
    await supabase.functions.invoke('echo', { body: { test: 42 } });
    expect(receivedBody).toEqual({ test: 42 });
  });

  it('11. invoke() endpoint non-stubbe → error explicite', async () => {
    const supabase = createSupabaseMock();
    const { data, error } = await supabase.functions.invoke('inconnu');
    expect(data).toBeNull();
    expect(error?.message).toContain('non stubbe');
  });
});

describe('createSupabaseMock - rpc()', () => {
  it('12. rpc() retourne le stub', async () => {
    const supabase = createSupabaseMock({
      rpcs: {
        is_super_admin: () => ({ data: true, error: null }),
      },
    });
    const { data } = await supabase.rpc('is_super_admin');
    expect(data).toBe(true);
  });

  it('13. rpc() recoit les params', async () => {
    let receivedParams: unknown = null;
    const supabase = createSupabaseMock({
      rpcs: {
        check: (params) => {
          receivedParams = params;
          return { data: null, error: null };
        },
      },
    });
    await supabase.rpc('check', { user_id: 'u1' });
    expect(receivedParams).toEqual({ user_id: 'u1' });
  });
});

describe('createSupabaseMock - auth', () => {
  it('14. auth.getUser() retourne user null par defaut', async () => {
    const supabase = createSupabaseMock();
    const { data, error } = await supabase.auth.getUser();
    expect(error).toBeNull();
    expect(data.user).toBeNull();
  });

  it('15. auth.getSession() retourne session null par defaut', async () => {
    const supabase = createSupabaseMock();
    const { data, error } = await supabase.auth.getSession();
    expect(error).toBeNull();
    expect(data.session).toBeNull();
  });
});
