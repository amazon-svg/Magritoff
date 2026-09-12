/**
 * NotificationTemplateFormModal — creation et modification d un modele de
 * notification (E10.15b, CA2/CA3/CA5/CA6).
 *
 * `event_name` et `channel` sont IMMUABLES apres creation (contrat
 * `UpdateNotificationTemplateCommand`, §8.23 §2 decision « event_name ET
 * channel NE SONT PAS MODIFIABLES ») : en mode edition, ces deux champs sont
 * affiches en lecture seule plutot que masques, meme discipline que
 * `PriceRuleFormModal` pour `scope`/`value_type`.
 *
 * APERCU (CA6) : necessite un `templateId` (contrat `previewNotification
 * Template`, decision « previsualiser AVANT la premiere sauvegarde n est
 * pas possible en V1 »). En mode creation, le bouton est donc desactive
 * jusqu au premier enregistrement — apres quoi le modele cree (`is_active:
 * false` par defaut) reste ouvert dans CE MEME modal, desormais en mode
 * edition, pour enchainer "ecrire, previsualiser, activer" sans fermeture
 * intermediaire (§8.23 §2, note `createNotificationTemplate`).
 *
 * Aucun calcul ni envoi ici : l apercu est rendu par le SERVEUR
 * (`previewNotificationTemplate`, jeu d exemple, 200, aucun envoi reel).
 */
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Loader2, X } from 'lucide-react';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { ApiClientError } from '@/platform/api';
import { NotificationsApiClient } from '@/modules/notifications/api/client';
import type {
  NotificationAudience,
  NotificationChannel,
  NotificationEventDescriptorDto,
  NotificationEventName,
  NotificationPreviewDto,
  NotificationTemplateDto,
} from '@/modules/notifications/api/contracts';
import type { ProductionStepDto } from '@/modules/production-steps';
import {
  formatRecipientsInput,
  insertTagAtCursor,
  isQuoteSentDoubleEmailRisk,
  notificationTemplateApiProblemMessage,
  parseRecipientsInput,
  smsCounterState,
  validateNotificationPreviewInput,
  validateNotificationTemplateForm,
} from './notification-templates.helpers';

const inputCls =
  'w-full px-3 py-2 border border-line-2 rounded-lg bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand disabled:opacity-60 disabled:bg-bg';
const textareaCls = `${inputCls} font-mono`;
const labelCls = 'block text-sm font-medium text-ink-2 mb-1';
const btnPrimary =
  'px-4 py-2 bg-brand text-brand-ink rounded-lg hover:opacity-90 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2';
const btnGhost = 'px-3 py-1.5 border border-line-2 rounded-lg text-sm text-ink-2 hover:bg-bg hover:text-ink disabled:opacity-50';
const tagBtnCls =
  'px-2 py-1 border border-line-2 rounded-md text-xs text-ink-2 hover:bg-bg hover:text-ink text-left';

type EditingState = Readonly<{ template: NotificationTemplateDto; etag: string }>;
type FocusedField = 'subject' | 'body';

export interface NotificationTemplateFormModalProps {
  onClose: () => void;
  events: readonly NotificationEventDescriptorDto[];
  productionSteps: readonly ProductionStepDto[];
  /** Present en mode edition (modele deja enregistre) ; absent en mode creation. */
  editing?: EditingState;
  onSaved?: () => void;
}

