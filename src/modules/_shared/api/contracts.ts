/**
 * Contrats transverses de l API Gestion commerciale (story E10.0).
 *
 * Ces schemas Zod sont la validation d EXECUTION du contrat decrit dans
 * openapi/magrit-core.v1.yaml. Ils ne redefinissent pas le contrat : les
 * assertions `CONTRACT_ALIGNMENT` en bas de fichier verrouillent a la
 * compilation le fait que ce qu ils produisent satisfait bien les types
 * generes depuis le YAML (CA2). La verification structurelle complete
 * (payload reel contre le JSON Schema du contrat) est faite par
 * tests/contract/.
 */
import { z } from 'zod';
import type {
  Audit as AuditContract,
  EventEnvelope as EventEnvelopeContract,
  EventName as EventNameContract,
  Meta as MetaContract,
  Money as MoneyContract,
  ProblemCode as ProblemCodeContract,
  Rate as RateContract,
  Timestamp as TimestampContract,
  Uuid as UuidContract,
} from '../../../platform/api/generated/magrit-core.v1.ts';

/** Prefixe impose a toute route de la facade (CA3). */
export const GESCOM_API_BASE_PATH = '/api/v1' as const;

/** Media type des reponses d erreur (CA6, RFC 7807). */
export const PROBLEM_MEDIA_TYPE = 'application/problem+json; charset=utf-8' as const;

/** Media type des reponses de succes. */
export const JSON_MEDIA_TYPE = 'application/json; charset=utf-8' as const;

// ---------------------------------------------------------------------------
// Types scalaires (Dev Notes E10 : format de serialisation opposable)
// ---------------------------------------------------------------------------

/**
 * Montant : `numeric(12,2)` en base, chaine decimale a deux decimales en JSON.
 * Jamais un flottant : un flottant JSON perd des centimes a l arrondi.
 */
export const moneySchema = z.string().regex(/^-?[0-9]{1,10}\.[0-9]{2}$/, {
  message: 'Un montant se serialise en chaine decimale a deux decimales, ex. "1234.50".',
});

/** Taux : `numeric(6,4)` en base, chaine a quatre decimales. "0.5000" vaut 50 %. */
export const rateSchema = z.string().regex(/^-?[0-9]{1,2}\.[0-9]{4}$/, {
  message: 'Un taux se serialise en chaine a quatre decimales, ex. "0.5000" pour 50 %.',
});

/** Devise ISO 4217. */
export const currencySchema = z.string().regex(/^[A-Z]{3}$/);

/** Instant ISO 8601 UTC. */
export const timestampSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/, {
    message: 'Une date se serialise en ISO 8601 UTC suffixe Z.',
  });

/** UUID v4. Les numeros metier (DEV-2026-00042) sont des attributs, pas des cles. */
export const uuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/, {
    message: 'Un identifiant technique est un UUID v4.',
  });

/** Enumeration API : toujours en snake_case. */
export const apiEnumTokenSchema = z.string().regex(/^[a-z][a-z0-9_]*$/);

// ---------------------------------------------------------------------------
// Composants partages
// ---------------------------------------------------------------------------

/**
 * Tracabilite. `created_by` et `updated_by` sont OPTIONNELS, comme au contrat :
 * un payload qui les omet est legal cote YAML, il doit l etre cote Zod. Les
 * rendre obligatoires ici ferait rejeter par le client une reponse que l API
 * documente comme valide.
 */
export const auditSchema = z.object({
  created_at: timestampSchema,
  created_by: uuidSchema.nullable().optional(),
  updated_at: timestampSchema,
  updated_by: uuidSchema.nullable().optional(),
});

/**
 * Bloc `meta` de toute reponse de succes (CA6, CA7).
 *
 * `next_cursor` est OPTIONNEL, comme dans le contrat : un payload qui l omet
 * est legal cote YAML, il doit donc l etre cote Zod. La facade, elle, l emet
 * toujours (`null` quand il n y a pas de page suivante) — c est une garantie
 * de l implementation, pas une exigence du contrat.
 */
export const metaSchema = z.object({
  request_id: z.string().min(1),
  next_cursor: z.string().min(1).max(512).nullable().optional(),
  page_size: z.number().int().min(1).max(200).optional(),
});

