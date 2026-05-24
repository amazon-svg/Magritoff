/**
 * Tests Deno pour anthropicClient.ts (Story S1.5).
 *
 * Lancer : `deno test --allow-env --allow-net=api.anthropic.com supabase/functions/_shared/anthropicClient.test.ts`
 *
 * Ces tests mockent globalThis.fetch pour simuler les reponses Anthropic
 * (succes, erreur HTTP, stream SSE), sans appeler l API reelle.
 */

import {
  assertEquals,
  assertRejects,
  assert,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  anthropicComplete,
  anthropicStream,
  AnthropicClientError,
  isAnthropicBillingError,
} from "./anthropicClient.ts";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ORIGINAL_SUPABASE_URL = Deno.env.get("SUPABASE_URL");

function setApiKey(value: string | undefined) {
  if (value === undefined) Deno.env.delete("ANTHROPIC_API_KEY");
  else Deno.env.set("ANTHROPIC_API_KEY", value);
  // Empeche le helper logLlmUsage de tenter une insertion (no SUPABASE_URL).
  Deno.env.delete("SUPABASE_URL");
}

function restoreEnv() {
  if (ORIGINAL_API_KEY !== undefined) Deno.env.set("ANTHROPIC_API_KEY", ORIGINAL_API_KEY);
  else Deno.env.delete("ANTHROPIC_API_KEY");
  if (ORIGINAL_SUPABASE_URL !== undefined) Deno.env.set("SUPABASE_URL", ORIGINAL_SUPABASE_URL);
  else Deno.env.delete("SUPABASE_URL");
  globalThis.fetch = ORIGINAL_FETCH;
}

function buildSseStream(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const evt of events) controller.enqueue(encoder.encode(evt));
      controller.close();
    },
  });
}

Deno.test("anthropicComplete throws missing_api_key when no env var", async () => {
  setApiKey(undefined);
  try {
    await assertRejects(
      () =>
        anthropicComplete({
          model: "claude-haiku-4-5-20251001",
          prompt: "ping",
          endpoint: "test",
        }),
      AnthropicClientError,
    );
  } finally {
    restoreEnv();
  }
});

Deno.test("anthropicComplete returns text and usage on success", async () => {
  setApiKey("test-key");
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          content: [{ type: "text", text: "Bonjour" }],
          usage: { input_tokens: 12, output_tokens: 3 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    )) as typeof fetch;
  try {
    const r = await anthropicComplete({
      model: "claude-haiku-4-5-20251001",
      prompt: "ping",
      endpoint: "test",
    });
    assertEquals(r.text, "Bonjour");
    assertEquals(r.usage.input_tokens, 12);
    assertEquals(r.usage.output_tokens, 3);
  } finally {
    restoreEnv();
  }
});

Deno.test("anthropicComplete throws api_error on non-2xx", async () => {
  setApiKey("test-key");
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response("credit balance is too low", { status: 402 }),
    )) as typeof fetch;
  try {
    const err = await assertRejects(
      () =>
        anthropicComplete({
          model: "claude-haiku-4-5-20251001",
          prompt: "ping",
          endpoint: "test",
        }),
      AnthropicClientError,
    ) as AnthropicClientError;
    assertEquals(err.kind, "api_error");
    assertEquals(
      (err.details as { status?: number } | undefined)?.status,
      402,
    );
  } finally {
    restoreEnv();
  }
});

Deno.test("anthropicStream parses SSE chunks and final usage", async () => {
  setApiKey("test-key");
  // Simule la sequence SSE Anthropic typique :
  //  message_start (donne input_tokens) → content_block_delta x N → message_delta (output_tokens) → message_stop
  const sse = [
    `event: message_start\ndata: ${JSON.stringify({
      type: "message_start",
      message: {
        model: "claude-sonnet-4-5-20250929",
        usage: { input_tokens: 42 },
      },
    })}\n\n`,
    `event: content_block_delta\ndata: ${JSON.stringify({
      type: "content_block_delta",
      delta: { type: "text_delta", text: "Bon" },
    })}\n\n`,
    `event: content_block_delta\ndata: ${JSON.stringify({
      type: "content_block_delta",
      delta: { type: "text_delta", text: "jour" },
    })}\n\n`,
    `event: message_delta\ndata: ${JSON.stringify({
      type: "message_delta",
      delta: {},
      usage: { output_tokens: 7 },
    })}\n\n`,
    `event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n\n`,
  ];

  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(buildSseStream(sse), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    )) as typeof fetch;

  try {
    const { textChunks, finalPromise } = await anthropicStream({
      model: "claude-sonnet-4-5-20250929",
      prompt: "Dis bonjour",
      endpoint: "test-stream",
    });

    const collected: string[] = [];
    for await (const chunk of textChunks) collected.push(chunk);

    assertEquals(collected, ["Bon", "jour"]);

    const final = await finalPromise;
    assertEquals(final.fullText, "Bonjour");
    assertEquals(final.model, "claude-sonnet-4-5-20250929");
    assertEquals(final.usage.input_tokens, 42);
    assertEquals(final.usage.output_tokens, 7);
  } finally {
    restoreEnv();
  }
});