export function NotificationTemplateFormModal({
  onClose,
  events,
  productionSteps,
  editing: initialEditing,
  onSaved,
}: NotificationTemplateFormModalProps) {
  const api = useWorkspaceApi(NotificationsApiClient);
  const [editing, setEditing] = useState<EditingState | undefined>(initialEditing);
  const isEditing = editing !== undefined;

  const [eventName, setEventName] = useState<NotificationEventName>(
    editing?.template.event_name ?? events[0]?.event_name ?? 'quote.sent',
  );
  const [channel, setChannel] = useState<NotificationChannel>(editing?.template.channel ?? 'email');
  const [audience, setAudience] = useState<NotificationAudience>(editing?.template.audience ?? 'customer');
  const [recipientsRaw, setRecipientsRaw] = useState(formatRecipientsInput(editing?.template.recipients));
  const [productionStepId, setProductionStepId] = useState(editing?.template.production_step_id ?? '');
  const [name, setName] = useState(editing?.template.name ?? '');
  const [subject, setSubject] = useState(editing?.template.subject ?? '');
  const [body, setBody] = useState(editing?.template.body ?? '');
  const [isActive, setIsActive] = useState(editing?.template.is_active ?? false);

  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<NotificationPreviewDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<FocusedField>('body');

  const subjectRef = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const [conflictOpen, setConflictOpen] = useState(false);

  const selectedEvent = useMemo(
    () => events.find((candidate) => candidate.event_name === eventName),
    [events, eventName],
  );
  // qa-review round 1 (B2) : `selectedEvent` (et donc `supportsStepFilter`)
  // depend du CATALOGUE, charge de facon INDEPENDANTE de la liste des
  // modeles par la page. Si ce chargement echoue ou n a pas encore fini
  // (blip reseau, 500 partiel sur `Promise.all`), `selectedEvent` vaut
  // `undefined` MEME pour un modele existant deja rattache a une etape —
  // `catalogReady` distingue ce cas de « l evenement ne supporte pas le
  // filtre » pour ne JAMAIS effacer silencieusement `production_step_id`
  // faute de catalogue (voir `handleSubmit`).
  const catalogReady = selectedEvent !== undefined;
  const availableChannels = selectedEvent?.channels ?? (['email'] as const);
  const availableAudiences = selectedEvent?.audiences ?? (['customer', 'explicit'] as const);
  const availableTags = selectedEvent?.tags ?? [];
  const supportsStepFilter = selectedEvent?.supports_step_filter ?? false;

  // Un changement d evenement (mode creation uniquement, le champ est
  // desactive en edition) invalide le canal courant si l evenement ne le
  // propose plus (ex. SMS non arme sur cet espace), l audience si elle n est
  // plus proposee, et le filtre d etape s il ne s applique qu a
  // `order.step_changed`.
  useEffect(() => {
    if (isEditing) return;
    if (!availableChannels.includes(channel)) setChannel(availableChannels[0] ?? 'email');
    if (!availableAudiences.includes(audience)) setAudience(availableAudiences[0] ?? 'customer');
    if (!supportsStepFilter) setProductionStepId('');
  }, [isEditing, availableChannels, channel, availableAudiences, audience, supportsStepFilter]);

  // Le sujet n a pas de sens hors canal email (contrat, `channelShapeIssues`).
  useEffect(() => {
    if (channel === 'sms') setSubject('');
  }, [channel]);

  // qa-review round 1 (B3) : un destinataire explicite saisi puis abandonne
  // au profit de l audience « client » ne doit plus survivre dans l etat —
  // sinon la validation locale (`validateNotificationTemplateForm`) refuse
  // un formulaire dont le CHAMP N EST MEME PLUS AFFICHE, alors que la
  // commande reellement construite envoie deja `recipients: null` et que le
  // serveur l accepterait.
  useEffect(() => {
    if (audience === 'customer') setRecipientsRaw('');
  }, [audience]);

  // E10.15d-1, reserve (c) du contrat §8.23 point 9 : avertissement visible
  // (PAS bloquant, la combinaison reste legitime — une adresse explicite en
  // plus du courriel automatique est un usage reel) au moment PRECIS ou la
  // combinaison event_name/channel/audience cree reellement un doublon,
  // jamais un texte statique toujours affiche.
  const quoteSentDoubleEmailWarning = isQuoteSentDoubleEmailRisk(eventName, channel, audience);

  const smsCounter = smsCounterState(channel, body);
  const recipients = useMemo(() => parseRecipientsInput(recipientsRaw), [recipientsRaw]);
  const formIssues = useMemo(
    () => validateNotificationTemplateForm({ channel, audience, recipients, name, subject, body }),
    [channel, audience, recipients, name, subject, body],
  );

  /**
   * Insertion de balise au clic (CA5) — appelle REELLEMENT `insertTagAtCursor`
   * (qa-review round 1, B1 : la version precedente dupliquait cette logique
   * en ligne, rendant le helper teste mort et invisible a toute divergence
   * future). Lit la selection courante du champ actif (le curseur reste
   * lisible sur un element qui vient de perdre le focus au profit du bouton
   * cliqué), calcule le texte et la position de curseur resultants via le
   * helper, puis reapplique cette position apres le rendu (`requestAnimationFrame`,
   * necessaire car `setSelectionRange` sur un element pas encore reaffiche
   * avec la nouvelle valeur n aurait aucun effet).
   */
  function insertTag(tagSyntax: string): void {
    if (focusedField === 'subject' && channel === 'email') {
      const el = subjectRef.current;
      const selection = { start: el?.selectionStart ?? subject.length, end: el?.selectionEnd ?? subject.length };
      const { nextValue, nextCursorPosition } = insertTagAtCursor(subject, selection, tagSyntax);
      setSubject(nextValue);
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(nextCursorPosition, nextCursorPosition);
      });
      return;
    }
    const el = bodyRef.current;
    const selection = { start: el?.selectionStart ?? body.length, end: el?.selectionEnd ?? body.length };
    const { nextValue, nextCursorPosition } = insertTagAtCursor(body, selection, tagSyntax);
    setBody(nextValue);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(nextCursorPosition, nextCursorPosition);
    });
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (formIssues.length > 0) {
      setError(formIssues.map((issue) => issue.message).join(' '));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEditing) {
        const result = await api.update(
          editing.template.id,
          {
            audience,
            recipients: audience === 'explicit' ? [...recipients] : null,
            // qa-review round 1 (B2, BLOQUANT) : `production_step_id` n est
            // envoye QUE si le catalogue d evenements a effectivement charge
            // (`catalogReady`). Sans cette garde, un `Promise.all` partiellement
            // en echec cote page laisse `selectedEvent` (donc
            // `supportsStepFilter`) a `undefined`/`false` MEME pour un modele
            // qui porte deja un filtre d etape — le champ partait alors
            // INCONDITIONNELLEMENT a `null` dans le PATCH, effacant
            // silencieusement un filtre existant a la moindre correction sans
            // rapport (nom, corps). Omettre la cle est un PATCH PARTIEL valide
            // (contrat : « seuls les champs presents sont appliques ») : le
            // serveur garde alors la valeur deja enregistree.
            ...(catalogReady
              ? { production_step_id: supportsStepFilter && productionStepId ? productionStepId : null }
              : {}),
            name: name.trim(),
            subject: channel === 'email' ? subject.trim() : null,
            body,
            is_active: isActive,
          },
          editing.etag,
        );
        if (result.etag) setEditing({ template: result.data, etag: result.etag });
        onSaved?.();
      } else {
        const created = await api.create({
          event_name: eventName,
          channel,
          audience,
          ...(audience === 'explicit' ? { recipients: [...recipients] } : {}),
          // Meme garde qu au PATCH ci-dessus, par defense en profondeur : en
          // creation, `events` ne peut normalement pas etre vide (la page
          // desactive le bouton de creation tant que le catalogue n a pas
          // charge), mais `production_step_id` reste OMIS plutot qu envoye a
          // tort si `catalogReady` est faux pour une autre raison.
          ...(catalogReady && supportsStepFilter && productionStepId ? { production_step_id: productionStepId } : {}),
          name: name.trim(),
          ...(channel === 'email' ? { subject: subject.trim() } : {}),
          body,
          is_active: isActive,
        });
        // L ETag n est pas porte par `create()` (meme pattern que
        // `PriceRulesApiClient.create()`/`ProductionStepsApiClient.create()`) :
        // une relecture dediee (`getForEdit`) est necessaire avant tout PATCH
        // ou apercu ulterieur.
        const withEtag = await api.getForEdit(created.id);
        if (!withEtag.etag) throw new Error('ETag du modele de notification indisponible apres creation.');
        setEditing({ template: withEtag.data, etag: withEtag.etag });
        onSaved?.();
      }
    } catch (cause) {
      // qa-review round 1 (M1) : un 409 (ETag perime — quelqu un d autre a
      // modifie ce modele entretemps) n a PAS de porte de sortie avec un
      // simple message d erreur : rejouer "Enregistrer" renvoie le meme ETag
      // perime et echoue a l identique. Meme patron que
      // `DocumentTemplateFieldsPage.handleSave`/`handleReloadAfterConflict`.
      if (cause instanceof ApiClientError && cause.problem.status === 409 && isEditing) {
        setConflictOpen(true);
      } else {
        setError(notificationTemplateApiProblemMessage(cause, 'Enregistrement du modele impossible.'));
      }
    } finally {
      setSaving(false);
    }
  }

  /** Recharge le modele APRES un conflit (qa-review round 1, M1) : la saisie locale n est plus fiable une fois qu une autre main a modifie le modele, donc reprise sur l etat serveur frais — meme choix que `DocumentTemplateFieldsPage`. */
  async function handleReloadAfterConflict(): Promise<void> {
    setConflictOpen(false);
    setError(null);
    if (!editing) return;
    try {
      const fresh = await api.getForEdit(editing.template.id);
      if (!fresh.etag) throw new Error('ETag du modele de notification indisponible apres rechargement.');
      setEditing({ template: fresh.data, etag: fresh.etag });
      setAudience(fresh.data.audience);
      setRecipientsRaw(formatRecipientsInput(fresh.data.recipients));
      setProductionStepId(fresh.data.production_step_id ?? '');
      setName(fresh.data.name);
      setSubject(fresh.data.subject ?? '');
      setBody(fresh.data.body);
      setIsActive(fresh.data.is_active);
    } catch (cause) {
      setError(notificationTemplateApiProblemMessage(cause, 'Rechargement du modele impossible.'));
    }
  }

  async function handlePreview(): Promise<void> {
    if (!editing) return;
    // qa-review round 1 (M3a) : `body`/`subject` sont valides AVANT l appel —
    // sans ce garde-fou, un corps vide (ou un sujet vide sur canal email)
    // levait une `ZodError` BRUTE au `.parse()` du client, jamais rattrapee
    // proprement par `notificationTemplateApiProblemMessage` (qui ne sait
    // lire qu une `ApiClientError`).
    const previewIssues = validateNotificationPreviewInput(channel, subject, body);
    if (previewIssues.length > 0) {
      setError(previewIssues.map((issue) => issue.message).join(' '));
      return;
    }
    setPreviewing(true);
    setError(null);
    try {
      const result = await api.preview(editing.template.id, {
        ...(channel === 'email' ? { subject: subject.trim() } : {}),
        body,
      });
      setPreview(result);
    } catch (cause) {
      setError(notificationTemplateApiProblemMessage(cause, "Aperçu impossible."));
    } finally {
      setPreviewing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-paper rounded-2xl shadow-2xl w-full max-w-3xl p-6 max-h-[92vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
        data-testid={TEST_IDS.notificationTemplate.modal}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-ink">
            {isEditing ? 'Modifier le modèle de notification' : 'Nouveau modèle de notification'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-bg rounded" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-2 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} htmlFor="notification-event">
                  Événement
                </label>
                <select
                  id="notification-event"
                  value={eventName}
                  onChange={(event) => setEventName(event.target.value as NotificationEventName)}
                  className={inputCls}
                  disabled={isEditing}
                  data-testid={TEST_IDS.notificationTemplate.eventSelect}
                >
                  {events.map((descriptor) => (
                    <option key={descriptor.event_name} value={descriptor.event_name}>
                      {descriptor.label}
                    </option>
                  ))}
                </select>
                {selectedEvent && <p className="text-xs text-ink-muted mt-1">{selectedEvent.description}</p>}
              </div>
              <div>
                <label className={labelCls} htmlFor="notification-channel">
                  Canal
                </label>
                <select
                  id="notification-channel"
                  value={channel}
                  onChange={(event) => setChannel(event.target.value as NotificationChannel)}
                  className={inputCls}
                  disabled={isEditing}
                  data-testid={TEST_IDS.notificationTemplate.channelSelect}
                >
                  {availableChannels.map((value) => (
                    <option key={value} value={value}>
                      {value === 'email' ? 'Courriel' : 'SMS'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {supportsStepFilter && (
              <div>
                <label className={labelCls} htmlFor="notification-step-filter">
                  Filtre d’étape de production (facultatif)
                </label>
                <select
                  id="notification-step-filter"
                  value={productionStepId}
                  onChange={(event) => setProductionStepId(event.target.value)}
                  className={inputCls}
                  data-testid={TEST_IDS.notificationTemplate.stepFilterSelect}
                >
                  <option value="">Toutes les étapes</option>
                  {productionSteps.map((step) => (
                    <option key={step.id} value={step.id}>
                      {step.label}
                      {step.is_active ? '' : ' (étape désactivée)'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {quoteSentDoubleEmailWarning && (
              <p
                className="text-xs text-warn-fg bg-warn-bg border border-warn-fg/20 rounded-lg px-3 py-2"
                data-testid={TEST_IDS.notificationTemplate.quoteSentDoubleEmailWarning}
              >
                Un courriel de devis avec pièce jointe est déjà envoyé automatiquement à cet instant (E10.10b-3). Ce
                modèle s’ajoutera à ce courriel, il ne le remplacera pas — le client recevra deux courriels.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} htmlFor="notification-audience">
                  Destinataire
                </label>
                <select
                  id="notification-audience"
                  value={audience}
                  onChange={(event) => setAudience(event.target.value as NotificationAudience)}
                  className={inputCls}
                  data-testid={TEST_IDS.notificationTemplate.audienceSelect}
                >
                  {availableAudiences.map((value) => (
                    <option key={value} value={value}>
                      {value === 'customer' ? 'Le client de l’événement' : 'Destinataires explicites'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor="notification-name">
                  Nom du modèle
                </label>
                <input
                  id="notification-name"
                  type="text"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className={inputCls}
                  placeholder="Ex. Confirmation d’expédition"
                  data-testid={TEST_IDS.notificationTemplate.nameInput}
                />
              </div>
            </div>

            {audience === 'explicit' && (
              <div>
                <label className={labelCls} htmlFor="notification-recipients">
                  Destinataires explicites (un par ligne, 10 maximum)
                </label>
                <textarea
                  id="notification-recipients"
                  value={recipientsRaw}
                  onChange={(event) => setRecipientsRaw(event.target.value)}
                  className={`${textareaCls} h-20`}
                  placeholder={channel === 'sms' ? '+33612345678' : 'contact@exemple.fr'}
                  data-testid={TEST_IDS.notificationTemplate.recipientsInput}
                />
                <p className="text-xs text-ink-muted mt-1">{recipients.length}/10</p>
              </div>
            )}

            {channel === 'email' && (
              <div>
                <label className={labelCls} htmlFor="notification-subject">
                  Sujet
                </label>
                <input
                  id="notification-subject"
                  ref={subjectRef}
                  type="text"
                  required
                  value={subject}
                  onFocus={() => setFocusedField('subject')}
                  onChange={(event) => setSubject(event.target.value)}
                  className={inputCls}
                  data-testid={TEST_IDS.notificationTemplate.subjectInput}
                />
              </div>
            )}

            <div>
              <label className={labelCls} htmlFor="notification-body">
                Corps
              </label>
              <textarea
                id="notification-body"
                ref={bodyRef}
                required
                value={body}
                onFocus={() => setFocusedField('body')}
                onChange={(event) => setBody(event.target.value)}
                className={`${textareaCls} h-40`}
                data-testid={TEST_IDS.notificationTemplate.bodyInput}
              />
              {smsCounter && (
                <p
                  className={`text-xs mt-1 ${smsCounter.overLimit ? 'text-err-fg font-medium' : 'text-ink-muted'}`}
                  data-testid={TEST_IDS.notificationTemplate.smsCharCounter}
                >
                  {smsCounter.count}/{smsCounter.limit} caractères
                  {smsCounter.overLimit ? ' — dépasse la limite du canal SMS.' : ''}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                id="notification-active"
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
                data-testid={TEST_IDS.notificationTemplate.activeCheckbox}
              />
              <label htmlFor="notification-active" className="text-sm text-ink-2">
                Actif (envoie réellement une fois la chaîne d’envoi livrée)
              </label>
            </div>

            {error && (
              <p className="text-sm text-err-fg" data-testid={TEST_IDS.notificationTemplate.errorBanner}>
                {error}
              </p>
            )}

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={onClose} className={`flex-1 ${btnGhost}`}>
                Fermer
              </button>
              <button
                type="button"
                onClick={() => void handlePreview()}
                disabled={!editing || previewing}
                className={`flex-1 ${btnGhost}`}
                title={editing ? undefined : 'Enregistrez le modèle une première fois pour prévisualiser.'}
                data-testid={TEST_IDS.notificationTemplate.previewBtn}
              >
                {previewing && <Loader2 className="w-4 h-4 animate-spin" />}
                Aperçu
              </button>
              <button
                type="submit"
                disabled={saving}
                className={`flex-1 ${btnPrimary}`}
                data-testid={TEST_IDS.notificationTemplate.saveBtn}
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Enregistrer
              </button>
            </div>
            {!editing && (
              // qa-review round 1 (m2) : le motif de desactivation de l apercu
              // n etait porte que par un `title` (infobulle), invisible au
              // clavier et au tactile. Message VISIBLE, en plus du `title`
              // conserve pour la souris.
              <p className="text-xs text-ink-muted">
                Enregistrez le modèle une première fois pour prévisualiser.
              </p>
            )}
          </div>

          <div className="md:col-span-1 space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-ink mb-1">Balises disponibles</h4>
              <p className="text-xs text-ink-muted mb-2">
                Clic pour insérer dans le champ actif ({focusedField === 'subject' ? 'sujet' : 'corps'}).
              </p>
              <div className="flex flex-col gap-1.5" data-testid={TEST_IDS.notificationTemplate.tagList}>
                {availableTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => insertTag(tag.syntax)}
                    className={tagBtnCls}
                    data-testid={TEST_IDS.notificationTemplate.tagInsertBtn}
                    data-tag={tag.id}
                    title={tag.example}
                  >
                    <span className="font-mono">{tag.syntax}</span> — {tag.label}
                    {tag.nullable ? ' (peut être vide)' : ''}
                  </button>
                ))}
              </div>
            </div>

            {preview && (
              <div
                className="border border-line-2 rounded-lg p-3 space-y-1.5"
                data-testid={TEST_IDS.notificationTemplate.previewPanel}
              >
                <h4 className="text-sm font-semibold text-ink">Aperçu (jeu d’exemple, aucun envoi)</h4>
                {preview.subject !== null && <p className="text-sm font-medium text-ink">{preview.subject}</p>}
                <p className="text-sm text-ink-2 whitespace-pre-wrap">{preview.body}</p>
                <p className="text-xs text-ink-muted">
                  {preview.character_count} caractère{preview.character_count > 1 ? 's' : ''}
                  {preview.sms_segment_count !== null
                    ? ` — ${preview.sms_segment_count} segment${preview.sms_segment_count > 1 ? 's' : ''} SMS`
                    : ''}
                </p>
              </div>
            )}
          </div>
        </form>

        {conflictOpen && (
          <div className="fixed inset-0 z-[110] bg-ink/40 flex items-center justify-center p-4">
            <div
              className="bg-paper rounded-xl p-5 max-w-md space-y-3"
              data-testid={TEST_IDS.notificationTemplate.conflictDialog}
            >
              <p className="text-sm text-ink">
                Ce modèle a été modifié depuis votre dernière ouverture — par vous dans un autre onglet, ou par un
                collègue. Rechargez le modèle pour continuer ; votre saisie non enregistrée sera perdue.
              </p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setConflictOpen(false)} className="px-3 py-1.5 text-sm text-ink-2">
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => void handleReloadAfterConflict()}
                  data-testid={TEST_IDS.notificationTemplate.conflictReloadBtn}
                  className="px-3 py-1.5 bg-brand text-brand-ink rounded-lg text-sm font-medium"
                >
                  Recharger le modèle
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
