import { createContext, useContext, useState, ReactNode } from 'react';

interface CartItem {
  id: string;
  product: any;
  addedAt: string;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: any) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  getTotalPrice: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addToCart = (product: any) => {
    const newItem: CartItem = {
      id: `cart_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      product: product,
      addedAt: new Date().toISOString()
    };
    setItems([...items, newItem]);
    console.log('✅ Produit ajouté au panier:', product.name);
  };

  const removeFromCart = (id: string) => {
    setItems(items.filter(item => item.id !== id));
    console.log('🗑️ Produit retiré du panier');
  };

  const clearCart = () => {
    setItems([]);
    console.log('🧹 Panier vidé');
  };

  const getTotalPrice = () => {
    return items.reduce((total, item) => total + (item.product.price || 0), 0);
  };

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, clearCart, getTotalPrice }}>
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
