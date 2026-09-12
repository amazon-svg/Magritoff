/**
 * Catalogue EN DUR, cote serveur, des faits metier notifiables et des
 * balises qui leur sont associees (story E10.15a, CA1/CA4/CA5).
 *
 * SERVI PAR LE SERVEUR, JAMAIS ECRIT DANS L ECRAN (contrat, `listNotification
 * Events`) : c est la SEULE source que le validateur d enregistrement
 * (`NotificationTemplatesService`) ET un futur ecran de parametrage (E10.15b)
 * doivent lire — une liste recopiee en dur cote navigateur divergerait au
 * premier ajout.
 *
 * L ASSOCIATION evenement -> balises AUTORISEES est une decision de ce lot,
 * non dictee lettre a lettre par le contrat (qui fixe la liste FERMEE des 13
 * `NotificationTagId` et les 5 `NotificationEventName`, mais pas la matrice).
 * Principe applique : une balise n est proposee sur un evenement que si la
 * donnee qu elle designe est raisonnablement disponible au moment ou E10.15c/d
 * construira le contexte de rendu (a partir de l agregat, pas seulement de la
 * charge utile du bus — verifie contre `QuoteConversionPayload`,
 * `OrderStepChangedPayload`, `OrderFilesSubmittedPayload`, EventEnvelope
 * generique pour `customer.created`). AUCUN montant, aucun statut hors
 * `step.label`/`step.previous_label` (regle definitive du contrat).
 */
import type {
  NotificationAudience,
  NotificationEventDescriptorDto,
  NotificationEventName,
  NotificationTagDto,
  NotificationTagId,
  NotificationTagRenderStage,
} from '../api/contracts.ts';

/** Les cinq evenements notifiables portent TOUS de quoi router vers un client (`customer_id` ou equivalent) — les deux audiences sont donc toujours proposees (contrat, `NotificationEventDescriptor.audiences`). */
const ALL_AUDIENCES: readonly NotificationAudience[] = Object.freeze(['customer', 'explicit']);

type TagDefinition = Readonly<{
  label: string;
  nullable: boolean;
  example: string;
  /**
   * Etage de substitution (arbitrage architecte du 2026-09-12, §8.23 point
   * 11) : `enqueue` pour les douze balises REGIME NORMAL — resolues et
   * figees a la mise en file, comme aujourd hui. `delivery` pour
   * `files.count` SEULE, arretee A LA REMISE (mecanisme de rendu differe,
   * HORS PERIMETRE de ce lot — E10.15d-2 : ici, seule la METADONNEE de
   * catalogue est posee, servie telle quelle par `listNotificationEvents`).
   * Une balise `delivery` ne peut exister QUE sur un evenement declarant une
   * fenetre (`coalescing_window_minutes > 0`) — verrouille par
   * `notification-event-catalog.test.ts`.
   */
  renderStage: NotificationTagRenderStage;
}>;

/** Definition STABLE de chaque balise, independante de l evenement qui la propose. */
const TAG_DEFINITIONS: Readonly<Record<NotificationTagId, TagDefinition>> = Object.freeze({
  'tenant.name': { label: "Nom de l'atelier", nullable: false, example: 'Imprimerie Exemple', renderStage: 'enqueue' },
  'customer.company_name': {
    label: 'Raison sociale du client',
    // Un client PARTICULIER (customers.type = 'individual', E10.4) n a pas
    // de raison sociale.
    nullable: true,
    example: 'Client Exemple SARL',
    renderStage: 'enqueue',
  },
  'customer.contact_name': {
    label: "Nom de l'interlocuteur",
    nullable: false,
    example: 'Jeanne Dupont',
    renderStage: 'enqueue',
  },
  'quote.number': { label: 'Numero du devis', nullable: false, example: 'DEV-2026-00042', renderStage: 'enqueue' },
  'quote.valid_until': {
    label: 'Date de validite du devis',
    // `CommercialSettings.default_validity_days` peut valoir `null` (« aucune
    // validite par defaut ») : un devis peut donc n avoir aucune echeance.
    nullable: true,
    example: '2026-12-31',
    renderStage: 'enqueue',
  },
  'quote.customer_reference': {
    label: 'Reference client du devis',
    nullable: true,
    example: 'PO-2026-0118',
    renderStage: 'enqueue',
  },
  'order.number': { label: 'Numero de la commande', nullable: false, example: 'CDE-2026-00042', renderStage: 'enqueue' },
  'order.customer_reference': {
    label: 'Reference client de la commande',
    nullable: true,
    example: 'PO-2026-0118',
    renderStage: 'enqueue',
  },
  'order.expected_delivery_date': {
    label: 'Date de livraison prevue',
    // `expected_delivery_date` vaut `null` tant qu aucun chemin d ecriture
    // n existe (docs/api/CONVENTIONS.md §8.14bis, arbitrage (h) — non tranche).
    nullable: true,
    example: '2026-10-15',
    renderStage: 'enqueue',
  },
  'step.label': { label: 'Etape atteinte', nullable: false, example: 'En cours de production', renderStage: 'enqueue' },
  'step.previous_label': {
    label: 'Etape precedente',
    // `OrderStepChangedPayload.from_step_id` peut etre `null` si la commande
    // n en portait aucune (tenant sans etape active a la conversion).
    nullable: true,
    example: 'Fichier validé',
    renderStage: 'enqueue',
  },
  // SEULE balise `delivery` du catalogue (§8.23 point 11) : substituee A LA
  // REMISE, avec le compteur de regroupement ARRETE A LA RECLAMATION —
  // mecanisme non implemente par ce lot (E10.15d-2). N existe aujourd hui
  // que sur `order.files_submitted` (coalescing_window_minutes: 10),
  // non branche par ce lot.
  'files.count': { label: 'Nombre de fichiers reçus', nullable: false, example: '3', renderStage: 'delivery' },
  'link.portal_quotes': {
    label: 'Lien vers les devis du portail client',
    nullable: false,
    example: 'https://boutique.exemple.fr/mon-compte/devis',
    renderStage: 'enqueue',
  },
});

