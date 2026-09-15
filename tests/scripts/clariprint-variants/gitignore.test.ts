import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * BCP-1a — arbitrage architecte (qa-review de `d8a0a57b`, point (2)) :
 * « Un seul fichier non commité, `results/<…>/texts.local.json`, ignoré par
 * git (`*.local.json`). » Mutation à tuer : `texts.local.json` non ignoré
 * par git. Ce test exécute RÉELLEMENT `git check-ignore` (pas une lecture
 * de `.gitignore` par regex) : c'est le comportement git lui-même qui est
 * vérifié, dans CE dépôt.
 */
describe('texts.local.json est ignore par git', () => {
  const repoRoot = process.cwd();
  const campaignDir = join(repoRoot, 'scripts/diagnostics/clariprint-variants/results', '__gitignore_test_campaign__');
  const textsLocalPath = join(campaignDir, 'texts.local.json');
  const callsJsonPath = join(campaignDir, 'calls.json');

  it('git check-ignore reussit (code 0) sur texts.local.json', () => {
    mkdirSync(campaignDir, { recursive: true });
    writeFileSync(textsLocalPath, '[]', 'utf8');
    try {
      // `execFileSync` leve si le code de sortie est non nul : un succes
      // (throw absent) prouve que git ignore bien le fichier.
      expect(() => execFileSync('git', ['check-ignore', textsLocalPath], { cwd: repoRoot })).not.toThrow();
    } finally {
      rmSync(campaignDir, { recursive: true, force: true });
    }
  });

  it("git check-ignore ECHOUE sur calls.json (il doit rester COMMITABLE)", () => {
    mkdirSync(campaignDir, { recursive: true });
    writeFileSync(callsJsonPath, '{}', 'utf8');
    try {
      expect(() => execFileSync('git', ['check-ignore', callsJsonPath], { cwd: repoRoot })).toThrow();
      expect(existsSync(callsJsonPath)).toBe(true);
    } finally {
      rmSync(campaignDir, { recursive: true, force: true });
    }
  });
});
