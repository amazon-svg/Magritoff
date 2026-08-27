import { useEffect, useRef, useState } from 'react';

const ASSET_ROOT = '/vendor/hopstudio/1.0.0/';
const RUNTIME_URL = `${ASSET_ROOT}sugarcrepeHLUX.mjs`;
const STYLESHEET_URL = `${ASSET_ROOT}css/sugarcrepeHLUX.magrit.css`;
const TEST_API_URL = '/dev/hopstudio-api';

type HopeStudioInstance = Readonly<{
  locals: Record<string, unknown> & { customApiFetch?: typeof fetch };
}>;

type HopeStudioRuntime = Readonly<{
  allInstances: HopeStudioInstance[];
  newInstanceFromElem(element: HTMLElement): HopeStudioInstance;
}>;

declare global {
  interface Window {
    sugarcrepeHL?: HopeStudioRuntime;
    hopes_suite?: {
      chat?: {
        sendMessage?: (message: string) => Promise<unknown>;
      };
    };
  }
}

let runtimePromise: Promise<HopeStudioRuntime> | null = null;

export function HopeStudioIntegrationTestPage() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [detail, setDetail] = useState('Chargement du runtime HopeStudio…');
  const [calls, setCalls] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    const mount = async () => {
      try {
        const runtime = await loadHopeStudioRuntime();
        if (!active || !hostRef.current) return;

        configureHopeStudioHost(hostRef.current);
        const instance = runtime.newInstanceFromElem(hostRef.current);
        instance.locals.customApiFetch = createMockApiFetch((action) => {
          if (active) setCalls((previous) => [...previous, action].slice(-12));
        });
        await waitForElement('#chat-widget', 10_000);
        document.querySelector('#chat-widget')?.classList.remove('chat-minimized');

        if (!active) return;
        setStatus('ready');
        setDetail('Bundle chargé, instance créée et chat HopeStudio monté avec l’identité de test Magrit.');
      } catch (error) {
        if (!active) return;
        setStatus('error');
        setDetail(error instanceof Error ? error.message : 'Échec inconnu du montage HopeStudio.');
      }
    };

    void mount();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-bg p-6 text-ink" data-testid="hopstudio-integration-test">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-lg border border-line bg-paper p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Test développeur isolé</p>
          <h1 className="mt-1 text-xl font-semibold">Montage de l’UX HopeStudio</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Les assets sont réels. Les appels métier sont simulés dans le navigateur et aucun secret n’est utilisé.
          </p>
          <div className="mt-3 flex items-center gap-2 text-sm" role="status">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                status === 'ready' ? 'bg-green-600' : status === 'error' ? 'bg-red-600' : 'bg-amber-500'
              }`}
            />
            <span data-testid="hopstudio-integration-status">{detail}</span>
          </div>
          <button
            type="button"
            disabled={status !== 'ready'}
            onClick={() => void window.hopes_suite?.chat?.sendMessage?.('Je veux 500 flyers')}
            className="mt-3 rounded-md bg-ink px-3 py-2 text-sm text-paper disabled:opacity-40"
          >
            Envoyer le prompt de test
          </button>
        </header>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-h-[680px] overflow-auto rounded-lg border border-line bg-white p-3">
            <div id="chat-bar" data-testid="hopstudio-chat-bar" />
            <div
              ref={hostRef}
              id="hopes-container"
              role="SugarCrepe"
              data-tenant="magrit-test-tenant"
              data-user="magrit-test-user"
              data-testid="hopstudio-host"
            >
              <div role="dashboard" />
            </div>
          </div>

          <aside className="rounded-lg border border-line bg-paper p-4 text-xs">
            <h2 className="text-sm font-semibold">Appels capturés</h2>
            <p className="mt-1 text-ink-muted">Réponses simulées par le test.</p>
            <ol className="mt-3 space-y-1 font-mono" data-testid="hopstudio-api-calls">
              {calls.length === 0 ? <li className="text-ink-muted">Aucun appel</li> : calls.map((call, index) => (
                <li key={`${call}-${index}`}>{call}</li>
              ))}
            </ol>
          </aside>
        </section>
      </div>
      <footer data-hopstudio-test-footer />
    </main>
  );
}

async function waitForElement(selector: string, timeoutMs: number) {
  const startedAt = Date.now();
  while (!document.querySelector(selector)) {
    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error(`HopeStudio n a pas créé ${selector} dans le délai attendu.`);
    }
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
}

function configureHopeStudioHost(element: HTMLElement) {
  element.setAttribute('url', TEST_API_URL);
  element.setAttribute('headless', ASSET_ROOT);
  element.setAttribute('ux', 'all -rc');
  element.setAttribute('options', JSON.stringify({
    verbose: -1,
    ui_mode: 'disconnect',
    ui_lang: 'fr',
    useInCustomUX: true,
    sugarcrepe_server: TEST_API_URL,
    sugarcrepe_headless: ASSET_ROOT,
    root_ejs: { base: `${ASSET_ROOT}ejs/` },
    root_img: { base: `${ASSET_ROOT}img/` },
    root_css: { base: `${ASSET_ROOT}css/` },
    root_lang: { base: `${ASSET_ROOT}lang/` },
  }));
}

function loadHopeStudioRuntime(): Promise<HopeStudioRuntime> {
  if (window.sugarcrepeHL) return Promise.resolve(window.sugarcrepeHL);
  if (runtimePromise) return runtimePromise;

  ensureStylesheet();
  runtimePromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = RUNTIME_URL;
    script.dataset.hopstudioRuntime = 'true';
    script.addEventListener('load', () => {
      if (window.sugarcrepeHL) resolve(window.sugarcrepeHL);
      else reject(new Error('Le bundle est chargé mais window.sugarcrepeHL est absent.'));
    }, { once: true });
    script.addEventListener('error', () => reject(new Error(`Impossible de charger ${RUNTIME_URL}.`)), { once: true });
    document.head.appendChild(script);
  });
  return runtimePromise;
}

function ensureStylesheet() {
  if (document.querySelector(`link[href="${STYLESHEET_URL}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = STYLESHEET_URL;
  link.dataset.hopstudioStyles = 'true';
  document.head.appendChild(link);
}

