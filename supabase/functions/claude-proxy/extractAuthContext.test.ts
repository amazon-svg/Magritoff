/**
 * Tests Deno pour extractAuthContext (Story S-LLM-WRAPPER-ROBUSTNESS AC4).
 *
 * Lancer : `deno test --no-check --allow-env supabase/functions/claude-proxy/extractAuthContext.test.ts`
 *
 * Couvre :
 *  - JWT absent / mal forme / signature absente => null/null (back-compat)
 *  - JWT valide avec sub => userId extrait
 *  - JWT valide avec app_metadata.tenant_id => tenantId du claim (prioritaire)
 *  - JWT valide sans tenant_id claim => query tenant_members fallback
 *  - Erreur query tenant_members => tenantId null (best-effort)
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { extractAuthContext } from "./_auth.ts";

const ORIGINAL_SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const ORIGINAL_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

function clearSupabaseEnv() {
  Deno.env.delete("SUPABASE_URL");
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
}

function restoreSupabaseEnv() {
  if (ORIGINAL_SUPABASE_URL !== undefined) Deno.env.set("SUPABASE_URL", ORIGINAL_SUPABASE_URL);
  else Deno.env.delete("SUPABASE_URL");
  if (ORIGINAL_SERVICE_KEY !== undefined) Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", ORIGINAL_SERVICE_KEY);
  else Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
}

/** Forge un JWT (non signe — la fonction ne verifie pas la signature). */
function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const body = btoa(JSON.stringify(payload))
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${header}.${body}.fake-signature`;
}

function reqWithAuth(headerValue?: string): Request {
  const headers = new Headers();
  if (headerValue !== undefined) headers.set("Authorization", headerValue);
  return new Request("https://example.com/claude-proxy", { method: "POST", headers });
}

Deno.test("extractAuthContext: pas de header Authorization => null/null", async () => {
  clearSupabaseEnv();
  try {
    const ctx = await extractAuthContext(reqWithAuth(undefined));
    assertEquals(ctx, { userId: null, tenantId: null });
  } finally {
    restoreSupabaseEnv();
  }
});

Deno.test("extractAuthContext: header sans 'Bearer' prefix => null/null", async () => {
  clearSupabaseEnv();
  try {
    const ctx = await extractAuthContext(reqWithAuth("Basic abc123"));
    assertEquals(ctx, { userId: null, tenantId: null });
  } finally {
    restoreSupabaseEnv();
  }
});

Deno.test("extractAuthContext: JWT mal forme (pas 3 parties) => null/null", async () => {
  clearSupabaseEnv();
  try {
    const ctx = await extractAuthContext(reqWithAuth("Bearer not.a.valid.jwt.token"));
    assertEquals(ctx, { userId: null, tenantId: null });
  } finally {
    restoreSupabaseEnv();
  }
});

Deno.test("extractAuthContext: payload base64 invalide => null/null", async () => {
  clearSupabaseEnv();
  try {
    const ctx = await extractAuthContext(reqWithAuth("Bearer header.!!!notbase64!!!.sig"));
    assertEquals(ctx, { userId: null, tenantId: null });
  } finally {
    restoreSupabaseEnv();
  }
});

Deno.test("extractAuthContext: JWT valide sans sub => null/null", async () => {
  clearSupabaseEnv();
  try {
    const jwt = makeJwt({ email: "test@example.com" });
    const ctx = await extractAuthContext(reqWithAuth(`Bearer ${jwt}`));
    assertEquals(ctx, { userId: null, tenantId: null });
  } finally {
    restoreSupabaseEnv();
  }
});

Deno.test("extractAuthContext: JWT valide avec sub + app_metadata.tenant_id => claim prioritaire", async () => {
  clearSupabaseEnv(); // garantit que la query fallback n'est pas tentee
  try {
    const jwt = makeJwt({
      sub: "user-uuid-1234",
      app_metadata: { tenant_id: "tenant-uuid-5678" },
    });
    const ctx = await extractAuthContext(reqWithAuth(`Bearer ${jwt}`));
    assertEquals(ctx, { userId: "user-uuid-1234", tenantId: "tenant-uuid-5678" });
  } finally {
    restoreSupabaseEnv();
  }
});

Deno.test("extractAuthContext: JWT valide avec sub mais sans tenant claim, SUPABASE_URL absent => tenantId null", async () => {
  clearSupabaseEnv(); // pas de SUPABASE_URL => query fallback skip
  try {
    const jwt = makeJwt({ sub: "user-uuid-no-tenant-claim" });
    const ctx = await extractAuthContext(reqWithAuth(`Bearer ${jwt}`));
    assertEquals(ctx, { userId: "user-uuid-no-tenant-claim", tenantId: null });
  } finally {
    restoreSupabaseEnv();
  }
});

Deno.test("extractAuthContext: Bearer case-insensitive (BEARER / bearer)", async () => {
  clearSupabaseEnv();
  try {
    const jwt = makeJwt({ sub: "user-1", app_metadata: { tenant_id: "tenant-1" } });
    const upper = await extractAuthContext(reqWithAuth(`BEARER ${jwt}`));
    const lower = await extractAuthContext(reqWithAuth(`bearer ${jwt}`));
    assertEquals(upper, { userId: "user-1", tenantId: "tenant-1" });
    assertEquals(lower, { userId: "user-1", tenantId: "tenant-1" });
  } finally {
    restoreSupabaseEnv();
  }
});
