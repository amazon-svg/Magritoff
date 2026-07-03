/**
 * Auth context extraction for claude-proxy (Story S-LLM-WRAPPER-ROBUSTNESS AC4).
 *
 * Isole de index.ts pour pouvoir tester unitairement sans tirer les imports
 * npm:zod / wrapper anthropicClient.
 *
 * Strategie :
 *   1. Parse "Authorization: Bearer <jwt>" du header
 *   2. Decode base64url le payload JWT (Supabase Gateway a deja verifie crypto)
 *   3. userId = payload.sub
 *   4. tenantId : prefer payload.app_metadata.tenant_id (claim custom),
 *      sinon query tenant_members LIMIT 1 (heuristique premier tenant)
 *   5. Si JWT absent / invalide : userId=null, tenantId=null (back-compat)
 *
 * Best-effort : toute erreur de parsing/query retourne null, ne bloque pas
 * la requete (le tracking degrade gracefully).
 */

import { createClient } from "npm:@supabase/supabase-js@2";

export async function extractAuthContext(
  req: Request,
): Promise<{ userId: string | null; tenantId: string | null }> {
  const auth = req.headers.get("Authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return { userId: null, tenantId: null };

  const jwt = match[1];
  const parts = jwt.split(".");
  if (parts.length !== 3) return { userId: null, tenantId: null };

  let payload: { sub?: string; app_metadata?: { tenant_id?: string } };
  try {
    const seg = parts[1];
    const padded = seg + "=".repeat((4 - (seg.length % 4)) % 4);
    const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(b64);
    payload = JSON.parse(json);
  } catch {
    return { userId: null, tenantId: null };
  }

  const userId = typeof payload.sub === "string" ? payload.sub : null;
  if (!userId) return { userId: null, tenantId: null };

  let tenantId: string | null = payload.app_metadata?.tenant_id ?? null;
  if (!tenantId) {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (url && key) {
      try {
        const client = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data } = await client
          .from("tenant_members")
          .select("tenant_id")
          .eq("user_id", userId)
          .limit(1)
          .maybeSingle();
        if (data && typeof (data as { tenant_id?: string }).tenant_id === "string") {
          tenantId = (data as { tenant_id: string }).tenant_id;
        }
      } catch {
        // best-effort : query echoue => tenantId reste null
      }
    }
  }

  return { userId, tenantId };
}