Deno.test("anthropicStream throws api_error on non-2xx", async () => {
  setApiKey("test-key");
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response("authentication failed", { status: 401 }),
    )) as typeof fetch;
  try {
    const err = await assertRejects(
      () =>
        anthropicStream({
          model: "claude-sonnet-4-5-20250929",
          prompt: "ping",
          endpoint: "test-stream",
        }),
      AnthropicClientError,
    ) as AnthropicClientError;
    assertEquals(err.kind, "api_error");
    assertEquals(
      (err.details as { status?: number } | undefined)?.status,
      401,
    );
  } finally {
    restoreEnv();
  }
});

Deno.test("anthropicStream throws missing_api_key when no env var", async () => {
  setApiKey(undefined);
  try {
    const err = await assertRejects(
      () =>
        anthropicStream({
          model: "claude-sonnet-4-5-20250929",
          prompt: "ping",
          endpoint: "test-stream",
        }),
      AnthropicClientError,
    ) as AnthropicClientError;
    assertEquals(err.kind, "missing_api_key");
  } finally {
    restoreEnv();
  }
});

Deno.test("anthropicStream handles SSE data line split across 2 chunks (review fix P5)", async () => {
  setApiKey("test-key");
  const encoder = new TextEncoder();
  // On split l'event `content_block_delta` en plein milieu du payload JSON.
  // Le wrapper doit accumuler dans buffer et reparser quand le \n\n arrive.
  const fullEvent = `event: content_block_delta\ndata: ${JSON.stringify({
    type: "content_block_delta",
    delta: { type: "text_delta", text: "split-text" },
  })}\n\n`;
  const splitAt = Math.floor(fullEvent.length / 2);
  const chunk1 = fullEvent.slice(0, splitAt);
  const chunk2 = fullEvent.slice(splitAt);
  const messageStop = `event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n\n`;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(chunk1));
      controller.enqueue(encoder.encode(chunk2));
      controller.enqueue(encoder.encode(messageStop));
      controller.close();
    },
  });

  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } }),
    )) as typeof fetch;

  try {
    const { textChunks, finalPromise } = await anthropicStream({
      model: "claude-sonnet-4-5-20250929",
      prompt: "ping",
      endpoint: "test-stream-split",
    });
    const collected: string[] = [];
    for await (const chunk of textChunks) collected.push(chunk);
    assertEquals(collected, ["split-text"]);
    const final = await finalPromise;
    assertEquals(final.fullText, "split-text");
  } finally {
    restoreEnv();
  }
});

Deno.test("anthropicStream tolerates [DONE] payload and malformed JSON SSE lines (review fix P6)", async () => {
  setApiKey("test-key");
  const sse = [
    `event: message_start\ndata: ${JSON.stringify({
      type: "message_start",
      message: { model: "claude-sonnet-4-5-20250929", usage: { input_tokens: 5 } },
    })}\n\n`,
    // Ligne data avec [DONE] sentinel : doit etre skip silencieusement
    `data: [DONE]\n\n`,
    // Ligne data avec JSON malforme : doit etre skip silencieusement
    `data: {not valid json\n\n`,
    `event: content_block_delta\ndata: ${JSON.stringify({
      type: "content_block_delta",
      delta: { type: "text_delta", text: "ok" },
    })}\n\n`,
    `event: message_delta\ndata: ${JSON.stringify({
      type: "message_delta",
      delta: {},
      usage: { output_tokens: 1 },
    })}\n\n`,
    `event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n\n`,
  ];
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(buildSseStream(sse), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    )) as typeof fetch;

  try {
    const { textChunks, finalPromise } = await anthropicStream({
      model: "claude-sonnet-4-5-20250929",
      prompt: "ping",
      endpoint: "test-stream-tolerant",
    });
    const collected: string[] = [];
    for await (const chunk of textChunks) collected.push(chunk);
    // [DONE] et malforme sont ignores ; seul le delta valide produit une chunk
    assertEquals(collected, ["ok"]);
    const final = await finalPromise;
    assertEquals(final.usage.input_tokens, 5);
    assertEquals(final.usage.output_tokens, 1);
  } finally {
    restoreEnv();
  }
});

