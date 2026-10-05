import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { parseProjectFrontmatter } from './project-frontmatter.mjs';

export const PROCESSING_STATUSES = new Set(['draft', 'review', 'done']);
export const DOCUMENT_KINDS = new Set(['meeting', 'report']);

const TRACKING_PATH = 'project/meetings/tracking.yaml';

async function markdownFiles(directory, recursive = false) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (recursive && entry.isDirectory()) files.push(...await markdownFiles(absolute, true));
    if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md' && !entry.name.startsWith('_')) {
      files.push(absolute);
    }
  }
  return files.sort((left, right) => left.localeCompare(right, 'fr'));
}

function sha256(content) {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

function fallbackId(kind, relative) {
  const basename = path.basename(relative, '.md').toUpperCase().replace(/[^A-Z0-9]+/g, '-');
  return `${kind === 'meeting' ? 'MEET' : 'REPORT'}-${basename}`;
}

async function sourceDocuments(root) {
  const meetingsRoot = path.join(root, 'project', 'meetings');
  const reportRoot = path.join(meetingsRoot, 'reports');
  const meetingFiles = (await readdir(meetingsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && /^\d{4}$/.test(entry.name));
  const sources = [];

  for (const year of meetingFiles) {
    for (const absolute of await markdownFiles(path.join(meetingsRoot, year.name), true)) {
      sources.push(await describeSource(root, absolute, 'meeting'));
    }
  }
  for (const absolute of await markdownFiles(reportRoot)) {
    sources.push(await describeSource(root, absolute, 'report'));
  }
  return sources.sort((left, right) => left.path.localeCompare(right.path, 'fr'));
}

async function describeSource(root, absolute, kind) {
  const content = await readFile(absolute, 'utf8');
  let metadata = null;
  try {
    metadata = parseProjectFrontmatter(content);
  } catch {
    // Un compte rendu importé peut être conservé sans frontmatter.
  }
  const relative = path.relative(root, absolute).split(path.sep).join('/');
  return {
    id: metadata?.id ? String(metadata.id) : fallbackId(kind, relative),
    title: metadata?.title ? String(metadata.title) : path.basename(relative, '.md').replaceAll('-', ' '),
    date: metadata?.date ? String(metadata.date) : relative.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null,
    kind,
    path: relative,
    contentHash: kind === 'meeting' ? sha256(content) : null,
  };
}

export async function readMeetingTracking(root) {
  const absolute = path.join(root, TRACKING_PATH);
  const content = await readFile(absolute, 'utf8');
  const tracking = YAML.parse(content);
  return { tracking, absolute };
}

export async function validateMeetingTracking(root) {
  const errors = [];
  const sources = await sourceDocuments(root);
  let tracking;
  try {
    ({ tracking } = await readMeetingTracking(root));
  } catch (error) {
    return { errors: [`${TRACKING_PATH}: lecture impossible (${error.message})`], documents: [] };
  }

  if (tracking?.version !== 1) errors.push(`${TRACKING_PATH}: version doit valoir 1`);
  if (!Array.isArray(tracking?.documents)) {
    return { errors: [...errors, `${TRACKING_PATH}: documents doit être une liste`], documents: [] };
  }

  const sourceByPath = new Map(sources.map((source) => [source.path, source]));
  const trackedPaths = new Set();
  const trackedIds = new Set();

  for (const document of tracking.documents) {
    const prefix = `${TRACKING_PATH}: ${document?.path ?? 'entrée sans chemin'}`;
    if (!document?.id) errors.push(`${prefix}: id manquant`);
    if (document?.id && trackedIds.has(document.id)) errors.push(`${prefix}: id ${document.id} dupliqué`);
    if (document?.id) trackedIds.add(document.id);
    if (!document?.path) continue;
    if (trackedPaths.has(document.path)) errors.push(`${prefix}: chemin dupliqué`);
    trackedPaths.add(document.path);

    const source = sourceByPath.get(document.path);
    if (!source) {
      errors.push(`${prefix}: document introuvable ou hors périmètre`);
      continue;
    }
    if (document.id !== source.id) errors.push(`${prefix}: id=${document.id} différent de l'identifiant source ${source.id}`);
    if (!DOCUMENT_KINDS.has(document.kind) || document.kind !== source.kind) {
      errors.push(`${prefix}: kind=${document.kind} invalide (attendu : ${source.kind})`);
    }
    if (!PROCESSING_STATUSES.has(document.processingStatus)) {
      errors.push(`${prefix}: processingStatus=${document.processingStatus} invalide (draft, review ou done)`);
    }
    if (!document.owner) errors.push(`${prefix}: owner manquant`);
    if (!Array.isArray(document.openItems)) errors.push(`${prefix}: openItems doit être une liste`);
    if (document.processingStatus === 'done') {
      if (document.owner === 'unassigned') errors.push(`${prefix}: un document done doit avoir un responsable`);
      if (!document.reviewedAt) errors.push(`${prefix}: un document done doit avoir une date reviewedAt`);
      if (document.openItems?.length) errors.push(`${prefix}: un document done ne peut pas conserver de point ouvert`);
    }
    if (document.kind === 'meeting') {
      if (!document.contentHash) errors.push(`${prefix}: contentHash obligatoire pour un compte rendu`);
      if (document.contentHash && document.contentHash !== source.contentHash) {
        errors.push(`${prefix}: le compte rendu immuable a été modifié (hash attendu ${document.contentHash}, obtenu ${source.contentHash})`);
      }
    }
  }

  for (const source of sources) {
    if (!trackedPaths.has(source.path)) errors.push(`${source.path}: document absent de ${TRACKING_PATH}`);
  }

  const documents = tracking.documents.map((document) => {
    const source = sourceByPath.get(document.path);
    return {
      ...document,
      title: source?.title ?? document.id,
      date: source?.date ?? null,
      openItemCount: Array.isArray(document.openItems) ? document.openItems.length : 0,
      sourcePath: document.path,
    };
  });
  return { errors, documents };
}

export async function syncMeetingTracking(root) {
  const sources = await sourceDocuments(root);
  const { tracking, absolute } = await readMeetingTracking(root);
  const known = new Set((tracking.documents ?? []).map((document) => document.path));
  let added = 0;
  for (const source of sources) {
    if (known.has(source.path)) continue;
    tracking.documents.push({
      id: source.id,
      kind: source.kind,
      path: source.path,
      processingStatus: 'draft',
      owner: 'unassigned',
      ...(source.kind === 'meeting' ? { contentHash: source.contentHash } : {}),
      reviewedAt: null,
      openItems: [],
    });
    added += 1;
  }
  tracking.documents.sort((left, right) => left.path.localeCompare(right.path, 'fr'));
  await writeFile(absolute, YAML.stringify(tracking, { lineWidth: 0 }), 'utf8');
  return { added, total: tracking.documents.length };
}
