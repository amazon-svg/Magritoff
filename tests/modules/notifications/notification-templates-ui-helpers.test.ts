/**
 * Fonctions PURES de l ecran de parametrage des modeles de notification
 * (E10.15b). Aucun test de composant n existe ailleurs dans le depot (aucun
 * `.test.tsx` sous `tests/` a la remise de ce lot) : ces fonctions sont donc
 * extraites du composant precisement pour rester testables sans rendu React,
 * et couvrent l integralite de la logique non triviale de l ecran
 * (insertion de balise au curseur, compteur SMS, parsing des destinataires,
 * validation de formulaire miroir du contrat, messages d erreur API).
 */
import { describe, expect, it } from 'vitest';
import { ApiClientError } from '@/platform/api';
import {
  channelShapeWarnings,
  formatRecipientsInput,
  insertTagAtCursor,
  isQuoteSentDoubleEmailRisk,
  notificationTemplateApiProblemMessage,
  parseRecipientsInput,
  smsCounterState,
  SMS_BODY_MAX_LENGTH,
  validateNotificationPreviewInput,
  validateNotificationTemplateForm,
} from '@/modules/notifications/ui/workspace/notification-templates.helpers';

describe('insertTagAtCursor', () => {
  it('insere la balise a la position du curseur (selection vide)', () => {
    const result = insertTagAtCursor('Bonjour , votre commande est prete.', { start: 8, end: 8 }, '{{customer.contact_name}}');
    expect(result.nextValue).toBe('Bonjour {{customer.contact_name}}, votre commande est prete.');
    expect(result.nextCursorPosition).toBe(8 + '{{customer.contact_name}}'.length);
  });

  it('remplace la selection courante plutot que de l entourer', () => {
    const result = insertTagAtCursor('Bonjour XXX, a bientot.', { start: 8, end: 11 }, '{{customer.contact_name}}');
    expect(result.nextValue).toBe('Bonjour {{customer.contact_name}}, a bientot.');
  });

  it('une position hors bornes est ramenee dans la chaine (jamais d exception)', () => {
    const result = insertTagAtCursor('abc', { start: 999, end: 999 }, '{{x}}');
    expect(result.nextValue).toBe('abc{{x}}');
  });

  it('insertion en tout debut de champ vide', () => {
    const result = insertTagAtCursor('', { start: 0, end: 0 }, '{{order.number}}');
    expect(result.nextValue).toBe('{{order.number}}');
    expect(result.nextCursorPosition).toBe('{{order.number}}'.length);
  });
});

describe('parseRecipientsInput / formatRecipientsInput', () => {
  it('un destinataire par ligne, lignes vides filtrees', () => {
    expect(parseRecipientsInput('a@exemple.fr\n\n  b@exemple.fr  \n')).toEqual(['a@exemple.fr', 'b@exemple.fr']);
  });

  it('ne deduplique pas (un doublon volontaire reste un choix de l utilisateur)', () => {
    expect(parseRecipientsInput('a@exemple.fr\na@exemple.fr')).toEqual(['a@exemple.fr', 'a@exemple.fr']);
  });

  it('formatRecipientsInput est l inverse de parseRecipientsInput sur un jeu simple', () => {
    const recipients = ['a@exemple.fr', 'b@exemple.fr'];
    expect(parseRecipientsInput(formatRecipientsInput(recipients))).toEqual(recipients);
  });

  it('formatRecipientsInput(null|undefined) rend une chaine vide', () => {
    expect(formatRecipientsInput(null)).toBe('');
    expect(formatRecipientsInput(undefined)).toBe('');
  });
});

describe('smsCounterState', () => {
  it('rend null hors canal sms (rien a compter)', () => {
    expect(smsCounterState('email', 'x'.repeat(500))).toBeNull();
  });

  it('sous la limite : overLimit false', () => {
    const state = smsCounterState('sms', 'x'.repeat(100));
    expect(state).toEqual({ count: 100, limit: SMS_BODY_MAX_LENGTH, overLimit: false });
  });

  it('pile a la limite (480) : pas encore en depassement', () => {
    const state = smsCounterState('sms', 'x'.repeat(480));
    expect(state?.overLimit).toBe(false);
  });

  it('au-dela de 480 : avertissement (valeur EXACTE reprise du contrat E10.15a, pas 160)', () => {
    const state = smsCounterState('sms', 'x'.repeat(481));
    expect(state).toEqual({ count: 481, limit: 480, overLimit: true });
  });
});

