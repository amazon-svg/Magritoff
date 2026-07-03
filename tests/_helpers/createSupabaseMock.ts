/**
 * Factory `createSupabaseMock()` — R8 (refacto 2026-05-11 ADR-R5).
 *
 * Minimaliste, sans MSW (boring technology — review §1.2 M2). Stub les
 * patterns Supabase utilises par Magrit :
 *   - `from('table').select()` / `.insert()` / `.update()` / `.delete()` / `.eq()` / `.single()`
 *   - `functions.invoke('endpoint', { body })`
 *   - `rpc('fn', params)`
 *
 * Pattern utilise en tests vitest : passe le mock comme dependency injection
 * ou via vi.mock() sur le module `/utils/supabase/client`. La factory retourne
 * un objet typeably-compatible avec `SupabaseClient` (subset reellement
 * consomme par Magrit). Pas de couverture exhaustive de l'API Supabase.
 */

export type SupabaseMockResult<T = unknown> = { data: T | null; error: { message: string } | null };

export interface SupabaseMockTableStub<T = any> {
  /** Resultat retourne par `.select()` (et derives `.eq().select()`). */
  select?: T[] | T;
  /** Resultat retourne par `.insert()`. */
  insert?: SupabaseMockResult<T>;
  /** Resultat retourne par `.update()`. */
  update?: SupabaseMockResult<T>;
  /** Resultat retourne par `.delete()`. */
  delete?: SupabaseMockResult<null>;
  /** Erreur retournee inconditionnellement par toutes les ops (pour tester error paths). */
  error?: { message: string };
}

export interface CreateSupabaseMockOptions {
  tables?: Record<string, SupabaseMockTableStub>;
  rpcs?: Record<string, (params?: unknown) => SupabaseMockResult>;
  functions?: Record<string, (body?: unknown) => SupabaseMockResult>;
}

/**
 * Construit un objet ressemblant a un SupabaseClient pour les tests vitest.
 *
 * Exemple d'usage :
 *   const supabase = createSupabaseMock({
 *     tables: {
 *       shop_orders: {
 *         insert: { data: { id: 'order-1' }, error: null },
 *       },
 *     },
 *     functions: {
 *       'pim-generate': () => ({ data: { generated: {...} }, error: null }),
 *     },
 *   });
 *   // Pass to component via DI or vi.mock('/utils/supabase/client').
 */
export function createSupabaseMock(options: CreateSupabaseMockOptions = {}) {
  const { tables = {}, rpcs = {}, functions = {} } = options;

  function buildTableBuilder(tableName: string) {
    const stub = tables[tableName] ?? {};
    const error = stub.error ?? null;

    // Chainable builder qui retourne `Promise` ou s elf selon la methode
    // appelee. On retourne un Proxy qui resout en `{data, error}` quand
    // utilise comme thenable.
    const builder: Record<string, any> = {
      _table: tableName,
      _filter: {},
      select: (_cols?: string) => {
        const data = error ? null : (stub.select ?? []);
        return makeThenable({ data, error });
      },
      insert: (_payload?: any) => {
        if (stub.insert) return makeThenable(stub.insert);
        return makeThenable({ data: null, error });
      },
      update: (_payload?: any) => {
        if (stub.update) return makeThenable(stub.update);
        return makeThenable({ data: null, error });
      },
      delete: () => {
        if (stub.delete) return makeThenable(stub.delete);
        return makeThenable({ data: null, error });
      },
      eq: (_col: string, _val: unknown) => builder,
      neq: (_col: string, _val: unknown) => builder,
      in: (_col: string, _vals: unknown[]) => builder,
      gt: (_col: string, _val: unknown) => builder,
      gte: (_col: string, _val: unknown) => builder,
      lt: (_col: string, _val: unknown) => builder,
      lte: (_col: string, _val: unknown) => builder,
      like: (_col: string, _pat: string) => builder,
      order: (_col: string, _opts?: unknown) => builder,
      limit: (_n: number) => builder,
      single: () => {
        const arr = Array.isArray(stub.select) ? stub.select : null;
        const data = error ? null : arr?.[0] ?? stub.select ?? null;
        return makeThenable({ data, error });
      },
      maybeSingle: () => {
        const arr = Array.isArray(stub.select) ? stub.select : null;
        const data = error ? null : arr?.[0] ?? stub.select ?? null;
        return makeThenable({ data, error });
      },
    };
    return builder;
  }

  function makeThenable<T>(result: SupabaseMockResult<T>) {
    return {
      then: (onFulfilled: (r: SupabaseMockResult<T>) => unknown) => Promise.resolve(result).then(onFulfilled),
      catch: (onRejected: (e: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
      // Permet d'appeler .select() / .order() / etc. apres une op (chainable)
      // → on retourne un builder qui resout au meme resultat.
      eq: () => makeThenable(result),
      single: () => makeThenable(result),
      maybeSingle: () => makeThenable(result),
      order: () => makeThenable(result),
      limit: () => makeThenable(result),
      select: () => makeThenable(result),
    };
  }

  return {
    from: (table: string) => buildTableBuilder(table),
    rpc: (name: string, params?: unknown) => {
      const fn = rpcs[name];
      if (!fn) {
        return Promise.resolve({
          data: null,
          error: { message: `[createSupabaseMock] rpc '${name}' non stubbe` },
        });
      }
      return Promise.resolve(fn(params));
    },
    functions: {
      invoke: <T = unknown>(name: string, opts?: { body?: unknown }) => {
        const fn = functions[name];
        if (!fn) {
          return Promise.resolve({
            data: null,
            error: { message: `[createSupabaseMock] functions.invoke '${name}' non stubbe` },
          }) as Promise<SupabaseMockResult<T>>;
        }
        return Promise.resolve(fn(opts?.body)) as Promise<SupabaseMockResult<T>>;
      },
    },
    auth: {
      getUser: () =>
        Promise.resolve({
          data: { user: null },
          error: null,
        }),
      getSession: () =>
        Promise.resolve({
          data: { session: null },
          error: null,
        }),
    },
  };
}

export type SupabaseMockClient = ReturnType<typeof createSupabaseMock>;
