import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, FolderKanban, ListChecks, Plus, Search, Sparkles, Users } from 'lucide-react';
import { MagritLogo } from '@/shared/presentation/MagritLogo';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { CustomersApiClient, type CreateCustomerCommand, type CustomerDto } from '@/modules/customers';
import { CustomerFormModal } from '@/modules/customers/ui/workspace/CustomerFormModal';
import { ProjectsApiClient, type CreateProjectCommand, type ProjectDto } from '@/modules/projects';
import { customerDisplayName, ProjectCreateModal } from '@/modules/projects/ui';
import { ActiveProjectItemsDrawer } from './ActiveProjectItemsDrawer';

const inputCls = 'w-full rounded-lg border border-line-2 bg-paper px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40';
const btnPrimary = 'inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-ink hover:opacity-90';
const PROMPT_EXAMPLES = [
  { label: 'Cartes de visite', description: '500 cartes avec pelliculage mat' },
  { label: 'Flyers', description: '1000 flyers A5 recto verso' },
  { label: 'Brochure', description: '24 pages format A4' },
  { label: 'Affiches', description: '250 affiches A2 brillant' },
] as const;

export function MagritConfiguratorHome({
  selectedCustomerName = null,
  selectedProjectId = null,
  selectedProjectName = null,
  onProjectSelect,
  onChangeProject,
  onQuoteCreated,
  onSubmit,
}: Readonly<{
  selectedCustomerName?: string | null;
  selectedProjectId?: string | null;
  selectedProjectName?: string | null;
  onProjectSelect: (selection: { projectId: string; customerName: string; projectName: string; hopstudioSessionId: string | null }) => void;
  onChangeProject: () => void;
  onQuoteCreated: (quoteId: string) => void;
  onSubmit: (query: string) => void;
}>) {
  const customersApi = useWorkspaceApi(CustomersApiClient);
  const projectsApi = useWorkspaceApi(ProjectsApiClient);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customers, setCustomers] = useState<readonly CustomerDto[]>([]);
  const [projects, setProjects] = useState<readonly ProjectDto[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [showProjectItems, setShowProjectItems] = useState(false);
  const [selectedProjectItemCount, setSelectedProjectItemCount] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId) ?? null;
  const visibleCustomers = useMemo(() => {
    const normalized = customerQuery.trim().toLocaleLowerCase('fr-FR');
    if (!normalized) return customers;
    return customers.filter((customer) => customerDisplayName(customer).toLocaleLowerCase('fr-FR').includes(normalized));
  }, [customerQuery, customers]);

  const loadProjects = async (customerId: string | null) => {
    setLoadingContext(true);
    setContextError(null);
    try {
      const response = await projectsApi.list({
        ...(customerId ? { customerId } : {}),
        status: 'active',
        pageSize: customerId ? 100 : 10,
      });
      setProjects(response.items);
    } catch (cause) {
      setProjects([]);
      setContextError(cause instanceof Error ? cause.message : 'Le contexte client est indisponible.');
    } finally {
      setLoadingContext(false);
    }
  };

  useEffect(() => {
    let active = true;
    setLoadingContext(true);
    void Promise.all([
      customersApi.list({ pageSize: 200 }),
      projectsApi.list({ status: 'active', pageSize: 10 }),
    ]).then(([customerPage, projectPage]) => {
      if (!active) return;
      setCustomers(customerPage.items);
      setProjects(projectPage.items);
      setContextError(null);
    }).catch((cause) => {
      if (!active) return;
      setContextError(cause instanceof Error ? cause.message : 'Le contexte client est indisponible.');
    }).finally(() => {
      if (active) setLoadingContext(false);
    });
    return () => { active = false; };
  }, [customersApi, projectsApi]);

  useEffect(() => {
    let active = true;
    setSelectedProjectItemCount(null);
    if (!selectedProjectId) return () => { active = false; };
    void projectsApi.getDetail(selectedProjectId)
      .then((project) => {
        if (active) setSelectedProjectItemCount(project.items.length);
      })
      .catch(() => {
        if (active) setSelectedProjectItemCount(null);
      });
    return () => { active = false; };
  }, [projectsApi, selectedProjectId]);

  const selectCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    void loadProjects(customerId);
  };

  const createProject = async (command: CreateProjectCommand) => {
    const customerId = selectedCustomerId ?? command.customer_id;
    if (!customerId) throw new Error('Sélectionnez un client avant de créer un projet.');
    const created = await projectsApi.create({ name: command.name, customer_id: customerId });
    await loadProjects(selectedCustomerId);
    return created;
  };

  const submitPrompt = (event?: FormEvent) => {
    event?.preventDefault();
    const value = query.trim();
    if (value) onSubmit(value);
  };

  const handlePromptKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submitPrompt();
    }
  };

  const selectPromptExample = (value: string) => {
    setQuery(value);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <main
      className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center bg-[#fbfbfb] px-6 py-12"
      data-testid="magrit-configurator-home"
    >
      <div className="flex w-full max-w-3xl -translate-y-6 flex-col items-center text-center">
        <MagritLogo size={92} />
        <h1 className="mt-7 text-4xl font-light tracking-[-0.045em] text-ink sm:text-6xl">
          Le papier pense.
        </h1>
        <p className="mt-3 max-w-2xl text-base font-light leading-7 text-ink-muted sm:text-lg">
          Choisissez un client, reprenez un projet récent, ou démarrez un nouveau chiffrage avec HopeStudio.
        </p>

        {selectedProjectName ? (
          <section className="mt-8 w-full rounded-2xl border border-line bg-white p-4 text-left shadow-[0_16px_45px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between gap-3 border-b border-line pb-3 text-sm">
              <div className="min-w-0 truncate text-ink">
                <span className="font-medium">{selectedCustomerName ?? 'Client'}</span>
                <span className="mx-2 text-ink-muted">·</span>
                <span className="text-ink-muted">{selectedProjectName}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {selectedProjectId && (
                  <button
                    type="button"
                    onClick={() => setShowProjectItems(true)}
                    className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-bg"
                  >
                    <ListChecks className="size-4" />
                    Éléments du projet
                    {selectedProjectItemCount !== null && (
                      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-ink px-1.5 py-0.5 text-xs leading-none text-white" aria-label={`${selectedProjectItemCount} éléments`}>
                        {selectedProjectItemCount}
                      </span>
                    )}
                  </button>
                )}
                <button type="button" onClick={onChangeProject} className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-bg">
                  Changer
                </button>
              </div>
            </div>
            <form className="pt-4" onSubmit={submitPrompt}>
              <label className="sr-only" htmlFor="magrit-configurator-prompt">
                Décrivez votre projet d’impression
              </label>
              <textarea
                ref={inputRef}
                id="magrit-configurator-prompt"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handlePromptKeyDown}
                rows={4}
                autoFocus
                placeholder="Décrivez votre projet d’impression…"
                className="w-full resize-none border-0 bg-transparent px-1 text-base text-ink outline-none placeholder:text-ink-mute-2"
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={!query.trim()}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Envoyer
                  <ArrowUp className="size-4" />
                </button>
              </div>
            </form>
            <div className="mt-4 grid grid-cols-1 gap-2 border-t border-line pt-4 sm:grid-cols-2" aria-label="Exemples de demandes">
              {PROMPT_EXAMPLES.map((example) => (
                <button
                  key={example.label}
                  type="button"
                  onClick={() => selectPromptExample(`${example.label} — ${example.description}`)}
                  className="rounded-xl border border-line bg-white/80 px-4 py-3 text-left transition hover:-translate-y-px hover:border-ink-mute-2 hover:shadow-sm"
                >
                  <strong className="block text-sm font-medium text-ink">{example.label}</strong>
                  <span className="mt-1 block text-xs text-ink-muted">{example.description}</span>
                </button>
              ))}
            </div>
          </section>
        ) : (
        <div className="mt-8 grid w-full gap-4 text-left lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-[0_12px_30px_rgba(15,23,42,0.06)]" aria-labelledby="home-customers-title">
            <div className="border-b border-line px-4 py-3">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-ink-muted" />
                <h2 id="home-customers-title" className="text-sm font-semibold text-ink">Clients</h2>
                <span className="ml-auto text-xs text-ink-muted">{customers.length}</span>
                <button
                  type="button"
                  onClick={() => setShowCreateCustomer(true)}
                  className={`${btnPrimary} px-3 py-1.5`}
                >
                  <Plus className="size-4" /> Nouveau
                </button>
              </div>
              <label className="relative mt-3 block">
                <span className="sr-only">Rechercher un client</span>
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
                <input
                  type="search"
                  value={customerQuery}
                  onChange={(event) => setCustomerQuery(event.target.value)}
                  placeholder="Rechercher un client…"
                  className={`${inputCls} pl-9`}
                />
              </label>
            </div>
            <div className="max-h-64 overflow-y-auto p-2">
              {loadingContext && customers.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-ink-muted">Chargement des clients…</p>
              ) : visibleCustomers.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-ink-muted">Aucun client trouvé.</p>
              ) : visibleCustomers.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => selectCustomer(customer.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${selectedCustomerId === customer.id ? 'bg-ink text-white' : 'text-ink hover:bg-bg'}`}
                >
                  <span className="min-w-0 truncate font-medium">{customerDisplayName(customer)}</span>
                  <span className={`ml-3 shrink-0 text-xs ${selectedCustomerId === customer.id ? 'text-white/70' : 'text-ink-muted'}`}>{customer.type === 'company' ? 'Entreprise' : 'Particulier'}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-[0_12px_30px_rgba(15,23,42,0.06)]" aria-labelledby="home-projects-title">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <FolderKanban className="size-4 text-ink-muted" />
              <div className="min-w-0">
                <h2 id="home-projects-title" className="truncate text-sm font-semibold text-ink">
                  {selectedCustomer ? `Projets de ${customerDisplayName(selectedCustomer)}` : 'Projets récents'}
                </h2>
                <p className="text-xs text-ink-muted">{selectedCustomer ? 'Projets actifs du client' : 'Mis à jour récemment'}</p>
              </div>
              {selectedCustomer && (
                <button type="button" onClick={() => setShowCreateProject(true)} className={`${btnPrimary} ml-auto shrink-0 px-3 py-1.5`}>
                  <Plus className="size-4" /> Nouveau
                </button>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto p-2">
              {loadingContext ? (
                <p className="px-3 py-6 text-center text-sm text-ink-muted">Chargement des projets…</p>
              ) : projects.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <p className="text-sm text-ink-muted">{selectedCustomer ? 'Aucun projet actif pour ce client.' : 'Aucun projet récent.'}</p>
                  {selectedCustomer && <button type="button" onClick={() => setShowCreateProject(true)} className="mt-3 text-sm font-medium text-brand hover:underline">Créer le premier projet</button>}
                </div>
              ) : projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => onProjectSelect({
                    projectId: project.id,
                    customerName: (() => {
                      const customer = customers.find((candidate) => candidate.id === project.customer_id) ?? selectedCustomer;
                      return customer ? customerDisplayName(customer) : 'Client';
                    })(),
                    projectName: project.name,
                    hopstudioSessionId: project.hopstudio_session_id,
                  })}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm text-ink transition hover:bg-bg"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{project.name}</span>
                    <span
                      className={`mt-0.5 flex min-w-0 items-center gap-1 text-[11px] ${project.hopstudio_session_id ? 'text-brand' : 'text-ink-muted'}`}
                      title={project.hopstudio_session_id ?? 'Aucune session HopeStudio associée'}
                    >
                      <Sparkles className="size-3 shrink-0" aria-hidden="true" />
                      <span className="truncate font-mono">
                        Session : {project.hopstudio_session_id ?? 'non initialisée'}
                      </span>
                    </span>
                  </span>
                  <time className="ml-3 shrink-0 text-xs text-ink-muted" dateTime={project.updated_at}>
                    {new Date(project.updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </time>
                </button>
              ))}
            </div>
          </section>
        </div>
        )}

        {contextError && <p className="mt-3 w-full text-left text-sm text-err-fg">{contextError}</p>}

      </div>
      {showCreateProject && selectedCustomerId && (
        <ProjectCreateModal
          initialCustomerId={selectedCustomerId}
          onClose={() => setShowCreateProject(false)}
          onCreate={createProject}
        />
      )}
      {showCreateCustomer && (
        <CustomerFormModal
          onClose={() => setShowCreateCustomer(false)}
          onCreate={async (command: CreateCustomerCommand) => {
            const created = await customersApi.create(command);
            setCustomers((current) => [created, ...current.filter((customer) => customer.id !== created.id)]);
            selectCustomer(created.id);
            return created;
          }}
          onVerifySiret={async (customerId) => {
            const result = await customersApi.verifySiret(customerId);
            return { verified: result.verified, mocked: result.mocked };
          }}
        />
      )}
      {showProjectItems && selectedProjectId && selectedProjectName && (
        <ActiveProjectItemsDrawer
          projectId={selectedProjectId}
          projectName={selectedProjectName}
          onClose={() => setShowProjectItems(false)}
          onCreated={(quoteId) => {
            setShowProjectItems(false);
            onQuoteCreated(quoteId);
          }}
        />
      )}
    </main>
  );
}
