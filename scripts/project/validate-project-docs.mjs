#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseProjectFrontmatter } from './project-frontmatter.mjs';

const root = process.cwd();
const projectRoot = path.join(root, 'project');
const errors = [];
const identifiers = new Map();

const DOCUMENT_STATUSES = new Set(['draft', 'review', 'approved', 'deprecated']);
const SPEC_STATUSES = new Set(['draft', 'review', 'approved', 'contradictory', 'superseded', 'deprecated']);
const DELIVERY_STATUSES = new Set([
  'not-started',
  'ready',
  'in-progress',
  'implemented',
  'verified',
  'released',
  'blocked',
  'cancelled',
]);
const PROPAGATION_STATUSES = new Set(['pending', 'partial', 'complete', 'not-applicable']);
const DECISION_STATUSES = new Set(['proposed', 'adopted', 'rejected', 'deferred', 'superseded']);

async function listMarkdown(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listMarkdown(absolute));
    if (entry.isFile() && entry.name.endsWith('.md')) files.push(absolute);
  }
  return files;
}

function requireFields(relative, data, fields) {
  for (const field of fields) {
    if (!(field in data) || data[field] === null || data[field] === '' || data[field] === 'null') {
      errors.push(`${relative}: champ obligatoire manquant ou vide : ${field}`);
    }
  }
}

function checkEnum(relative, field, value, allowed) {
  if (value && !allowed.has(value)) {
    errors.push(`${relative}: ${field}=${value} invalide (attendu : ${[...allowed].join(', ')})`);
  }
}

function registerId(relative, id) {
  if (!id) return;
  const previous = identifiers.get(id);
  if (previous) {
    errors.push(`${relative}: identifiant ${id} déjà utilisé dans ${previous}`);
  } else {
    identifiers.set(id, relative);
  }
}

function artifactType(relative) {
  if (/^project\/prd\/(product-[^/]+\.md|domains\/[^/]+\.md)$/.test(relative)) return 'prd';
  if (/^project\/meetings\/\d{4}\//.test(relative)) return 'meeting';
  if (/^project\/decisions\/(product|architecture)\//.test(relative)) return 'decision';
  if (/^project\/backlog\/epics\//.test(relative)) return 'epic';
  if (/^project\/backlog\/features\//.test(relative)) return 'feature';
  if (/^project\/backlog\/stories\//.test(relative)) return 'story';
  if (/^project\/sprints\/[^/]+\//.test(relative)) return 'sprint';
  return null;
}

const files = await listMarkdown(projectRoot);
let checked = 0;

for (const absolute of files.sort()) {
  const relative = path.relative(root, absolute);
  const basename = path.basename(absolute);
  if (basename === 'README.md' || basename.startsWith('_')) continue;

  const type = artifactType(relative);
  if (!type) continue;

  checked += 1;
  const content = await readFile(absolute, 'utf8');
  let data;
  try {
    data = parseProjectFrontmatter(content);
  } catch (error) {
    errors.push(`${relative}: ${error.message}`);
    continue;
  }
  if (!data) {
    errors.push(`${relative}: frontmatter YAML absent`);
    continue;
  }

  registerId(relative, data.id);

  if (type === 'prd') {
    requireFields(relative, data, ['id', 'title', 'documentStatus', 'owner', 'source']);
    checkEnum(relative, 'documentStatus', data.documentStatus, DOCUMENT_STATUSES);
  }

  if (type === 'meeting') {
    requireFields(relative, data, ['id', 'title', 'date', 'type', 'status', 'propagationStatus']);
    checkEnum(relative, 'status', data.status, DOCUMENT_STATUSES);
    checkEnum(relative, 'propagationStatus', data.propagationStatus, PROPAGATION_STATUSES);
    if (!content.includes('## Matrice de propagation')) {
      errors.push(`${relative}: section « Matrice de propagation » absente`);
    }
  }

  if (type === 'decision') {
    requireFields(relative, data, ['id', 'title', 'date', 'documentStatus', 'decisionStatus', 'source']);
    checkEnum(relative, 'documentStatus', data.documentStatus, DOCUMENT_STATUSES);
    checkEnum(relative, 'decisionStatus', data.decisionStatus, DECISION_STATUSES);
  }

  if (type === 'epic') {
    requireFields(relative, data, ['id', 'title', 'specStatus', 'owner']);
    checkEnum(relative, 'specStatus', data.specStatus, SPEC_STATUSES);
  }

  if (type === 'feature') {
    requireFields(relative, data, ['id', 'title', 'epic', 'specStatus', 'owner']);
    checkEnum(relative, 'specStatus', data.specStatus, SPEC_STATUSES);
  }

  if (type === 'story') {
    requireFields(relative, data, [
      'id',
      'title',
      'epic',
      'feature',
      'specStatus',
      'deliveryStatus',
      'owner',
    ]);
    checkEnum(relative, 'specStatus', data.specStatus, SPEC_STATUSES);
    checkEnum(relative, 'deliveryStatus', data.deliveryStatus, DELIVERY_STATUSES);
    if (!content.includes("## Critères d'acceptation")) {
      errors.push(`${relative}: section « Critères d'acceptation » absente`);
    }
  }

  if (type === 'sprint') {
    requireFields(relative, data, ['id', 'status']);
    checkEnum(relative, 'status', data.status, DOCUMENT_STATUSES);
  }
}

const activeAuthorityFiles = [
  'CLAUDE.md',
  'docs/spec/STORY_DOCUMENT_STANDARD.md',
  'quality/specs/README.md',
  'project/governance/source-of-truth.md',
];
for (const relative of activeAuthorityFiles) {
  const content = await readFile(path.join(root, relative), 'utf8');
  if (/Notion fait foi/i.test(content)) {
    errors.push(`${relative}: règle active interdite « Notion fait foi »`);
  }
}

if (errors.length > 0) {
  console.error(`Validation de la gouvernance échouée (${errors.length} erreur(s)) :`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Gouvernance valide : ${checked} artefact(s), ${identifiers.size} identifiant(s) unique(s).`);
