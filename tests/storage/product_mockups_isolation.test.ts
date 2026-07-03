/**
 * S4.1a — Tests integration bucket Storage `product_mockups`.
 *
 * Verifie que :
 *   1. Upload service_role : les edge functions (futures S4.1c) peuvent
 *      ecrire dans le bucket via le client service_role.
 *   2. GET public : un client anonyme HTTP peut recuperer les fichiers via
 *      l'URL publique du CDN Supabase Storage.
 *   3. Upload anon BLOCKED : un client anon (JWT public) ne peut PAS uploader
 *      dans le bucket (RLS rejette : pas de policy INSERT pour anon).
 *   4. Cleanup service_role : les edge functions peuvent supprimer leurs
 *      propres uploads (utilise pour invalidation S4.1c future).
 *
 * Lancer : pnpm test (necessite .env.test avec SUPABASE_URL +
 * SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY).
 *
 * Pattern aligne sur tests/rls/* (E9.10, S1.4).
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'product_mockups';

const SKIP_REASON = (() => {
  const env = process.env;
  if (!env.SUPABASE_URL) return 'SUPABASE_URL absent';
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return 'SUPABASE_SERVICE_ROLE_KEY absent';
  if (!env.SUPABASE_ANON_KEY) return 'SUPABASE_ANON_KEY absent';
  return null;
})();

const describeIfCreds = SKIP_REASON ? describe.skip : describe;

describeIfCreds('S4.1a — bucket product_mockups : RLS + public read', () => {
  let admin: SupabaseClient;
  let anon: SupabaseClient;
  let testPath: string;
  let publicUrl: string;
  // 1 KB de bytes deterministes (pas crypto.randomUUID pour eviter les flaky
  // round-trip checks si la lib bytes diverge).
  const payload = new Uint8Array(1024);
  for (let i = 0; i < payload.length; i++) payload[i] = i % 256;

  beforeAll(() => {
    const url = process.env.SUPABASE_URL!;
    admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    anon = createClient(url, process.env.SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // Path realiste : tenant/shop/product. Suffixe timestamp pour eviter les
    // collisions entre executions paralleles ou re-runs.
    const tag = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    testPath = `tenants/test-${tag}/shops/test/products/test.png`;
    publicUrl = `${url}/storage/v1/object/public/${BUCKET}/${testPath}`;
  });

  afterAll(async () => {
    // Filet de securite : suppression du fichier de test si encore present
    // (au cas ou un test echoue avant le cleanup explicite).
    if (admin) {
      await admin.storage.from(BUCKET).remove([testPath]).catch(() => {});
    }
  });

  it('Test 1 : upload service_role OK', async () => {
    const { data, error } = await admin.storage
      .from(BUCKET)
      .upload(testPath, payload, {
        contentType: 'image/png',
        upsert: true, // tolerer un re-run si le cleanup precedent a foire
      });
    expect(error).toBeNull();
    expect(data?.path).toBe(testPath);
  });

  it('Test 2 : GET public OK + bytes match (round-trip)', async () => {
    // Fetch HTTP anonyme sur l'URL publique (pas de token, pas de header auth)
    const res = await fetch(publicUrl);
    expect(res.status).toBe(200);
    const buf = new Uint8Array(await res.arrayBuffer());
    expect(buf.length).toBe(payload.length);
    // Verification round-trip : meme bytes que ce qu'on a upload
    for (let i = 0; i < payload.length; i++) {
      if (buf[i] !== payload[i]) {
        throw new Error(`bytes diverge a l'index ${i}: ${buf[i]} != ${payload[i]}`);
      }
    }
  });

  it('Test 3 : upload anon BLOCKED par RLS', async () => {
    const blockedPath = `tenants/blocked/shops/blocked/products/anon-${Date.now()}.png`;
    const { data, error } = await anon.storage
      .from(BUCKET)
      .upload(blockedPath, payload, {
        contentType: 'image/png',
      });
    // Le client anon n'a aucune policy INSERT sur ce bucket → rejet RLS.
    // Supabase Storage retourne typiquement une erreur structuree avec status
    // 403 ou message "new row violates row-level security policy".
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it('Test 4 : cleanup service_role OK', async () => {
    const { data, error } = await admin.storage.from(BUCKET).remove([testPath]);
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(Array.isArray(data)).toBe(true);
    expect(data!.length).toBeGreaterThanOrEqual(1);
  });
});
