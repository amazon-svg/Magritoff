import { useCallback, useEffect, useState } from 'react';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { ProjectTagsApiClient, type ProjectTagDto } from '@/modules/project-tags';
import { projectsManagementError } from './useProjectsManagement';

/**
 * Catalogue des tags du tenant (E10.2, CA2, CA3) : source commune au champ
 * de saisie autocomplete (ProjectDetailPage) et au filtre multi-tags
 * (ProjectsPage). Le tenant est resolu par la facade depuis le jeton (CA4 du
 * socle E10.0) : ce hook ne le transmet jamais lui-meme.
 */
export function useProjectTagsCatalog(enabled: boolean) {
  const api = useWorkspaceApi(ProjectTagsApiClient);
  const [tags, setTags] = useState<readonly ProjectTagDto[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) {
      setTags([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.list();
      setTags(result);
    } catch (cause) {
      setError(projectsManagementError(cause, 'Chargement des tags impossible.'));
    } finally {
      setLoading(false);
    }
  }, [api, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Cree un tag a la volee (CA2) et le verse dans le catalogue local : si le
   * libelle normalise existait deja dans le tenant, l API rend l EXISTANT
   * (200) plutot qu un doublon — le catalogue ne grossit alors pas.
   */
  const createOrGet = useCallback(
    async (label: string): Promise<ProjectTagDto> => {
      const tag = await api.createOrGet({ label });
      setTags((current) => (current.some((existing) => existing.id === tag.id) ? current : [...current, tag]));
      return tag;
    },
    [api],
  );

  return { tags, loading, error, refresh: load, createOrGet } as const;
}
