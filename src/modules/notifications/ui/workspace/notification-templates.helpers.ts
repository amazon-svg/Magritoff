/**
 * Fonctions PURES de l ecran de parametrage des modeles de notification
 * (E10.15b). Extraites du composant pour rester testables SANS rendu React
 * (aucun test de composant n existe ailleurs dans le depot — voir
 * `tests/modules/notifications/notification-templates.helpers.test.ts`).
 *
 * Aucune de ces fonctions ne remplace une regle metier deja tenue par le
 * serveur (contrat, docs/api/CONVENTIONS.md §8.23) : `channelShapeIssues` est
 * IMPORTEE telle quelle du module (meme fonction que celle appelee par
 * `createNotificationTemplateCommandSchema` cote client ET par le service
 * cote serveur) — ce fichier n en ecrit pas une seconde version qui pourrait
 * diverger. Le compteur SMS et l avertissement de longueur sont de l UX
 * (retour immediat), jamais la seule barriere : `create()`/`update()`
 * revalident via le meme schema Zod, et le serveur refuse de toute facon en
 * 422 (`api.validation_failed`).
 */
import { ApiClientError, type ApiProblem } from '@/platform/api';
import {
  channelShapeIssues,
  type NotificationAudience,
  type NotificationChannel,
  type NotificationEventName,
} from '@/modules/notifications/api/contracts';

/** Plafond du CORPS d un modele SMS (contrat §8.23 §4, colonne `body`) — repris de `channelShapeIssues`, jamais redecide ici. */
export const SMS_BODY_MAX_LENGTH = 480;

export type CursorSelection = Readonly<{ start: number; end: number }>;

export type TagInsertionResult = Readonly<{ nextValue: string; nextCursorPosition: number }>;

/**
 * Insere `tagSyntax` (ex. `{{order.number}}`) a l emplacement du curseur
 * (ou remplace la selection courante), et rend la position de curseur a
 * reappliquer apres reindu (CA5 : "insere au clic"). Balayage a un seul
 * passage, aucune re-lecture du texte deja present — coherent avec le moteur
 * de rendu serveur (§8.23 §5) qui ne re-balaie jamais une valeur substituee.
 */
export function insertTagAtCursor(value: string, selection: CursorSelection, tagSyntax: string): TagInsertionResult {
  const start = Math.max(0, Math.min(selection.start, value.length));
  const end = Math.max(start, Math.min(selection.end, value.length));
  const before = value.slice(0, start);
  const after = value.slice(end);
  const nextValue = `${before}${tagSyntax}${after}`;
  return { nextValue, nextCursorPosition: before.length + tagSyntax.length };
}

/**
 * Parse le champ "un destinataire par ligne" de l ecran vers le tableau
 * `recipients` du contrat. Filtre les lignes vides, ne deduplique pas
 * (le serveur est seul juge de la validite d une entree, ex. adresse ou
 * numero) — un doublon volontaire (copie a deux boites du meme domaine)
 * n a pas a etre corrige a l insu de l utilisateur.
 */
export function parseRecipientsInput(raw: string): readonly string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** Forme inverse de `parseRecipientsInput`, pour re-remplir le champ en edition. */
export function formatRecipientsInput(recipients: readonly string[] | null | undefined): string {
  return (recipients ?? []).join('\n');
}

export type SmsCounterState = Readonly<{
  count: number;
  limit: number;
  overLimit: boolean;
}>;

/** Etat du compteur de caracteres SMS (CA — avertissement au-dela de 480, contrat §8.23 §4/§9(e)). `null` hors canal SMS : rien a compter. */
export function smsCounterState(channel: NotificationChannel, body: string): SmsCounterState | null {
  if (channel !== 'sms') return null;
  return { count: body.length, limit: SMS_BODY_MAX_LENGTH, overLimit: body.length > SMS_BODY_MAX_LENGTH };
}

/**
 * Re-expose `channelShapeIssues` sous une forme adaptee a l ecran (message
 * par champ), SANS reimplementer la regle. Utilise a la frappe pour le
 * retour immediat (sujet requis/interdit, corps SMS trop long) avant meme
 * l appel serveur.
 *
 * `subject` est TRIMME avant l appel (qa-review B3bis/M3 round 1) : le
 * schema Zod du contrat trimme le sujet (`z.string().trim().min(1)`) et
 * `handleSubmit`/`handlePreview` envoient `subject.trim()` — un sujet fait
 * uniquement d espaces doit donc etre signale ICI comme manquant, sinon le
 * formulaire valide localement une valeur que le client rejette ensuite par
 * une `ZodError` brute au moment de l appel API.
 */
export function channelShapeWarnings(
  channel: NotificationChannel,
  subject: string,
  body: string,
): readonly Readonly<{ field: 'subject' | 'body'; message: string }>[] {
  return channelShapeIssues(channel, channel === 'email' ? subject.trim() : undefined, body);
}

export type NotificationTemplateFormIssue = Readonly<{ field: string; message: string }>;

export type NotificationTemplateFormValues = Readonly<{
  channel: NotificationChannel;
  audience: NotificationAudience;
  recipients: readonly string[];
  name: string;
  subject: string;
  body: string;
}>;

/**
 * Retour immediat AVANT l appel API (contrat, memes bornes que le schema
 * Zod du client — `notificationRecipientsSchema`, `name`/`body` `min`/`max`,
 * `channelShapeIssues`). N invente AUCUNE regle : chaque borne reprend
 * exactement `src/modules/notifications/api/contracts.ts`. La verite reste
 * cote serveur (422 `notification_template.*`) — ce validateur evite
 * seulement de lancer un appel voue a l echec ou de laisser `.parse()`
 * lancer une `ZodError` brute dans l ecran.
 */
