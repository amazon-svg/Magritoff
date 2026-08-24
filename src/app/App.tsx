import { RouterProvider } from 'react-router';
import { router } from '@/app/routes';

/**
 * App.tsx v3
 * ──────────
 * La composition des providers a legerement bouge : le TenantProvider depend
 * du router (useParams, useNavigate), donc il ne peut pas wrapper le
 * RouterProvider. On le place dans `AppShell` qui est le premier element
 * rendu PAR le router (cf routes.tsx, element: <AppShell />).
 *
 * Les providers sont désormais montés par surface dans les frontières de
 * routes : storefront sans Auth Magrit, workspace avec Auth/session/tenant.
 * App ne porte plus aucun contexte d'identité transversal.
 */
export default function App() {
  return <RouterProvider router={router} />;
}
