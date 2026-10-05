import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseProjectFrontmatter } from './project-frontmatter.mjs';

const BACKLOG_TYPES = [
  ['epics', 'epic'],
  ['features', 'feature'],
  ['stories', 'story'],
];

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md' && !entry.name.startsWith('_'))
    .map((entry) => path.join(directory, entry.name))
    .sort((left, right) => left.localeCompare(right, 'fr'));
}

async function markdownFilesRecursive(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await markdownFilesRecursive(absolute));
    if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md' && !entry.name.startsWith('_')) {
      files.push(absolute);
    }
  }
  return files.sort((left, right) => left.localeCompare(right, 'fr'));
}

function extractSection(markdown, headings) {
  for (const heading of headings) {
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = markdown.match(new RegExp(`^## ${escaped}\\s*$\\n([\\s\\S]*?)(?=^## |\\Z)`, 'im'));
    if (!match) continue;
    const paragraph = match[1]
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('|') && !line.startsWith('---'))
      .join(' ')
      .replace(/[`*_>#]/g, '')
      .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
    if (paragraph) return paragraph.slice(0, 360);
  }
  return '';
}

async function loadBacklog(root) {
  const documents = [];
  for (const [directory, type] of BACKLOG_TYPES) {
    const base = path.join(root, 'project', 'backlog', directory);
    for (const absolute of await markdownFiles(base)) {
      const content = await readFile(absolute, 'utf8');
      const metadata = parseProjectFrontmatter(content);
      if (!metadata) throw new Error(`${absolute}: frontmatter absent`);
      documents.push({
        id: String(metadata.id),
        title: String(metadata.title),
        type,
        epic: metadata.epic ? String(metadata.epic) : null,
        feature: metadata.feature ? String(metadata.feature) : null,
        specStatus: metadata.specStatus ? String(metadata.specStatus) : null,
        deliveryStatus: metadata.deliveryStatus ? String(metadata.deliveryStatus) : null,
        lifecycleStatus: metadata.lifecycleStatus ? String(metadata.lifecycleStatus) : null,
        owner: metadata.owner ? String(metadata.owner) : 'unassigned',
        dependencies: Array.isArray(metadata.dependencies) ? metadata.dependencies.map(String) : [],
        decisions: Array.isArray(metadata.decisions) ? metadata.decisions.map(String) : [],
        sourcePath: path.relative(root, absolute).split(path.sep).join('/'),
        summary: extractSection(content, [
          'Valeur métier',
          'Besoin utilisateur',
          'Résultat attendu',
          'Besoin',
          'Comportement attendu',
          'Contexte',
        ]),
      });
    }
  }
  return documents.sort((left, right) => left.id.localeCompare(right.id, 'fr'));
}

function parseMarkdownTable(content) {
  const rows = [];
  for (const line of content.split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((cell) => cell.trim());
    if (cells.length < 2 || cells.every((cell) => /^-+$/.test(cell)) || cells[0] === 'ID') continue;
    rows.push(cells);
  }
  return rows;
}

function cleanInlineMarkdown(value) {
  return String(value ?? '')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[`*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function loadOpenQuestions(root) {
  const sourcePath = 'project/decisions/open-questions.md';
  const content = await readFile(path.join(root, sourcePath), 'utf8');
  return parseMarkdownTable(content).map(([id, question, source, owner, due, status]) => ({
    id: cleanInlineMarkdown(id),
    question: cleanInlineMarkdown(question),
    source: cleanInlineMarkdown(source),
    owner: cleanInlineMarkdown(owner),
    due: cleanInlineMarkdown(due),
    status: cleanInlineMarkdown(status),
    sourcePath,
  }));
}

async function loadDecisions(root) {
  const base = path.join(root, 'project', 'decisions');
  const decisions = [];
  for (const absolute of await markdownFilesRecursive(base)) {
    if (path.basename(absolute) === 'open-questions.md') continue;
    const content = await readFile(absolute, 'utf8');
    const metadata = parseProjectFrontmatter(content);
    if (!metadata?.id || !metadata?.title || !metadata?.decisionStatus) continue;
    decisions.push({
      id: String(metadata.id),
      title: String(metadata.title),
      date: metadata.date ? String(metadata.date) : null,
      documentStatus: metadata.documentStatus ? String(metadata.documentStatus) : null,
      decisionStatus: String(metadata.decisionStatus),
      sourcePath: path.relative(root, absolute).split(path.sep).join('/'),
      summary: extractSection(content, ['Décision', 'Contexte']),
    });
  }
  return decisions.sort((left, right) => (right.date ?? '').localeCompare(left.date ?? '') || left.id.localeCompare(right.id, 'fr'));
}

function countBy(items, key, fallback = 'non-renseigné') {
  return Object.fromEntries(
    [...items.reduce((counts, item) => {
      const value = item[key] ?? fallback;
      counts.set(value, (counts.get(value) ?? 0) + 1);
      return counts;
    }, new Map())].sort(([left], [right]) => left.localeCompare(right, 'fr')),
  );
}

export async function buildProjectDashboardModel(root) {
  const backlog = await loadBacklog(root);
  const epics = backlog.filter((item) => item.type === 'epic');
  const features = backlog.filter((item) => item.type === 'feature');
  const stories = backlog.filter((item) => item.type === 'story');
  const openQuestions = await loadOpenQuestions(root);
  const decisions = await loadDecisions(root);

  return {
    repository: process.env.GITHUB_REPOSITORY || 'amazon-svg/Magritoff',
    reference: 'main',
    epics,
    features,
    stories,
    openQuestions,
    decisions,
    metrics: {
      epics: epics.length,
      features: features.length,
      stories: stories.length,
      openQuestions: openQuestions.filter((question) => question.status === 'ouverte').length,
      contradictory: backlog.filter((item) => item.specStatus === 'contradictory').length,
      blocked: stories.filter((story) => story.deliveryStatus === 'blocked').length,
      specStatuses: countBy(stories, 'specStatus'),
      deliveryStatuses: countBy(stories, 'deliveryStatus'),
      decisionStatuses: countBy(decisions, 'decisionStatus'),
    },
  };
}
