import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from '@playwright/test';

const baseUrl = process.env.A11Y_BASE_URL || 'http://localhost:5177';
const routes = [
  '/login',
  '/t/imprimerie-ipa/atelier',
  '/t/imprimerie-ipa/dashboard/orders',
  '/t/imprimerie-ipa/dashboard/users',
  '/t/imprimerie-ipa/dashboard/order-roles',
  '/t/imprimerie-ipa/spaces',
  '/shop/boutique-1',
  '/shop/boutique-1/catalog',
  '/shop/boutique-1/g/flyer',
  '/shop/boutique-1/account/orders',
  '/shop/boutique-1/portal',
];

const args = process.argv.slice(2).filter((argument) => argument !== '--');
const defaultOutput = resolve(
  process.env.QUALITY_CHECK_ARTIFACTS_DIR || process.cwd(),
  'a11y-report.json',
);
const output = resolve(args[0] || defaultOutput);
mkdirSync(dirname(output), { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const results = [];
let executionError = false;

try {
  for (const route of routes) {
    const page = await context.newPage();
    const url = new URL(route, baseUrl).toString();
    process.stdout.write(`→ ${url}\n`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      const analysis = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      const violations = analysis.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        description: violation.description,
        help: violation.help,
        helpUrl: violation.helpUrl,
        nodes: violation.nodes.map((node) => ({
          target: node.target,
          html: node.html,
          failureSummary: node.failureSummary,
        })),
      }));
      results.push({ url, status: 'completed', violations });
      const blocking = violations.filter((violation) =>
        ['critical', 'serious'].includes(violation.impact),
      );
      process.stdout.write(
        `  ${violations.length} violation(s), ${blocking.length} sérieuse(s) ou critique(s)\n`,
      );
    } catch (error) {
      executionError = true;
      results.push({ url, status: 'failed', error: error.message, violations: [] });
      process.stderr.write(`  contrôle impossible : ${error.message}\n`);
    } finally {
      await page.close();
    }
  }
} finally {
  await context.close();
  await browser.close();
}

const blockingViolations = results.flatMap((result) => result.violations).filter((violation) =>
  ['critical', 'serious'].includes(violation.impact),
);
writeFileSync(
  output,
  `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    baseUrl,
    routes: results,
    summary: {
      routes: routes.length,
      failedRoutes: results.filter((result) => result.status === 'failed').length,
      violations: results.flatMap((result) => result.violations).length,
      blockingViolations: blockingViolations.length,
    },
  }, null, 2)}\n`,
);
process.stdout.write(`Rapport : ${output}\n`);

if (executionError || blockingViolations.length > 0) process.exit(1);
