/**
 * AnthropicClient — wrapper unique pour les appels Claude depuis les edge functions.
 *
 * Story S1.1 (Epic 1 — Stack Foundations, PRD v1.1, 2026-05-09).
 *
 * Resout 4 problemes identifies en S1.3 / Epic 1 :
 *  1. Duplication du code fetch + parsing dans les 4 edge functions.
 *  2. Validation JSON ad-hoc, pas de schema strict (FR42, story 1.3 P0).
 *  3. Limite 25 parametres par prompt non appliquee (FR43, story 2.4 P0).
 *  4. Tracking llm_usage_events parfois oublie ou inconsistant (NFR23).
 *
 * Le wrapper expose 2 methodes :
 *   - complete()           : appel libre, retour texte + usage tokens
 *   - completeStructured() : appel + validation Zod + JSON parse automatique
 *
 * Tracking automatique via logLlmUsage() apres chaque appel reussi.
 *
 * Usage type (depuis une edge function) :
 *   import { anthropicComplete, anthropicCompleteStructured } from "../_shared/anthropicClient.ts";
 *   import { z } from "npm:zod@3";
 *
 *   const PimSchema = z.object({ name: z.string(), description: z.string() });
 *   const result = await anthropicCompleteStructured({
 *     model: "claude-haiku-4-5-20251001",
 *     prompt: "...",
 *     schema: PimSchema,
 *     endpoint: "pim-generate",
 *     userId, tenantId,
 *   });
 *   // result.data est typed PimSchema, deja valide
 */

import type { z } from "npm:zod@3";
import { logLlmUsage } from "./llm_usage.ts";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MAX_TOKENS = 4096;

/** Limite anti-hallucination (story 2.4 P0, FR43). */
const MAX_PROMPT_PARAMETERS = 25;

/**
 * Timeout defensif sur les fetch Anthropic (Story S-LLM-WRAPPER-ROBUSTNESS, AC3).
 * 60s = avant le kill platform Supabase a ~150s. Libere les ressources si Anthropic hang.
 *
 * Pour anthropicStream : couvre l'etablissement de la connexion + premier chunk
 * uniquement. AbortSignal.timeout ne tue pas un stream actif qui produit des chunks
 * regulierement (cas LLM 5-15s nominal cf. fix fe59be2). Il ne fire QUE si la
 * lecture du body bloque pendant 60s sans nouveau chunk.
 */
const ANTHROPIC_FETCH_TIMEOUT_MS = 60_000;

/**
 * Tokens canoniques d'error.type Anthropic classes "billing/auth" (Couche 1 AC1).
 * Source : https://docs.anthropic.com/en/api/errors (matrice officielle).
 *
 * Note : rate_limit_error (429) et invalid_request_error (400) sont EXCLUS
 * intentionnellement — un rate limit ou une input invalide n'est PAS un probleme
 * billing/cle, c'est un probleme metier (retry / fix payload caller).
 */
const ANTHROPIC_BILLING_ERROR_TYPES = new Set([
  "authentication_error", // 401 — API key invalide / revoquee
  "billing_error",        // 402 — credit_balance_too_low, payment required
  "permission_error",     // 403 — API key sans acces au modele
]);

/**
 * Regex Couche 2 (fallback message) : tokens stricts identifies dans la doc
 * Anthropic ou observes en prod. Ne match QUE des tokens complets entre word
 * boundaries, JAMAIS un substring libre dans une phrase.
 *
 * Patterns historiquement permissifs explicitement BANNIS :
 *   - /credit|billing|authentication/  (claude-proxy:23, match texte arbitraire)
 *   - /credit|billing|authentication|invalid/  (make-server:20, drift |invalid
 *     qui matchait "invalid input parameter" => faux positif billing)
 */
const BILLING_MESSAGE_REGEX =
  /\b(credit_balance_too_low|insufficient_quota|payment_required|invalid_api_key|authentication_error|billing_error|permission_error)\b/i;

