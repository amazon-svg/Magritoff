import { describe, expect, it } from 'vitest';
import { normalizeAssistantContext } from '@/modules/conversations/ui/components/ChatInterface';

describe('normalisation du contexte assistant', () => {
  it('supprime les messages vides qui rendaient la requête suivante invalide', () => {
    expect(normalizeAssistantContext([
      { role: 'user', content: 'Je veux 500 flyers' },
      { role: 'assistant', content: '' },
      { role: 'user', content: 'Et en 1000 exemplaires ?' },
    ])).toEqual([
      { role: 'user', content: 'Je veux 500 flyers' },
      { role: 'user', content: 'Et en 1000 exemplaires ?' },
    ]);
  });

  it('convertit les anciens rôles ai, bot et human', () => {
    expect(normalizeAssistantContext([
      { role: 'human', content: 'Bonjour' },
      { role: 'ai', content: 'Réponse IA' },
      { role: 'bot', content: 'Réponse bot' },
      { role: 'system', content: 'Instruction interne' },
    ])).toEqual([
      { role: 'user', content: 'Bonjour' },
      { role: 'assistant', content: 'Réponse IA' },
      { role: 'assistant', content: 'Réponse bot' },
    ]);
  });
});