Deno.test("anthropicStream silently drops content_block_delta without text (review fix P7)", async () => {
  setApiKey("test-key");
  const sse = [
    `event: message_start\ndata: ${JSON.stringify({
      type: "message_start",
      message: { model: "claude-sonnet-4-5-20250929", usage: { input_tokens: 3 } },
    })}\n\n`,
    // Tool-use delta : pas de `text`, doit etre silently drop
    `event: content_block_delta\ndata: ${JSON.stringify({
      type: "content_block_delta",
      delta: { type: "tool_use_delta", partial_json: '{"foo":' },
    })}\n\n`,
    // Text delta valide qui suit
    `event: content_block_delta\ndata: ${JSON.stringify({
      type: "content_block_delta",
      delta: { type: "text_delta", text: "real" },
    })}\n\n`,
    `event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n\n`,
  ];
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(buildSseStream(sse), { status: 200 }),
    )) as typeof fetch;
  try {
    const { textChunks, finalPromise } = await anthropicStream({
      model: "claude-sonnet-4-5-20250929",
      prompt: "ping",
      endpoint: "test-stream-tool-use",
    });
    const collected: string[] = [];
    for await (const chunk of textChunks) collected.push(chunk);
    // Seul le text_delta produit une chunk ; le tool_use_delta est drop
    assertEquals(collected, ["real"]);
    const final = await finalPromise;
    assertEquals(final.fullText, "real");
  } finally {
    restoreEnv();
  }
});

Deno.test("anthropicComplete does not mutate caller messages array (review fix P1)", async () => {
  setApiKey("test-key");
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({ content: [{ type: "text", text: "ok" }], usage: {} }),
        { status: 200 },
      ),
    )) as typeof fetch;
  try {
    const callerMessages = [{ role: "user" as const, content: "first" }];
    const before = callerMessages.length;
    await anthropicComplete({
      model: "claude-haiku-4-5-20251001",
      messages: callerMessages,
      prompt: "second",
      endpoint: "test-immutable",
    });
    // Le caller messages NE DOIT PAS avoir ete mute par push() interne
    assertEquals(callerMessages.length, before);
    assertEquals(callerMessages[0].content, "first");
  } finally {
    restoreEnv();
  }
});

