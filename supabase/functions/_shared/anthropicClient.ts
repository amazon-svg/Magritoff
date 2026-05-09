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

export interface AnthropicMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AnthropicCompleteOptions {
  /** Modele Claude (ex: "claude-haiku-4-5-20251001", "claude-sonnet-4-20250514"). */
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
 */
export class AnthropicClientError extends Error {
  constructor(
    public readonly kind:
      | "api_error"
      | "invalid_response"
      | "json_parse"
      | "schema_validation"
      | "param_limit_exceeded"
      | "missing_api_key",
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AnthropicClientError";
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
  const apiKey =
    Deno.env.get("ANTHROPIC_API_KEY") ?? Deno.env.get("MAGRIT3") ?? Deno.env.get("MAGRIT");
  if (!apiKey) {
    throw new AnthropicClientError(
      "missing_api_key",
      "Aucune cle API Anthropic configuree (variables ANTHROPIC_API_KEY / MAGRIT3 / MAGRIT absentes)",
    );
  }

  // Build messages
  const messages: AnthropicMessage[] = opts.messages ?? [];
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
  const response = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  });
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
