/**
 * ConversationContext — v3 tenant-scoped
 * ──────────────────────────────────────
 * L'historique chat est desormais scope par tenant_id. Changer de tenant
 * = changer d'historique. Local storage garde un cache par tenant
 * (cle suffixee du tenant.id) pour eviter de fuiter entre espaces.
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { supabase } from '/utils/supabase/client';
import { useAuth } from './AuthContext';
import { useTenant } from './TenantContext';

export interface ConversationMessage {
  role: string;
  content: string;
}

export interface ConversationHistory {
  id: string;
  timestamp: number;
  title: string;
  messages: ConversationMessage[];
  products: any[];
}

interface ConversationContextType {
  messages: ConversationMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ConversationMessage[]>>;
  products: any[];
  setProducts: React.Dispatch<React.SetStateAction<any[]>>;
  history: ConversationHistory[];
  currentConversationId: string | null;
  saveCurrent: (messages: ConversationMessage[], products: any[]) => void;
  loadConversation: (conv: ConversationHistory) => void;
  deleteConversation: (id: string) => void;
  startNewConversation: () => void;
}

// Cle localStorage suffixee par tenant_id : chaque espace a son cache
// d'historique. Empeche le bleed entre tenants si un user a plusieurs.
const storageKey = (tenantId: string | null) =>
  tenantId ? `magrit_conversation_history__${tenantId}` : 'magrit_conversation_history';

// Cle localStorage de la conversation active (pour restorer apres refresh /
// re-mount du provider). Suffixee par tenant comme storageKey.
const currentConvIdKey = (tenantId: string | null) =>
  tenantId ? `magrit_current_conversation__${tenantId}` : 'magrit_current_conversation';

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

async function fetchRemote(tenantId: string): Promise<ConversationHistory[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('timestamp', { ascending: false });
  if (error) console.error('[Conversation] fetch failed', error.message);
  if (!data) return [];
  return data.map((row: any) => ({
    id: row.id,
    timestamp: new Date(row.timestamp).getTime(),
    title: row.title,
    messages: row.messages ?? [],
    products: row.products ?? [],
  }));
}

async function upsertRemote(
  userId: string,
  tenantId: string,
  conv: ConversationHistory
): Promise<{ ok: boolean; rlsBlocked: boolean }> {
  const { error } = await supabase.from('conversations').upsert(
    {
      id: conv.id,
      user_id: userId,
      tenant_id: tenantId,
      title: conv.title,
      messages: conv.messages,
      products: conv.products,
      timestamp: new Date(conv.timestamp).toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) {
    const rlsBlocked = /row-level security policy/i.test(error.message || '');
    if (!rlsBlocked) {
      console.error('[Conversation] upsert failed', { convId: conv.id, message: error.message });
    } else {
      console.warn('[Conversation] upsert blocked by RLS (conv belongs to another user), dropping locally:', conv.id);
    }
    return { ok: false, rlsBlocked };
  }
  return { ok: true, rlsBlocked: false };
}

async function deleteRemote(tenantId: string, id: string) {
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);
  if (error) console.error('[Conversation] delete failed', { convId: id, message: error.message });
}

export function ConversationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [history, setHistory] = useState<ConversationHistory[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const migratedRef = useRef(false);
  // 2026-05-17 — Bloque la synchronisation history -> localStorage tant que
  // l hydratation initiale (lecture cache + fetchRemote) n est pas terminee.
  // Sans ce flag, l effet ligne ~227 ecrasait le cache avec history=[]
  // (state initial useState) DES le premier render, AVANT que l effet de
  // restauration n ait fini sa lecture cote tab focus / re-mount. Resultat :
  // au remontage suivant le cache valait toujours "[]" et la restauration
  // synchrone ne trouvait jamais la conv -> reset = home par defaut.
  const hydratedRef = useRef(false);

  useEffect(() => {
    // Reset le cache de migration quand on change de tenant
    migratedRef.current = false;
    hydratedRef.current = false;

    // E9.x — Capture la conv active AVANT de reset le state. Permet de la
    // restaurer apres re-mount du provider (ex : Supabase auth refresh sur
    // tab focus qui change la reference user et re-declenche cet effet).
    // Sans ca, l utilisateur perdait ses produits genere quand il quittait
    // l onglet et revenait, alors que la conv etait toujours en historique.
    const tenantIdAtMount = currentTenant?.id ?? null;
    const savedConvId = localStorage.getItem(currentConvIdKey(tenantIdAtMount));

    // 2026-05-15 — Restauration SYNCHRONE depuis le cache localStorage de
    // l historique (tenu a jour par l effet ligne ~197). Evite le flash
    // visuel "home standard" entre le reset state et la restauration apres
    // fetchRemote (async) qui re-declenchait sur chaque tab focus.
    let restoredSync = false;
    if (savedConvId) {
      try {
        const cachedRaw = localStorage.getItem(storageKey(tenantIdAtMount));
        if (cachedRaw) {
          const cached: ConversationHistory[] = JSON.parse(cachedRaw);
          const conv = cached.find((c) => c.id === savedConvId);
          if (conv) {
            setCurrentConversationId(conv.id);
            setMessages(Array.isArray(conv.messages) ? conv.messages.map((m) => ({ ...m })) : []);
            setProducts(Array.isArray(conv.products) ? conv.products.map((p) => ({ ...p })) : []);
            setHistory((prev) => (prev.length ? prev : cached));
            restoredSync = true;
            // Hydratation effective : on a deja restaure le state depuis le
            // cache. Les saveCurrent ulterieurs (avant que fetchRemote ne
            // resolve) doivent pouvoir persister dans localStorage.
            hydratedRef.current = true;
          }
        }
      } catch {
        // Cache corrompu : on retombe sur le reset + fetchRemote
      }
    }

    if (!restoredSync) {
      setMessages([]);
      setProducts([]);
      setCurrentConversationId(null);
    }

    const restoreCurrentFromHistory = (h: ConversationHistory[]) => {
      if (!savedConvId) return;
      const conv = h.find((c) => c.id === savedConvId);
      if (!conv) {
        // ID stale (conv supprimee) — nettoyage
        localStorage.removeItem(currentConvIdKey(tenantIdAtMount));
        return;
      }
      setCurrentConversationId(conv.id);
      setMessages(Array.isArray(conv.messages) ? conv.messages.map((m) => ({ ...m })) : []);
      setProducts(Array.isArray(conv.products) ? conv.products.map((p) => ({ ...p })) : []);
    };

    if (user && currentTenant) {
      fetchRemote(currentTenant.id).then(async (remote) => {
        if (!migratedRef.current) {
          const localKey = storageKey(currentTenant.id);
          const local = localStorage.getItem(localKey);
          if (local) {
            try {
              const parsed: ConversationHistory[] = JSON.parse(local);
              const missing = parsed.filter((p) => !remote.some((r) => r.id === p.id));
              for (const conv of missing) {
                await upsertRemote(user.id, currentTenant.id, conv);
              }
              if (missing.length > 0) {
                const refreshed = await fetchRemote(currentTenant.id);
                setHistory(refreshed);
                migratedRef.current = true;
                restoreCurrentFromHistory(refreshed);
                hydratedRef.current = true;
                return;
              }
            } catch {}
          }
          migratedRef.current = true;
        }
        setHistory(remote);
        restoreCurrentFromHistory(remote);
        hydratedRef.current = true;
      });
    } else {
      const localKey = storageKey(currentTenant?.id ?? null);
      const saved = localStorage.getItem(localKey);
      let parsed: ConversationHistory[] = [];
      if (saved) {
        try { parsed = JSON.parse(saved); } catch {}
      }
      setHistory(parsed);
      restoreCurrentFromHistory(parsed);
      hydratedRef.current = true;
    }
  }, [user, currentTenant?.id]);

  // E9.x — Auto-persist de la conv active dans localStorage. Permet a
  // restoreCurrentFromHistory de la retrouver au prochain mount. On NE
  // supprime PAS la cle quand currentConversationId devient null : ce null
  // peut etre transient (reset au re-mount du provider sur tab focus).
  // Le nettoyage explicite est dans startNewConversation, deleteConversation,
  // et restoreCurrentFromHistory (sur ID stale).
  useEffect(() => {
    if (currentConversationId) {
      localStorage.setItem(
        currentConvIdKey(currentTenant?.id ?? null),
        currentConversationId,
      );
    }
  }, [currentConversationId, currentTenant?.id]);

  useEffect(() => {
    // Le localStorage sert de cache hors-ligne et de source pour la migration
    // au login. On le garde synchronise en permanence avec l'etat courant.
    // Cle suffixee par tenant : un espace = un cache.
    // 2026-05-17 — Gate `hydratedRef` : on n ecrit PAS le cache avant que
    // l hydratation initiale (lecture + restoration sync OU fetchRemote)
    // soit finie. Sinon le `useState([])` initial du nouveau mount ecrasait
    // le cache avec "[]" AVANT que le useEffect de restauration ait pu lire
    // l ancien contenu -> au remontage suivant (tab focus) la conv etait
    // perdue parce que le cache valait "[]".
    if (!hydratedRef.current) return;
    localStorage.setItem(storageKey(currentTenant?.id ?? null), JSON.stringify(history));
  }, [history, currentTenant?.id]);

  const saveCurrent = useCallback(
    (nextMessages: ConversationMessage[], nextProducts: any[]) => {
      if (nextMessages.length === 0 && nextProducts.length === 0) return;

      const firstUser = nextMessages.find((m) => m.role === 'user')?.content || 'Nouvelle conversation';
      const title = firstUser.length > 50 ? firstUser.substring(0, 50) + '...' : firstUser;

      setHistory((prev) => {
        let conv: ConversationHistory;
        let next: ConversationHistory[];

        if (currentConversationId) {
          conv = {
            id: currentConversationId,
            title: prev.find((c) => c.id === currentConversationId)?.title ?? title,
            messages: [...nextMessages],
            products: [...nextProducts],
            timestamp: Date.now(),
          };
          next = prev.map((c) => (c.id === currentConversationId ? conv : c));
        } else {
          const newId =
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? `conv-${crypto.randomUUID()}`
              : `conv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
          setCurrentConversationId(newId);
          conv = {
            id: newId,
            timestamp: Date.now(),
            title,
            messages: [...nextMessages],
            products: [...nextProducts],
          };
          next = [conv, ...prev];
        }

        console.log('[Conversation] save', {
          id: conv.id,
          title: conv.title,
          messages: conv.messages.length,
          products: conv.products.length,
          action: currentConversationId ? 'update' : 'create',
        });
        if (user && currentTenant) {
          void upsertRemote(user.id, currentTenant.id, conv).then((res) => {
            if (!res.ok && res.rlsBlocked) {
              // Conv appartient a un autre tenant/user -> on la retire localement
              // pour eviter de spammer en rejeu.
              setHistory((prev2) => prev2.filter((c) => c.id !== conv.id));
              setCurrentConversationId((cur) => (cur === conv.id ? null : cur));
            }
          });
        }
        return next;
      });
    },
    [currentConversationId, user, currentTenant?.id]
  );

  const loadConversation = useCallback((conv: ConversationHistory) => {
    console.log('[Conversation] load (append)', {
      id: conv.id,
      title: conv.title,
      messages: conv.messages?.length ?? 0,
      products: conv.products?.length ?? 0,
    });
    // APPEND : cliquer sur une conv de l'historique ajoute ses messages
    // et ses produits à l'état courant, sans tout écraser. Permet de
    // construire une session en piochant dans les conversations passées.
    // Déduplication par product.id pour éviter les doublons.
    const clonedMsgs = Array.isArray(conv.messages)
      ? conv.messages.map((m) => ({ ...m }))
      : [];
    const clonedProducts = Array.isArray(conv.products)
      ? conv.products.map((p) => ({ ...p }))
      : [];

    setMessages((prev) => [...prev, ...clonedMsgs]);
    setProducts((prev) => {
      const existingIds = new Set(
        prev.map((p: any) => p?.id).filter(Boolean) as string[]
      );
      const additions = clonedProducts.filter(
        (p: any) => !p?.id || !existingIds.has(p.id as string)
      );
      return [...prev, ...additions];
    });
    // On conserve currentConversationId inchangé : les nouveaux messages
    // qu'envoie ensuite l'utilisateur continuent à s'ajouter à la conv en
    // cours (ou en créent une nouvelle si pas encore de conv active).
  }, []);

  const deleteConversation = useCallback(
    (id: string) => {
      setHistory((prev) => prev.filter((c) => c.id !== id));
      if (user && currentTenant) void deleteRemote(currentTenant.id, id);
      if (currentConversationId === id) {
        setCurrentConversationId(null);
        setMessages([]);
        setProducts([]);
        // Clear explicite de la cle de restauration (cf. auto-persist effect)
        localStorage.removeItem(currentConvIdKey(currentTenant?.id ?? null));
      }
    },
    [currentConversationId, user, currentTenant?.id]
  );

  const startNewConversation = useCallback(() => {
    saveCurrent(messages, products);
    setMessages([]);
    setProducts([]);
    setCurrentConversationId(null);
    // Clear explicite de la cle de restauration
    localStorage.removeItem(currentConvIdKey(currentTenant?.id ?? null));
  }, [messages, products, saveCurrent, currentTenant?.id]);

  return (
    <ConversationContext.Provider
      value={{
        messages,
        setMessages,
        products,
        setProducts,
        history,
        currentConversationId,
        saveCurrent,
        loadConversation,
        deleteConversation,
        startNewConversation,
      }}
    >
      {children}
    </ConversationContext.Provider>
  );
}

export function useConversation() {
  const ctx = useContext(ConversationContext);
  if (!ctx) throw new Error('useConversation must be used within a ConversationProvider');
  return ctx;
}
