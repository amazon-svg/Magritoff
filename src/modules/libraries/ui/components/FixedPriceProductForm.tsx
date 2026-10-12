import { useState, type FormEvent } from 'react';
import { usePIM } from '@/modules/catalog/ui';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/shared/ui/dialog';
import { useLibrary } from '@/modules/libraries/ui/runtime';

export function FixedPriceProductForm({ libraryId, onClose }: { libraryId: string; onClose(): void }) {
  const { addProduct } = useLibrary();
  const { gammes } = usePIM();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categorySlug, setCategorySlug] = useState('');
  const [cost, setCost] = useState('');
  const [image, setImage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    const category = gammes.find((g) => g.slug === categorySlug);
    setBusy(true);
    setError('');
    try {
      const result = await addProduct({ library_id: libraryId, name: name.trim(),
        description, category: category?.name ?? '', gamme_slug: category?.slug ?? null,
        price_ht: Number(cost), image_url: image, active: true,
        config: { pricing_mode: 'fixed_unit' } });
      if (result) onClose();
      else setError('Le produit n’a pas pu être créé. Vérifiez les champs et réessayez.');
    } finally { setBusy(false); }
  }
  const field = 'w-full rounded-lg border border-line-2 bg-paper px-3 py-2 text-ink';
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-paper text-ink">
      <form onSubmit={submit} className="space-y-4">
        <DialogTitle>Ajouter un produit à prix fixe</DialogTitle>
        <DialogDescription className="text-ink-muted">Saisissez le coût d’une unité. La boutique affiche le prix de vente après application des règles de marge.</DialogDescription>
        <label className="block text-sm text-ink">Nom du produit<input className={field} required maxLength={300} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="block text-sm text-ink">Catégorie de produits<select className={field} value={categorySlug} onChange={(e) => setCategorySlug(e.target.value)}>
          <option value="">Sans catégorie</option>{gammes.map((g) => <option key={g.slug} value={g.slug}>{g.name}</option>)}
        </select></label>
        <label className="block text-sm text-ink">Coût unitaire HT (€)<input className={field} type="number" required min="0.01" max="9999999999.99" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} /></label>
        <label className="block text-sm text-ink">Description<textarea className={field} maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <label className="block text-sm text-ink">URL de l’image<input className={field} type="url" maxLength={4000} value={image} onChange={(e) => setImage(e.target.value)} /></label>
        {error && <p role="alert" className="text-sm text-err-fg">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-ink">Annuler</button>
          <button type="submit" disabled={busy} className="rounded-lg bg-ink px-4 py-2 text-paper disabled:opacity-50">{busy ? 'Création…' : 'Créer le produit'}</button>
        </div>
      </form>
      </DialogContent>
    </Dialog>
  );
}
