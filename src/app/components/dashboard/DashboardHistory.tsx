import { useNavigate } from 'react-router';
import { Trash2, MessageSquare } from 'lucide-react';
import { useConversation } from '../../contexts/ConversationContext';

export function DashboardHistory() {
  const { history, loadConversation, deleteConversation } = useConversation();
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink mb-1">Historique des conversations</h2>
        <p className="text-sm text-ink-muted">{history.length} conversation(s) enregistrée(s).</p>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-12 text-ink-mute-2">
          <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Aucune conversation.</p>
        </div>
      ) : (
        <div className="divide-y divide-line border border-line rounded-lg">
          {history.map((conv) => (
            <div key={conv.id} className="flex items-center justify-between p-3 hover:bg-bg">
              <button
                onClick={() => { loadConversation(conv); navigate('/'); }}
                className="flex-1 text-left"
              >
                <p className="text-sm font-medium text-ink truncate">{conv.title}</p>
                <p className="text-xs text-ink-muted mt-0.5">
                  {new Date(conv.timestamp).toLocaleString('fr-FR')}
                  {conv.products.length > 0 && ` · ${conv.products.length} produit(s)`}
                </p>
              </button>
              <button
                onClick={() => deleteConversation(conv.id)}
                className="p-2 text-ink-mute-2 hover:text-err-fg hover:bg-err-bg rounded"
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
