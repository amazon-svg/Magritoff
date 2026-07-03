/**
 * E7.7 — Smoke test data-testid.
 *
 * Verifie que chaque testid critique des cahiers de tests fonctionnels P00-P09
 * (cf. SPEC_data-testid_06052026.md section 6) :
 *   1. existe dans l enum TEST_IDS (`src/app/lib/testIds.ts`)
 *   2. est effectivement utilise dans un composant React de `src/app/`
 *
 * Implementation : scan statique du source — pas de mount React. Pour les
 * cahiers joues par Claude in Chrome (via MCP), ce qui compte est que
 * le testid existe a un endroit qui finit par etre rendu dans le DOM.
 * Si un testid est present dans le code mais conditionnel (modale fermee,
 * etat absent), Claude in Chrome saura ouvrir la modale d abord.
 *
 * Exception : usage-quota-counter (P07) — UI inexistante au moment du
 * Sprint courant, le testid est defini dans testIds.ts pour usage futur.
 * Liste dans EXPECTED_MISSING ci-dessous.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { TEST_IDS } from '../src/app/lib/testIds';

const SRC_ROOT = resolve(__dirname, '..', 'src', 'app');

// Testids critiques par parcours (cf. spec section 6).
const CRITICAL: Record<string, string[]> = {
  P00: [TEST_IDS.tenant.createForm, TEST_IDS.tenant.sirenVerifyBtn, TEST_IDS.tenant.createSubmitBtn],
  P01: [TEST_IDS.auth.loginSubmitBtn, TEST_IDS.nav.sidebarUsersLink],
  P02: [TEST_IDS.user.table, TEST_IDS.user.inviteBtn, TEST_IDS.user.inviteModal],
  P03: [TEST_IDS.user.permissionsModal, TEST_IDS.user.accessScopeRadio],
  P04: [TEST_IDS.tenant.settingsSection, TEST_IDS.tenant.renameSaveBtn],
  P05: [TEST_IDS.marguerite.chat, TEST_IDS.marguerite.messageInput, TEST_IDS.marguerite.modeToggle],
  P06: [TEST_IDS.marguerite.clarificationBubble],
  P07: [TEST_IDS.usage.quotaCounter],
  P08: [TEST_IDS.quote.priceDisplay],
  P09: [TEST_IDS.shop.portal, TEST_IDS.shop.productGrid],
};

// Testids dont l UI n existe pas encore (story d ajout future).
const EXPECTED_MISSING = new Set<string>([
  TEST_IDS.usage.quotaCounter, // P07 — pas de sidebar quota counter aujourd hui
]);

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(tsx?|jsx?)$/.test(name)) acc.push(p);
  }
  return acc;
}

const ALL_FILES = walk(SRC_ROOT);
// On exclut testIds.ts du haystack pour eviter de matcher la definition de l enum
// elle-meme (chaque ID y apparait par construction).
const HAYSTACK = ALL_FILES
  .filter((f) => !f.endsWith('testIds.ts'))
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');

// On reference les testid par TEST_IDS.<scope>.<name> dans le source.
// On reconstruit donc l ensemble des references valides pour CHAQUE id en
// inversant l enum, puis on matche soit la string litterale, soit la
// reference TEST_IDS.scope.name.
const ID_TO_REFS = new Map<string, string[]>();
for (const [scope, group] of Object.entries(TEST_IDS)) {
  for (const [name, id] of Object.entries(group as Record<string, string>)) {
    const refs = ID_TO_REFS.get(id) ?? [];
    refs.push(`TEST_IDS.${scope}.${name}`);
    ID_TO_REFS.set(id, refs);
  }
}

function isUsed(testId: string): boolean {
  if (HAYSTACK.includes(testId)) return true;
  const refs = ID_TO_REFS.get(testId) ?? [];
  return refs.some((r) => HAYSTACK.includes(r));
}

describe('E7.7 smoke — data-testid presence par parcours', () => {
  for (const [parcours, ids] of Object.entries(CRITICAL)) {
    describe(parcours, () => {
      for (const id of ids) {
        const expectedMissing = EXPECTED_MISSING.has(id);
        const label = expectedMissing
          ? `[differe] testid "${id}" defini dans testIds.ts (UI a venir)`
          : `testid "${id}" present dans le code source`;

        it(label, () => {
          if (expectedMissing) {
            // Verifie au moins que l ID est defini dans TEST_IDS
            expect(typeof id).toBe('string');
            expect(id.length).toBeGreaterThan(0);
          } else {
            expect(
              isUsed(id),
              `Testid "${id}" introuvable dans src/app/ (hors testIds.ts). ` +
                `Verifiez l instrumentation du parcours ${parcours}.`,
            ).toBe(true);
          }
        });
      }
    });
  }

  it('aucun testid critique n est duplique entre parcours', () => {
    const all: string[] = Object.values(CRITICAL).flat();
    const seen = new Map<string, string>();
    for (const [parcours, ids] of Object.entries(CRITICAL)) {
      for (const id of ids) {
        if (seen.has(id) && seen.get(id) !== parcours) {
          throw new Error(
            `Testid "${id}" reference dans 2 parcours differents : ${seen.get(id)} et ${parcours}`,
          );
        }
        seen.set(id, parcours);
      }
    }
    expect(all.length).toBeGreaterThan(0);
  });
});