describe('channelShapeWarnings (reexpose channelShapeIssues sans le reimplementer)', () => {
  it('email sans sujet : avertissement sur le champ subject', () => {
    const warnings = channelShapeWarnings('email', '', 'Corps.');
    expect(warnings).toEqual([{ field: 'subject', message: 'Le sujet est requis sur le canal email.' }]);
  });

  it('sms avec un corps de 481 caracteres : avertissement sur le champ body', () => {
    const warnings = channelShapeWarnings('sms', '', 'x'.repeat(481));
    expect(warnings).toEqual([{ field: 'body', message: 'Le corps est limite a 480 caracteres sur le canal sms.' }]);
  });

  it('email avec sujet et corps conformes : aucun avertissement', () => {
    expect(channelShapeWarnings('email', 'Sujet', 'Corps.')).toEqual([]);
  });

  it('qa-review round 1 (M3b) : un sujet fait UNIQUEMENT d espaces est traite comme absent (aligne sur le .trim() du schema Zod et de handleSubmit)', () => {
    const warnings = channelShapeWarnings('email', '   ', 'Corps.');
    expect(warnings).toEqual([{ field: 'subject', message: 'Le sujet est requis sur le canal email.' }]);
  });

  it('un sujet avec des espaces autour d un contenu reel reste valide', () => {
    expect(channelShapeWarnings('email', '  Sujet  ', 'Corps.')).toEqual([]);
  });
});

describe('validateNotificationTemplateForm', () => {
  const base = { channel: 'email' as const, audience: 'customer' as const, recipients: [], name: 'Modele', subject: 'Sujet', body: 'Corps.' };

  it('un formulaire complet et coherent ne leve aucune erreur', () => {
    expect(validateNotificationTemplateForm(base)).toEqual([]);
  });

  it('nom vide', () => {
    expect(validateNotificationTemplateForm({ ...base, name: '  ' })).toContainEqual({
      field: 'name',
      message: 'Le nom est requis.',
    });
  });

  it('corps vide', () => {
    expect(validateNotificationTemplateForm({ ...base, body: '' })).toContainEqual({
      field: 'body',
      message: 'Le corps est requis.',
    });
  });

  it('audience explicite sans destinataire', () => {
    expect(validateNotificationTemplateForm({ ...base, audience: 'explicit', recipients: [] })).toContainEqual({
      field: 'recipients',
      message: 'Au moins un destinataire explicite est requis.',
    });
  });

  it('audience explicite avec plus de 10 destinataires', () => {
    const recipients = Array.from({ length: 11 }, (_, i) => `dest${i}@exemple.fr`);
    expect(validateNotificationTemplateForm({ ...base, audience: 'explicit', recipients })).toContainEqual({
      field: 'recipients',
      message: 'Dix destinataires explicites au maximum.',
    });
  });

  it('audience client avec des destinataires renseignes (le systeme doit choisir seul)', () => {
    expect(
      validateNotificationTemplateForm({ ...base, audience: 'customer', recipients: ['a@exemple.fr'] }),
    ).toContainEqual({
      field: 'recipients',
      message: "Aucun destinataire ne doit etre saisi pour l audience « client ».",
    });
  });

  it('cumule les erreurs de canal (channelShapeWarnings) avec les erreurs de formulaire', () => {
    const issues = validateNotificationTemplateForm({ ...base, channel: 'sms', subject: '', body: 'x'.repeat(481) });
    expect(issues).toContainEqual({ field: 'body', message: 'Le corps est limite a 480 caracteres sur le canal sms.' });
  });

  it('qa-review round 1 (M3b) : un sujet email fait uniquement d espaces est refuse ICI, pas seulement au moment de l appel API (le formulaire envoie subject.trim())', () => {
    const issues = validateNotificationTemplateForm({ ...base, channel: 'email', subject: '   ' });
    expect(issues).toContainEqual({ field: 'subject', message: 'Le sujet est requis sur le canal email.' });
  });
});

