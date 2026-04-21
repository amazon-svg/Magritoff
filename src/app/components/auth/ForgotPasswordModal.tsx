import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  onClose: () => void;
  onSwitchToLogin: () => void;
}

export function ForgotPasswordModal({ onClose, onSwitchToLogin }: Props) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await resetPassword(email);
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Mot de passe oublié</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {sent ? (
          <div className="space-y-4">
            <p className="text-sm text-green-700 bg-green-50 p-3 rounded">
              ✅ Si un compte existe pour <strong>{email}</strong>, vous recevrez un lien pour réinitialiser
              votre mot de passe.
            </p>
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium"
            >
              Fermer
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-4">
              Entrez votre email, nous vous enverrons un lien pour réinitialiser votre mot de passe.
            </p>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Envoyer le lien
              </button>
            </form>

            <div className="mt-4 text-sm text-center">
              <button onClick={onSwitchToLogin} className="text-blue-600 hover:underline">
                Retour à la connexion
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
