import { useNavigate } from 'react-router';
import { Trash2, MessageSquare } from 'lucide-react';
import { useConversation } from '../../contexts/ConversationContext';

export function DashboardHistory() {
  const { history, loadConversation, deleteConversation } = useConversation();
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Historique des conversations</h2>
        <p className="text-sm text-gray-600">{history.length} conversation(s) enregistrée(s).</p>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Aucune conversation.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
          {history.map((conv) => (
            <div key={conv.id} className="flex items-center justify-between p-3 hover:bg-gray-50">
              <button
                onClick={() => { loadConversation(conv); navigate('/'); }}
                className="flex-1 text-left"
              >
                <p className="text-sm font-medium text-gray-900 truncate">{conv.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(conv.timestamp).toLocaleString('fr-FR')}
                  {conv.products.length > 0 && ` · ${conv.products.length} produit(s)`}
                </p>
              </button>
              <button
                onClick={() => deleteConversation(conv.id)}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
