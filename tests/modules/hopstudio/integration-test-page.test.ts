import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('page de test d intégration HopeStudio', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/modules/hopstudio/ui/HopeStudioIntegrationTestPage.tsx'),
    'utf8',
  );

  it('charge le bundle versionné et configure toutes les racines statiques', () => {
    expect(source).toContain("const ASSET_ROOT = '/vendor/hopstudio/1.0.0/'");
    expect(source).toContain('sugarcrepeHLUX.mjs');
    expect(source).toContain('root_ejs');
    expect(source).toContain('root_img');
    expect(source).toContain('root_css');
    expect(source).toContain('root_lang');
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
