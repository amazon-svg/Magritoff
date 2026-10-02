import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';

export const FIELD_DEFINITIONS = [
  { name: 'Backlog ID', type: 'TEXT' },
  { name: 'Type', type: 'SINGLE_SELECT', options: ['Epic', 'Feature', 'Story'] },
  {
    name: 'Spec Status',
    type: 'SINGLE_SELECT',
    options: ['draft', 'review', 'approved', 'contradictory', 'superseded', 'deprecated'],
  },
  {
    name: 'Delivery Status',
    type: 'SINGLE_SELECT',
    options: [
      'not-started',
      'ready',
      'in-progress',
      'implemented',
      'verified',
      'released',
      'blocked',
      'cancelled',
    ],
  },
  { name: 'Epic', type: 'TEXT' },
  { name: 'Feature', type: 'TEXT' },
  { name: 'Source Path', type: 'TEXT' },
];

const TYPE_BY_DIRECTORY = {
  epics: 'Epic',
  features: 'Feature',
  stories: 'Story',
};

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith('.md') &&
        entry.name !== 'README.md' &&
        !entry.name.startsWith('_'),
    )
    .map((entry) => path.join(directory, entry.name))
    .sort();
}

function parseDocument(content, sourcePath, type) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error(`${sourcePath}: frontmatter YAML absent`);
  const metadata = YAML.parse(match[1]);
  if (!metadata?.id || !metadata?.title || !metadata?.specStatus) {
    throw new Error(`${sourcePath}: id, title ou specStatus manquant`);
  }
  return {
    id: String(metadata.id),
    title: String(metadata.title),
    type,
    specStatus: String(metadata.specStatus),
    deliveryStatus: metadata.deliveryStatus ? String(metadata.deliveryStatus) : null,
    epic: metadata.epic ? String(metadata.epic) : null,
    feature: metadata.feature ? String(metadata.feature) : null,
    sourcePath,
    markdown: match[2].trim(),
  };
}

export async function loadBacklog(root) {
  const backlogRoot = path.join(root, 'project', 'backlog');
  const documents = [];
  for (const [directory, type] of Object.entries(TYPE_BY_DIRECTORY)) {
    const files = await markdownFiles(path.join(backlogRoot, directory));
    for (const file of files) {
      const sourcePath = path.relative(root, file).split(path.sep).join('/');
      documents.push(parseDocument(await readFile(file, 'utf8'), sourcePath, type));
    }
  }
  const ids = new Set();
  for (const document of documents) {
    if (ids.has(document.id)) throw new Error(`Identifiant dupliqué : ${document.id}`);
    ids.add(document.id);
  }
  return documents.sort((left, right) => left.id.localeCompare(right.id, 'fr'));
}

function escapeCell(value) {
  return value ? String(value).replaceAll('|', '\\|').replaceAll('\n', ' ') : '—';
}

export function renderDraftBody(document, repository, ref = 'main') {
  const sourceUrl = `https://github.com/${repository}/blob/${encodeURIComponent(ref)}/${document.sourcePath}`;
  const metadata = [
    ['Identifiant', document.id],
    ['Type', document.type],
    ['Spec', document.specStatus],
    ['Livraison', document.deliveryStatus],
    ['Epic', document.epic],
    ['Feature', document.feature],
  ];
  const sourceBody = document.markdown
    .replace(/^# .*\n+/, '')
    .trim()
    .slice(0, 12000);
  return [
    `<!-- magrit-backlog-id: ${document.id} -->`,
    `<!-- magrit-source-path: ${document.sourcePath} -->`,
    '',
    '> Vue générée depuis le backlog Git. Ne pas modifier ici : les changements seront écrasés par la prochaine projection.',
    '',
    `[Ouvrir la source canonique](${sourceUrl})`,
    '',
    '| Champ | Valeur |',
    '|---|---|',
    ...metadata.map(([name, value]) => `| ${name} | ${escapeCell(value)} |`),
    '',
    sourceBody,
  ].join('\n');
}

export function desiredFields(document) {
  return {
    'Backlog ID': document.id,
    Type: document.type,
    'Spec Status': document.specStatus,
    'Delivery Status': document.deliveryStatus,
    Epic: document.epic,
    Feature: document.feature,
    'Source Path': document.sourcePath,
  };
}

export function buildSyncPlan(localDocuments, remoteItems, repository, ref = 'main') {
  const remoteById = new Map();
  for (const item of remoteItems) {
    if (!item.backlogId) continue;
    if (remoteById.has(item.backlogId)) {
      throw new Error(`Plusieurs éléments GitHub Project portent Backlog ID=${item.backlogId}`);
    }
    remoteById.set(item.backlogId, item);
  }

  const actions = [];
  for (const document of localDocuments) {
    const title = `[${document.id}] ${document.title}`;
    const body = renderDraftBody(document, repository, ref);
    const fields = desiredFields(document);
    const remote = remoteById.get(document.id);
    if (!remote) {
      actions.push({ action: 'create', id: document.id, title, body, fields, document });
      continue;
    }
    const changedFields = {};
    for (const [name, value] of Object.entries(fields)) {
      if ((remote.fields[name] ?? null) !== (value ?? null)) changedFields[name] = value;
    }
    const contentChanged = remote.title !== title || remote.body !== body;
    if (contentChanged || Object.keys(changedFields).length > 0) {
      actions.push({
        action: 'update',
        id: document.id,
        title,
        body,
        fields: changedFields,
        contentChanged,
        remote,
        document,
      });
    } else {
      actions.push({ action: 'noop', id: document.id, remote, document });
    }
  }

  const localIds = new Set(localDocuments.map((document) => document.id));
  for (const item of remoteItems) {
    if (item.backlogId && !localIds.has(item.backlogId)) {
      actions.push({ action: 'stale', id: item.backlogId, remote: item });
    }
  }
  return actions;
}

export function summarizePlan(actions) {
  const summary = { create: 0, update: 0, noop: 0, stale: 0 };
  for (const action of actions) summary[action.action] += 1;
  return summary;
}
