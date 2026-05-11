import { createContext, useContext, useState, ReactNode } from 'react';
import {
  computeCartTaxAmount,
  computeCartTotalHT,
  computeCartTotalTTC,
} from '../utils/cartMath';
import { getTaxRate } from '../utils/tax';
import { useTenant } from './TenantContext';

interface CartItem {
  id: string;
  product: any;
  addedAt: string;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: any) => void;
  removeFromCart: (id: string) => void;
  updateItemClient: (itemId: string, clientId: string | null) => void;
  clearCart: () => void;
  /** Total HT (somme prix_ht * qty). Anciennement `getTotalPrice`. */
  getTotalHT: () => number;
  /** Total TTC selon le tax_regime du tenant courant (R0 - Spike H). */
  getTotalTTC: () => number;
  /** Montant de la TVA seule selon le tenant courant. */
  getTaxAmount: () => number;
  /** @deprecated Utiliser getTotalHT(). Conserve pour compat call-sites existants. */
  getTotalPrice: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const { currentTenant } = useTenant();

  const addToCart = (product: any) => {
    const newItem: CartItem = {
      id: `cart_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      product: product,
      addedAt: new Date().toISOString(),
    };
    setItems((prev) => [...prev, newItem]);
    console.log('✅ Produit ajouté au panier:', product.name);
  };

  const removeFromCart = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    console.log('🗑️ Produit retiré du panier');
  };

  const updateItemClient = (itemId: string, clientId: string | null) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, product: { ...item.product, client_id: clientId } } : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
    console.log('🧹 Panier vidé');
  };

  const getTotalHT = () => computeCartTotalHT(items);
  const getTotalTTC = () => computeCartTotalTTC(items, getTaxRate(currentTenant));
  const getTaxAmount = () => computeCartTaxAmount(items, getTaxRate(currentTenant));

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateItemClient,
        clearCart,
        getTotalHT,
        getTotalTTC,
        getTaxAmount,
        getTotalPrice: getTotalHT, // alias deprecated
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
