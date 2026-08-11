import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('runtime Supabase local', () => {
  it('versionne une stack CLI Docker reproductible', () => {
    const config = read('supabase/config.toml');
    const packageJson = JSON.parse(read('package.json')) as {
      scripts: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    expect(config).toContain('project_id = "magritoff-v5"');
    expect(config).toContain('site_url = "http://127.0.0.1:5177"');
    expect(packageJson.devDependencies.supabase).toBeDefined();
    expect(packageJson.scripts['db:local:start']).toContain('supabase-local.sh start');
    expect(packageJson.scripts['db:local:reset']).toContain('supabase-local.sh reset');
    expect(read('scripts/supabase-local.sh')).toContain('20260417000000_local_b4_baseline.sql');
  });

  it('permet au front et au proxy API de cibler la stack locale', () => {
    expect(read('utils/supabase/info.tsx')).toContain('import.meta.env.VITE_SUPABASE_URL');
    expect(read('utils/supabase/info.tsx')).toContain('import.meta.env.VITE_SUPABASE_ANON_KEY');
    expect(read('vite.config.ts')).toContain('env.VITE_API_PROXY_TARGET');
    expect(read('.env.local.example')).toContain('http://127.0.0.1:54321');
    expect(read('supabase/functions/magrit-api/deno.json')).toContain('npm:zod@4.4.3');
  });
});