/**
 * Lookup de la cle API Anthropic dans l'env Deno.
 * Ordre de priorite : ANTHROPIC_API_KEY (standard) > Magrit3 (mixed case, secret historique)
 * > MAGRIT3 (upper, robustesse) > MAGRIT (legacy).
 *
 * Note (S1.5 review fix P3) : factorise pour eviter la divergence entre
 * anthropicComplete et anthropicStream.
 */
function getAnthropicApiKey(): string | undefined {
  return (
    Deno.env.get("ANTHROPIC_API_KEY") ??
    Deno.env.get("Magrit3") ??
    Deno.env.get("MAGRIT3") ??
    Deno.env.get("MAGRIT")
  );
}

export interface AnthropicMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AnthropicCompleteOptions {
  /** Modele Claude (ex: "claude-haiku-4-5-20251001", "claude-sonnet-4-5-20250929"). */
  model: string;
  /** Soit `prompt` (raccourci user-only), soit `messages` (multi-tour). */
  prompt?: string;
  messages?: AnthropicMessage[];
  /** System prompt optionnel (Anthropic convention). */
  system?: string;
  /** Tokens max de sortie. Defaut 4096. */
  maxTokens?: number;
  /** Temperature 0..1. */
  temperature?: number;
  /** Nom de l'endpoint qui appelle (pour le tracking llm_usage_events). */
  endpoint: string;
  /** Sub utilisateur courant (peut etre null). */
  userId?: string | null;
  /** Tenant courant (peut etre null). */
  tenantId?: string | null;
  /** Metadonnees libres ajoutees au log (latence calculee automatiquement). */
  metadata?: Record<string, unknown>;
}

export interface AnthropicCompleteResult {
  /** Texte concatene des content blocks de la reponse Anthropic. */
  text: string;
  /** Reponse brute Anthropic (si besoin de parser autrement). */
  raw: unknown;
  /** Tokens consommes (deja loggue dans llm_usage_events). */
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  /** Latence en ms (de la requete a la reponse). */
  latency_ms: number;
}

export interface AnthropicCompleteStructuredOptions<T> extends AnthropicCompleteOptions {
  /** Schema Zod pour valider la reponse (apres parsing JSON). */
  schema: z.ZodSchema<T>;
  /** Si true, retire les fences markdown ```json...``` avant parsing. Defaut true. */
  stripMarkdownFences?: boolean;
}

export interface AnthropicCompleteStructuredResult<T> extends AnthropicCompleteResult {
  /** Donnee parsee + validee par le schema Zod. */
  data: T;
}

/**
 * Erreur levee par le wrapper. Conserve le contexte pour debug.
 *
 * kind "timeout" (Story S-LLM-WRAPPER-ROBUSTNESS AC3) : fire quand AbortSignal.timeout
 * declenche apres ANTHROPIC_FETCH_TIMEOUT_MS sans reponse / sans nouveau chunk SSE.
 */
export class AnthropicClientError extends Error {
  constructor(
    public readonly kind:
      | "api_error"
      | "invalid_response"
      | "json_parse"
      | "schema_validation"
      | "param_limit_exceeded"
      | "missing_api_key"
      | "timeout",
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AnthropicClientError";
  }
}

/**
 * Classifie une AnthropicClientError comme erreur billing/auth (Story
 * S-LLM-WRAPPER-ROBUSTNESS, AC1). Helper canonique partage par claude-proxy
 * et make-server-e3db71a4 pour decider du fallback demo.
 *
 * Strategie en 2 couches :
 *   Couche 1 (prioritaire, deterministe) : status HTTP + body.error.type Anthropic
 *     - 401 OU error.type=authentication_error  => billing (API key invalide)
 *     - 402 OU error.type=billing_error         => billing (paiement / credits)
 *     - 403 OU error.type=permission_error      => billing (API key sans acces)
 *     - 429 (rate_limit_error)                  => NON billing (transient)
 *     - 5xx (api_error/overloaded_error)        => NON billing (transient Anthropic)
 *     - 400 (invalid_request_error)             => NON billing (input client)
 *
 *   Couche 2 (fallback message body) : regex stricte sur tokens Anthropic
 *     canoniques uniquement (cf. BILLING_MESSAGE_REGEX). Pas de match libre
 *     sur "credit" / "billing" / "authentication" en substring.
 *
 * Retourne false pour tout kind != "api_error" (timeout, json_parse,
 * schema_validation, etc. ne sont pas des erreurs billing).
 */