type EventDefinition = Readonly<{
  event_name: NotificationEventName;
  label: string;
  description: string;
  tags: readonly NotificationTagId[];
  supports_step_filter: boolean;
  coalescing_window_minutes: number;
}>;

const COMMON_TAGS: readonly NotificationTagId[] = Object.freeze([
  'tenant.name',
  'customer.company_name',
  'customer.contact_name',
  'link.portal_quotes',
]);

const EVENT_DEFINITIONS: readonly EventDefinition[] = Object.freeze([
  {
    event_name: 'quote.sent',
    label: 'Un devis a été envoyé',
    description:
      "Le devis vient d'être transmis au client (premier envoi ou renvoi). Distinct du courriel non configurable déjà en service (E10.10b-3/4c, avec le devis en pièce jointe) : un modèle sur cet événement s'ajoute à ce courriel, il ne le remplace pas — un modèle email + audience client fera recevoir deux courriels au client.",
    tags: [...COMMON_TAGS, 'quote.number', 'quote.valid_until', 'quote.customer_reference'],
    supports_step_filter: false,
    coalescing_window_minutes: 0,
  },
  {
    event_name: 'quote.converted',
    label: 'Un devis a été transformé en commande',
    description: "L'atelier a validé le devis : une commande est née (numéro CDE-...), le devis reste consultable.",
    tags: [...COMMON_TAGS, 'quote.number', 'order.number'],
    supports_step_filter: false,
    coalescing_window_minutes: 0,
  },
  {
    event_name: 'order.step_changed',
    label: 'Une commande a changé d\'étape de production',
    description:
      "La commande vient de passer à une nouvelle étape du flux d'atelier (sauts et reculs compris). Un modèle peut être restreint à UNE étape d'arrivée précise via le filtre d'étape.",
    tags: [
      ...COMMON_TAGS,
      'order.number',
      'order.customer_reference',
      'order.expected_delivery_date',
      'step.label',
      'step.previous_label',
    ],
    supports_step_filter: true,
    coalescing_window_minutes: 0,
  },
  {
    event_name: 'order.files_submitted',
    label: 'Des fichiers ont été reçus du client',
    description:
      "Le client a déposé un fichier sur un lien public de dépôt. Émis À CHAQUE FICHIER ; les occurrences rapprochées sont REGROUPÉES en un seul message (fenêtre de 10 minutes), {{files.count}} rend le nombre de fichiers du lot.",
    tags: [...COMMON_TAGS, 'order.number', 'order.customer_reference', 'files.count'],
    supports_step_filter: false,
    coalescing_window_minutes: 10,
  },
  {
    event_name: 'customer.created',
    label: 'Un client a été créé',
    description: "Un nouveau client vient d'être ajouté au référentiel commercial.",
    tags: [...COMMON_TAGS],
    supports_step_filter: false,
    coalescing_window_minutes: 0,
  },
]);

const EVENT_DEFINITIONS_BY_NAME: ReadonlyMap<NotificationEventName, EventDefinition> = new Map(
  EVENT_DEFINITIONS.map((definition) => [definition.event_name, definition]),
);

