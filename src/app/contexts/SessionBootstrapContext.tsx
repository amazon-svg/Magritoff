import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  SessionApiClient,
  type SessionBootstrap,
  type UpdatePreferences,
  type CreateRootTenant,
} from '../../modules/session';
import { FetchApiClient } from '../../platform/api';
import { useAuth } from './AuthContext';

type SessionBootstrapContextValue = Readonly<{
  data: SessionBootstrap | null;
  loading: boolean;
  error: Error | null;
  reload(): Promise<void>;
  updatePreferences(patch: UpdatePreferences): Promise<void>;
  updateCurrentTenant(tenantId: string): Promise<void>;
  createRootTenant(command: CreateRootTenant): Promise<string>;
  acceptInvitation(token: string): Promise<string>;
}>;

const SessionBootstrapContext = createContext<SessionBootstrapContextValue | undefined>(undefined);

export function SessionBootstrapProvider({ children }: { children: ReactNode }) {
  const { user, session, loading: authLoading } = useAuth();
  const [data, setData] = useState<SessionBootstrap | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const requestSequence = useRef(0);
  const currentUserId = useRef<string | null>(user?.id ?? null);
  currentUserId.current = user?.id ?? null;
  const api = useMemo(
    () => new SessionApiClient(
      new FetchApiClient('', globalThis.fetch, () => session?.access_token ?? null),
    ),
    [session?.access_token],
  );

  const reload = useCallback(async () => {
    const sequence = ++requestSequence.current;
    if (!user || !session?.access_token) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const bootstrap = await api.load();
      if (sequence === requestSequence.current && currentUserId.current === bootstrap.user.id) {
        setData(bootstrap);
      }
    } catch (cause) {
      if (sequence !== requestSequence.current) return;
      const nextError = cause instanceof Error ? cause : new Error('Bootstrap session impossible.');
      setData(null);
      setError(nextError);
      console.error('[SessionBootstrap] load failed', nextError);
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [api, session?.access_token, user]);

  useEffect(() => {
    if (!authLoading) void reload();
  }, [authLoading, reload]);

  const updatePreferences = useCallback(
    async (patch: UpdatePreferences) => {
      const preferences = await api.updatePreferences(patch);
      setData((current) => (current === null ? current : { ...current, preferences }));
    },
    [api],
  );

  const updateCurrentTenant = useCallback(
    async (tenantId: string) => {
      const preferences = await api.updateCurrentTenant(tenantId);
      setData((current) => (current === null ? current : { ...current, preferences }));
    },
    [api],
  );

  const createRootTenant = useCallback(
    (command: CreateRootTenant) => api.createRootTenant(command),
    [api],
  );

  const acceptInvitation = useCallback(
    (token: string) => api.acceptInvitation(token),
    [api],
  );

  return (
    <SessionBootstrapContext.Provider
      value={{
        data,
        loading: authLoading || loading,
        error,
        reload,
        updatePreferences,
        updateCurrentTenant,
        createRootTenant,
        acceptInvitation,
      }}
    >
      {children}
    </SessionBootstrapContext.Provider>
  );
}

export function useSessionBootstrap() {
  const context = useContext(SessionBootstrapContext);
  if (!context) {
    throw new Error('useSessionBootstrap must be used within a SessionBootstrapProvider');
  }
  return context;
}
