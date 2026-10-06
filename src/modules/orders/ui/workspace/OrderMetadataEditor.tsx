import { useState } from 'react';
import { OrdersApiClient } from '@/modules/orders/api/client';
import type { UnifiedOrderDetail } from '@/modules/orders/api/contracts';
import { useUserCapability } from '@/modules/roles/ui/hooks';
import { useTenant } from '@/modules/tenants/ui/runtime';

export function OrderMetadataEditor({
  order,
  etag,
  api,
  onSaved,
}: {
  order: UnifiedOrderDetail;
  etag: string | null;
  api: OrdersApiClient;
  onSaved: (result: Awaited<ReturnType<OrdersApiClient['updateMetadata']>>) => void;
}) {
  const { currentTenant } = useTenant();
  const { hasIt: canModify } = useUserCapability('can_modify');
  const [editing, setEditing] = useState(false);
  const [reference, setReference] = useState(order.customer_reference ?? '');
  const [notes, setNotes] = useState(order.notes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allowed = canModify || currentTenant?.myRole === 'admin';

  const save = async () => {
    if (!etag || saving) return;
    setSaving(true);
    setError(null);
    try {
      const result = await api.updateMetadata(order.id, {
        customer_reference: reference.trim() || null,
        notes,
      }, etag);
      onSaved(result);
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-line p-4" aria-label="Informations modifiables de la commande">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">Informations de suivi</h2>
          <p className="mt-1 text-xs text-ink-muted">Les lignes, quantités et prix restent en lecture seule.</p>
        </div>
        {allowed && !editing && (
          <button type="button" onClick={() => setEditing(true)} className="rounded border border-line bg-paper px-3 py-2 text-sm text-ink hover:border-brand">
            Modifier
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-4 space-y-4">
          <label className="block text-sm text-ink">
            Référence client
            <input
              value={reference}
              maxLength={500}
              onChange={(event) => setReference(event.target.value)}
              className="mt-1 block w-full rounded border border-line bg-paper px-3 py-2"
              placeholder="Non renseignée"
            />
          </label>
          <label className="block text-sm text-ink">
            Notes
            <textarea
              value={notes}
              maxLength={5000}
              rows={4}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-1 block w-full resize-y rounded border border-line bg-paper px-3 py-2"
              placeholder="Aucune note"
            />
          </label>
          {error && <p className="text-sm text-err-fg">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={saving || !etag} onClick={() => void save()} className="rounded bg-brand px-3 py-2 text-sm text-white disabled:opacity-50">
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button type="button" disabled={saving} onClick={() => {
              setReference(order.customer_reference ?? '');
              setNotes(order.notes);
              setError(null);
              setEditing(false);
            }} className="rounded border border-line bg-paper px-3 py-2 text-sm text-ink">
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div><dt className="text-xs uppercase tracking-wider text-ink-muted">Référence client</dt><dd className="mt-1 text-sm text-ink">{order.customer_reference ?? 'Non renseignée'}</dd></div>
          <div><dt className="text-xs uppercase tracking-wider text-ink-muted">Notes</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-ink">{order.notes.trim() || 'Aucune note.'}</dd></div>
        </dl>
      )}
    </section>
  );
}
