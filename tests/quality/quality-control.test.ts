import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';
import { afterEach, describe, expect, it } from 'vitest';

const root = process.cwd();
const temporaryDirectories: string[] = [];

function readYaml(path: string): Record<string, unknown> {
  return parse(readFileSync(resolve(root, path), 'utf8')) as Record<string, unknown>;
}

afterEach(() => {
  for (const path of temporaryDirectories.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
});

describe('architecture de contrôle qualité', () => {
  it('déclare uniquement une politique advisory avec cinq profils lisibles', () => {
    const policy = readYaml('quality/policy.yaml') as {
      policy: string;
      agents: Record<string, { profile: string; checks: Record<string, string[]> }>;
      checks: Record<string, { command: string[] }>;
    };

    expect(policy.policy).toBe('advisory');
    expect(Object.keys(policy.agents)).toEqual([
      'architecture',
      'api',
      'functional',
      'ux',
      'test-quality',
    ]);

    for (const [agentId, agent] of Object.entries(policy.agents)) {
      expect(existsSync(resolve(root, agent.profile)), `${agentId} doit avoir un profil`).toBe(true);
      expect(readFileSync(resolve(root, agent.profile), 'utf8').length).toBeGreaterThan(100);
      for (const mode of ['diff', 'module', 'full']) {
        expect(agent.checks[mode], `${agentId}.${mode} doit déclarer ses contrôles`).toBeDefined();
        for (const checkId of agent.checks[mode]) {
          expect(policy.checks[checkId], `${agentId}.${mode} référence ${checkId}`).toBeDefined();
          expect(policy.checks[checkId].command.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('compile strictement les schémas de spécification et de rapport', () => {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);

    for (const path of [
      'quality/specs/spec.schema.json',
      'quality/schemas/agent-report.schema.json',
    ]) {
      const schema = JSON.parse(readFileSync(resolve(root, path), 'utf8')) as object;
      expect(() => ajv.compile(schema), path).not.toThrow();
    }
  });

  it('génère un audit full en mode plan sans exécuter les contrôles', () => {
    const output = mkdtempSync(resolve(tmpdir(), 'magrit-quality-plan-'));
    temporaryDirectories.push(output);

    execFileSync(
      process.execPath,
      [
        resolve(root, 'scripts/run-quality-audit.mjs'),
        '--mode',
        'full',
        '--plan',
        '--output',
        output,
      ],
      { cwd: root, encoding: 'utf8' },
    );

    const runDirectories = execFileSync('find', [output, '-mindepth', '1', '-maxdepth', '1', '-type', 'd'], {
      encoding: 'utf8',
    })
      .trim()
      .split(/\r?\n/)
      .filter(Boolean);
    expect(runDirectories).toHaveLength(1);

    const manifest = JSON.parse(
      readFileSync(resolve(runDirectories[0], 'manifest.json'), 'utf8'),
    ) as {
      policy: string;
      verdict: string;
      reports: Array<{ agent: string; json: string }>;
    };
    expect(manifest.policy).toBe('advisory');
    expect(manifest.verdict).toBe('INCONCLUSIVE');
    expect(manifest.reports).toHaveLength(5);

    for (const entry of manifest.reports) {
      const report = JSON.parse(
        readFileSync(resolve(runDirectories[0], entry.json), 'utf8'),
      ) as { verdict: string; checks: Array<{ status: string }> };
      expect(report.verdict, entry.agent).toBe('INCONCLUSIVE');
      expect(report.checks.every((check) => check.status === 'planned')).toBe(true);
    }
  });

  it('conserve le workflow GitHub en lecture seule et publie toujours les rapports', () => {
    const workflow = readYaml('.github/workflows/quality-audit.yml') as {
      permissions: { contents: string };
      jobs: {
        audit: {
          steps: Array<Record<string, unknown>>;
        };
      };
    };

    expect(workflow.permissions).toEqual({ contents: 'read' });
    const upload = workflow.jobs.audit.steps.find(
      (step) => step['uses'] === 'actions/upload-artifact@v4',
    );
    expect(upload).toBeDefined();
    expect(upload?.['if']).toBe('always()');
  });
});
