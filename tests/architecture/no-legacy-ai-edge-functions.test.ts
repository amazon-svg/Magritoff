import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('retrait des proxies IA Supabase', () => {
  it.each([
    'supabase/functions/magrit-api/index.ts',
    'supabase/functions/claude-proxy/index.ts',
    'supabase/functions/make-server-e3db71a4/index.ts',
    'supabase/functions/_shared/anthropicClient.ts',
    'src/server/node/transitional-api-handler.ts',
  ])('ne réintroduit pas %s', (path) => {
    expect(existsSync(resolve(root, path))).toBe(false);
  });

  it('le navigateur cible uniquement la façade assistant Magrit', () => {
    const gateway = readFileSync(
      resolve(root, 'src/adapters/http/browser-assistant-gateway.ts'),
      'utf8',
    );
    expect(gateway).toContain("fetch('/api/v1/assistant/chat'");
    expect(gateway).not.toMatch(/supabase|claude-proxy|make-server-e3db71a4/i);
  });
});
