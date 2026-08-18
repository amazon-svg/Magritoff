import { categoryEditorialSchema, type CategoryEditorialCommand, type CategoryEditorialResult } from '../api/contracts.ts';
import type { UserId } from '../../../kernel/ids/index.ts';
import type { AssistantAccessGateway } from './assistant-access-gateway.ts';
import type { AiCompletionGateway } from './ai-completion-gateway.ts';

const SYSTEM_PROMPT = `Tu rédiges des contenus courts pour un catalogue d'imprimerie B2B français.
Ton style est direct, concret, professionnel et orienté bénéfices/ROI, sans jargon ni anglicisme.
Réponds uniquement avec un objet JSON valide contenant title, intro et seo.
Contraintes : title 60 caractères maximum, intro 240 caractères maximum, seo 155 caractères maximum.`;

export class AssistantService {
  constructor(private readonly completion: AiCompletionGateway, private readonly access: AssistantAccessGateway) {}

  async categoryEditorial(actor: UserId, tenantId: string, command: CategoryEditorialCommand): Promise<CategoryEditorialResult> {
    if (!await this.access.isTenantMember(actor, tenantId)) throw new AssistantRejectedError('permission_denied', 'Accès IA interdit pour ce tenant.');
    return this.generateCategoryEditorial(command);
  }

  /** Appelé uniquement après résolution serveur d’une session boutique. */
  async storefrontCategoryEditorial(command: CategoryEditorialCommand): Promise<CategoryEditorialResult> {
    return this.generateCategoryEditorial(command);
  }

  private async generateCategoryEditorial(command: CategoryEditorialCommand): Promise<CategoryEditorialResult> {
    try {
      const result = await this.completion.complete({
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt(command) }],
        maxTokens: 600,
        temperature: 0.4,
      });
      const parsed = categoryEditorialSchema.safeParse(JSON.parse(stripJsonFence(result.text)));
      return parsed.success ? { editorial: parsed.data, generated: true } : fallback();
    } catch {
      return fallback();
    }
  }
}

export class AssistantRejectedError extends Error {
  constructor(public readonly code: 'permission_denied', message: string) { super(message); this.name = 'AssistantRejectedError'; }
}

function userPrompt(command: CategoryEditorialCommand): string {
  return `Famille : ${command.familyName}\nSous-catégories : ${command.subcategories.join(', ') || 'aucune'}\nExemples de produits : ${command.sampleProducts.join(', ') || 'aucun'}`;
}
function stripJsonFence(value: string): string { return value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''); }
function fallback(): CategoryEditorialResult { return { editorial: {}, generated: false }; }
