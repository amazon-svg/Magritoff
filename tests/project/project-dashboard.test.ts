import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildProjectDashboardModel } from '../../scripts/project/project-dashboard-data.mjs';
import { renderProjectDashboard } from '../../scripts/project/project-dashboard-template.mjs';

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'magrit-dashboard-'));
  for (const directory of [
    'project/backlog/epics',
    'project/backlog/features',
    'project/backlog/stories',
    'project/decisions/product',
    'project/decisions/architecture',
    'project/meetings/2026',
    'project/meetings/reports',
  ]) await mkdir(path.join(root, directory), { recursive: true });

  await writeFile(path.join(root, 'project/backlog/epics/EPIC-1.md'), `---
id: EPIC-1
title: "Epic pilote"
specStatus: draft
---
# Epic pilote
## Résultat attendu
Rendre le projet visible.
`);
  await writeFile(path.join(root, 'project/backlog/features/FEAT-1.md'), `---
id: FEAT-1
title: "Pilotage"
epic: EPIC-1
specStatus: draft
---
# Pilotage
`);
  await writeFile(path.join(root, 'project/backlog/stories/US-1.md'), `---
id: US-1
title: "Afficher le Kanban"
epic: EPIC-1
feature: FEAT-1
specStatus: contradictory
deliveryStatus: in-progress
dependencies: []
---
# Afficher le Kanban
## Valeur métier
Comprendre immédiatement ce qui avance.
`);
  await writeFile(path.join(root, 'project/decisions/product/PD-1.md'), `---
id: PD-1
title: "Décision pilote"
date: 2026-10-05
documentStatus: draft
decisionStatus: adopted
---
# Décision pilote
## Décision
Le Kanban est généré depuis Git.
`);
  await writeFile(path.join(root, 'project/decisions/open-questions.md'), `# Questions ouvertes

| ID | Question | Source | Responsable | Échéance | État |
|---|---|---|---|---|---|
| OQ-1 | Quelle vue afficher ? | Atelier | Xavier | à fixer | ouverte |
`);
  await writeFile(path.join(root, 'project/meetings/reports/2026-10-05-rapport-pilote.md'), `---
id: REPORT-2026-10-05-PILOTE
title: "Rapport pilote"
date: 2026-10-05
---
# Rapport pilote
`);
  await writeFile(path.join(root, 'project/meetings/tracking.yaml'), `version: 1
documents:
  - id: REPORT-2026-10-05-PILOTE
    kind: report
    path: project/meetings/reports/2026-10-05-rapport-pilote.md
    processingStatus: review
    owner: Xavier
    reviewedAt: null
    openItems:
      - "Reporter la décision pilote"
`);
  return root;
}

describe('tableau de bord projet', () => {
  it('charge le backlog, les décisions et les questions ouvertes', async () => {
    const model = await buildProjectDashboardModel(await fixture());
    expect(model.metrics).toMatchObject({
      epics: 1,
      features: 1,
      stories: 1,
      openQuestions: 1,
      contradictory: 1,
      documentsToProcess: 1,
    });
    expect(model.stories[0]).toMatchObject({ id: 'US-1', deliveryStatus: 'in-progress' });
    expect(model.decisions[0]).toMatchObject({ id: 'PD-1', decisionStatus: 'adopted' });
    expect(model.meetingDocuments[0]).toMatchObject({ id: 'REPORT-2026-10-05-PILOTE', processingStatus: 'review' });
  });

  it('génère un document HTML autonome avec les cinq vues', async () => {
    const html = renderProjectDashboard(await buildProjectDashboardModel(await fixture()));
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Pilotage du projet Magrit');
    expect(html).toContain('data-view="kanban"');
    expect(html).toContain('data-view="hierarchy"');
    expect(html).toContain('data-view="decisions"');
    expect(html).toContain('data-view="meetings"');
    expect(html).toContain('Afficher le Kanban');
    expect(html).not.toContain('https://cdn.');
  });

  it('neutralise une fermeture de balise script dans les données', () => {
    const html = renderProjectDashboard({
      repository: 'owner/repo', reference: 'main', epics: [], features: [],
      stories: [{ title: '</script><script>alert(1)</script>' }], openQuestions: [], decisions: [], meetingDocuments: [],
      metrics: { epics: 0, features: 0, stories: 1, openQuestions: 0, contradictory: 0, blocked: 0, documentsToProcess: 0, meetingStatuses: {}, specStatuses: {}, deliveryStatuses: {}, decisionStatuses: {} },
    });
    expect(html).not.toContain('</script><script>alert(1)</script>');
  });
});
