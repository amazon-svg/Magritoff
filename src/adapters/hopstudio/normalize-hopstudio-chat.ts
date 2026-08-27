import {
  hopStudioChatResultSchema,
  hopStudioRawEnvelopeSchema,
  type HopeStudioChatResult,
  type HopeStudioProductConfig,
} from '../../modules/hopstudio/api/contracts.ts';
import { HopeStudioChatUnavailableError } from '../../modules/hopstudio/application/hopstudio-chat-gateway.ts';

type UnknownRecord = Record<string, unknown>;

export function normalizeHopeStudioChatResponse(payload: unknown): HopeStudioChatResult {
  const envelope = hopStudioRawEnvelopeSchema.safeParse(payload);
  if (!envelope.success) {
    throw new HopeStudioChatUnavailableError(
      `Réponse HopeStudio invalide (${describePayloadShape(payload)}).`,
    );
  }

  const response = envelope.data.response;
  const event = asRecord(response.event);
  const session = asRecord(response.session);
  const cards = extractCards(response, event);
  const aliasInfos = asRecord(session.alias_infos);
  const configs = cards.map((card) => normalizeCard(card, aliasInfos));

  return hopStudioChatResultSchema.parse({
    success: true,
    configs,
    teachingNote: firstString(event.message, response.message, response.ai_message),
    demoMode: false,
    provider: 'hopstudio',
    // chat.js considère UID/session_id comme l'identifiant de session. DBK est
    // une clé de données et ne doit être utilisée qu'en repli pour les anciennes
    // réponses HopeStudio qui ne fournissent pas encore d'identifiant explicite.
    sessionRef: firstString(session.UID, session.session_id, session.DBK),
    sessionDataRef: firstString(session.DBK),
  });
}

function describePayloadShape(payload: unknown): string {
  if (payload === null) return 'valeur null';
  if (Array.isArray(payload)) return `tableau de ${payload.length} élément(s)`;
  if (typeof payload !== 'object') return `type ${typeof payload}`;

  const keys = Object.keys(payload as UnknownRecord).slice(0, 8);
  return keys.length > 0
    ? `objet sans champ response; champs: ${keys.join(', ')}`
    : 'objet vide sans champ response';
}

function extractCards(response: UnknownRecord, event: UnknownRecord): UnknownRecord[] {
  const deck = Array.isArray(event.deck)
    ? event.deck
    : Array.isArray(response.deck)
      ? response.deck
      : [];
  const cards = deck.map(asRecord).filter((card) => Object.keys(card).length > 0);
  if (cards.length > 0) return cards;

  const uiEvent = asRecord(response.ui_event);
  const configuration = asRecord(uiEvent.configuration);
  if (Object.keys(configuration).length === 0) return [];
  return [{
    UID: uiEvent.UID,
    DBK: uiEvent.DBK,
    selected: uiEvent.ID,
    configuration,
    ui_event: uiEvent,
  }];
}

function normalizeCard(card: UnknownRecord, aliasInfos: UnknownRecord): HopeStudioProductConfig {
  const uiEvent = asRecord(card.ui_event);
  const configuration = firstRecord(card.configuration, uiEvent.configuration);
  const selected = firstString(card.selected, uiEvent.ID);
  const directInfos = asRecord(card.infos);
  const selectedInfos = selected ? asRecord(aliasInfos[selected]) : {};
  const infos = Object.keys(directInfos).length > 0 ? directInfos : selectedInfos;
  const productName = firstString(
    infos.title,
    infos.name,
    card.title,
    card.name,
    selected,
  ) ?? 'Produit';

  const quantity = firstNumber(
    configuration.quantity,
    configuration.q,
    configuration.DEF_Q,
  );
  const width = firstNumber(configuration.width, configuration.w, configuration.DEF_W);
  const height = firstNumber(configuration.height, configuration.h, configuration.DEF_H);
  const support = firstString(
    configuration.material,
    configuration.paper,
    configuration.support,
    infos.material,
  );
  const grammage = firstNumber(configuration.weight, configuration.grammage);
  const gamme = firstString(configuration.gamme, configuration.gamme_slug, infos.gamme);

  return {
    clariprint: configuration,
    display: compact({
      productName,
      quantity,
      gamme,
      format: firstString(configuration.format) ?? dimensions(width, height),
      support,
      grammage,
      impression: asOptionalRecord(configuration.impression),
      finitionRecto: firstString(configuration.finishRecto, configuration.finishing_front),
      finitionVerso: firstString(configuration.finishVerso, configuration.finishing_back),
    }),
    hopStudio: {
      cardRef: firstString(card.UID, uiEvent.UID),
      dataRef: firstString(card.DBK, uiEvent.DBK),
    },
  };
}

function compact(record: UnknownRecord): UnknownRecord {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined && value !== null && value !== ''));
}

function dimensions(width?: number, height?: number): string | undefined {
  return width !== undefined && height !== undefined ? `${width} × ${height}` : undefined;
}

function asOptionalRecord(value: unknown): UnknownRecord | undefined {
  const record = asRecord(value);
  return Object.keys(record).length > 0 ? record : undefined;
}

function firstRecord(...values: unknown[]): UnknownRecord {
  for (const value of values) {
    const record = asRecord(value);
    if (Object.keys(record).length > 0) return record;
  }
  return {};
}

function asRecord(value: unknown): UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return undefined;
}
