import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Eye, FileArchive, FileImage, FileText, Loader2, Paperclip, Upload } from 'lucide-react';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog';
import {
  CommercialLineFilesApiClient,
  type CommercialLineFileDto,
  type CommercialLineType,
} from '../index';
import type { CommercialFileKind, CommercialFileVisibility } from '@/modules/projects';

const KIND_LABELS: Readonly<Record<CommercialFileKind, string>> = {
  supplier_quote: 'Devis fournisseur',
  cutting_template: 'Gabarit de découpe',
  folding_template: 'Gabarit de pliage',
  technical_template: 'Gabarit technique',
  artwork: 'Fichier graphique',
  proof: 'Bon à tirer',
  other: 'Autre',
};

export function CommercialLineFilesButton({
  lineType,
  lineId,
  lineLabel,
}: Readonly<{
  lineType: CommercialLineType;
  lineId: string;
  lineLabel: string;
}>) {
  const api = useWorkspaceApi(CommercialLineFilesApiClient);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<readonly CommercialLineFileDto[]>([]);
  const [kind, setKind] = useState<CommercialFileKind>('other');
  const [visibility, setVisibility] = useState<CommercialFileVisibility>('internal');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyFileId, setBusyFileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setFiles(await api.list(lineType, lineId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chargement des fichiers impossible.');
    } finally {
      setLoading(false);
    }
  }, [api, lineId, lineType]);

  useEffect(() => {
    if (open) void load();
  }, [load, open]);

  const openFile = async (file: CommercialLineFileDto, download: boolean) => {
    setBusyFileId(file.id);
    setError(null);
    try {
      const detail = await api.getForRead(lineType, lineId, file.id);
      window.open(download ? detail.download_url : detail.preview_url, '_blank', 'noopener,noreferrer');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Ouverture du fichier impossible.');
    } finally {
      setBusyFileId(null);
    }
  };

  const uploadFile = async (file: File) => {
    if (file.size === 0 || file.size > 15_000_000) {
      setError('Le fichier doit peser entre 1 octet et 15 Mo.');
      return;
    }
    const contentType = resolveContentType(file);
    if (!contentType) {
      setError('Format accepté : PDF, ZIP, EPS/PS, JPG, PNG, TIFF ou SVG.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      await api.upload(lineType, lineId, {
        kind,
        visibility,
        filename: file.name,
        content_type: contentType,
        data_base64: await fileToBase64(file),
      });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Ajout du fichier impossible.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-line-2 px-2 py-1 text-xs text-ink-2 hover:bg-bg hover:text-ink"
          title={`Gérer les fichiers de ${lineLabel}`}
        >
          <Paperclip className="size-3.5" />
          Fichiers
          {files.length > 0 && <span className="rounded-full bg-brand/10 px-1.5 text-brand">{files.length}</span>}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Fichiers de la ligne</DialogTitle>
          <DialogDescription>{lineLabel}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 rounded-xl border border-line bg-bg/50 p-3 sm:flex-row sm:items-center">
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as CommercialFileKind)}
            disabled={uploading}
            className="rounded-lg border border-line-2 bg-paper px-3 py-2 text-sm text-ink"
            aria-label="Type du fichier"
          >
            {Object.entries(KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as CommercialFileVisibility)}
            disabled={uploading}
            className="rounded-lg border border-line-2 bg-paper px-3 py-2 text-sm text-ink"
            aria-label="Visibilité du fichier"
          >
            <option value="internal">Interne uniquement</option>
            <option value="customer">Accessible au client</option>
          </select>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".pdf,.zip,.eps,.ps,.jpg,.jpeg,.png,.tif,.tiff,.svg"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadFile(file);
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-ink disabled:opacity-50"
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {uploading ? 'Ajout…' : 'Ajouter un fichier'}
          </button>
        </div>

        {error && <p role="alert" className="rounded-lg bg-err-bg px-3 py-2 text-sm text-err-fg">{error}</p>}

        <div className="max-h-80 overflow-y-auto rounded-xl border border-line">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-ink-muted"><Loader2 className="size-4 animate-spin" />Chargement…</div>
          ) : files.length === 0 ? (
            <p className="p-8 text-center text-sm text-ink-muted">Aucun fichier associé à cette ligne.</p>
          ) : (
            <ul className="divide-y divide-line">
              {files.map((file) => (
                <li key={file.id} className="flex items-center gap-3 p-3">
                  <FileKindIcon contentType={file.content_type} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink" title={file.filename}>{file.filename}</p>
                    <p className="text-xs text-ink-muted">
                      {KIND_LABELS[file.kind]} · {file.visibility === 'customer' ? 'Client' : 'Interne'} · {formatSize(file.byte_size)}
                    </p>
                  </div>
                  {canPreview(file.content_type) && (
                    <button type="button" disabled={busyFileId === file.id} onClick={() => void openFile(file, false)} className="rounded-md p-2 text-ink-2 hover:bg-bg" aria-label={`Visualiser ${file.filename}`} title="Visualiser">
                      {busyFileId === file.id ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
                    </button>
                  )}
                  <button type="button" disabled={busyFileId === file.id} onClick={() => void openFile(file, true)} className="rounded-md p-2 text-ink-2 hover:bg-bg" aria-label={`Télécharger ${file.filename}`} title="Télécharger">
                    <Download className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FileKindIcon({ contentType }: Readonly<{ contentType: string }>) {
  if (contentType.startsWith('image/')) return <FileImage className="size-5 shrink-0 text-brand" />;
  if (contentType.includes('zip')) return <FileArchive className="size-5 shrink-0 text-brand" />;
  return <FileText className="size-5 shrink-0 text-brand" />;
}

function resolveContentType(file: File): 'application/pdf' | 'application/zip' | 'application/x-zip-compressed' | 'application/postscript' | 'image/jpeg' | 'image/png' | 'image/tiff' | 'image/svg+xml' | null {
  const supported = ['application/pdf', 'application/zip', 'application/x-zip-compressed', 'application/postscript', 'image/jpeg', 'image/png', 'image/tiff', 'image/svg+xml'] as const;
  if ((supported as readonly string[]).includes(file.type)) return file.type as typeof supported[number];
  const extension = file.name.split('.').pop()?.toLowerCase();
  const byExtension: Readonly<Record<string, typeof supported[number]>> = {
    pdf: 'application/pdf', zip: 'application/zip', eps: 'application/postscript', ps: 'application/postscript',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', tif: 'image/tiff', tiff: 'image/tiff', svg: 'image/svg+xml',
  };
  return extension ? byExtension[extension] ?? null : null;
}

function canPreview(contentType: string): boolean {
  // Un SVG peut contenir du contenu actif : il reste téléchargeable, mais
  // n'est jamais ouvert en aperçu inline par Magrit.
  return contentType === 'application/pdf'
    || (contentType.startsWith('image/') && contentType !== 'image/svg+xml');
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.onload = () => {
      const value = typeof reader.result === 'string' ? reader.result : '';
      const separator = value.indexOf(',');
      if (separator < 0) reject(new Error('Encodage du fichier impossible.'));
      else resolve(value.slice(separator + 1));
    };
    reader.readAsDataURL(file);
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1_000) return `${bytes} o`;
  if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(1)} Ko`;
  return `${(bytes / 1_000_000).toFixed(1)} Mo`;
}
