import { useEffect, useRef, useState } from 'react';
import { ApiClientError } from '../../../platform/api/fetch-api-client.ts';
import { useWorkspaceApi } from '../../../platform/runtime/workspace-ui-runtime.tsx';
import { HopeStudioApiClient } from '../api/client.ts';
import {
  HOPSTUDIO_ASSET_ROOT,
  HOPSTUDIO_EJS_ROOT,
  HOPSTUDIO_RUNTIME_URL,
  HOPSTUDIO_STYLESHEET_URL,
  type HopeStudioBrowserChat,
} from './assets.ts';


type HopeStudioInstance = Readonly<{
  locals: Record<string, unknown> & { customApiFetch?: typeof fetch };
}>;

type HopeStudioRuntime = Readonly<{
  allInstances: HopeStudioInstance[];
  newInstanceFromElem(element: HTMLElement): HopeStudioInstance;
}>;

export type HopeStudioInitialRequest = Readonly<{
  id: string;
  query: string;
}>;

declare global {
  interface Window {
    sugarcrepeHL?: HopeStudioRuntime;
    HChat?: Record<string, unknown>;
    hopes_suite?: {
      chat?: HopeStudioBrowserChat;
    };
  }
}

let runtimePromise: Promise<HopeStudioRuntime> | null = null;
const sentInitialRequestIds = new Set<string>();
const HOPSTUDIO_WIDGET_TIMEOUT_MS = 60_000;

