import { useCallback, useEffect, useState } from 'react';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { ProjectsApiClient } from '@/modules/projects/api/client';
import type {
  CreateProjectItemCommand,
  ProjectDetailDto,
  UpdateProjectCommand,
} from '@/modules/projects/api/contracts';
import { projectsManagementError } from './useProjectsManagement';

/**
 * Fiche projet detaillee (CA5, CA6) : nom, client, statut, elements de
 * chiffrage. Chaque mutation relit la ressource pour rester synchro avec l
 * `ETag` courant (CA9 du socle) — pas d etat optimiste local qui pourrait
 * diverger de la base.
 */
export function useProjectDetail(projectId: string | null) {
  const api = useWorkspaceApi(ProjectsApiClient);
  const [detail, setDetail] = useState<ProjectDetailDto | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(projectId));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) {
      setDetail(null);
      setEtag(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.getForEdit(projectId);
      setDetail(result.data);
      setEtag(result.etag);
    } catch (cause) {
      setError(projectsManagementError(cause, 'Chargement du projet impossible.'));
    } finally {
      setLoading(false);
    }
  }, [api, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = useCallback(
    async (command: UpdateProjectCommand) => {
      if (!projectId || !etag) throw new Error('Projet non chargé.');
      setError(null);
      try {
        const result = await api.update(projectId, command, etag);
        await load();
        return result.data;
      } catch (cause) {
        setError(projectsManagementError(cause, 'Modification du projet impossible.'));
        throw cause;
      }
    },
    [api, projectId, etag, load],
  );

  const addItem = useCallback(
    async (command: CreateProjectItemCommand) => {
      if (!projectId) throw new Error('Projet non chargé.');
      setError(null);
      try {
        const created = await api.addItem(projectId, command);
        await load();
        return created;
      } catch (cause) {
        setError(projectsManagementError(cause, 'Ajout de l’élément au projet impossible.'));
        throw cause;
      }
    },
    [api, projectId, load],
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      if (!projectId) throw new Error('Projet non chargé.');
      setError(null);
      try {
        await api.removeItem(projectId, itemId);
        await load();
      } catch (cause) {
        setError(projectsManagementError(cause, 'Retrait de l’élément impossible.'));
        throw cause;
      }
    },
    [api, projectId, load],
  );

  return {
    detail,
    etag,
    loading,
    error,
    refresh: load,
    update,
    addItem,
    removeItem,
  } as const;
}