function createMockApiFetch(onCall: (action: string) => void): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (!url.endsWith(TEST_API_URL)) return fetch(input, init);

    const parameters = new URLSearchParams(typeof init?.body === 'string' ? init.body : undefined);
    const action = parameters.get('action') ?? 'unknown';
    onCall(action);

    if (action === 'CallAI') {
      return Response.json({
        response: {
          ai_message: 'Réponse simulée : le pont chat HopeStudio est correctement monté dans Magrit.',
          event: {
            prompt: 'Je veux 500 flyers',
            message: 'Réponse simulée : le pont chat HopeStudio est correctement monté dans Magrit.',
            deck: ['test-card-data'],
          },
          session: {
            UID: 'test-session',
            tenant_id: 'magrit-test-tenant',
            user_id: 'magrit-test-user',
          },
        },
      });
    }
    if (action === 'newSession' || action === 'loadSession') {
      return Response.json({
        status: 'ok',
        datas: {
          UID: 'test-session',
          DBK: 'test-session-data',
          tenant_id: 'magrit-test-tenant',
          user_id: 'magrit-test-user',
          history: [],
          events: [],
        },
      });
    }
    if (action === 'getSessionTitle') {
      return Response.json({ session_title: 'Session de test Magrit' });
    }
    if (action === 'loadSessionParts') {
      return Response.json({
        status: 'ok',
        datas: {
          UID: 'test-card',
          DBK: 'test-card-data',
          message: 'Réponse simulée : le pont chat HopeStudio est correctement monté dans Magrit.',
          configuration: {},
          fields: [],
        },
      });
    }
    return Response.json({ response: {}, datas: [] });
  }) as typeof fetch;
}