Deno.test("anthropicComplete enforces 25 parameter limit (FR43)", async () => {
  setApiKey("test-key");
  // 26 lignes "- key: value" → depasse la limite
  const promptWith26Params = Array.from({ length: 26 }, (_, i) =>
    `- key${i}: "value${i}"`,
  ).join("\n");
  try {
    const err = await assertRejects(
      () =>
        anthropicComplete({
          model: "claude-haiku-4-5-20251001",
          prompt: promptWith26Params,
          endpoint: "test",
        }),
      AnthropicClientError,
    ) as AnthropicClientError;
    assertEquals(err.kind, "param_limit_exceeded");
    assert((err.details as { paramCount?: number } | undefined)?.paramCount! > 25);
  } finally {
    restoreEnv();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Story S-LLM-WRAPPER-ROBUSTNESS — AC1/AC6 matrice billing + AC3 timeout
// ─────────────────────────────────────────────────────────────────────────────

/** Helper : forge une AnthropicClientError api_error avec status + body donnes. */
function makeApiError(status: number, body: string): AnthropicClientError {
  return new AnthropicClientError("api_error", `Anthropic API HTTP ${status}`, {
    status,
    body,
    endpoint: "test",
  });
}

// ── Couche 1 : status HTTP deterministe ──────────────────────────────────────

Deno.test("isAnthropicBillingError: 401 authentication_error → true (Couche 1 status)", () => {
  assertEquals(isAnthropicBillingError(makeApiError(401, "")), true);
});

Deno.test("isAnthropicBillingError: 402 billing_error → true (Couche 1 status)", () => {
  assertEquals(isAnthropicBillingError(makeApiError(402, "")), true);
});

Deno.test("isAnthropicBillingError: 403 permission_error → true (Couche 1 status)", () => {
  assertEquals(isAnthropicBillingError(makeApiError(403, "")), true);
});

Deno.test("isAnthropicBillingError: 429 rate_limit_error → false (transient, pas billing)", () => {
  assertEquals(
    isAnthropicBillingError(
      makeApiError(429, JSON.stringify({ error: { type: "rate_limit_error", message: "..." } })),
    ),
    false,
  );
});

Deno.test("isAnthropicBillingError: 500 api_error → false (transient Anthropic)", () => {
  assertEquals(
    isAnthropicBillingError(
      makeApiError(500, JSON.stringify({ error: { type: "api_error", message: "..." } })),
    ),
    false,
  );
});

Deno.test("isAnthropicBillingError: 529 overloaded_error → false (transient)", () => {
  assertEquals(
    isAnthropicBillingError(
      makeApiError(529, JSON.stringify({ error: { type: "overloaded_error", message: "..." } })),
    ),
    false,
  );
});

Deno.test("isAnthropicBillingError: 400 invalid_request_error → false (input client invalide)", () => {
  assertEquals(
    isAnthropicBillingError(
      makeApiError(
        400,
        JSON.stringify({ error: { type: "invalid_request_error", message: "input is invalid" } }),
      ),
    ),
    false,
  );
});

Deno.test("isAnthropicBillingError: 504 timeout_error → false (transient timeout cote Anthropic)", () => {
  assertEquals(
    isAnthropicBillingError(
      makeApiError(504, JSON.stringify({ error: { type: "timeout_error", message: "..." } })),
    ),
    false,
  );
});

// ── Couche 1b : error.type parse depuis body JSON (cas sans status canonique) ─

Deno.test("isAnthropicBillingError: status hors range mais error.type=billing_error → true (Couche 1b parse JSON)", () => {
  // Cas defensif : status non standard (ex 0 sur erreur reseau parse-able,
  // ou code custom proxy) mais body Anthropic-shaped avec error.type canonique billing.
  // Couche 1b parse le JSON et match error.type=billing_error contre la set.
  assertEquals(
    isAnthropicBillingError(
      makeApiError(0, JSON.stringify({ error: { type: "billing_error", message: "..." } })),
    ),
    true,
  );
  // Idem avec authentication_error
  assertEquals(
    isAnthropicBillingError(
      makeApiError(0, JSON.stringify({ error: { type: "authentication_error", message: "..." } })),
    ),
    true,
  );
  // Mais NOT pour rate_limit_error meme si JSON parse-able
  assertEquals(
    isAnthropicBillingError(
      makeApiError(0, JSON.stringify({ error: { type: "rate_limit_error", message: "..." } })),
    ),
    false,
  );
});

// ── Couche 2 : regex stricte tokens canoniques ───────────────────────────────

Deno.test("isAnthropicBillingError: body avec credit_balance_too_low → true (Couche 2 regex)", () => {
  assertEquals(
    isAnthropicBillingError(makeApiError(0, "Error: credit_balance_too_low encountered")),
    true,
  );
});

Deno.test("isAnthropicBillingError: body avec invalid_api_key → true (Couche 2 regex)", () => {
  assertEquals(
    isAnthropicBillingError(makeApiError(0, "Error: invalid_api_key provided")),
    true,
  );
});

// ── Anti-faux-positifs : strings ambigues qui ne doivent PAS matcher ─────────

Deno.test("isAnthropicBillingError: 'input is invalid' → false (drift |invalid banni)", () => {
  // Ancien regex make-server matchait /invalid/ et classait ca billing.
  // Le nouveau helper rejette correctement.
  assertEquals(
    isAnthropicBillingError(
      makeApiError(400, JSON.stringify({ error: { type: "invalid_request_error", message: "input is invalid" } })),
    ),
    false,
  );
});

Deno.test("isAnthropicBillingError: 'credit card refused' Stripe-style → false (substring libre banni)", () => {
  // Ancien regex permissive /credit/ matchait ce texte non-Anthropic.
  assertEquals(
    isAnthropicBillingError(makeApiError(500, "credit card refused at Stripe gateway")),
    false,
  );
});

Deno.test("isAnthropicBillingError: 'authentication via OAuth' libre → false", () => {
  assertEquals(
    isAnthropicBillingError(makeApiError(500, "authentication via OAuth completed but session expired")),
    false,
  );
});

Deno.test("isAnthropicBillingError: 'billing department contact' libre → false", () => {
  assertEquals(
    isAnthropicBillingError(makeApiError(500, "please contact our billing department for details")),
    false,
  );
});

Deno.test("isAnthropicBillingError: erreur non-api_error (timeout, json_parse) → false", () => {
  assertEquals(
    isAnthropicBillingError(
      new AnthropicClientError("timeout", "Anthropic hang", { durationMs: 60001 }),
    ),
    false,
  );
  assertEquals(
    isAnthropicBillingError(
      new AnthropicClientError("json_parse", "bad json", { rawText: "..." }),
    ),
    false,
  );
  assertEquals(
    isAnthropicBillingError(
      new AnthropicClientError("missing_api_key", "no key"),
    ),
    false,
  );
});

Deno.test("isAnthropicBillingError: non-AnthropicClientError (Error standard) → false", () => {
  assertEquals(isAnthropicBillingError(new Error("random error")), false);
  assertEquals(isAnthropicBillingError(null), false);
  assertEquals(isAnthropicBillingError(undefined), false);
  assertEquals(isAnthropicBillingError("string error"), false);
});

// ── AC3 : timeout AbortSignal.timeout(60s) ───────────────────────────────────

Deno.test("anthropicComplete: throws kind=timeout when fetch is aborted", async () => {
  setApiKey("test-key");
  // Mock fetch qui throw immediatement une DOMException("TimeoutError")
  // simulant l'AbortSignal.timeout qui fire.
  globalThis.fetch = (() => {
    return Promise.reject(new DOMException("Request timed out", "TimeoutError"));
  }) as typeof fetch;
  try {
    const err = await assertRejects(
      () =>
        anthropicComplete({
          model: "claude-haiku-4-5-20251001",
          prompt: "ping",
          endpoint: "test-timeout",
        }),
      AnthropicClientError,
    ) as AnthropicClientError;
    assertEquals(err.kind, "timeout");
    const details = err.details as { endpoint?: string; timeoutMs?: number; model?: string };
    assertEquals(details.endpoint, "test-timeout");
    assertEquals(details.timeoutMs, 60_000);
    assertEquals(details.model, "claude-haiku-4-5-20251001");
  } finally {
    restoreEnv();
  }
});

Deno.test("anthropicStream: throws kind=timeout when fetch is aborted", async () => {
  setApiKey("test-key");
  globalThis.fetch = (() => {
    return Promise.reject(new DOMException("Request timed out", "TimeoutError"));
  }) as typeof fetch;
  try {
    const err = await assertRejects(
      () =>
        anthropicStream({
          model: "claude-sonnet-4-5-20250929",
          prompt: "ping",
          endpoint: "test-stream-timeout",
        }),
      AnthropicClientError,
    ) as AnthropicClientError;
    assertEquals(err.kind, "timeout");
    assertEquals(
      (err.details as { endpoint?: string } | undefined)?.endpoint,
      "test-stream-timeout",
    );
  } finally {
    restoreEnv();
  }
});

// ── Regression : strings d'erreur reelles observees en prod ──────────────────

Deno.test("anthropicComplete: 402 + body Anthropic billing_error JSON → kind=api_error classified billing", async () => {
  setApiKey("test-key");
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({ type: "error", error: { type: "billing_error", message: "Your credit balance is too low." } }),
        { status: 402 },
      ),
    )) as typeof fetch;
  try {
    const err = await assertRejects(
      () =>
        anthropicComplete({
          model: "claude-haiku-4-5-20251001",
          prompt: "ping",
          endpoint: "test",
        }),
      AnthropicClientError,
    ) as AnthropicClientError;
    assertEquals(err.kind, "api_error");
    assertEquals(isAnthropicBillingError(err), true);
  } finally {
    restoreEnv();
  }
});

