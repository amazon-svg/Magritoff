import { useEffect, useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { supabase } from '/utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';

interface Order {
  id: string;
  reference: string;
  product_name: string;
  total_ttc: number;
  status: string;
  created_at: string;
}

export function DashboardOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setOrders(data as Order[]);
        setLoading(false);
      });
  }, [user]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Commandes</h2>
        <p className="text-sm text-gray-600">{orders.length} commande(s) enregistrée(s).</p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Chargement...</p>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Aucune commande pour l'instant.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-left">
              <tr>
                <th className="px-3 py-2">Référence</th>
                <th className="px-3 py-2">Produit</th>
                <th className="px-3 py-2">Total TTC</th>
                <th className="px-3 py-2">Statut</th>
                <th className="px-3 py-2">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs">{o.reference}</td>
                  <td className="px-3 py-2">{o.product_name}</td>
                  <td className="px-3 py-2 font-semibold">{o.total_ttc?.toFixed(2)} €</td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100">{o.status}</span>
                  </td>
                  <td className="px-3 py-2 text-gray-500 text-xs">
                    {new Date(o.created_at).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
