import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildSyncPlan,
  loadBacklog,
  renderDraftBody,
  summarizePlan,
} from '../../scripts/project/github-project-sync-lib.mjs';

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'magrit-project-sync-'));
  for (const directory of ['epics', 'features', 'stories']) {
    await mkdir(path.join(root, 'project', 'backlog', directory), { recursive: true });
  }
  await writeFile(
    path.join(root, 'project', 'backlog', 'stories', 'US-1.md'),
    `---
id: US-1
title: Première story
epic: EPIC-1
feature: FEAT-1
specStatus: draft
deliveryStatus: in-progress
---

# Première story

## Besoin utilisateur

Afficher une information utile.
`,
  );
  return root;
}

test('charge les artefacts Markdown du backlog', async () => {
  const root = await fixture();
  const documents = await loadBacklog(root);
  assert.equal(documents.length, 1);
  assert.deepEqual(
    {
      id: documents[0].id,
      type: documents[0].type,
      epic: documents[0].epic,
      feature: documents[0].feature,
    },
    { id: 'US-1', type: 'Story', epic: 'EPIC-1', feature: 'FEAT-1' },
  );
});

test('génère un corps qui rappelle que Git reste canonique', async () => {
  const [document] = await loadBacklog(await fixture());
  const body = renderDraftBody(document, 'amazon-svg/Magritoff');
  assert.match(body, /magrit-backlog-id: US-1/);
  assert.match(body, /Ne pas modifier ici/);
  assert.match(body, /blob\/main\/project\/backlog\/stories\/US-1.md/);
});

test('planifie création, mise à jour, absence de changement et élément distant obsolète', async () => {
  const [document] = await loadBacklog(await fixture());
  const exactBody = renderDraftBody(document, 'amazon-svg/Magritoff');
  const fields = {
    'Backlog ID': 'US-1',
    Type: 'Story',
    'Spec Status': 'draft',
    'Delivery Status': 'in-progress',
    Epic: 'EPIC-1',
    Feature: 'FEAT-1',
    'Source Path': 'project/backlog/stories/US-1.md',
  };
  const noop = buildSyncPlan(
    [document],
    [{ backlogId: 'US-1', title: '[US-1] Première story', body: exactBody, fields }],
    'amazon-svg/Magritoff',
  );
  assert.deepEqual(summarizePlan(noop), { create: 0, update: 0, noop: 1, stale: 0 });

  const update = buildSyncPlan(
    [document],
    [
      { backlogId: 'US-1', title: 'Ancien titre', body: exactBody, fields },
      { backlogId: 'OLD-1', title: 'Ancien', body: '', fields: {} },
    ],
    'amazon-svg/Magritoff',
  );
  assert.deepEqual(summarizePlan(update), { create: 0, update: 1, noop: 0, stale: 1 });

  const create = buildSyncPlan([document], [], 'amazon-svg/Magritoff');
  assert.deepEqual(summarizePlan(create), { create: 1, update: 0, noop: 0, stale: 0 });
});
