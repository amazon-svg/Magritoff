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
