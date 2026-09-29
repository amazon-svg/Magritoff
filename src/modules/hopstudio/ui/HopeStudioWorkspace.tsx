import { useEffect, useRef, useState } from 'react';
import { ApiClientError } from '../../../platform/api/fetch-api-client.ts';
import { useWorkspaceApi } from '../../../platform/runtime/workspace-ui-runtime.tsx';
import { HopeStudioApiClient } from '../api/client.ts';
import {
  ProjectsApiClient,
  importHopeStudioBasketItemCommandSchema,
  type ImportedCommercialFile,
} from '@/modules/projects';
import {
  HOPSTUDIO_ASSET_ROOT,
  HOPSTUDIO_EJS_ROOT,
  HOPSTUDIO_RUNTIME_URL,
  HOPSTUDIO_STYLESHEET_URL,
  type HopeStudioBrowserChat,
} from './assets.ts';
import {
  DESCRIPTION_HTML_MAX_LENGTH,
  escapeDescriptionHtml,
} from '@/shared/validation/safe-description-html';


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
const HOPSTUDIO_WIDGET_TIMEOUT_MS = 120_000;

export function HopeStudioWorkspace({
  tenantId,
  userId,
  initialRequest,
  compact = false,
  projectId = null,
  sessionId = null,
  onSessionId,
  onProjectItemsAdded,
}: Readonly<{
  tenantId: string;
  userId: string;
  initialRequest: HopeStudioInitialRequest;
  compact?: boolean;
  projectId?: string | null;
  sessionId?: string | null;
  onSessionId?: (sessionId: string) => Promise<void> | void;
  onProjectItemsAdded?: (count: number) => void;
}>) {
  const api = useWorkspaceApi(HopeStudioApiClient);
  const projectsApi = useWorkspaceApi(ProjectsApiClient);
  const hostRef = useRef<HTMLDivElement>(null);
  const importingRef = useRef(false);
  const [transferMessage, setTransferMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const persistedSessionRef = useRef<string | null>(sessionId);
  const projectBootstrapRef = useRef({ projectId, sessionId });
  if (projectBootstrapRef.current.projectId !== projectId) {
    projectBootstrapRef.current = { projectId, sessionId };
  }
  // Fige la session utilisée au montage pour le projet courant. Lorsque le
  // widget crée sa première session, la prop passe de null à l identifiant
  // persisté sans provoquer un démontage/remontage de cette même instance.
  const bootstrapSessionId = projectBootstrapRef.current.sessionId;

  useEffect(() => {
    // Le runtime HopeStudio est global et conserve la session du widget
    // précédent après son démontage. La vider synchroniquement, avant tout
    // `await` et avant la création de la nouvelle instance, empêche le projet
    // entrant de capturer puis persister la session du projet sortant.
    resetHopeStudioBrowserSession();
    persistedSessionRef.current = bootstrapSessionId;

    let active = true;
    let mountedInstance: HopeStudioInstance | null = null;
    let disposeChatChrome = () => {};
    const addCurrentCardToProject = (card: unknown, rankSelected: number) => {
      if (!projectId) {
        setTransferMessage('Sélectionnez un projet actif avant d’ajouter ce chiffrage.');
        return;
      }
      if (importingRef.current) return;

      importingRef.current = true;
      setTransferMessage('Ajout du chiffrage au projet…');
      void (async () => {
        try {
          const selectedCard = selectedHopeStudioCard(card, rankSelected);
          const [supplierQuote, templatesResult] = await Promise.all([
            getHopeStudioSupplierQuote(selectedCard),
            getHopeStudioCardSvgsForImport(selectedCard),
          ]);
          const descriptionHtml = getHopeStudioCardDescription(selectedCard);
          const files = [
            ...(supplierQuote ? [supplierQuote] : []),
            ...templatesResult.files,
          ];
          const command = {
            card: selectedCard,
            ...(descriptionHtml ? { description_html: descriptionHtml } : {}),
            ...(files.length > 0 ? { files } : {}),
          };
          const key = await basketIdempotencyKey(projectId, command.card);
          await projectsApi.importHopeStudioBasketItem(projectId, command, key);
          if (active) {
            onProjectItemsAdded?.(1);
            const fileSummary = files.length > 0
              ? ` avec ${files.length} fichier${files.length > 1 ? 's' : ''}`
              : '';
            const templateWarning = templatesResult.warning
              ? ` Gabarits non joints : ${templatesResult.warning}`
              : '';
            setTransferMessage(`Chiffrage ajouté au projet${fileSummary}.${templateWarning}`);
          }
        } catch (cause) {
          if (active) {
            setTransferMessage(cause instanceof Error
              ? cause.message
              : 'Le chiffrage n’a pas pu être ajouté au projet.');
          }
        } finally {
          importingRef.current = false;
        }
      })();
    };
    const disposeChatIdentity = configureChatIdentity(
      tenantId,
      userId,
      bootstrapSessionId,
      initialRequest.query,
      addCurrentCardToProject,
    );

    const mount = async () => {
      try {
        console.log('[HopeStudio] chargement', {
          sessionKey: bootstrapSessionId ?? '<nouvelle>',
          projectId,
        });
        const runtime = await loadHopeStudioRuntime();
        const host = hostRef.current;
        if (!active || !host) return;

        discardDetachedInstances(runtime);
        configureHost(host, tenantId);
        console.info('[HopeStudio] création de l’instance', {
          tenantId,
          projectId,
          sessionId: bootstrapSessionId ?? null,
          userId
        });
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
      disposeChatIdentity();
      disposeChatChrome();
      if (mountedInstance && window.sugarcrepeHL) {
        const index = window.sugarcrepeHL.allInstances.indexOf(mountedInstance);
        if (index >= 0) window.sugarcrepeHL.allInstances.splice(index, 1);
      }
      document.querySelector('#chat-widget')?.remove();
    };
  }, [api, bootstrapSessionId, onProjectItemsAdded, projectId, projectsApi, tenantId, userId]);

  useEffect(() => {
    if (!onSessionId) return;
    let active = true;
    const capture = () => {
      const session = window.hopes_suite?.chat?.session;
      const candidate = typeof session?.session_id === 'string' && session.session_id
        ? session.session_id
        : typeof session?.UID === 'string' && session.UID
          ? session.UID
          : null;
      if (!active || !candidate || candidate === persistedSessionRef.current) return;
      persistedSessionRef.current = candidate;
      void Promise.resolve(onSessionId(candidate)).catch((cause) => {
        // Conserver la valeur dans la ref évite de relancer la même écriture
        // toutes les 250 ms, notamment si la session appartient déjà à un
        // autre projet. Le prochain changement réel de session sera capturé.
        setError(cause instanceof Error
          ? cause.message
          : 'La session HopeStudio n’a pas pu être associée au projet.');
      });
    };
    capture();
    const timer = window.setInterval(capture, 250);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [onSessionId, sessionId, status]);

  useEffect(() => {
    const importBasket = (event: Event) => {
      if (importingRef.current) return;
      if (!projectId) {
        setTransferMessage('Sélectionnez un projet actif avant de transférer le panier.');
        return;
      }
      const lines = (event as CustomEvent<{ lines?: unknown }>).detail?.lines;
      if (!Array.isArray(lines) || lines.length === 0 || lines.length > 50) {
        setTransferMessage('Le panier HopeStudio doit contenir entre 1 et 50 lignes.');
        return;
      }
      importingRef.current = true;
      setTransferMessage('Transfert du panier vers le projet…');
      void (async () => {
        let imported = 0;
        try {
          const commands = lines.map((line) => {
            const { card } = importHopeStudioBasketItemCommandSchema.parse({ card: line });
            const descriptionHtml = getHopeStudioCardDescription(card);
            return {
              card: {
                DBK: card.DBK,
                ...(card.prompt !== undefined ? { prompt: card.prompt } : {}),
                ...(card.selected !== undefined ? { selected: card.selected } : {}),
                configuration: card.configuration,
                clicked_intent: { getPrice: { response: card.clicked_intent.getPrice.response } },
              },
              ...(descriptionHtml ? { description_html: descriptionHtml } : {}),
            };
          });
          for (const command of commands) {
            const key = await basketIdempotencyKey(projectId, command.card);
            await projectsApi.importHopeStudioBasketItem(projectId, command, key);
            imported += 1;
            onProjectItemsAdded?.(1);
          }
          setTransferMessage(`${imported} chiffrage${imported > 1 ? 's' : ''} ajouté${imported > 1 ? 's' : ''} au projet.`);
        } catch (cause) {
          setTransferMessage(`${imported} ligne${imported > 1 ? 's' : ''} ajoutée${imported > 1 ? 's' : ''}. ${cause instanceof Error ? cause.message : 'Transfert impossible.'}`);
        } finally {
          importingRef.current = false;
        }
      })();
    };
    window.addEventListener('HOPES-PUSH-BASKET', importBasket);
    return () => window.removeEventListener('HOPES-PUSH-BASKET', importBasket);
  }, [onProjectItemsAdded, projectId, projectsApi]);

  return (
    <section
      className="hopstudio-workspace relative h-full min-h-0 overflow-hidden bg-white"
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
      {transferMessage && (
        <div className="absolute inset-x-3 top-3 z-40 rounded-md border border-line bg-white px-4 py-3 text-sm text-ink shadow" role="status">
          {transferMessage}
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

async function basketIdempotencyKey(
  projectId: string,
  card: ReturnType<typeof importHopeStudioBasketItemCommandSchema.parse>['card'],
): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify({
    projectId,
    cardKey: card.DBK,
    selected: card.selected,
    configuration: card.configuration,
    amount: card.clicked_intent.getPrice.response,
  }));
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return `hopstudio-${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
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
  const submitThroughHopeStudioUi = () => {
    if (!input.value.trim()) return;
    // Déclenche le gestionnaire clavier natif installé par HopeStudio. Magrit
    // n appelle ni sendMessage ni CallAI et n effectue aucun HTTP ici.
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keypress', {
      key: 'Enter',
      code: 'Enter',
      bubbles: true,
      cancelable: true,
    }));
    updateSendState();
  };

  if (!send) {
    send = document.createElement('button');
    send.id = 'hopstudio-send';
    send.type = 'button';
    send.disabled = !input.value.trim();
    send.innerHTML = '<span>Envoyer</span><kbd>↵</kbd>';
    composer.appendChild(send);
  }
  send.addEventListener('click', submitThroughHopeStudioUi);
  input.addEventListener('input', updateSendState);

  return () => {
    input.removeEventListener('keypress', startOnEnter, { capture: true });
    input.removeEventListener('input', updateSendState);
    reset?.removeEventListener('click', onConversationReset, { capture: true });
    send?.removeEventListener('click', submitThroughHopeStudioUi);
  };
}

function configureHost(element: HTMLElement, tenantId: string) {
  const workflowUrl = `/api/v1/tenants/${encodeURIComponent(tenantId)}/integrations/hopstudio/workflow`;
  element.setAttribute('url', workflowUrl);
  element.setAttribute('headless', HOPSTUDIO_ASSET_ROOT);
  element.setAttribute('ux', 'all -rc -sa -sh +market');
  element.setAttribute('options', JSON.stringify({
    verbose: 10,
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

function configureChatIdentity(
  tenantId: string,
  userId: string,
  sessionId: string | null,
  initialPrompt: string,
  onAddToBasket: (card: unknown, rankSelected: number) => void,
) {
  if (!window.HChat) window.HChat = {};
  window.HChat.tenant_id = tenantId;
  window.HChat.user_id = userId;
  window.HChat.session_id = null;
  window.HChat.initial_session_id = isValidSessionId(sessionId) ? sessionId : 'new';
  window.HChat.initial_prompt = initialPrompt.trim() || null;

  window.HChat.useDefaultSession = true;
  const callbackAddToBasket = (card: unknown, rankSelected: number) => {
    onAddToBasket(card, rankSelected);
  };
  window.HChat.callbackAddToBasket = callbackAddToBasket;

  return () => {
    if (window.HChat?.callbackAddToBasket === callbackAddToBasket) {
      delete window.HChat.callbackAddToBasket;
    }
  };
}

export function selectedHopeStudioCard(
  card: unknown,
  rankSelected: number,
): ReturnType<typeof importHopeStudioBasketItemCommandSchema.parse>['card'] {
  if (!isRecord(card)) throw new Error('Le chiffrage HopeStudio est invalide.');
  const clickedIntent = card['clicked_intent'];
  if (!isRecord(clickedIntent)) throw new Error('Le chiffrage HopeStudio ne contient aucun prix.');
  const getPrice = clickedIntent['getPrice'];
  if (!isRecord(getPrice)) throw new Error('Le chiffrage HopeStudio ne contient aucun prix.');

  // HopeStudio trie `all_process` puis transmet l'index effectivement choisi.
  // Le contrat projet attend le prix retenu dans `response`.
  const processes = getPrice['all_process'];
  const selectedProcess = Array.isArray(processes) && Number.isInteger(rankSelected)
    ? processes[rankSelected]
    : null;
  const selectedTotal = isRecord(selectedProcess) ? selectedProcess['total'] : undefined;
  const response = selectedTotal ?? getPrice['response'];

  return importHopeStudioBasketItemCommandSchema.parse({
    card: {
      ...card,
      clicked_intent: {
        ...clickedIntent,
        getPrice: { ...getPrice, response },
      },
    },
  }).card;
}

export async function getHopeStudioSupplierQuote(
  card: ReturnType<typeof importHopeStudioBasketItemCommandSchema.parse>['card'],
  hchat: Record<string, unknown> | undefined = window.HChat,
): Promise<ImportedCommercialFile | null> {
  const getPrice = card.clicked_intent.getPrice;
  const quoteProcessKey = typeof getPrice['quote_process_key'] === 'string'
    ? getPrice['quote_process_key']
    : null;
  if (!quoteProcessKey) return null;

  const getAttachment = hchat?.getAttachment;
  if (typeof getAttachment !== 'function') {
    throw new Error('HopeStudio ne permet pas de récupérer le PDF fournisseur.');
  }

  const response = await Reflect.apply(getAttachment, hchat, [quoteProcessKey]);
  if (!(response instanceof Response)) {
    throw new Error('HopeStudio a retourné une réponse de fichier invalide.');
  }
  if (!response.ok) throw new Error(`Récupération du PDF HopeStudio impossible (${response.status}).`);
  const payload: unknown = await response.json();
  if (!isRecord(payload) || payload['status'] !== 'ok' || typeof payload['datas'] !== 'string') {
    throw new Error('HopeStudio n’a pas retourné le PDF fournisseur attendu.');
  }

  const safeCardKey = card.DBK.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 120);
  return {
    kind: 'supplier_quote',
    visibility: 'internal',
    filename: `devis-fournisseur-${safeCardKey || 'hopstudio'}.pdf`,
    content_type: 'application/pdf',
    data_base64: payload['datas'],
  };
}

const HOPSTUDIO_SVG_TIMEOUT_MS = 30_000;

/**
 * Les gabarits enrichissent la ligne mais ne conditionnent jamais sa création.
 * L'erreur reste disponible pour informer l'utilisateur après l'import.
 */
export async function getHopeStudioCardSvgsForImport(
  card: ReturnType<typeof importHopeStudioBasketItemCommandSchema.parse>['card'],
  chat: HopeStudioBrowserChat | undefined = window.hopes_suite?.chat,
): Promise<Readonly<{ files: ImportedCommercialFile[]; warning: string | null }>> {
  try {
    return { files: await getHopeStudioCardSvgs(card, chat), warning: null };
  } catch (cause) {
    return {
      files: [],
      warning: cause instanceof Error
        ? cause.message
        : 'Les gabarits HopeStudio n’ont pas pu être récupérés.',
    };
  }
}

/**
 * Récupère les gabarits produits par HopeStudio pour la card sélectionnée.
 * L'API vendor est asynchrone par callback : on attend donc sa réponse avant
 * de créer la ligne afin que celle-ci et ses fichiers restent cohérents.
 */
export async function getHopeStudioCardSvgs(
  card: ReturnType<typeof importHopeStudioBasketItemCommandSchema.parse>['card'],
  chat: HopeStudioBrowserChat | undefined = window.hopes_suite?.chat,
): Promise<ImportedCommercialFile[]> {
  const getCardSvgs = chat?.getCardSvgs;
  if (typeof getCardSvgs !== 'function') return [];
  const getDesignerSVG = chat?.getDesignerSVG;
  const getPrinterSVG = chat?.getPrinterSVG;
  if (typeof getDesignerSVG !== 'function' || typeof getPrinterSVG !== 'function') {
    throw new Error('HopeStudio ne permet pas de préparer les gabarits PAO et production.');
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback();
    };
    const timeout = setTimeout(() => {
      finish(() => reject(new Error('HopeStudio n’a pas retourné les gabarits dans le délai attendu.')));
    }, HOPSTUDIO_SVG_TIMEOUT_MS);

    const handleResponse = (data: unknown) => {
      finish(() => {
        try {
          if (!isRecord(data)) {
            throw new Error('HopeStudio a retourné une réponse de gabarits invalide.');
          }
          // Depuis la mise à jour HopeStudio, la collection s'appelle
          // `response` et `sources` est un tableau. On conserve la lecture de
          // l'ancien `reponses`/`sources: string` pour les runtimes en cache.
          const responses = Array.isArray(data['response'])
            ? data['response']
            : data['reponses'];
          if (!Array.isArray(responses)) {
            throw new Error('HopeStudio a retourné une réponse de gabarits invalide.');
          }

          const files = responses.flatMap((response, index): ImportedCommercialFile[] => {
            const source = isRecord(response)
              ? hopeStudioSvgSource(response['sources'])
              : null;
            if (!isRecord(response)
              || !source
              || typeof response['svg'] !== 'string'
              || !response['svg'].trim()) {
              throw new Error(`Le gabarit HopeStudio n°${index + 1} est invalide.`);
            }

            const sourceFilename = safeHopeStudioFilename(source, index);
            const designerSvg = Reflect.apply(getDesignerSVG, chat, [response['svg']]);
            const printerSvg = Reflect.apply(getPrinterSVG, chat, [response['svg']]);
            if (typeof designerSvg !== 'string' || !designerSvg.trim()) {
              throw new Error(`Le gabarit PAO HopeStudio n°${index + 1} est invalide.`);
            }
            if (typeof printerSvg !== 'string' || !printerSvg.trim()) {
              throw new Error(`Le gabarit de production HopeStudio n°${index + 1} est invalide.`);
            }

            return [
              {
                kind: 'technical_template',
                visibility: 'customer',
                filename: hopeStudioVariantFilename(sourceFilename, 'pao'),
                content_type: 'image/svg+xml',
                data_base64: utf8ToBase64(designerSvg),
              },
              {
                kind: 'technical_template',
                visibility: 'internal',
                filename: hopeStudioVariantFilename(sourceFilename, 'production'),
                content_type: 'image/svg+xml',
                data_base64: utf8ToBase64(printerSvg),
              },
            ];
          });
          resolve(files);
        } catch (cause) {
          reject(cause);
        }
      });
    };

    try {
      Reflect.apply(getCardSvgs, chat, [card, handleResponse]);
    } catch (cause) {
      finish(() => reject(cause));
    }
  });
}

function hopeStudioSvgSource(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value;
  if (!Array.isArray(value)) return null;
  return value.find((source): source is string => typeof source === 'string' && Boolean(source.trim())) ?? null;
}

function hopeStudioVariantFilename(filename: string, variant: 'pao' | 'production'): string {
  const basename = filename.toLocaleLowerCase().endsWith('.svg')
    ? filename.slice(0, -4)
    : filename;
  return `${basename.slice(0, 255 - variant.length - 5)}-${variant}.svg`;
}

function safeHopeStudioFilename(source: string, index: number): string {
  const filename = source
    .split(/[\\/]/)
    .at(-1)
    ?.replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
  return (filename || `gabarit-${index + 1}.svg`).slice(0, 255);
}

function utf8ToBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Demande à HopeStudio le résumé lisible de la card reçue par son callback,
 * puis le transforme en HTML volontairement minimal pour la ligne métier.
 */
export function getHopeStudioCardDescription(
  card: ReturnType<typeof importHopeStudioBasketItemCommandSchema.parse>['card'],
  chat: HopeStudioBrowserChat | undefined = window.hopes_suite?.chat,
  ownerDocument: Document = document,
): string | null {
  const getCardClearResume = chat?.getCardClearResume;
  if (typeof getCardClearResume !== 'function') return null;

  try {
    const rawResume = Reflect.apply(getCardClearResume, chat, [card]);
    if (typeof rawResume !== 'string' || !rawResume.trim()) return null;

    // HopeStudio peut retourner des entités HTML. On les décode d'abord comme
    // du texte, puis on ré-échappe tout afin qu'aucune balise de la card ne
    // puisse entrer dans la description commerciale.
    const decoder = ownerDocument.createElement('textarea');
    decoder.innerHTML = rawResume;
    const clearText = decoder.value.replaceAll('\r\n', '\n').trim();
    if (!clearText) return null;

    const characters = [...clearText];
    const render = (length: number) => `<p>${escapeDescriptionHtml(characters.slice(0, length).join('')).replaceAll('\n', '<br>')}</p>`;
    if (render(characters.length).length <= DESCRIPTION_HTML_MAX_LENGTH) {
      return render(characters.length);
    }

    let low = 0;
    let high = characters.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (render(middle).length <= DESCRIPTION_HTML_MAX_LENGTH) low = middle;
      else high = middle - 1;
    }
    return low > 0 ? render(low) : null;
  } catch {
    // Un résumé indisponible ne doit pas empêcher l'ajout du chiffrage : le
    // backend reconstruira alors le détail depuis la configuration.
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resetHopeStudioBrowserSession() {
  if (window.hopes_suite?.chat) delete window.hopes_suite.chat.session;
}

export function createWorkflowTransport(
  api: Pick<HopeStudioApiClient, 'callWorkflow'>,
  tenantId: string,
  userId: string,
): typeof fetch {
  return (async (_url: RequestInfo | URL, payload: RequestInit = {}) => {
    try {
      const rawBody = await requestBody(payload.body);
      const result = await api.callWorkflow(tenantId, {
        hook: 'magrit.workspace.home',
        event: 'callHopesServer',
        provider: 'hopstudio',
        context: {
          tenantId,
          userId,
          method: payload.method ?? 'POST',
          headers: safeHeaders(payload.headers),
          // Le transport est volontairement transparent : seul HopeStudio
          // choisit ses actions et crée ses sessions. Magrit relaie le corps
          // exact sans transformer loadSession en newSession ni fabriquer
          // d appel HTTP supplémentaire.
          body: rawBody,
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

function isValidSessionId(value: string | null): value is string {
  return Boolean(value && value !== 'undefined' && value !== 'null');
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
    const element = (instance as HopeStudioInstance & { element?: unknown } | undefined)?.element;
    const node = element instanceof HTMLElement
      ? element
      : element && typeof element === 'object' && '0' in element
        ? (element as { 0?: unknown })[0]
        : null;
    if (node instanceof HTMLElement && !node.isConnected) runtime.allInstances.splice(index, 1);
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
