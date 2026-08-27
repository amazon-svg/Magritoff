import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('page de test d intégration HopeStudio', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/modules/hopstudio/ui/HopeStudioIntegrationTestPage.tsx'),
    'utf8',
  );
  const workspaceSource = readFileSync(
    resolve(process.cwd(), 'src/modules/hopstudio/ui/HopeStudioWorkspace.tsx'),
    'utf8',
  );
  const assetsSource = readFileSync(
    resolve(process.cwd(), 'src/modules/hopstudio/ui/assets.ts'),
    'utf8',
  );

  it('charge le bundle versionné et configure toutes les racines statiques', () => {
    expect(assetsSource).toContain("HOPSTUDIO_ASSET_ROOT = '/vendor/hopstudio/1.0.0/'");
    expect(assetsSource).toContain("HOPSTUDIO_EJS_ROOT = '/hopstudio/ejs/'");
    expect(source).toContain('root_ejs');
    expect(source).toContain('base: HOPSTUDIO_EJS_ROOT');
    expect(workspaceSource).toContain('base: HOPSTUDIO_EJS_ROOT');
    expect(source).toContain('root_img');
    expect(source).toContain('root_css');
    expect(source).toContain('root_lang');
  });

  it('conserve une copie personnalisable de tous les templates EJS du bundle', () => {
    const templates = (directory: string) => readdirSync(resolve(process.cwd(), directory))
      .filter((name) => name.endsWith('.ejs'))
      .sort();

    expect(templates('public/hopstudio/ejs')).toEqual(
      templates('public/vendor/hopstudio/1.0.0/ejs'),
    );
  });

  it('utilise une identité et une API simulées sans inclure de secret', () => {
    expect(source).toContain('data-tenant="magrit-test-tenant"');
    expect(source).toContain('data-user="magrit-test-user"');
    expect(source).toContain("const TEST_API_URL = '/dev/hopstudio-api'");
    expect(source).toContain('id="chat-bar"');
    expect(source).toContain("sendMessage?.('Je veux 500 flyers')");
    expect(source).not.toContain('X-CLARIPRINT-PASS');
  });
});
