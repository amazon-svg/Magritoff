import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { syncMeetingTracking, validateMeetingTracking } from '../../scripts/project/meeting-tracking.mjs';

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'magrit-meetings-'));
  await mkdir(path.join(root, 'project/meetings/2026'), { recursive: true });
  await mkdir(path.join(root, 'project/meetings/reports'), { recursive: true });
  await writeFile(path.join(root, 'project/meetings/tracking.yaml'), 'version: 1\ndocuments: []\n');
  return root;
}

describe('registre des réunions', () => {
  it('enregistre un compte rendu sans modifier son contenu', async () => {
    const root = await fixture();
    const meetingPath = path.join(root, 'project/meetings/2026/2026-10-05-reunion.md');
    const content = '# Compte rendu reçu\n\nContenu original.\n';
    await writeFile(meetingPath, content);

    const result = await syncMeetingTracking(root);
    const tracking = YAML.parse(await readFile(path.join(root, 'project/meetings/tracking.yaml'), 'utf8'));

    expect(result.added).toBe(1);
    expect(await readFile(meetingPath, 'utf8')).toBe(content);
    expect(tracking.documents[0]).toMatchObject({
      kind: 'meeting',
      processingStatus: 'draft',
      contentHash: `sha256:${createHash('sha256').update(content).digest('hex')}`,
    });
    expect((await validateMeetingTracking(root)).errors).toEqual([]);
  });

  it('détecte la modification ultérieure d’un compte rendu', async () => {
    const root = await fixture();
    const meetingPath = path.join(root, 'project/meetings/2026/2026-10-05-reunion.md');
    await writeFile(meetingPath, '# Version initiale\n');
    await syncMeetingTracking(root);
    await writeFile(meetingPath, '# Version modifiée\n');

    expect((await validateMeetingTracking(root)).errors.join('\n')).toContain('compte rendu immuable a été modifié');
  });

  it('refuse de clore un report avec des points ouverts', async () => {
    const root = await fixture();
    await writeFile(path.join(root, 'project/meetings/reports/2026-10-05-rapport.md'), `---
id: REPORT-2026-10-05
title: Rapport
---
# Rapport
`);
    await syncMeetingTracking(root);
    const trackingPath = path.join(root, 'project/meetings/tracking.yaml');
    const tracking = YAML.parse(await readFile(trackingPath, 'utf8'));
    Object.assign(tracking.documents[0], {
      processingStatus: 'done',
      owner: 'Xavier',
      reviewedAt: '2026-10-05',
      openItems: ['Décision à reporter'],
    });
    await writeFile(trackingPath, YAML.stringify(tracking));

    expect((await validateMeetingTracking(root)).errors.join('\n')).toContain('ne peut pas conserver de point ouvert');
  });
});