export function isAnthropicBillingError(err: unknown): boolean {
  if (!(err instanceof AnthropicClientError)) return false;
  if (err.kind !== "api_error") return false;

  const details = err.details as
    | { status?: number; body?: string }
    | undefined;
  const status = details?.status;
  const body = String(details?.body ?? "");

  // Couche 1a — status HTTP deterministe
  if (status === 401 || status === 402 || status === 403) return true;
  if (status === 429) return false;
  if (status !== undefined && status >= 500 && status <= 599) return false;
  if (status === 400) {
    // 400 invalid_request_error = jamais billing.
    // Cas limite : 400 avec error.type ambigu dans le body => exclu par defaut.
    return false;
  }

  // Couche 1b — error.type canonique parse depuis le body JSON Anthropic
  // Format attendu : { type: "error", error: { type: "...", message: "..." } }
  try {
    const parsed = JSON.parse(body) as
      | { error?: { type?: string } }
      | null;
    const errorType = parsed?.error?.type;
    if (typeof errorType === "string" && ANTHROPIC_BILLING_ERROR_TYPES.has(errorType)) {
      return true;
    }
  } catch {
    // body n'est pas du JSON valide — on tombe sur la Couche 2 ci-dessous
  }

  // Couche 2 — regex stricte sur le message body (tokens canoniques uniquement)
  return BILLING_MESSAGE_REGEX.test(body);
}

/**
 * Wrapper interne pour fetch Anthropic avec AbortSignal.timeout (AC3).
 * Convertit AbortError en AnthropicClientError("timeout") typee.
 */
