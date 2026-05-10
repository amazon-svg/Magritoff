/**
 * llm_usage — helper Deno partage par les edge functions Magrit
 * ──────────────────────────────────────────────────────────────
 * Logge un evenement de consommation LLM dans la table llm_usage_events.
 * Utilise le client Supabase service_role pour bypasser les RLS.
 *
 * E7.1 — au moins claude-proxy (chat utilisateur) appelle ce helper a chaque
 * reponse Claude. pim-generate et pim-ingest peuvent l'appeler aussi.
 *
 * Le logging est best-effort : en cas d'echec d'insertion (ex: tenant_id
 * invalide, table absente), on ne bloque PAS la reponse au user, on logge
 * juste une erreur cote console. La metrique manquera mais l'experience
 * utilisateur ne degrade pas.
 */

import { createClient } from "npm:@supabase/supabase-js@2";

export interface LlmUsageEvent {
  /** Sub. de l'utilisateur (peut etre null si appel anonyme). */
  userId?: string | null;
  /** Tenant courant (peut etre null si hors tenant). */
  tenantId?: string | null;
  /** Nom de l'endpoint (ex: 'claude-proxy', 'pim-generate'). */
  endpoint: string;
  /** Modele Claude utilise (ex: 'claude-sonnet-4-5-20250929'). */
  model: string;
  /** Reponse `usage` brute de l'API Anthropic. */
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  } | null;
  /** Metadonnees libres pour debug (latence, request_id, etc.). */
  metadata?: Record<string, unknown>;
}

let _client: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (_client) return _client;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    console.warn(
      "[llm_usage] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY absents — logging desactive"
    );
    return null;
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

export async function logLlmUsage(event: LlmUsageEvent): Promise<void> {
  const client = getClient();
  if (!client) return;

  const inputTokens =
    (event.usage?.input_tokens ?? 0) +
    (event.usage?.cache_read_input_tokens ?? 0) +
    (event.usage?.cache_creation_input_tokens ?? 0);
  const outputTokens = event.usage?.output_tokens ?? 0;

  try {
    const { error } = await client.from("llm_usage_events").insert({
      user_id: event.userId ?? null,
      tenant_id: event.tenantId ?? null,
      endpoint: event.endpoint,
      model: event.model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      metadata: event.metadata ?? {},
    });
    if (error) {
      console.error("[llm_usage] insert failed:", error.message);
    }
  } catch (e) {
    console.error("[llm_usage] unexpected error:", e);
  }
}