/** Code metier stable, `domaine.raison` en snake_case (CA6). */
export const problemCodeSchema = z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, {
  message: 'Un code metier suit la forme domaine.raison en snake_case.',
});

export const problemFieldErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
});

/** Erreur RFC 7807 enrichie du code metier et du request_id (CA6). */
export const problemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int().min(400).max(599),
  detail: z.string().optional(),
  instance: z.string().optional(),
  code: problemCodeSchema,
  request_id: z.string().min(1),
  errors: z.array(problemFieldErrorSchema).optional(),
  current_state: z.record(z.string(), z.unknown()).nullable().optional(),
});

/**
 * Enveloppe de succes uniforme (CA6). Chaque endpoint restreint `data` a son
 * propre schema via `successEnvelopeSchema(monSchema)`.
 */
export function successEnvelopeSchema<TData extends z.ZodType>(data: TData) {
  return z.object({ data, meta: metaSchema });
}

/** Enveloppe de succes non contrainte, utile aux verifications transverses. */
export const anySuccessEnvelopeSchema = successEnvelopeSchema(z.unknown());

// ---------------------------------------------------------------------------
// Pagination par curseur (CA7)
// ---------------------------------------------------------------------------

export const PAGE_SIZE_PARAM = 'page[size]' as const;
export const PAGE_CURSOR_PARAM = 'page[cursor]' as const;
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export const pageParamsSchema = z.object({
  size: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  cursor: z.string().min(1).max(512).nullable().default(null),
});

// ---------------------------------------------------------------------------
// En-tetes transverses (CA8, CA9, CA10)
// ---------------------------------------------------------------------------

export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key' as const;
/**
 * Marque une reponse rendue depuis le cache d idempotence plutot que par une
 * execution neuve. L appelant peut ainsi distinguer « ma creation a abouti » de
 * « ma creation avait deja abouti », ce que le seul statut 201 ne dit pas.
 */
export const IDEMPOTENCY_REPLAYED_HEADER = 'Idempotency-Replayed' as const;
export const IF_MATCH_HEADER = 'If-Match' as const;
export const ETAG_HEADER = 'ETag' as const;
export const REQUEST_ID_HEADER = 'X-Request-Id' as const;
export const SERVICE_KEY_HEADER = 'X-Magrit-Service-Key' as const;
/**
 * SELECTION de l espace de travail parmi ceux que le jeton autorise deja.
 *
 * Ce n est pas une exception au CA4 : l en-tete ne peut jamais elargir les
 * droits, seulement choisir dans ce que le jeton permet. Il existe parce qu un
 * utilisateur Magrit appartient souvent a plusieurs espaces (tenant parent et
 * sous-tenants) et qu aucun claim du JWT ne dit lequel il regarde — le front
 * lui-meme le resout depuis l URL `/t/:slug`. Voir docs/api/CONVENTIONS.md
 * §3.4.
 */
export const TENANT_SELECTION_HEADER = 'X-Magrit-Tenant' as const;
export const EVENT_SIGNATURE_HEADER = 'X-Magrit-Signature' as const;
export const EVENT_NAME_HEADER = 'X-Magrit-Event' as const;

export const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9_.:-]{8,255}$/, {
  message: 'Une cle d idempotence fait 8 a 255 caracteres alphanumeriques, _ . : ou -.',
});

export const eventSignatureSchema = z.string().regex(/^sha256=[0-9a-f]{64}$/);

// ---------------------------------------------------------------------------
// Evenements sortants (CA10)
// ---------------------------------------------------------------------------

/**
 * Noms d evenements prevus par le sprint. Liste ADDITIVE : une story
 * ulterieure peut en ajouter, jamais en retirer ni en renommer (CA13).
 */
export const OUTBOX_EVENT_NAMES = [
  'quote.converted',
  'order.step_changed',
  'order.files_submitted',
  'customer.created',
  'price_rule.changed',
] as const;

export const eventNameSchema = z.enum(OUTBOX_EVENT_NAMES);