Deno.test("anthropicComplete: 429 rate_limit → kind=api_error but NOT classified billing", async () => {
  setApiKey("test-key");
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({ type: "error", error: { type: "rate_limit_error", message: "Number of request tokens has exceeded your per-minute rate limit." } }),
        { status: 429 },
      ),
    )) as typeof fetch;
  try {
    const err = await assertRejects(
      () =>
        anthropicComplete({
          model: "claude-haiku-4-5-20251001",
          prompt: "ping",
          endpoint: "test",
        }),
      AnthropicClientError,
    ) as AnthropicClientError;
    assertEquals(err.kind, "api_error");
    assertEquals(isAnthropicBillingError(err), false);
  } finally {
    restoreEnv();
  }
});

Deno.test("anthropicComplete: 529 overloaded → kind=api_error but NOT classified billing", async () => {
  setApiKey("test-key");
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({ type: "error", error: { type: "overloaded_error", message: "Overloaded" } }),
        { status: 529 },
      ),
    )) as typeof fetch;
  try {
    const err = await assertRejects(
      () =>
        anthropicComplete({
          model: "claude-haiku-4-5-20251001",
          prompt: "ping",
          endpoint: "test",
        }),
      AnthropicClientError,
    ) as AnthropicClientError;
    assertEquals(err.kind, "api_error");
    assertEquals(isAnthropicBillingError(err), false);
  } finally {
    restoreEnv();
  }
});
