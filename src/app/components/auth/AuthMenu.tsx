import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { User, LogIn, LogOut, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { LoginModal } from './LoginModal';
import { SignupModal } from './SignupModal';
import { ForgotPasswordModal } from './ForgotPasswordModal';

type ModalType = 'login' | 'signup' | 'forgot' | null;

export function AuthMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<ModalType>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const displayName =
    (user?.user_metadata?.full_name as string | undefined)?.trim() || user?.email?.split('@')[0] || '';

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <div className="w-7 h-7 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-semibold">
            {user ? (displayName[0] || 'U').toUpperCase() : <User className="w-4 h-4" />}
          </div>
          <span className="font-medium hidden sm:inline">{user ? displayName : 'Compte'}</span>
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50">
            {user ? (
              <>
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-xs text-gray-500">Connecté en tant que</p>
                  <p className="text-sm font-medium text-gray-900 truncate">{user.email}</p>
                </div>
                <button
                  onClick={() => { setOpen(false); navigate('/dashboard'); }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Tableau de bord
                </button>
                <button
                  onClick={async () => { setOpen(false); await signOut(); }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <LogOut className="w-4 h-4" />
                  Se déconnecter
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { setOpen(false); setModal('login'); }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <LogIn className="w-4 h-4" />
                  Se connecter
                </button>
                <button
                  onClick={() => { setOpen(false); setModal('signup'); }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <User className="w-4 h-4" />
                  Créer un compte
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {modal === 'login' && (
        <LoginModal
          onClose={() => setModal(null)}
          onSwitchToSignup={() => setModal('signup')}
          onSwitchToForgot={() => setModal('forgot')}
        />
      )}
      {modal === 'signup' && (
        <SignupModal
          onClose={() => setModal(null)}
          onSwitchToLogin={() => setModal('login')}
        />
      )}
      {modal === 'forgot' && (
        <ForgotPasswordModal
          onClose={() => setModal(null)}
          onSwitchToLogin={() => setModal('login')}
        />
      )}
    </>
  );
}