export const eventEnvelopeSchema = z.object({
  event_id: uuidSchema,
  event_name: eventNameSchema,
  event_version: z.number().int().min(1),
  occurred_at: timestampSchema,
  tenant_id: uuidSchema,
  aggregate_type: apiEnumTokenSchema,
  aggregate_id: uuidSchema,
  payload: z.record(z.string(), z.unknown()),
});

// ---------------------------------------------------------------------------
// Types exportes
// ---------------------------------------------------------------------------

export type MoneyDto = z.infer<typeof moneySchema>;
export type RateDto = z.infer<typeof rateSchema>;
export type TimestampDto = z.infer<typeof timestampSchema>;
export type UuidDto = z.infer<typeof uuidSchema>;
export type AuditDto = z.infer<typeof auditSchema>;
export type MetaDto = z.infer<typeof metaSchema>;
export type ProblemDto = z.infer<typeof problemSchema>;
export type ProblemFieldErrorDto = z.infer<typeof problemFieldErrorSchema>;
export type PageParamsDto = z.infer<typeof pageParamsSchema>;
export type EventNameDto = z.infer<typeof eventNameSchema>;
export type EventEnvelopeDto = z.infer<typeof eventEnvelopeSchema>;
export type SuccessEnvelopeDto<TData> = Readonly<{ data: TData; meta: MetaDto }>;

// ---------------------------------------------------------------------------
// Alignement de compilation contrat <-> schemas (CA2)
// ---------------------------------------------------------------------------
// PORTEE REELLE DE CE GARDE-FOU, a ne pas surestimer.
//
// Ce qu il attrape : la disparition ou le renommage d un champ (l indexation
// `Dto['champ']` ne compile plus), un champ requis devenu incompatible, et
// surtout les ENUMERATIONS — `EventName` est genere en union de litteraux,
// donc ajouter une valeur cote Zod sans l ajouter au YAML echoue ici.
//
// Ce qu il n attrape PAS : tout ce que le contrat exprime en `pattern`,
// `format`, `minimum` ou `maxLength`. Money et Rate sont generes en `string`
// des deux cotes — l assertion est alors tautologique et ne prouve rien sur le
// format. Un montant serialise en flottant passerait ici sans bruit.
//
// La verification de FORMAT est faite ailleurs, a l execution :
// tests/contract/shared-components.contract.test.ts confronte les payloads
// reellement produits aux JSON Schema du contrat via Ajv. C est ce test-la qui
// tient le CA2 sur les formats, pas cette assertion.

type AssertAssignable<TSource, TTarget> = TSource extends TTarget ? true : never;

export const CONTRACT_ALIGNMENT = Object.freeze({
  // Assertions structurelles : elles mordent (champ disparu, type incompatible).
  eventName: true as AssertAssignable<EventNameDto, EventNameContract>,
  auditCreatedAt: true as AssertAssignable<AuditDto['created_at'], AuditContract['created_at']>,
  auditUpdatedBy: true as AssertAssignable<AuditDto['updated_by'], AuditContract['updated_by']>,
  metaRequestId: true as AssertAssignable<MetaDto['request_id'], MetaContract['request_id']>,
  metaNextCursor: true as AssertAssignable<MetaDto['next_cursor'], MetaContract['next_cursor']>,
  metaPageSize: true as AssertAssignable<MetaDto['page_size'], MetaContract['page_size']>,
  eventVersion: true as AssertAssignable<
    EventEnvelopeDto['event_version'],
    EventEnvelopeContract['event_version']
  >,
  eventTenant: true as AssertAssignable<
    EventEnvelopeDto['tenant_id'],
    EventEnvelopeContract['tenant_id']
  >,
  eventPayload: true as AssertAssignable<
    EventEnvelopeDto['payload'],
    EventEnvelopeContract['payload']
  >,
  // Assertions tautologiques assumees : le contrat genere `string`, la garantie
  // de format est portee par le test Ajv, pas par ces trois lignes.
  money: true as AssertAssignable<MoneyDto, MoneyContract>,
  rate: true as AssertAssignable<RateDto, RateContract>,
  timestamp: true as AssertAssignable<TimestampDto, TimestampContract>,
  uuid: true as AssertAssignable<UuidDto, UuidContract>,
  problemCode: true as AssertAssignable<ProblemDto['code'], ProblemCodeContract>,
});
