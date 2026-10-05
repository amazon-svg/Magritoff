import { describe, expect, it } from 'vitest';
import { parseProjectFrontmatter } from '../../scripts/project/project-frontmatter.mjs';

describe('frontmatter des artefacts projet', () => {
  it('parse les champs imbriqués et les listes YAML', () => {
    const result = parseProjectFrontmatter(`---
id: US-TEST
title: "Story : titre explicite"
source:
  system: git
dependencies:
  - US-A
---

# Story
`);

    expect(result).toEqual({
      id: 'US-TEST',
      title: 'Story : titre explicite',
      source: { system: 'git' },
      dependencies: ['US-A'],
    });
  });

  it('refuse un deux-points ambigu dans une chaîne non citée', () => {
    expect(() => parseProjectFrontmatter(`---
id: US-TEST
title: Story : titre ambigu
---
`)).toThrow(/frontmatter YAML invalide/);
  });

  it('refuse un titre non cité interprété comme une collection YAML', () => {
    expect(() => parseProjectFrontmatter(`---
id: US-TEST
title: [SUPERSEDEE] Story
---
`)).toThrow(/frontmatter YAML invalide/);
  });

  it('retourne null lorsque le frontmatter est absent', () => {
    expect(parseProjectFrontmatter('# Story sans frontmatter\n')).toBeNull();
  });
});
