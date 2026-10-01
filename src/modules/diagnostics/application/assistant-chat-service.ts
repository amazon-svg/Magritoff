import { z } from 'zod';
import type { AssistantChatCommand } from '../api/contracts.ts';
import type { AiCompletionGateway } from './ai-completion-gateway.ts';

const displaySchema = z.object({
  productName: z.string().min(1),
  gamme: z.enum(['carterie', 'flyer', 'affiche', 'depliant', 'brochure', 'etiquette', 'kakemono', 'banderole', 'packaging']),
  quantity: z.number().int().positive(),
  format: z.string().min(1),
  support: z.string().min(1),
  grammage: z.number().int().nonnegative(),
  impression: z.object({ recto: z.string(), verso: z.string() }),
  finitionRecto: z.string(),
  finitionVerso: z.string(),
  suggestions: z.array(z.string()).max(5),
});

const assistantGenerationSchema = z.object({
  teachingNote: z.string(),
  assumptions: z.array(z.string()).max(10),
  clarification: z.string().nullable(),
  clarificationOptions: z.array(z.string()).max(5),
  products: z.array(z.object({
    clariprint: z.record(z.string(), z.unknown()),
    display: displaySchema,
  })).max(8),
});

export type AssistantChatPayload = Readonly<{
  content: readonly Readonly<{ type: 'text'; text: string }>[];
  configs: readonly unknown[];
  teachingNote: string;
  assumptions: readonly string[];
  clarification: string | null;
  clarificationOptions: readonly string[];
  mode: 'open' | 'strict';
  truncatedCount: number;
  model: string;
  usage: Readonly<{ input_tokens?: number; output_tokens?: number }>;
  demoMode: false;
}>;

const OUTPUT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['teachingNote', 'assumptions', 'clarification', 'clarificationOptions', 'products'],
  properties: {
    teachingNote: { type: 'string' },
    assumptions: { type: 'array', items: { type: 'string' }, maxItems: 10 },
    clarification: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    clarificationOptions: { type: 'array', items: { type: 'string' }, maxItems: 5 },
    products: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['clariprint', 'display'],
        properties: {
          clariprint: { type: 'object', additionalProperties: true },
          display: {
            type: 'object',
            additionalProperties: false,
            required: ['productName', 'gamme', 'quantity', 'format', 'support', 'grammage', 'impression', 'finitionRecto', 'finitionVerso', 'suggestions'],
            properties: {
              productName: { type: 'string' },
              gamme: { type: 'string', enum: ['carterie', 'flyer', 'affiche', 'depliant', 'brochure', 'etiquette', 'kakemono', 'banderole', 'packaging'] },
              quantity: { type: 'integer', minimum: 1 },
              format: { type: 'string' },
              support: { type: 'string' },
              grammage: { type: 'integer', minimum: 0 },
              impression: {
                type: 'object',
                additionalProperties: false,
                required: ['recto', 'verso'],
                properties: { recto: { type: 'string' }, verso: { type: 'string' } },
              },
              finitionRecto: { type: 'string' },
              finitionVerso: { type: 'string' },
              suggestions: { type: 'array', items: { type: 'string' }, maxItems: 5 },
            },
          },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = `Tu es Marguerite, experte française en imprimerie professionnelle et web-to-print.
Tu transformes les demandes en configurations Clariprint et tu réponds uniquement avec le JSON demandé.
Chaque produit contient clariprint (paramètres techniques) et display (présentation utilisateur).
Dans clariprint : quantity est une chaîne, dimensions sont en centimètres, with_bleeds vaut "1", les couleurs utilisent "4-color", papers.custom contient quality et weight, deliveries.d_livraison contient iso "FR-75", address "" et la même quantity.
Kinds : leaflet pour imprimé plat, folded pour dépliant, book pour brochure reliée.
Formats usuels en cm : carte 8.5x5.5, A5 14.8x21.0, A4 21.0x29.7, A3 29.7x42.0, A2 42.0x59.4, A1 59.4x84.1, A0 84.1x118.9.
Gammes autorisées : carterie, flyer, affiche, depliant, brochure, etiquette, kakemono, banderole, packaging.
Pour une question pédagogique, renseigne teachingNote en markdown et propose 2 ou 3 variantes comparatives.
En mode ouvert, une demande vague peut produire 3 à 5 produits cohérents ; indique alors les hypothèses.
En mode strict, n'invente aucune caractéristique manquante : retourne products vide, une clarification courte et 2 à 5 clarificationOptions.
Ne fournis jamais de texte hors JSON.`;

export class AssistantChatService {
  constructor(private readonly completion: AiCompletionGateway) {}

  async generate(command: AssistantChatCommand): Promise<AssistantChatPayload> {
    const mode = command.mode === 'strict' ? 'strict' : 'open';
    const truncatedCount = Math.max(0, command.messages.length - 25);
    const messages = command.messages.slice(-25);
    const result = await this.completion.complete({
      system: `${SYSTEM_PROMPT}\nMode actif : ${mode}.`,
      messages,
      maxTokens: 4096,
      temperature: 0.2,
      outputSchema: { name: 'magrit_catalog_suggestions', schema: OUTPUT_JSON_SCHEMA, strict: false },
    });
    const decoded = assistantGenerationSchema.parse(JSON.parse(stripJsonFence(result.text)));
    return {
      content: [{ type: 'text', text: readableSummary(decoded.products) }],
      configs: decoded.products,
      teachingNote: decoded.teachingNote,
      assumptions: decoded.assumptions,
      clarification: decoded.clarification,
      clarificationOptions: decoded.clarificationOptions,
      mode,
      truncatedCount,
      model: result.model,
      usage: {
        ...(result.inputTokens === undefined ? {} : { input_tokens: result.inputTokens }),
        ...(result.outputTokens === undefined ? {} : { output_tokens: result.outputTokens }),
      },
      demoMode: false,
    };
  }
}

function stripJsonFence(value: string): string {
  return value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
}

function readableSummary(products: Readonly<z.infer<typeof assistantGenerationSchema>['products']>): string {
  if (products.length === 0) return 'Configuration non disponible.';
  return products.map(({ display }) => {
    const finish = display.finitionRecto === 'Sans finition'
      ? 'Sans finition'
      : `${display.finitionRecto} recto${display.finitionVerso && display.finitionVerso !== display.finitionRecto ? ` / ${display.finitionVerso} verso` : '/verso'}`;
    return `**${display.quantity} ${display.productName}**\n- **Format** : ${display.format}\n- **Support** : ${display.support}\n- **Grammage** : ${display.grammage}g/m²\n- **Finition** : ${finish}`;
  }).join('\n\n');
}
