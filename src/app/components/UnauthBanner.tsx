import { useState } from 'react';
import { Lock, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { LoginModal } from './auth/LoginModal';
import { SignupModal } from './auth/SignupModal';
import { ForgotPasswordModal } from './auth/ForgotPasswordModal';

type ModalType = 'login' | 'signup' | 'forgot' | null;

export function UnauthBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [modal, setModal] = useState<ModalType>(null);

  if (user || dismissed) return null;

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-gray-900 text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Lock className="w-5 h-5 text-amber-400 shrink-0" />
            <p className="text-sm truncate">Pour voir le prix, connectez-vous</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setModal('login')}
              className="px-4 py-1.5 bg-amber-400 hover:bg-amber-500 text-gray-900 rounded text-sm font-medium"
            >
              Se connecter
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="p-1.5 hover:bg-gray-800 rounded"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {modal === 'login' && (
        <LoginModal
          onClose={() => setModal(null)}
          onSwitchToSignup={() => setModal('signup')}
          onSwitchToForgot={() => setModal('forgot')}
        />
      )}
      {modal === 'signup' && (
        <SignupModal onClose={() => setModal(null)} onSwitchToLogin={() => setModal('login')} />
      )}
      {modal === 'forgot' && (
        <ForgotPasswordModal onClose={() => setModal(null)} onSwitchToLogin={() => setModal('login')} />
      )}
    </>
  );
}
