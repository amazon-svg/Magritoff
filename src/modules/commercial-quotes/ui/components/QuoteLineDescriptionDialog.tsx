import { useEffect, useRef, useState } from 'react';
import { Bold, Italic, List, ListOrdered, RemoveFormatting } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import {
  DESCRIPTION_HTML_MAX_LENGTH,
  safeDescriptionHtmlSchema,
} from '@/shared/validation/safe-description-html';

type EditorCommand = 'bold' | 'italic' | 'insertUnorderedList' | 'insertOrderedList' | 'removeFormat';

export function QuoteLineDescriptionDialog({
  open,
  label,
  initialHtml,
  saving,
  onOpenChange,
  onSave,
}: Readonly<{
  open: boolean;
  label: string;
  initialHtml: string | null;
  saving: boolean;
  onOpenChange(open: boolean): void;
  onSave(html: string | null): Promise<boolean>;
}>) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [length, setLength] = useState(initialHtml?.length ?? 0);

  useEffect(() => {
    if (!open || !editorRef.current) return;
    editorRef.current.innerHTML = initialHtml ?? '';
    setLength(initialHtml?.length ?? 0);
    setError(null);
  }, [initialHtml, open]);

  const applyCommand = (command: EditorCommand) => {
    editorRef.current?.focus();
    document.execCommand(command, false);
  };

  const save = async () => {
    const editor = editorRef.current;
    if (!editor) return;
    const html = sanitizeEditorHtml(editor.innerHTML, editor.ownerDocument);
    const value = editor.textContent?.trim() ? html : null;
    const parsed = safeDescriptionHtmlSchema.nullable().safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Le détail est invalide.');
      return;
    }
    if (await onSave(parsed.data)) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Modifier le détail de la ligne</DialogTitle>
          <DialogDescription>{label}</DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-xl border border-line-2 bg-paper">
          <div className="flex flex-wrap items-center gap-1 border-b border-line bg-bg/70 p-2" role="toolbar" aria-label="Mise en forme du détail">
            <ToolbarButton label="Gras" onClick={() => applyCommand('bold')}><Bold className="size-4" /></ToolbarButton>
            <ToolbarButton label="Italique" onClick={() => applyCommand('italic')}><Italic className="size-4" /></ToolbarButton>
            <span className="mx-1 h-5 w-px bg-line-2" aria-hidden="true" />
            <ToolbarButton label="Liste à puces" onClick={() => applyCommand('insertUnorderedList')}><List className="size-4" /></ToolbarButton>
            <ToolbarButton label="Liste numérotée" onClick={() => applyCommand('insertOrderedList')}><ListOrdered className="size-4" /></ToolbarButton>
            <span className="mx-1 h-5 w-px bg-line-2" aria-hidden="true" />
            <ToolbarButton label="Effacer la mise en forme" onClick={() => applyCommand('removeFormat')}><RemoveFormatting className="size-4" /></ToolbarButton>
          </div>
          <div
            ref={editorRef}
            contentEditable={!saving}
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label="Détail commercial de la ligne"
            data-placeholder="Décrivez le produit, ses options et les conditions utiles au client…"
            onInput={(event) => setLength(event.currentTarget.innerHTML.length)}
            onPaste={(event) => {
              event.preventDefault();
              document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
            }}
            className="prose prose-sm min-h-52 max-w-none px-4 py-3 text-ink outline-none empty:before:pointer-events-none empty:before:text-ink-muted empty:before:content-[attr(data-placeholder)]"
          />
        </div>

        <div className="flex items-start justify-between gap-3 text-xs text-ink-muted">
          <p>Texte, gras, italique et listes uniquement. Le rendu affiché ici sera repris sur le devis.</p>
          <span className={length > DESCRIPTION_HTML_MAX_LENGTH ? 'font-semibold text-err-fg' : ''}>
            {length.toLocaleString('fr-FR')} / {DESCRIPTION_HTML_MAX_LENGTH.toLocaleString('fr-FR')}
          </span>
        </div>
        {error && <p className="text-sm text-err-fg" role="alert">{error}</p>}

        <DialogFooter>
          <DialogClose asChild>
            <button type="button" disabled={saving} className="rounded-lg border border-line-2 px-4 py-2 text-sm text-ink hover:bg-bg disabled:opacity-50">
              Annuler
            </button>
          </DialogClose>
          <button type="button" disabled={saving || length > DESCRIPTION_HTML_MAX_LENGTH} onClick={() => void save()} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-ink hover:opacity-90 disabled:opacity-50">
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToolbarButton({
  label,
  onClick,
  children,
}: Readonly<{ label: string; onClick(): void; children: React.ReactNode }>) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="rounded-md p-2 text-ink-2 hover:bg-paper hover:text-ink"
    >
      {children}
    </button>
  );
}

/** Nettoie le HTML produit par contentEditable avant de l'envoyer à l'API. */
export function sanitizeEditorHtml(input: string, ownerDocument: Document): string {
  const source = ownerDocument.createElement('template');
  source.innerHTML = input;
  const output = ownerDocument.createElement('div');

  const clean = (node: Node): Node | null => {
    if (node.nodeType === 3) return ownerDocument.createTextNode(node.textContent ?? '');
    if (node.nodeType !== 1) return null;
    const element = node as HTMLElement;
    const sourceTag = element.tagName.toLowerCase();
    if (sourceTag === 'script' || sourceTag === 'style') return null;
    const mappedTag = sourceTag === 'b' ? 'strong' : sourceTag === 'i' ? 'em' : sourceTag === 'div' ? 'p' : sourceTag;
    const allowed = ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li'].includes(mappedTag);
    const target = allowed
      ? ownerDocument.createElement(mappedTag)
      : ownerDocument.createDocumentFragment();
    for (const child of [...node.childNodes]) {
      const cleaned = clean(child);
      if (cleaned) target.appendChild(cleaned);
    }
    return target;
  };

  for (const child of [...source.content.childNodes]) {
    const cleaned = clean(child);
    if (cleaned) output.appendChild(cleaned);
  }
  return output.innerHTML.trim();
}
