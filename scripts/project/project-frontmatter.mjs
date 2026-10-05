import YAML from 'yaml';

export class ProjectFrontmatterError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'ProjectFrontmatterError';
  }
}

export function parseProjectFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) return null;

  let data;
  try {
    data = YAML.parse(match[1]);
  } catch (error) {
    const detail = error instanceof Error ? error.message.split('\n')[0] : String(error);
    throw new ProjectFrontmatterError(`frontmatter YAML invalide : ${detail}`, { cause: error });
  }

  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new ProjectFrontmatterError('frontmatter YAML invalide : un objet est attendu');
  }

  return data;
}
