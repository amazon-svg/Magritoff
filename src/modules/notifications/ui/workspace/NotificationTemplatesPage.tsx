/**
 * NotificationTemplatesPage — ecran de parametrage des modeles de
 * notification multicanal (E10.15b, docs/api/CONVENTIONS.md §8.23).
 *
 * PERIMETRE STRICT DE CE LOT : liste filtrable, editeur (creation/
 * modification), apercu SANS ENVOI. AUCUN mecanisme d envoi, AUCUN
 * consommateur d outbox, AUCUNE route API nouvelle, AUCUN ecran de journal
 * (`notification_logs` n existe pas encore cote backend — E10.15c) ici.
 *
 * L ecran n est monte que sous une route `requiredCapabilities:
 * ['can_manage_notifications']` (voir `../../surface-contributions.ts`) :
 * une garde d ergonomie, pas d autorisation — celle-ci est tenue par la RLS
 * de `notification_templates` et par `x-required-capabilities` sur
 * `createNotificationTemplate`/`updateNotificationTemplate` (E10.15a).
 *
 * Aucun calcul de rendu ni de balise ici : la liste des evenements et leurs
 * balises viennent de `listNotificationEvents` (catalogue SERVEUR), jamais
 * recopiees en dur (§8.23 §5 : « une liste recopiee en dur cote navigateur
 * diverge au premier ajout »).
 */
import { useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { useAuth } from '@/modules/account/ui/runtime';
import { useTenant } from '@/modules/tenants/ui/runtime';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { NotificationsApiClient } from '@/modules/notifications/api/client';
import type {
  NotificationChannel,
  NotificationEventDescriptorDto,
  NotificationEventName,
  NotificationTemplateDto,
  NotificationTemplateStatusFilter,
} from '@/modules/notifications/api/contracts';
import { ProductionStepsApiClient, type ProductionStepDto } from '@/modules/production-steps';
import { useNotificationTemplatesManagement } from '../hooks';
import { notificationTemplateApiProblemMessage } from './notification-templates.helpers';
import { NotificationTemplateFormModal } from './NotificationTemplateFormModal';

const inputCls =
  'w-full px-3 py-2 border border-line-2 rounded-lg bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand';
const btnPrimary =
  'px-4 py-2 bg-brand text-brand-ink rounded-lg hover:opacity-90 disabled:opacity-50 text-sm font-medium flex items-center gap-2';

type EditingState = Readonly<{ template: NotificationTemplateDto; etag: string }>;

export function DashboardNotificationTemplates() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const api = useWorkspaceApi(NotificationsApiClient);
  const productionStepsApi = useWorkspaceApi(ProductionStepsApiClient);
  const enabled = Boolean(user && currentTenant);

  const {
    items,
    loading,
    error,
    eventFilter,
    setEventFilter,
    channelFilter,
    setChannelFilter,
    statusFilter,
    setStatusFilter,
    refresh,
    toggleActive,
  } = useNotificationTemplatesManagement(enabled);

  const [events, setEvents] = useState<readonly NotificationEventDescriptorDto[]>([]);
  const [productionSteps, setProductionSteps] = useState<readonly ProductionStepDto[]>([]);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  // qa-review round 1 (M2) : erreurs des actions de ligne (ouvrir un modele,
  // basculer son statut), auparavant des rejets de promesse NON GERES —
  // distinctes de `error` (liste) et `referenceError` (catalogue, M5) pour
  // qu aucune des trois ne masque les deux autres.
  const [actionError, setActionError] = useState<string | null>(null);

  // Sources de reference du catalogue (§8.23 §5) et des etapes de production
  // (filtre `order.step_changed`, §8.23 §4) — chargees une fois, partagees
  // par la liste (filtres, libelles) et l editeur.
  //
  // qa-review round 1 (M4) : le catalogue des etapes est charge SANS filtre
  // de statut (actives ET desactivees). E10.13 permet de desactiver une
  // etape mais jamais de la supprimer ; un modele deja rattache a une etape
  // depuis desactivee doit rester resoluble en libelle (au lieu d afficher
  // un UUID brut dans la liste) et rester VISIBLE, marque comme telle, dans
  // le select du filtre d etape de l editeur — sinon ce select semble ne
  // proposer aucune option correspondant a la valeur deja enregistree, et
  // laisse croire a tort a un filtre « toutes les etapes ».
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    Promise.all([api.listEvents(), productionStepsApi.list({})])
      .then(([eventDescriptors, stepsResponse]) => {
        if (cancelled) return;
        setEvents(eventDescriptors);
        setProductionSteps(stepsResponse.data);
      })
      .catch((cause) => {
        if (!cancelled) {
          setReferenceError(
            notificationTemplateApiProblemMessage(cause, 'Chargement du catalogue de notifications impossible.'),
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, api, productionStepsApi]);

  const eventLabel = (name: NotificationEventName): string =>
    events.find((descriptor) => descriptor.event_name === name)?.label ?? name;
  const stepLabel = (stepId: string | null): string | null =>
    stepId ? (productionSteps.find((step) => step.id === stepId)?.label ?? stepId) : null;

  const openEdit = async (template: NotificationTemplateDto) => {
    setActionError(null);
    try {
      const { data, etag } = await api.getForEdit(template.id);
      if (!etag) throw new Error('ETag du modele de notification indisponible.');
      setEditing({ template: data, etag });
    } catch (cause) {
      // qa-review round 1 (M2) : si le modele a ete supprime entretemps ou
      // si le reseau tombe, un clic sur le nom ne devait RIEN afficher
      // (rejet de promesse non gere) — desormais une erreur visible.
      setActionError(notificationTemplateApiProblemMessage(cause, "Ouverture du modele impossible."));
    }
  };

  const handleToggle = async (template: NotificationTemplateDto) => {
    setTogglingId(template.id);
    setActionError(null);
    try {
      await toggleActive(template);
    } catch (cause) {
      setActionError(notificationTemplateApiProblemMessage(cause, 'Changement de statut impossible.'));
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-5" data-testid={TEST_IDS.notificationTemplate.page}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Notifications</h1>
          <p className="text-sm text-ink-muted mt-1">
            {items.length} modèle{items.length > 1 ? 's' : ''} de notification.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className={btnPrimary}
          disabled={events.length === 0}
          data-testid={TEST_IDS.notificationTemplate.createBtn}
        >
          <Plus className="w-4 h-4" />
          Nouveau modèle
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={eventFilter ?? ''}
          onChange={(event) => setEventFilter(event.target.value ? (event.target.value as NotificationEventName) : null)}
          className={inputCls}
          style={{ maxWidth: 260 }}
          data-testid={TEST_IDS.notificationTemplate.eventFilterSelect}
        >
          <option value="">Tous les événements</option>
          {events.map((descriptor) => (
            <option key={descriptor.event_name} value={descriptor.event_name}>
              {descriptor.label}
            </option>
          ))}
        </select>
        <select
          value={channelFilter ?? ''}
          onChange={(event) => setChannelFilter(event.target.value ? (event.target.value as NotificationChannel) : null)}
          className={inputCls}
          style={{ maxWidth: 160 }}
          data-testid={TEST_IDS.notificationTemplate.channelFilterSelect}
        >
          <option value="">Tous les canaux</option>
          <option value="email">Courriel</option>
          <option value="sms">SMS</option>
        </select>
        <select
          value={statusFilter ?? ''}
          onChange={(event) =>
            setStatusFilter(event.target.value ? (event.target.value as NotificationTemplateStatusFilter) : null)
          }
          className={inputCls}
          style={{ maxWidth: 160 }}
          data-testid={TEST_IDS.notificationTemplate.statusFilterSelect}
        >
          <option value="">Tous les statuts</option>
          <option value="active">Actifs</option>
          <option value="disabled">Désactivés</option>
        </select>
      </div>

      {/* qa-review round 1 (M5) : trois bannieres DISTINCTES plutot qu un
          `??` qui masquait silencieusement l echec du catalogue (celui-la
          meme qui a permis a B2 de passer inapercu) des qu une erreur de
          liste coexistait. */}
      {referenceError && <p className="text-sm text-err-fg">{referenceError}</p>}
      {error && <p className="text-sm text-err-fg">{error}</p>}
      {actionError && (
        <p className="text-sm text-err-fg" data-testid={TEST_IDS.notificationTemplate.actionErrorBanner}>
          {actionError}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-ink-muted">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-muted py-8 text-center">
          Aucun modèle de notification pour l’instant. Tant qu’aucun modèle n’est créé, aucun de ces événements ne
          notifie personne.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-muted border-b border-line">
              <th className="py-2 pr-3 font-medium">Nom</th>
              <th className="py-2 pr-3 font-medium">Événement</th>
              <th className="py-2 pr-3 font-medium">Canal</th>
              <th className="py-2 pr-3 font-medium">Étape</th>
              <th className="py-2 pr-3 font-medium">Statut</th>
              <th className="py-2 pr-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {items.map((template) => (
              <tr
                key={template.id}
                data-testid={TEST_IDS.notificationTemplate.row}
                data-template-id={template.id}
                data-channel={template.channel}
                data-event={template.event_name}
                className="border-b border-line/60 hover:bg-bg"
              >
                <td className="py-2 pr-3">
                  <button
                    type="button"
                    onClick={() => void openEdit(template)}
                    className="text-ink hover:text-brand hover:underline text-left"
                  >
                    {template.name}
                  </button>
                </td>
                <td className="py-2 pr-3 text-ink-muted">{eventLabel(template.event_name)}</td>
                <td className="py-2 pr-3 text-ink-muted">{template.channel === 'email' ? 'Courriel' : 'SMS'}</td>
                <td className="py-2 pr-3 text-ink-muted">{stepLabel(template.production_step_id) ?? '—'}</td>
                <td className="py-2 pr-3">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs ${
                      template.is_active ? 'text-green-700' : 'text-ink-muted'
                    }`}
                  >
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        template.is_active ? 'bg-green-600' : 'bg-ink-muted'
                      }`}
                    />
                    {template.is_active ? 'Actif' : 'Désactivé'}
                  </span>
                </td>
                <td className="py-2 pr-3 text-right">
                  <button
                    type="button"
                    onClick={() => void handleToggle(template)}
                    disabled={togglingId === template.id}
                    className="text-xs text-ink-2 border border-line-2 rounded-lg px-2 py-1 hover:bg-bg disabled:opacity-50"
                  >
                    {template.is_active ? 'Désactiver' : 'Activer'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showCreate && (
        <NotificationTemplateFormModal
          events={events}
          productionSteps={productionSteps}
          onClose={() => setShowCreate(false)}
          onSaved={() => void refresh()}
        />
      )}

      {editing && (
        <NotificationTemplateFormModal
          events={events}
          productionSteps={productionSteps}
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => void refresh()}
        />
      )}
    </div>
  );
}
