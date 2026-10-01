import type { GeneratePimDefinitionCommand } from '../api/contracts.ts';
import {
  AiCompletionUnavailableError,
  type AiCompletionGateway,
} from '../../diagnostics/application/ai-completion-gateway.ts';
import { CatalogRejectedError } from './catalog-repository.ts';

const GENERATION_SYSTEM = `Tu es un expert SEO et redacteur e-commerce specialise dans le web-to-print et l'imprimerie.
Retourne uniquement un objet JSON valide, sans markdown ni texte autour.
La fiche doit contenir : name, keywords, title_template, short_description_template,
description_template, h1_template, seo_title, seo_description, usage_examples et faq.
Les templates peuvent utiliser uniquement : {{format}} {{grammage}} {{papier}}
{{quantite}} {{finition}} {{finition_recto}} {{finition_verso}}
{{impression_recto}} {{impression_verso}} {{pages}} {{binding}}.`;

const VALIDATION_SYSTEM = `Tu es un relecteur editorial et SEO specialise dans l'imprimerie.
Retourne uniquement un objet JSON valide, sans markdown ni texte autour, avec les cles
quality_score (nombre entre 0 et 1), issues (tableau de textes) et improved
(version amelioree de la fiche).`;

export class AiPimDefinitionGenerator {
  constructor(private readonly completions: AiCompletionGateway) {}

  async generateDefinition(command: GeneratePimDefinitionCommand): Promise<Record<string, unknown>> {
    const prompt = command.mode === 'validate' ? validationPrompt(command) : generationPrompt(command);
    try {
      const completion = await this.completions.complete({
        system: command.mode === 'validate' ? VALIDATION_SYSTEM : GENERATION_SYSTEM,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 2_200,
        temperature: 0.2,
      });
      return parseJsonObject(completion.text);
    } catch (error) {
      if (error instanceof CatalogRejectedError) throw error;
      if (error instanceof AiCompletionUnavailableError) {
        throw new CatalogRejectedError('upstream_error', error.message);
      }
      throw new CatalogRejectedError(
        'upstream_error',
        error instanceof Error ? error.message : 'Generation PIM impossible.',
      );
    }
  }
}

function generationPrompt(command: GeneratePimDefinitionCommand): string {
  const locale = command.locale === 'fr' ? 'francais' : command.locale === 'en' ? 'anglais' : command.locale;
  return `Genere une fiche produit PIM en ${locale}.
Gamme : ${command.gammeName ?? command.gammeSlug} (${command.gammeSlug})
Regles de matching : ${JSON.stringify(command.gammeMatchingRules ?? {})}
Filtre de variation : ${JSON.stringify(command.variationFilter)}

Contraintes : vocabulaire d'imprimerie precis, contenu B2B naturel, titre SEO de moins
de 60 caracteres, meta-description de 140 a 160 caracteres, trois cas d'usage et
quatre questions frequentes.`;
}

function validationPrompt(command: GeneratePimDefinitionCommand): string {
  return `Relis et ameliore cette fiche PIM pour la gamme ${command.gammeName ?? command.gammeSlug}
et la locale ${command.locale}. Verifie la coherence technique, les longueurs SEO,
les placeholders et l'absence de duplication.

Fiche : ${JSON.stringify(command.existing ?? {})}`;
}

function parseJsonObject(value: string): Record<string, unknown> {
  const cleaned = value.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/\s*```$/, '')
    .trim();
  try {
    const parsed: unknown = JSON.parse(cleaned);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Le détail fournisseur n'est pas renvoyé au navigateur.
  }
  throw new CatalogRejectedError('upstream_error', 'Le fournisseur IA a renvoye un JSON PIM invalide.');
}