export function HopeStudioWorkspace({
  tenantId,
  userId,
  initialRequest,
  compact = false,
}: Readonly<{
  tenantId: string;
  userId: string;
  initialRequest: HopeStudioInitialRequest;
  compact?: boolean;
}>) {
  const api = useWorkspaceApi(HopeStudioApiClient);
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let mountedInstance: HopeStudioInstance | null = null;
    let disposeChatChrome = () => {};

    const mount = async () => {
      try {
        const runtime = await loadHopeStudioRuntime();
        const host = hostRef.current;
        if (!active || !host) return;

        discardDetachedInstances(runtime);
        configureChatIdentity(tenantId, userId);
        configureHost(host, tenantId);
        mountedInstance = runtime.newInstanceFromElem(host);
        const HLUX = mountedInstance.locals;
        HLUX.customApiFetch = createWorkflowTransport(api, tenantId, userId);

        await waitForElement('#chat-widget', HOPSTUDIO_WIDGET_TIMEOUT_MS);
        if (!active) return;
        document.querySelector('#chat-widget')?.classList.remove('chat-minimized');
        disposeChatChrome = enhanceChatChrome(() => {}, () => {});
        setStatus('ready');
      } catch (cause) {
        if (!active) return;
        setStatus('error');
        setError(cause instanceof Error ? cause.message : 'Chargement HopeStudio impossible.');
      }
    };

    void mount();
    return () => {
      active = false;
      disposeChatChrome();
      if (mountedInstance && window.sugarcrepeHL) {
        const index = window.sugarcrepeHL.allInstances.indexOf(mountedInstance);
        if (index >= 0) window.sugarcrepeHL.allInstances.splice(index, 1);
      }
      document.querySelector('#chat-widget')?.remove();
    };
  }, [api, tenantId, userId]);

  useEffect(() => {
    if (status !== 'ready') return;
    const key = `${tenantId}:${userId}:${initialRequest.id}`;
    if (sentInitialRequestIds.has(key)) return;
    const sendMessage = window.hopes_suite?.chat?.sendMessage;
    if (!sendMessage) {
      setError('Le chat HopeStudio est monté mais son API de message est indisponible.');
      return;
    }
    sentInitialRequestIds.add(key);
    setError(null);
    void sendMessage(initialRequest.query).catch((cause) => {
      sentInitialRequestIds.delete(key);
      setError(cause instanceof Error ? cause.message : 'La demande initiale n’a pas pu être envoyée à HopeStudio.');
    });
  }, [initialRequest.id, initialRequest.query, status, tenantId, userId]);

  return (
    <section
      className="hopstudio-workspace h-full min-h-0 overflow-hidden bg-white"
      data-testid="hopstudio-workspace"
      data-chat-started="true"
      data-embedded="true"
      data-compact={compact ? 'true' : 'false'}
      aria-busy={status === 'loading'}
    >
      {status !== 'ready' && (
        <div className="m-4 rounded-md border border-line bg-paper px-4 py-3 text-sm text-ink-muted" role="status">
          {status === 'loading' ? 'Chargement de Clariprint Studio…' : error}
        </div>
      )}
      {status === 'ready' && error && (
        <div className="absolute inset-x-3 top-3 z-40 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <div id="hopes-container" className="hopstudio-container">
        <div id="chat-bar" className="chat-bar" />
        <div id="ui-main" className="ui-main">
          <div
            ref={hostRef}
            role="SugarCrepe"
            data-tenant={tenantId}
            data-user={userId}
            data-testid="hopstudio-host"
          >
            <div role="dashboard" />
          </div>
        </div>
      </div>
    </section>
  );
}

function enhanceChatChrome(
  onConversationStart: () => void,
  onConversationReset: () => void,
) {
  const input = document.querySelector<HTMLInputElement>('#chat-text');
  const composer = document.querySelector<HTMLElement>('#chat-input');
  const title = document.querySelector<HTMLElement>('#chat-header .title');
  const reset = document.querySelector<HTMLButtonElement>('#chat-reset');
  const basketImage = document.querySelector<HTMLImageElement>('#chat-header-basket img');
  if (!input || !composer) return () => {};

  input.placeholder = 'Décrivez votre projet d’impression…';
  title?.replaceChildren(document.createTextNode('Historique'));
  title?.setAttribute('title', 'Afficher l’historique HopeStudio');
  reset?.replaceChildren(document.createTextNode('Nouveau'));
  reset?.setAttribute('title', 'Démarrer une nouvelle conversation');
  reset?.addEventListener('click', onConversationReset, { capture: true });
  basketImage?.setAttribute('alt', 'Panier');

  const startOnEnter = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && input.value.trim()) onConversationStart();
  };
  input.addEventListener('keypress', startOnEnter, { capture: true });

  let send = composer.querySelector<HTMLButtonElement>('#hopstudio-send');
  const updateSendState = () => {
    if (send) send.disabled = !input.value.trim();
  };
  const sendCurrentPrompt = () => {
    const prompt = input.value.trim();
    if (!prompt) return;
    onConversationStart();
    input.value = '';
    updateSendState();
    void window.hopes_suite?.chat?.sendMessage?.(prompt);
  };

  if (!send) {
    send = document.createElement('button');
    send.id = 'hopstudio-send';
    send.type = 'button';
    send.disabled = !input.value.trim();
    send.innerHTML = '<span>Envoyer</span><kbd>↵</kbd>';
    composer.appendChild(send);
  }
  send.addEventListener('click', sendCurrentPrompt);
  input.addEventListener('input', updateSendState);

  return () => {
    input.removeEventListener('keypress', startOnEnter, { capture: true });
    input.removeEventListener('input', updateSendState);
    reset?.removeEventListener('click', onConversationReset, { capture: true });
    send?.removeEventListener('click', sendCurrentPrompt);
  };
}

function configureHost(element: HTMLElement, tenantId: string) {
  const workflowUrl = `/api/v1/tenants/${encodeURIComponent(tenantId)}/integrations/hopstudio/workflow`;
  element.setAttribute('url', workflowUrl);
  element.setAttribute('headless', HOPSTUDIO_ASSET_ROOT);
  element.setAttribute('ux', 'all -rc -sa -sh +market');
  element.setAttribute('options', JSON.stringify({
    verbose: -1,
    ui_mode: 'disconnect',
    ui_lang: 'fr',
    useInCustomUX: true,
    sugarcrepe_server: workflowUrl,
    sugarcrepe_headless: HOPSTUDIO_ASSET_ROOT,
    root_ejs: { base: HOPSTUDIO_EJS_ROOT },
    root_img: { base: `${HOPSTUDIO_ASSET_ROOT}img/` },
    root_css: { base: `${HOPSTUDIO_ASSET_ROOT}css/` },
    root_lang: { base: `${HOPSTUDIO_ASSET_ROOT}lang/` },
  }));
}

