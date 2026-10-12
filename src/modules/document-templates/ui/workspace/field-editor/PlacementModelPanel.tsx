import { useEffect, useState } from 'react';
import type { DocumentTemplatesApiClient } from '@/modules/document-templates/api/client';
import type { DocumentPdfTemplateDetailDto, DocumentPdfTemplateDto, ReplaceDocumentPdfTemplateFieldsCommand } from '@/modules/document-templates/api/contracts';
import { validateDocumentFieldMap } from '@/modules/document-templates/application/document-field-map-validator';
import { basePlacementModel, placementPagesMatch } from './placement-model';

type Props = Readonly<{
  api: DocumentTemplatesApiClient;
  template: DocumentPdfTemplateDetailDto;
  hasPlacements: boolean;
  onApply(map: ReplaceDocumentPdfTemplateFieldsCommand): void;
  onClose(): void;
}>;

export function PlacementModelPanel({ api, template, hasPlacements, onApply, onClose }: Props) {
  const [templates, setTemplates] = useState<readonly DocumentPdfTemplateDto[]>([]);
  const [source, setSource] = useState('base');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void api.list({ documentType: template.document_type, status: 'ready' }).then(items => {
      if (!cancelled) setTemplates(items.filter(item => item.id !== template.id && item.document_type === template.document_type && item.status === 'ready'));
    }).catch(cause => {
      if (!cancelled) setListError(cause instanceof Error ? cause.message : 'Lecture des gabarits impossible.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [api, template.id, template.document_type]);

  async function apply(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      let map: ReplaceDocumentPdfTemplateFieldsCommand;
      if (source === 'base') {
        const page = template.pages[0];
        if (!page) throw new Error('Ce gabarit ne contient aucune page.');
        map = basePlacementModel(page, template.document_type);
      } else {
        const detail = await api.getForEdit(source);
        if (detail.data.document_type !== template.document_type || detail.data.status !== 'ready') throw new Error('Choisissez un gabarit prêt du même type de document.');
        const result = await api.getFields(source);
        map = { placements: result.data.placements, lines_block: result.data.lines_block };
        if (!map.placements.length && !map.lines_block) throw new Error('Ce gabarit ne contient aucun positionnement à copier.');
        if (!placementPagesMatch(detail.data.pages, template.pages, map)) throw new Error('Les pages utilisées doivent avoir les mêmes dimensions et exister dans les deux gabarits pour copier leurs positions.');
      }
      const errors = validateDocumentFieldMap(template.pages, map, template.document_type);
      if (errors.length) throw new Error(errors.map(item => item.message).join(' '));
      onApply(structuredClone(map));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Copie du positionnement impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Modèle de positionnement" className="border-b border-line-2 bg-paper px-4 py-3 space-y-2">
      <div className="flex gap-3 items-end flex-wrap">
        <div className="space-y-1">
          <label htmlFor="placement-model-source" className="block text-sm font-medium text-ink">Positionnement à copier</label>
          <select id="placement-model-source" value={source} disabled={busy} onChange={event => { setSource(event.target.value); setError(null); }} className="border border-line-2 rounded-lg px-3 py-2 bg-paper text-ink text-sm">
            <option value="base">Modèle de base — {template.document_type === 'order' ? 'bon de commande' : 'devis'}</option>
            {templates.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <button type="button" disabled={busy || (loading && source !== 'base')} onClick={() => void apply()} className="px-3 py-2 bg-brand text-brand-ink rounded-lg text-sm disabled:opacity-50">
          {busy ? 'Copie…' : hasPlacements ? 'Remplacer les placements actuels' : 'Appliquer ce positionnement'}
        </button>
        <button type="button" disabled={busy} onClick={onClose} className="px-3 py-2 text-ink-2 text-sm">Annuler</button>
      </div>
      <p className="text-xs text-ink-muted">Le modèle de base place le numéro, la date, la référence client, les coordonnées client, le tableau et les totaux sur la première page. Adaptez les positions à votre fond PDF, vérifiez l’aperçu, puis cliquez sur Enregistrer.</p>
      {hasPlacements && <p className="text-xs text-ink-2">Les champs et le tableau actuels seront remplacés. Le fond PDF est conservé.</p>}
      {loading && <p className="text-xs text-ink-muted">Recherche des autres gabarits…</p>}
      {listError && <p role="alert" className="text-xs text-err-fg">{listError} Le modèle de base reste disponible.</p>}
      {error && <p role="alert" className="text-sm text-err-fg">{error}</p>}
    </section>
  );
}
