import { RouterProvider } from 'react-router';
import { router } from './routes';
import { CartProvider } from './contexts/CartContext';
import { ConversationProvider } from './contexts/ConversationContext';
import { AuthProvider } from './contexts/AuthContext';
import { PreferencesProvider } from './contexts/PreferencesContext';
import { ClientsProvider } from './contexts/ClientsContext';
import { LibraryProvider } from './contexts/LibraryContext';
import { ShopsProvider } from './contexts/ShopsContext';
import { PIMProvider } from './contexts/PIMContext';

export default function App() {
  return (
    <AuthProvider>
      <PreferencesProvider>
        <PIMProvider>
          <ConversationProvider>
            <ClientsProvider>
              <LibraryProvider>
                <ShopsProvider>
                  <CartProvider>
                    <RouterProvider router={router} />
                  </CartProvider>
                </ShopsProvider>
              </LibraryProvider>
            </ClientsProvider>
          </ConversationProvider>
        </PIMProvider>
      </PreferencesProvider>
    </AuthProvider>
  );
}
