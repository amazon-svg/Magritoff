import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  INITIAL_CONFIGURATOR_WORKSPACE_STATE,
  configuratorWorkspaceReducer,
} from '@/modules/catalog/ui/workspace/configurator-workspace-state';

const request = {
  id: 'request-1',
  query: '500 flyers A5',
  submittedAt: '2026-09-01T10:00:00.000Z',
} as const;

describe('workspace configurateur', () => {
  it('affiche les éléments du projet courant et crée le devis via le client métier', () => {
    const homeSource = readFileSync(
      resolve(process.cwd(), 'src/modules/catalog/ui/workspace/MagritConfiguratorHome.tsx'),
      'utf8',
    );
    const drawerSource = readFileSync(
      resolve(process.cwd(), 'src/modules/catalog/ui/workspace/ActiveProjectItemsDrawer.tsx'),
      'utf8',
    );
    const workspaceSource = readFileSync(
      resolve(process.cwd(), 'src/modules/catalog/ui/workspace/ConfiguratorWorkspace.tsx'),
      'utf8',
    );
    const studioSource = readFileSync(
      resolve(process.cwd(), 'src/modules/catalog/ui/workspace/DualToolWorkspace.tsx'),
      'utf8',
    );

    expect(homeSource).toContain('Éléments du projet');
    expect(studioSource).toContain('Éléments du projet');
    expect(studioSource).toContain('<ActiveProjectItemsDrawer');
    expect(workspaceSource).toContain('selectedProjectId={state.projectId}');
    expect(drawerSource).toContain('projectsApi.getForEdit(projectId)');
    expect(drawerSource).toContain('quotesApi.createFromProject');
    expect(drawerSource).toContain('item_ids: selectedItems.map');
    expect(drawerSource).toContain('projectsApi.updateItem');
    expect(drawerSource).toContain('projectsApi.getItemForEdit');
    expect(drawerSource).toContain('projectsApi.removeItem');
    expect(drawerSource).toContain('projectsApi.update(projectId, { name }');
    expect(drawerSource).toContain('Supprimer cet élément du projet ?');
    expect(drawerSource).not.toContain("action: 'CallAI'");
  });

  it('ouvre HopeStudio sur toute la surface sans panneau PIM', () => {
    const state = configuratorWorkspaceReducer(INITIAL_CONFIGURATOR_WORKSPACE_STATE, {
      type: 'submit',
      request,
    });

    expect(state).toMatchObject({ mode: 'studio', initialRequest: request });
    expect(state).not.toHaveProperty('pimQuery');
  });

  it('conserve le projet courant au lancement de HopeStudio', () => {
    const selected = configuratorWorkspaceReducer(INITIAL_CONFIGURATOR_WORKSPACE_STATE, {
      type: 'select-project',
      projectId: 'project-1',
      customerName: 'Imprimerie Test',
      projectName: 'Catalogue automne',
      hopstudioSessionId: null,
    });
    const studio = configuratorWorkspaceReducer(selected, { type: 'submit', request });

    expect(studio).toMatchObject({
      mode: 'studio',
      projectId: 'project-1',
      projectName: 'Catalogue automne',
      hopstudioSessionId: null,
    });
  });

  it('ouvre directement HopeStudio quand le projet possède déjà une session', () => {
    const selected = configuratorWorkspaceReducer(INITIAL_CONFIGURATOR_WORKSPACE_STATE, {
      type: 'select-project',
      projectId: 'project-2',
      customerName: 'Client historique',
      projectName: 'Projet existant',
      hopstudioSessionId: 'session-existante',
    });

    expect(selected).toMatchObject({
      mode: 'studio',
      initialRequest: { query: '' },
      projectId: 'project-2',
      hopstudioSessionId: 'session-existante',
    });
  });

  it('conserve le nouveau nom du projet dans le contexte actif', () => {
    const selected = configuratorWorkspaceReducer(INITIAL_CONFIGURATOR_WORKSPACE_STATE, {
      type: 'select-project',
      projectId: 'project-3',
      customerName: 'Client',
      projectName: 'Ancien nom',
      hopstudioSessionId: null,
    });

    expect(configuratorWorkspaceReducer(selected, {
      type: 'rename-project',
      projectName: 'Nouveau nom',
    })).toMatchObject({ projectId: 'project-3', projectName: 'Nouveau nom' });
  });
});