function configureChatIdentity(tenantId: string, userId: string) {
  if (!window.HChat) window.HChat = {};
  window.HChat.tenant_id = tenantId;
  window.HChat.user_id = userId;
  window.HChat.useDefaultSession = true;
}

function createWorkflowTransport(
  api: HopeStudioApiClient,
  tenantId: string,
  userId: string,
): typeof fetch {
  return (async (_url: RequestInfo | URL, payload: RequestInit = {}) => {
    try {
      const result = await api.callWorkflow(tenantId, {
        hook: 'magrit.workspace.home',
        event: 'callHopesServer',
        provider: 'hopstudio',
        context: {
          tenantId,
          userId,
          method: payload.method ?? 'POST',
          headers: safeHeaders(payload.headers),
          body: await requestBody(payload.body),
        },
      }, payload.signal ?? undefined);
      return Response.json(result);
    } catch (error) {
      if ((error as Error).name === 'AbortError') throw error;
      if (error instanceof ApiClientError) {
        return Response.json(error.problem, {
          status: error.problem.status,
          headers: { 'Content-Type': 'application/problem+json' },
        });
      }
      return Response.json({
        type: 'about:blank',
        title: 'Workflow HopeStudio indisponible',
        status: 502,
        code: 'hopstudio.workflow_unavailable',
        detail: error instanceof Error ? error.message : 'Erreur de transport HopeStudio.',
      }, { status: 502 });
    }
  }) as typeof fetch;
}

async function requestBody(body: BodyInit | null | undefined): Promise<string> {
  if (body == null) return '';
  if (typeof body === 'string') return body;
  if (body instanceof URLSearchParams) return body.toString();
  if (body instanceof FormData) {
    const entries: [string, string][] = [];
    for (const [key, value] of body.entries()) {
      if (typeof value === 'string') entries.push([key, value]);
    }
    return new URLSearchParams(entries).toString();
  }
  throw new TypeError('Le callback HopeStudio attend un corps de formulaire encodé.');
}

function safeHeaders(headers: HeadersInit | undefined): Record<string, string> {
  const source = new Headers(headers);
  const result: Record<string, string> = {};
  for (const name of ['accept', 'content-type']) {
    const value = source.get(name);
    if (value) result[name] = value;
  }
  return result;
}

function discardDetachedInstances(runtime: HopeStudioRuntime) {
  for (let index = runtime.allInstances.length - 1; index >= 0; index -= 1) {
    const instance = runtime.allInstances[index];
    const element = (instance as HopeStudioInstance & { element?: HTMLElement } | undefined)?.element;
    if (element && !element.isConnected) runtime.allInstances.splice(index, 1);
  }
}

async function waitForElement(selector: string, timeoutMs: number) {
  const startedAt = Date.now();
  while (!document.querySelector(selector)) {
    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error(`HopeStudio n'a pas créé ${selector} dans le délai attendu.`);
    }
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
}

function loadHopeStudioRuntime(): Promise<HopeStudioRuntime> {
  if (window.sugarcrepeHL) return Promise.resolve(window.sugarcrepeHL);
  if (runtimePromise) return runtimePromise;

  ensureStylesheet();
  runtimePromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-hopstudio-runtime="true"]');
    const script = existing ?? document.createElement('script');
    script.type = 'module';
    script.src = HOPSTUDIO_RUNTIME_URL;
    script.dataset.hopstudioRuntime = 'true';
    script.addEventListener('load', () => {
      if (window.sugarcrepeHL) resolve(window.sugarcrepeHL);
      else reject(new Error('Le bundle HopeStudio est chargé mais son runtime est absent.'));
    }, { once: true });
    script.addEventListener('error', () => {
      runtimePromise = null;
      reject(new Error(`Impossible de charger ${HOPSTUDIO_RUNTIME_URL}.`));
    }, { once: true });
    if (!existing) document.head.appendChild(script);
  });
  return runtimePromise;
}

function ensureStylesheet() {
  if (document.querySelector(`link[href="${HOPSTUDIO_STYLESHEET_URL}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = HOPSTUDIO_STYLESHEET_URL;
  link.dataset.hopstudioStyles = 'true';
  document.head.appendChild(link);
}