/** `true` si `value` est un fait metier NOTIFIABLE (sous-ensemble strict d `EventName`, contrat). */
export function isNotifiableEventName(value: string): value is NotificationEventName {
  return EVENT_DEFINITIONS_BY_NAME.has(value as NotificationEventName);
}

/** Liste blanche des balises valides pour CET evenement (CA5) — source unique du validateur d enregistrement. */
export function allowedTagsForEvent(eventName: NotificationEventName): ReadonlySet<NotificationTagId> {
  const definition = EVENT_DEFINITIONS_BY_NAME.get(eventName);
  return new Set(definition?.tags ?? []);
}

/** `true` si l evenement accepte un filtre `production_step_id` (`order.step_changed` SEUL). */
export function eventSupportsStepFilter(eventName: NotificationEventName): boolean {
  return EVENT_DEFINITIONS_BY_NAME.get(eventName)?.supports_step_filter ?? false;
}

/**
 * Sous-ensemble de `allowedTagsForEvent(eventName)` dont `render_stage` vaut
 * `delivery` — SOURCE UNIQUE lue par la mise en file
 * (`NotificationDispatchConsumer`, story E10.15d-2, §8.23 point 11.3 §1 :
 * « jamais une liste en dur : meme discipline que
 * coalescingWindowMinutesForEvent, une seule verite »). Aujourd hui, seule
 * `order.files_submitted` en propose une (`files.count`) — un evenement
 * inconnu ou sans balise differee rend un ensemble VIDE, jamais une erreur.
 */
export function deferredTagsForEvent(eventName: NotificationEventName): ReadonlySet<string> {
  const definition = EVENT_DEFINITIONS_BY_NAME.get(eventName);
  if (!definition) return new Set();
  return new Set(definition.tags.filter((id) => TAG_DEFINITIONS[id].renderStage === 'delivery'));
}

/**
 * Fenetre de regroupement DE L EVENEMENT (0-120 min), SOURCE UNIQUE lue par
 * la mise en file (`NotificationDispatchConsumer` -> `NotificationLogsWriteGateway.enqueue()`
 * -> `api_enqueue_notification_message`, colonne `notification_logs.
 * coalescing_window_minutes`). CORRIGE 2026-09-12 (§8.23 point 4,
 * RECTIFICATIF D ARBITRAGE) : cette valeur ne doit JAMAIS etre reecrite en
 * dur ailleurs — un evenement inconnu du catalogue vaut `0` (jamais
 * regroupable), meme discipline defensive que `eventSupportsStepFilter`.
 */
export function coalescingWindowMinutesForEvent(eventName: NotificationEventName): number {
  return EVENT_DEFINITIONS_BY_NAME.get(eventName)?.coalescing_window_minutes ?? 0;
}

/** Jeu d exemple FICTIF (jamais une donnee reelle) pour `previewNotificationTemplate`, cle par identifiant de balise. */
export function exampleTagContext(): Readonly<Record<NotificationTagId, string>> {
  const entries = (Object.keys(TAG_DEFINITIONS) as NotificationTagId[]).map(
    (id) => [id, TAG_DEFINITIONS[id].example] as const,
  );
  return Object.freeze(Object.fromEntries(entries)) as Readonly<Record<NotificationTagId, string>>;
}

/**
 * Catalogue complet, dans l ordre d affichage attendu par l ecran de
 * parametrage (contrat, `listNotificationEvents`). `channels` depend du
 * reglage `CommercialSettings.notification_sms_enabled` de l espace : un
 * espace qui n a pas arme le SMS ne voit QUE `email` — le canal n est pas
 * masque par l ecran, il est absent du catalogue (contrat,
 * `NotificationEventDescriptor.channels`).
 */
export function listNotificationEventCatalog(smsEnabled: boolean): readonly NotificationEventDescriptorDto[] {
  const channels = smsEnabled ? (['email', 'sms'] as const) : (['email'] as const);
  return EVENT_DEFINITIONS.map((definition) => ({
    event_name: definition.event_name,
    label: definition.label,
    description: definition.description,
    audiences: [...ALL_AUDIENCES],
    channels: [...channels],
    tags: definition.tags.map((id): NotificationTagDto => {
      const tag = TAG_DEFINITIONS[id];
      return {
        id,
        syntax: `{{${id}}}`,
        label: tag.label,
        nullable: tag.nullable,
        example: tag.example,
        render_stage: tag.renderStage,
      };
    }),
    supports_step_filter: definition.supports_step_filter,
    coalescing_window_minutes: definition.coalescing_window_minutes,
  }));
}
