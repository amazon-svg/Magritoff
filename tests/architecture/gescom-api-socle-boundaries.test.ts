/**
 * Frontières du socle API Gestion commerciale (story E10.0, CA11).
 *
 * Pourquoi ce fichier existe : `api-first-boundaries.test.ts` et
 * `modular-ui-boundaries.test.ts` ne scrutent que les fichiers situés sous un
 * segment `ui/` de `src/modules`. Le socle E10 n'a délibérément pas de `ui/`
 * — il ne publie aucune UX — donc ces deux tests sont **vacants** pour lui.
 * Sans ce fichier, tout le code introduit par E10.0 échapperait aux gardes
 * architecturales. Il les complète, il ne les remplace pas.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const sourceRoot = resolve(root, 'src');
const sharedRoot = resolve(sourceRoot, 'modules/_shared');

function sourceFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry);
    return statSync(path).isDirectory()
      ? sourceFiles(path)
      : /\.[cm]?[jt]sx?$/.test(path)
        ? [path]
        : [];
  });
}

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8');
}

function imports(source: string): string[] {
  return Array.from(
    source.matchAll(/(?:from\s+|import\s*\()(['"])([^'"]+)\1/g),
    (match) => match[2] ?? '',
  );
}

const sharedFiles = sourceFiles(sharedRoot);
const gescomServerFiles = sourceFiles(resolve(sourceRoot, 'server/api')).filter((file) =>
  /gescom-/.test(file),
);

describe('frontières du socle API Gestion commerciale (E10.0)', () => {
  it('le socle existe et suit la convention de dossiers du dépôt', () => {
    expect(sharedFiles.length).toBeGreaterThan(0);
    for (const entry of ['api/contracts.ts', 'api/index.ts', 'application/index.ts', 'index.ts']) {
      expect(existsSync(resolve(sharedRoot, entry)), entry).toBe(true);
    }
    // Pas de structure routes/service/repository/dto/events : le dépôt a déjà
    // sa convention, appliquée par les 10 modules existants.
    for (const forbidden of ['routes', 'dto', 'repository', 'service', 'events', '__tests__']) {
      expect(existsSync(resolve(sharedRoot, forbidden)), forbidden).toBe(false);
    }
  });

  it('le socle ne publie aucune UX, donc aucun composant React', () => {
    expect(existsSync(resolve(sharedRoot, 'ui'))).toBe(false);
    const components = sharedFiles.filter((file) => file.endsWith('.tsx'));
    expect(components).toEqual([]);
    const reactImports = sharedFiles.filter((file) =>
      imports(readFileSync(file, 'utf8')).some((dependency) => /^react(\/|$)/.test(dependency)),
    );
    expect(reactImports).toEqual([]);
  });

  it('aucun code du socle ne parle au fournisseur de données', () => {
    const violations = [...sharedFiles, ...gescomServerFiles].flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      const forbidden = imports(source)
        .filter((dependency) =>
          /^@supabase(\/|$)/.test(dependency) ||
          /utils\/supabase/.test(dependency) ||
          /(?:^|\/)adapters(?:\/|$)/.test(dependency) ||
          /(?:^|\/)app(?:\/|$)/.test(dependency),
        )
        .map((dependency) => `${relative(sourceRoot, file)} -> ${dependency}`);
      return /\bsupabase\s*\.|functions\/v1/.test(source)
        ? [...forbidden, `${relative(sourceRoot, file)} -> appel fournisseur`]
        : forbidden;
    });
    expect(violations).toEqual([]);
  });

  it('le socle ne dépend d aucun module métier : il est en dessous, pas à côté', () => {
    const violations = sharedFiles.flatMap((file) =>
      imports(readFileSync(file, 'utf8'))
        .filter(
          (dependency) =>
            (dependency.includes('/modules/') || dependency.startsWith('@/modules/')) &&
            !dependency.includes('/_shared'),
        )
        .map((dependency) => `${relative(sourceRoot, file)} -> ${dependency}`),
    );
    expect(violations).toEqual([]);
  });

  it('les types dérivés du contrat ne sont pas édités à la main', () => {
    const generated = read('src/platform/api/generated/magrit-core.v1.ts');
    expect(generated).toContain('FICHIER GENERE — NE PAS EDITER A LA MAIN.');
    expect(generated).toContain('openapi/magrit-core.v1.yaml');
    // Le socle consomme les types générés : c est ce qui lie les schémas Zod
    // au contrat à la compilation.
    expect(read('src/modules/_shared/api/contracts.ts')).toContain(
      'platform/api/generated/magrit-core.v1.ts',
    );
  });

  it('la facade E10 réutilise le routage existant au lieu d en dupliquer un second', () => {
    const middleware = read('src/server/api/gescom-middleware.ts');
    expect(middleware).toContain("import { compilePathTemplate } from './api-v1-handler.ts'");
    expect(middleware).not.toMatch(/new RegExp\(`\^/);
  });

  it('aucun fichier de routes E10 n échappe au registre relié au contrat', () => {
    // Le registre `GESCOM_ROUTES` est ce qui relie une route codée à une
    // entrée réelle de l'OpenAPI (vérifié par
    // tests/contract/gescom-routes.contract.test.ts). Un fichier de routes qui
    // n'y arrive pas rouvre le trou : ses routes existeraient sans que
    // personne ne vérifie qu'elles sont décrites au partenaire.
    const registry = read('src/server/api/gescom-routes.ts');
    const definingFiles = sourceFiles(resolve(sourceRoot, 'server/api'))
      .filter((file) => readFileSync(file, 'utf8').includes('defineGescomRoute('))
      .map((file) => relative(resolve(sourceRoot, 'server/api'), file))
      // Le middleware EXPOSE defineGescomRoute et le registre le cite dans sa
      // documentation : ni l'un ni l'autre ne déclare de route.
      .filter(
        (file) =>
          file !== 'gescom-middleware.ts' &&
          file !== 'gescom-routes.ts' &&
          file !== 'index.ts',
      );

    const unregistered = definingFiles.filter(
      (file) => !registry.includes(`./${file.replace(/\.tsx?$/, '')}`),
    );
    expect(
      unregistered,
      `fichiers de routes absents de GESCOM_ROUTES : ${unregistered.join(', ')}`,
    ).toEqual([]);

    expect(registry).toContain('export const GESCOM_ROUTES');
  });

  it('le harnais de tests de contrat est en place et branché en CI', () => {
    expect(existsSync(resolve(root, 'tests/contract'))).toBe(true);
    const contractTests = readdirSync(resolve(root, 'tests/contract')).filter((file) =>
      file.endsWith('.contract.test.ts'),
    );
    expect(contractTests.length).toBeGreaterThan(0);

    const workflow = read('.github/workflows/architecture.yml');
    expect(workflow).toContain('pnpm test:contract');
    expect(workflow).toContain('pnpm gen:api:check');
    // L existant reste en place.
    expect(workflow).toContain('pnpm typecheck');
    expect(workflow).toContain('pnpm test:architecture');
  });

  it('outbox_events est append-only et fermée aux rôles client', () => {
    const migration = read('supabase/migrations/20260901000100_gescom_outbox_events.sql');
    expect(migration).toContain('create table if not exists public.outbox_events');
    expect(migration).toContain('alter table public.outbox_events enable row level security');
    expect(migration).toContain('drop policy if exists "outbox_events_select"');
    expect(migration).toContain(
      'revoke all on table public.outbox_events from public, anon, authenticated',
    );
    expect(migration).toContain('outbox_events_append_only');
    expect(migration).toContain('outbox_append_only: le contenu d un evenement est immuable');
    // Réversibilité documentée : le CLI Supabase n a pas de bloc down.
    expect(migration).toContain('drop table if exists public.outbox_events;');
  });

  it('api_idempotency_keys reste une table strictement serveur', () => {
    const migration = read('supabase/migrations/20260901000200_gescom_api_idempotency_keys.sql');
    expect(migration).toContain('create table if not exists public.api_idempotency_keys');
    expect(migration).toContain(
      'alter table public.api_idempotency_keys enable row level security',
    );
    expect(migration).toContain(
      'revoke all on table public.api_idempotency_keys from public, anon, authenticated',
    );
    expect(migration).toContain('constraint api_idempotency_keys_unique unique (tenant_id, idempotency_key)');
    expect(migration).toContain('drop table if exists public.api_idempotency_keys;');
  });

  it('les conventions API sont écrites et couvrent les 13 critères', () => {
    const conventions = read('docs/api/CONVENTIONS.md');
    for (let criterion = 1; criterion <= 13; criterion += 1) {
      expect(conventions, `critère ${criterion} absent`).toContain(`| ${criterion} |`);
    }
    expect(conventions).toContain('openapi-typescript');
    expect(conventions).toContain('zod-openapi');
    expect(conventions).toContain('DomainEvent');
    expect(conventions).toContain('Dérogations R5');
  });
});
