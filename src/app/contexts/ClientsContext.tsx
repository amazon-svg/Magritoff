import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '/utils/supabase/client';
import { useAuth } from './AuthContext';

export interface Client {
  id: string;
  user_id?: string;
  company: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  created_at?: string;
}

interface ClientsContextType {
  clients: Client[];
  loading: boolean;
  refresh: () => Promise<void>;
  addClient: (data: Omit<Client, 'id' | 'user_id' | 'created_at'>) => Promise<Client | null>;
  updateClient: (id: string, patch: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
}

const ClientsContext = createContext<ClientsContextType | undefined>(undefined);

export function ClientsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setClients([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error && data) setClients(data as Client[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const addClient = async (data: Omit<Client, 'id' | 'user_id' | 'created_at'>) => {
    if (!user) return null;
    const { data: inserted, error } = await supabase
      .from('clients')
      .insert({ ...data, user_id: user.id })
      .select()
      .single();
    if (error || !inserted) return null;
    setClients((prev) => [inserted as Client, ...prev]);
    return inserted as Client;
  };

  const updateClient = async (id: string, patch: Partial<Client>) => {
    if (!user) return;
    const { data, error } = await supabase
      .from('clients')
      .update(patch)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();
    if (!error && data) {
      setClients((prev) => prev.map((c) => (c.id === id ? (data as Client) : c)));
    }
  };

  const deleteClient = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from('clients').delete().eq('id', id).eq('user_id', user.id);
    if (!error) setClients((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <ClientsContext.Provider value={{ clients, loading, refresh, addClient, updateClient, deleteClient }}>
      {children}
    </ClientsContext.Provider>
  );
}

export function useClients() {
  const ctx = useContext(ClientsContext);
  if (!ctx) throw new Error('useClients must be used within a ClientsProvider');
  return ctx;
}
