import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '/utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { TEST_IDS } from '../../lib/testIds';

export function DashboardProfile() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState<string>((user?.user_metadata?.full_name as string) ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.auth.updateUser({ data: { full_name: fullName } });
    setSaving(false);
    setMessage(error ? `❌ ${error.message}` : '✅ Profil mis à jour.');
  };

  return (
    <div data-testid={TEST_IDS.dashboard.welcomeCard} className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Profil</h2>
        <p className="text-sm text-gray-600">Gérez vos informations personnelles.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          value={user?.email ?? ''}
          disabled
          className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {message && (
        <p className={`text-sm ${message.startsWith('✅') ? 'text-green-700' : 'text-red-600'}`}>{message}</p>
      )}

      <button
        onClick={save}
        disabled={saving}
        className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 font-medium flex items-center gap-2"
      >
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        Enregistrer
      </button>
    </div>
  );
}
