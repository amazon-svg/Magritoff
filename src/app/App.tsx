import { useState } from 'react';
import { ChatInterface } from './components/ChatInterface';
import { CartProvider } from './contexts/CartContext';

// Temporary simplified version to test if the module loads
export default function App() {
  return (
    <CartProvider>
      <div className="min-h-screen bg-gray-50">
        <ChatInterface 
          onShowResults={() => console.log('Show results')} 
        />
      </div>
    </CartProvider>
  );
}
