import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { ProjectsApiClient } from '@/modules/projects/api/client';
import type { CreateProjectCommand, ProjectDto, ProjectStatus } from '@/modules/projects/api/contracts';

export function projectsManagementError(
  cause: unknown,
  fallback = 'Opération sur les projets impossible.',
): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

/**
 * Liste + recherche des projets du tenant courant (CA2), triee par date de
 * derniere modification decroissante (deja garanti par l API). Le tenant est
 * resolu par la facade depuis le jeton (CA4 du socle E10.0) : ce hook ne le
 * transmet jamais dans un chemin ni une query, `useWorkspaceApi` porte deja
 * l authentification.
 */
export function useProjectsManagement(enabled: boolean) {
  const api = useWorkspaceApi(ProjectsApiClient);
  const requestVersion = useRef(0);
  const [items, setItems] = useState<readonly ProjectDto[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<ProjectStatus | null>(null);
  /** Filtre multi-tags en ET logique (CA4, E10.2). */
  const [tagIds, setTagIds] = useState<readonly string[]>([]);

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!enabled) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await api.list({
        ...(q ? { q } : {}),
        ...(status ? { status } : {}),
        ...(tagIds.length > 0 ? { tagIds } : {}),
      });
      if (version === requestVersion.current) setItems(response.items);
    } catch (cause) {
      if (version === requestVersion.current) {
        setError(projectsManagementError(cause, 'Chargement des projets impossible.'));
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [api, enabled, q, status, tagIds]);

  useEffect(() => {
    void load();
    return () => {
      requestVersion.current += 1;
    };
  }, [load]);

  const create = useCallback(
    async (command: CreateProjectCommand): Promise<ProjectDto> => {
      const created = await api.create(command);
      await load();
      return created;
    },
    [api, load],
  );

  return {
    items,
    loading,
    error,
    q,
    setQ,
    status,
    setStatus,
    tagIds,
    setTagIds,
    refresh: load,
    create,
  } as const;
}
