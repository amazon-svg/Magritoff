import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { supabase } from '/utils/supabase/client';
import { useAuth } from './AuthContext';

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

const STORAGE_KEY = 'magrit_conversation_history';

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

async function fetchRemote(userId: string): Promise<ConversationHistory[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
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

async function upsertRemote(userId: string, conv: ConversationHistory): Promise<{ ok: boolean; rlsBlocked: boolean }> {
  const { error } = await supabase.from('conversations').upsert(
    {
      id: conv.id,
      user_id: userId,
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

async function deleteRemote(userId: string, id: string) {
  const { error } = await supabase.from('conversations').delete().eq('id', id).eq('user_id', userId);
  if (error) console.error('[Conversation] delete failed', { convId: id, message: error.message });
}

export function ConversationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [history, setHistory] = useState<ConversationHistory[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const migratedRef = useRef(false);

  useEffect(() => {
    if (user) {
      fetchRemote(user.id).then(async (remote) => {
        if (!migratedRef.current) {
          const local = localStorage.getItem(STORAGE_KEY);
          if (local) {
            try {
              const parsed: ConversationHistory[] = JSON.parse(local);
              const missing = parsed.filter((p) => !remote.some((r) => r.id === p.id));
              for (const conv of missing) {
                await upsertRemote(user.id, conv);
              }
              if (missing.length > 0) {
                const refreshed = await fetchRemote(user.id);
                setHistory(refreshed);
                migratedRef.current = true;
                return;
              }
            } catch {}
          }
          migratedRef.current = true;
        }
        setHistory(remote);
      });
    } else {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try { setHistory(JSON.parse(saved)); } catch {}
      } else {
        setHistory([]);
      }
      migratedRef.current = false;
    }
  }, [user]);

  useEffect(() => {
    // Le localStorage sert de cache hors-ligne et de source pour la migration
    // au login. On le garde synchronisé en permanence avec l'état courant.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, [history]);

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
        if (user) {
          void upsertRemote(user.id, conv).then((res) => {
            if (!res.ok && res.rlsBlocked) {
              // Conv appartient à un autre user → on la retire localement et
              // on reset currentConversationId pour éviter de spammer.
              setHistory((prev2) => prev2.filter((c) => c.id !== conv.id));
              setCurrentConversationId((cur) => (cur === conv.id ? null : cur));
            }
          });
        }
        return next;
      });
    },
    [currentConversationId, user]
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
      if (user) void deleteRemote(user.id, id);
      if (currentConversationId === id) {
        setCurrentConversationId(null);
        setMessages([]);
        setProducts([]);
      }
    },
    [currentConversationId, user]
  );

  const startNewConversation = useCallback(() => {
    saveCurrent(messages, products);
    setMessages([]);
    setProducts([]);
    setCurrentConversationId(null);
  }, [messages, products, saveCurrent]);

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
