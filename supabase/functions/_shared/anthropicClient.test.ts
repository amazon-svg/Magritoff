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
