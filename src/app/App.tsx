import { RouterProvider } from 'react-router';
import { router } from './routes';

/**
 * App.tsx v3
 * ──────────
 * La composition des providers a legerement bouge : le TenantProvider depend
 * du router (useParams, useNavigate), donc il ne peut pas wrapper le
 * RouterProvider. On le place dans `AppShell` qui est le premier element
 * rendu PAR le router (cf routes.tsx, element: <AppShell />).
 *
 * Les providers "router-agnostiques" (Auth, Preferences, PIM…) restent
 * autour de RouterProvider pour eviter de les ressusciter a chaque
 * navigation.
 */
import { AuthProvider } from './contexts/AuthContext';
import { PreferencesProvider } from './contexts/PreferencesContext';
import { PIMProvider } from './contexts/PIMContext';

export default function App() {
  return (
    <AuthProvider>
      <PreferencesProvider>
        <PIMProvider>
          <RouterProvider router={router} />
        </PIMProvider>
      </PreferencesProvider>
    </AuthProvider>
  );
}