async function fetchAnthropicWithTimeout(
  body: unknown,
  apiKey: string,
  endpoint: string,
  model: string,
): Promise<Response> {
  const start = Date.now();
  try {
    return await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(ANTHROPIC_FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    // AbortSignal.timeout fire => DOMException("TimeoutError") sur Deno
    const isTimeout =
      (err instanceof DOMException && err.name === "TimeoutError") ||
      (err as Error)?.name === "TimeoutError" ||
      (err as Error)?.name === "AbortError";
    if (isTimeout) {
      throw new AnthropicClientError(
        "timeout",
        `Anthropic hang detecte apres ${ANTHROPIC_FETCH_TIMEOUT_MS}ms, abandon defensif`,
        {
          model,
          endpoint,
          durationMs: Date.now() - start,
          timeoutMs: ANTHROPIC_FETCH_TIMEOUT_MS,
        },
      );
    }
    throw err;
  }
}

/**
 * Compte le nombre de parametres "metier" dans le prompt pour appliquer
 * la limite de 25 (story 2.4 P0). Heuristique : on detecte les patterns
 * de paire cle: valeur dans le prompt (lignes avec "key: value" ou "- key:").
 *
 * Pour des prompts pure-prose sans liste de parametres, retourne 0.
 */
function countPromptParameters(text: string): number {
  if (!text) return 0;
  // Pattern simple : lignes commencant par "- xxx:" ou contenant " key: value"
  const lines = text.split(/\n/);
  let count = 0;
  for (const line of lines) {
    if (/^[\-\*\d.]+\s+\w[\w\s_-]{0,30}:\s+\S/.test(line.trim())) count++;
    else if (/\b\w[\w_-]{2,30}:\s+["{[\d]/.test(line)) count++;
  }
  return count;
}

/**
 * Appel Claude libre. Retourne le texte + metadata.
 * Trace automatiquement dans llm_usage_events.
 */
export async function anthropicComplete(
  opts: AnthropicCompleteOptions,
): Promise<AnthropicCompleteResult> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    throw new AnthropicClientError(
      "missing_api_key",
      "Aucune cle API Anthropic configuree (variables ANTHROPIC_API_KEY / Magrit3 / MAGRIT3 / MAGRIT absentes)",
    );
  }

  // Build messages — copie defensive pour ne pas muter l'array du caller (S1.5 review fix P1).
  const messages: AnthropicMessage[] = [...(opts.messages ?? [])];
  if (opts.prompt) {
    messages.push({ role: "user", content: opts.prompt });
  }
  if (messages.length === 0) {
    throw new AnthropicClientError(
      "invalid_response",
      "Au moins prompt ou messages doit etre fourni",
    );
  }

  // Anti-hallucination : limite 25 parametres (FR43, story 2.4 P0)
  for (const m of messages) {
    const params = countPromptParameters(m.content);
    if (params > MAX_PROMPT_PARAMETERS) {
      throw new AnthropicClientError(
        "param_limit_exceeded",
        `Prompt depasse la limite de ${MAX_PROMPT_PARAMETERS} parametres (detecte ${params}). Refuse pour eviter les hallucinations Claude.`,
        { paramCount: params, model: opts.model, endpoint: opts.endpoint },
      );
    }
  }

  const body: Record<string, unknown> = {
    model: opts.model,
    max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    messages,
  };
  if (opts.system) body.system = opts.system;
  if (opts.temperature !== undefined) body.temperature = opts.temperature;

  const start = Date.now();
  const response = await fetchAnthropicWithTimeout(body, apiKey, opts.endpoint, opts.model);
  const latency_ms = Date.now() - start;

  if (!response.ok) {
    const errorText = await response.text();
    throw new AnthropicClientError(
      "api_error",
      `Anthropic API HTTP ${response.status}`,
      { status: response.status, body: errorText.slice(0, 500), endpoint: opts.endpoint },
    );
  }

  const data = await response.json();
  const text: string = data?.content?.map?.((c: any) => c?.text ?? "").join("\n") ?? "";
  const usage = {
    input_tokens: data?.usage?.input_tokens ?? 0,
    output_tokens: data?.usage?.output_tokens ?? 0,
  };

  // Tracking automatique dans llm_usage_events (best-effort, non bloquant)
  await logLlmUsage({
    userId: opts.userId,
    tenantId: opts.tenantId,
    endpoint: opts.endpoint,
    model: opts.model,
    usage: data?.usage,
    metadata: {
      latency_ms,
      message_count: messages.length,
      ...(opts.metadata ?? {}),
    },
  });

  return { text, raw: data, usage, latency_ms };
}

/**
 * Appel Claude avec validation Zod automatique de la reponse JSON.
 *
 * Etapes :
 *  1. Appel via anthropicComplete().
 *  2. Strip des fences markdown ```json...``` (option, defaut true).
 *  3. JSON.parse.
 *  4. Validation Zod (schema.parse).
 *  5. Retour data type-safe.
 *
 * Erreurs typees :
 *  - "json_parse" si la reponse n'est pas du JSON valide.
 *  - "schema_validation" si la reponse ne matche pas le schema Zod.
 */
export async function anthropicCompleteStructured<T>(
  opts: AnthropicCompleteStructuredOptions<T>,
): Promise<AnthropicCompleteStructuredResult<T>> {
  const result = await anthropicComplete(opts);

  let textToParse = result.text;
  if (opts.stripMarkdownFences !== false) {
    textToParse = textToParse
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/\s*```$/, "")
      .trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(textToParse);
  } catch (err) {
    throw new AnthropicClientError(
      "json_parse",
      `Reponse Claude n'est pas un JSON valide`,
      { rawText: textToParse.slice(0, 500), parseError: (err as Error).message, endpoint: opts.endpoint },
    );
  }

  const validation = opts.schema.safeParse(parsed);
  if (!validation.success) {
    throw new AnthropicClientError(
      "schema_validation",
      `Reponse Claude ne respecte pas le schema attendu`,
      { issues: validation.error.issues, endpoint: opts.endpoint },
    );
  }

  return {
    ...result,
    data: validation.data,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Streaming variant (Story S1.5)
// ─────────────────────────────────────────────────────────────────────────────

export interface AnthropicStreamFinal {
  /** Texte concatene de tous les content_block_delta. */
  fullText: string;
  /** Tokens consommes (deja loggue dans llm_usage_events). */
  usage: { input_tokens: number; output_tokens: number };
  /** Modele Claude effectivement utilise (rapporte par message_start). */
  model: string;
}

export interface AnthropicStreamResult {
  /** Iterable async des deltas de texte. Le consommateur DOIT iterer pour
   *  drainer le stream et permettre a finalPromise de se resoudre. */
  textChunks: AsyncIterable<string>;
  /** Resout apres la fin du stream, apres logLlmUsage(). */
  finalPromise: Promise<AnthropicStreamFinal>;
}

/**
 * Variante streaming de anthropicComplete pour les endpoints SSE chat.
 *
 * Pattern d'usage typique (depuis make-server-e3db71a4/claude-proxy-stream) :
 *
 *   const { textChunks, finalPromise } = await anthropicStream({
 *     model: "claude-sonnet-4-5-20250929",
 *     messages, system, endpoint: "claude-proxy-stream", userId, tenantId,
 *   });
 *   for await (const text of textChunks) {
 *     await sse.writeSSE({ event: "delta", data: JSON.stringify({ text }) });
 *   }
 *   const { fullText, usage, model } = await finalPromise;
 *   // ... emettre l'event done ...
 *
 * Pre-flight :
 *  - Verifie ANTHROPIC_API_KEY / MAGRIT3 / MAGRIT (throw missing_api_key sinon)
 *  - Applique la limite 25 parametres (FR43, throw param_limit_exceeded sinon)
 *  - Throw api_error si la reponse HTTP n'est pas 2xx
 *
 * Side effects :
 *  - logLlmUsage() automatique apres le dernier event SSE (NFR23)
 *
 * Limitation connue : si le consommateur n'itere pas textChunks, finalPromise
 * reste en attente et le stream n'est pas drained. Le consommateur DOIT iterer.
 */
export async function anthropicStream(
  opts: AnthropicCompleteOptions,
): Promise<AnthropicStreamResult> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    throw new AnthropicClientError(
      "missing_api_key",
      "Aucune cle API Anthropic configuree (variables ANTHROPIC_API_KEY / Magrit3 / MAGRIT3 / MAGRIT absentes)",
    );
  }

  // Copie defensive pour ne pas muter l'array du caller (S1.5 review fix P1).
  const messages: AnthropicMessage[] = [...(opts.messages ?? [])];
  if (opts.prompt) {
    messages.push({ role: "user", content: opts.prompt });
  }
  if (messages.length === 0) {
    throw new AnthropicClientError(
      "invalid_response",
      "Au moins prompt ou messages doit etre fourni",
    );
  }

  // Anti-hallucination : limite 25 parametres (FR43, story 2.4 P0).
  for (const m of messages) {
    const params = countPromptParameters(m.content);
    if (params > MAX_PROMPT_PARAMETERS) {
      throw new AnthropicClientError(
        "param_limit_exceeded",
        `Prompt depasse la limite de ${MAX_PROMPT_PARAMETERS} parametres (detecte ${params}). Refuse pour eviter les hallucinations Claude.`,
        { paramCount: params, model: opts.model, endpoint: opts.endpoint },
      );
    }
  }

  const body: Record<string, unknown> = {
    model: opts.model,
    max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    messages,
    stream: true,
  };
  if (opts.system) body.system = opts.system;
  if (opts.temperature !== undefined) body.temperature = opts.temperature;

  const start = Date.now();
  const response = await fetchAnthropicWithTimeout(body, apiKey, opts.endpoint, opts.model);

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new AnthropicClientError(
      "api_error",
      `Anthropic API HTTP ${response.status}`,
      { status: response.status, body: errorText.slice(0, 500), endpoint: opts.endpoint },
    );
  }

  if (!response.body) {
    throw new AnthropicClientError(
      "invalid_response",
      "Anthropic streaming response has no body",
      { endpoint: opts.endpoint },
    );
  }

  let resolveFinal!: (v: AnthropicStreamFinal) => void;
  let rejectFinal!: (e: unknown) => void;
  const finalPromise = new Promise<AnthropicStreamFinal>((res, rej) => {
    resolveFinal = res;
    rejectFinal = rej;
  });
  // S1.5 review fix P10 : best-effort default handler pour eviter
  // UnhandledPromiseRejection si le caller n'await pas finalPromise.
  // Erreurs reelles : on les logge ici. Le caller qui veut les capter
  // peut quand meme attacher son propre .catch ; le default handler
  // est silent fallback uniquement.
  finalPromise.catch((err) => {
    console.error("[anthropicStream] finalPromise rejected (caller may not have awaited):", err);
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let fullText = "";
  let model = opts.model;
  let inputTokens = 0;
  let outputTokens = 0;

  async function* iterate(): AsyncIterable<string> {
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // S1.5 review fix P9 : CRLF support (certains proxies SSE).
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          let evt: { type?: string; message?: { model?: string; usage?: { input_tokens?: number } }; delta?: { text?: string }; usage?: { output_tokens?: number } };
          try {
            evt = JSON.parse(payload);
          } catch {
            continue;
          }
          if (evt.type === "message_start" && evt.message) {
            if (evt.message.model) model = evt.message.model;
            if (evt.message.usage?.input_tokens !== undefined) {
              inputTokens = evt.message.usage.input_tokens;
            }
          } else if (evt.type === "content_block_delta" && evt.delta?.text) {
            fullText += evt.delta.text;
            yield evt.delta.text;
          } else if (evt.type === "message_delta") {
            if (evt.usage?.output_tokens !== undefined) {
              outputTokens = evt.usage.output_tokens;
            }
          }
        }
      }

      const usage = { input_tokens: inputTokens, output_tokens: outputTokens };
      const latency_ms = Date.now() - start;
      // S1.5 review fix P8 : logLlmUsage en best-effort isole.
      // Sa signature interne est deja best-effort (catche ses erreurs DB),
      // mais si une exception inattendue survient (createClient, OOM),
      // on l'absorbe ici pour ne pas faire rejeter finalPromise.
      try {
        await logLlmUsage({
          userId: opts.userId,
          tenantId: opts.tenantId,
          endpoint: opts.endpoint,
          model,
          usage,
          metadata: {
            latency_ms,
            message_count: messages.length,
            streaming: true,
            ...(opts.metadata ?? {}),
          },
        });
      } catch (logErr) {
        console.error("[anthropicStream] logLlmUsage threw unexpectedly:", logErr);
      }
      resolveFinal({ fullText, usage, model });
    } catch (err) {
      rejectFinal(err);
      throw err;
    } finally {
      // S1.5 review fix P2 : cancel() le reader si le consommateur arrete
      // l'iteration prematurement (release lock + signale upstream).
      try {
        await reader.cancel().catch(() => {});
      } catch {
        // reader may already be released or stream closed
      }
      try {
        reader.releaseLock();
      } catch {
        // reader may already be released
      }
    }
  }

  return { textChunks: iterate(), finalPromise };
}
