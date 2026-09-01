/**
 * ProjectTagsEditor — champ de saisie + autocompletion + badges de tags
 * (E10.2, CA1, CA2, CA5, CA6), pose dans l en-tete de ProjectDetailPage.
 *
 * Se cree a la volee (CA2) : si le libelle saisi ne correspond a aucun tag
 * existant du tenant, valider (Entree) le CREE puis l attache au projet.
 * Retirer un tag du projet (bouton sur le badge) ne le supprime jamais du
 * tenant (CA5) — seul le lien au projet change.
 */
import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { ProjectTagDto } from '@/modules/project-tags';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { projectTagColorClassName } from '../helpers/tagColors';

const inputCls =
  'w-full px-3 py-1.5 border border-line-2 rounded-lg bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand';

export type ProjectTagsEditorProps = Readonly<{
  tags: readonly ProjectTagDto[];
  allTags: readonly ProjectTagDto[];
  onCreateOrGet: (label: string) => Promise<ProjectTagDto>;
  /** Le resultat n est pas exploite ici : `useProjectDetail` relit deja la ressource apres ecriture. */
  onChange: (tagIds: readonly string[]) => Promise<unknown>;
}>;

export function ProjectTagsEditor({ tags, allTags, onCreateOrGet, onChange }: ProjectTagsEditorProps) {
  const [inputValue, setInputValue] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [busy, setBusy] = useState(false);

  const assignedIds = useMemo(() => new Set(tags.map((tag) => tag.id)), [tags]);
  const options = useMemo(() => {
    const needle = inputValue.trim().toLowerCase();
    return allTags
      .filter((tag) => !assignedIds.has(tag.id))
      .filter((tag) => needle.length === 0 || tag.label.toLowerCase().includes(needle));
  }, [allTags, assignedIds, inputValue]);

  const commit = async (nextTagIds: readonly string[]) => {
    setBusy(true);
    try {
      await onChange(nextTagIds);
    } finally {
      setBusy(false);
    }
  };

  const addTag = async (tag: ProjectTagDto) => {
    setInputValue('');
    setShowOptions(false);
    await commit([...tags.map((t) => t.id), tag.id]);
  };

  const removeTag = async (tagId: string) => {
    await commit(tags.filter((t) => t.id !== tagId).map((t) => t.id));
  };

  const submitFreeText = async () => {
    const label = inputValue.trim();
    if (!label) return;
    const exactMatch = allTags.find((tag) => tag.label.trim().toLowerCase() === label.toLowerCase());
    const tag = exactMatch ?? (await onCreateOrGet(label));
    await addTag(tag);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag.id}
          data-testid={TEST_IDS.project.tagBadge}
          data-tag-id={tag.id}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs ${projectTagColorClassName(tag.color)}`}
        >
          {tag.label}
          <button
            type="button"
            onClick={() => void removeTag(tag.id)}
            disabled={busy}
            className="hover:opacity-70"
            aria-label={`Retirer le tag ${tag.label}`}
            data-testid={TEST_IDS.project.tagRemoveBtn}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          disabled={busy}
          onChange={(event) => {
            setInputValue(event.target.value);
            setShowOptions(true);
          }}
          onFocus={() => setShowOptions(true)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void submitFreeText();
            }
          }}
          placeholder="Ajouter un tag…"
          className={inputCls}
          style={{ minWidth: 140 }}
          data-testid={TEST_IDS.project.tagInput}
        />
        {showOptions && inputValue.trim().length > 0 && (
          <div className="absolute left-0 mt-1 w-48 bg-paper border border-line rounded-lg shadow-lg z-10 max-h-48 overflow-auto">
            {options.map((tag) => (
              <button
                key={tag.id}
                type="button"
                data-testid={TEST_IDS.project.tagOption}
                data-tag-id={tag.id}
                onClick={() => void addTag(tag)}
                className="w-full text-left px-2 py-1.5 text-sm hover:bg-bg flex items-center gap-2"
              >
                <span className={`px-1.5 py-0.5 rounded border text-xs ${projectTagColorClassName(tag.color)}`}>
                  {tag.label}
                </span>
              </button>
            ))}
            {!options.some((tag) => tag.label.trim().toLowerCase() === inputValue.trim().toLowerCase()) && (
              <button
                type="button"
                onClick={() => void submitFreeText()}
                className="w-full text-left px-2 py-1.5 text-sm hover:bg-bg text-ink-muted"
              >
                Créer « {inputValue.trim()} »
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