describe('validateNotificationPreviewInput (qa-review round 1, M3a)', () => {
  it('un corps vide est refuse AVANT tout appel API (jamais de ZodError brute)', () => {
    expect(validateNotificationPreviewInput('email', 'Sujet', '')).toContainEqual({
      field: 'body',
      message: 'Le corps est requis pour generer un apercu.',
    });
  });

  it('un corps de plus de 4000 caracteres est refuse', () => {
    expect(validateNotificationPreviewInput('email', 'Sujet', 'x'.repeat(4001))).toContainEqual({
      field: 'body',
      message: 'Le corps depasse 4000 caracteres.',
    });
  });

  it('un sujet vide sur canal email est refuse (reexpose channelShapeWarnings)', () => {
    expect(validateNotificationPreviewInput('email', '', 'Corps.')).toContainEqual({
      field: 'subject',
      message: 'Le sujet est requis sur le canal email.',
    });
  });

  it('un jeu conforme (email) ne leve aucune erreur', () => {
    expect(validateNotificationPreviewInput('email', 'Sujet', 'Corps.')).toEqual([]);
  });

  it('un jeu conforme (sms, sans sujet) ne leve aucune erreur', () => {
    expect(validateNotificationPreviewInput('sms', '', 'Corps.')).toEqual([]);
  });
});

describe('notificationTemplateApiProblemMessage', () => {
  it('mappe un code metier connu vers un message francais stable', () => {
    const problem = { type: 'about:blank', title: 'x', status: 422, code: 'notification_template.limit_reached', requestId: 'r1' };
    const message = notificationTemplateApiProblemMessage(new ApiClientError(problem), 'fallback');
    expect(message).toBe('Ce tenant a atteint son plafond de 100 modeles de notification.');
  });

  it('ajoute le detail par champ (CA5 : quelle balise est fautive) quand `errors` est present', () => {
    const problem = {
      type: 'about:blank',
      title: 'x',
      status: 422,
      code: 'notification_template.unknown_tag',
      requestId: 'r1',
      errors: [{ field: 'body', message: 'balise inconnue : {{fake.tag}}' }],
    };
    const message = notificationTemplateApiProblemMessage(new ApiClientError(problem), 'fallback');
    expect(message).toContain('body : balise inconnue : {{fake.tag}}');
  });

  it('un code inconnu retombe sur le detail du probleme, puis sur le fallback', () => {
    const withDetail = new ApiClientError({
      type: 'about:blank',
      title: 'x',
      status: 500,
      code: 'api.unknown',
      requestId: 'r1',
      detail: 'Detail du serveur.',
    });
    expect(notificationTemplateApiProblemMessage(withDetail, 'fallback')).toBe('Detail du serveur.');
  });

  it('une cause qui n est pas une ApiClientError retombe sur son message, puis sur le fallback', () => {
    expect(notificationTemplateApiProblemMessage(new Error('Panne reseau.'), 'fallback')).toBe('Panne reseau.');
    expect(notificationTemplateApiProblemMessage('non-error', 'fallback')).toBe('fallback');
  });
});

describe('isQuoteSentDoubleEmailRisk', () => {
  it('vrai uniquement sur quote.sent + email + customer, la combinaison ou le doublon existe reellement (contrat §8.23 §9(c))', () => {
    expect(isQuoteSentDoubleEmailRisk('quote.sent', 'email', 'customer')).toBe(true);
  });

  it('faux sur quote.sent en sms (le courriel automatique existant n est pas un SMS)', () => {
    expect(isQuoteSentDoubleEmailRisk('quote.sent', 'sms', 'customer')).toBe(false);
  });

  it('faux sur quote.sent en audience explicite (une adresse arbitraire ne recoit pas deja le courriel automatique)', () => {
    expect(isQuoteSentDoubleEmailRisk('quote.sent', 'email', 'explicit')).toBe(false);
  });

  it('faux sur tout autre evenement, meme email + customer', () => {
    expect(isQuoteSentDoubleEmailRisk('quote.converted', 'email', 'customer')).toBe(false);
    expect(isQuoteSentDoubleEmailRisk('order.step_changed', 'email', 'customer')).toBe(false);
    expect(isQuoteSentDoubleEmailRisk('customer.created', 'email', 'customer')).toBe(false);
  });
});