export function validateNotificationTemplateForm(
  values: NotificationTemplateFormValues,
): readonly NotificationTemplateFormIssue[] {
  const issues: NotificationTemplateFormIssue[] = [];
  const name = values.name.trim();
  if (name.length === 0) issues.push({ field: 'name', message: 'Le nom est requis.' });
  if (name.length > 120) issues.push({ field: 'name', message: 'Le nom depasse 120 caracteres.' });
  if (values.body.length === 0) issues.push({ field: 'body', message: 'Le corps est requis.' });
  if (values.body.length > 4000) issues.push({ field: 'body', message: 'Le corps depasse 4000 caracteres.' });
  if (values.audience === 'explicit' && values.recipients.length === 0) {
    issues.push({ field: 'recipients', message: 'Au moins un destinataire explicite est requis.' });
  }
  if (values.audience === 'explicit' && values.recipients.length > 10) {
    issues.push({ field: 'recipients', message: 'Dix destinataires explicites au maximum.' });
  }
  if (values.audience === 'customer' && values.recipients.length > 0) {
    issues.push({
      field: 'recipients',
      message: "Aucun destinataire ne doit etre saisi pour l audience « client ».",
    });
  }
  if (values.recipients.some((recipient) => recipient.length < 3 || recipient.length > 320)) {
    issues.push({ field: 'recipients', message: 'Chaque destinataire doit contenir entre 3 et 320 caracteres.' });
  }
  if (values.subject.trim().length > 200) {
    issues.push({ field: 'subject', message: 'Le sujet depasse 200 caracteres.' });
  }
  issues.push(...channelShapeWarnings(values.channel, values.subject, values.body));
  return issues;
}

/**
 * Retour immediat AVANT `previewNotificationTemplate` (qa-review M3(a)) :
 * `PreviewNotificationTemplateCommand` a un `body` OPTIONNEL mais, s il est
 * present, soumis a `min(1)` cote Zod — un corps vide envoye tel quel y
 * leve une `ZodError` brute, jamais rattrapee proprement par
 * `notificationTemplateApiProblemMessage` (qui ne sait lire que des
 * `ApiClientError`). Ce validateur ne verifie QUE ce que l apercu envoie
 * reellement (body, et sujet si canal email) — ni le nom, ni les
 * destinataires, qui ne font pas partie de la commande d apercu.
 */
export function validateNotificationPreviewInput(
  channel: NotificationChannel,
  subject: string,
  body: string,
): readonly NotificationTemplateFormIssue[] {
  const issues: NotificationTemplateFormIssue[] = [];
  if (body.length === 0) issues.push({ field: 'body', message: "Le corps est requis pour generer un apercu." });
  if (body.length > 4000) issues.push({ field: 'body', message: 'Le corps depasse 4000 caracteres.' });
  issues.push(...channelShapeWarnings(channel, subject, body));
  return issues;
}

/**
 * Reserve (c) du contrat §8.23 point 9, tranchee « accepter et avertir dans
 * l ecran, retenu par defaut » — E10.15d-1. `true` UNIQUEMENT sur la
 * combinaison exacte ou le doublon existe reellement (§8.23 §1 : le
 * consommateur `QuoteSentNotificationConsumer`, E10.10b-3/4c, envoie DEJA un
 * courriel avec piece jointe PDF a CE moment) : un modele `quote.sent` en
 * SMS, ou en audience « destinataires explicites », n a AUCUN doublon (ce
 * courriel existant ne s adresse qu au client, jamais a une adresse
 * arbitraire) — l avertissement ne doit apparaitre QUE la ou le doublon est
 * reel, pas systematiquement des que l evenement est selectionne.
 */
export function isQuoteSentDoubleEmailRisk(
  eventName: NotificationEventName,
  channel: NotificationChannel,
  audience: NotificationAudience,
): boolean {
  return eventName === 'quote.sent' && channel === 'email' && audience === 'customer';
}

const NOTIFICATION_TEMPLATE_ERROR_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  'notification_template.unknown_tag':
    'Le texte contient une balise inconnue pour cet evenement. Retirez-la ou choisissez-la dans la liste proposee.',
  'notification_template.event_not_notifiable': "Cet evenement n est pas notifiable.",
  'notification_template.recipients_required':
    "Un destinataire explicite est requis pour l audience « destinataires explicites », et interdit pour l audience « client ».",
  'notification_template.step_filter_not_applicable':
    "Le filtre d etape ne s applique qu a l evenement « changement d etape de production ».",
  'notification_template.limit_reached': 'Ce tenant a atteint son plafond de 100 modeles de notification.',
  'notification_template.not_found': 'Ce modele de notification n existe plus.',
  'api.validation_failed': 'Le formulaire contient une valeur invalide.',
});

/**
 * Message d erreur a afficher, a partir d une cause d appel API (creation,
 * modification, apercu, bascule d activation). `problem.errors` (champ par
 * champ, ex. balises fautives de CA5) est ajoute entre parentheses quand
 * present, pour ne pas forcer l utilisateur a deviner LAQUELLE des balises
 * pose probleme.
 */
export function notificationTemplateApiProblemMessage(cause: unknown, fallback: string): string {
  if (cause instanceof ApiClientError) {
    const base = NOTIFICATION_TEMPLATE_ERROR_MESSAGES[cause.problem.code] ?? cause.problem.detail ?? fallback;
    return appendFieldErrors(base, cause.problem);
  }
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

function appendFieldErrors(message: string, problem: ApiProblem): string {
  if (!problem.errors || problem.errors.length === 0) return message;
  const detail = problem.errors.map((entry) => `${entry.field} : ${entry.message}`).join(' ; ');
  return `${message} (${detail})`;
}
