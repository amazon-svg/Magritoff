#!/usr/bin/env node
/**
 * BCP-1a (docs/api/CONVENTIONS.md §8.25 point 2.3) — le banc de rejeu
 * Clariprint. INSTRUMENT, PAS UNE CAPACITÉ : ni un endpoint, ni un rejeu
 * automatique en production. Lancé À LA MAIN, avec les identifiants dans
 * l'environnement — JAMAIS dans le dépôt.
 *
 * CHAQUE APPEL RÉEL EST FACTURÉ sur le compte Clariprint de la plateforme.
 *
 *   Mode sec (par défaut, AUCUN appel réseau) :
 *     node scripts/diagnostics/clariprint-variants/run.mjs --charge <fichier.json>
 *
 *   Exécution réelle (jamais lancée par un agent — décision d'Arnaud) :
 *     CLARIPRINT_HOST=... CLARIPRINT_LOGIN=... CLARIPRINT_PASSWORD=... \
 *     node scripts/diagnostics/clariprint-variants/run.mjs --charge <fichier.json> --execute
 *
 * `--charge <fichier.json>` est OBLIGATOIRE dans les deux modes : c'est la
 * charge EXACTE qui a produit le `-1` au smoke du 15/09 (capture réseau
 * réelle), jamais une reconstitution ni une valeur inventée par cet outil
 * (docs/api/CONVENTIONS.md §8.25 point 2.3, phase A du plan).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { buildDryRunReport, runClariprintVariantsBench } from './runner.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const options = { execute: false, chargePath: null, outDir: join(__dirname, 'results'), object: 'clariprint-variants' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--execute') options.execute = true;
    else if (arg === '--charge') options.chargePath = argv[(i += 1)];
    else if (arg === '--out') options.outDir = argv[(i += 1)];
    else if (arg === '--object') options.object = argv[(i += 1)];
  }
  return options;
}

async function loadBaseCharge(chargePath) {
  if (!chargePath) {
    throw new Error(
      'Charge manquante. Fournir --charge <fichier.json> contenant EXACTEMENT la configuration qui a produit le -1 au smoke du 15/09 (capture reseau reelle) — voir docs/api/CONVENTIONS.md §8.25 point 2.3. Cet outil n invente aucune charge.',
    );
  }
  const raw = await readFile(chargePath, 'utf8');
  return JSON.parse(raw);
}

function apiUrl(host) {
  const normalized = host.trim().replace(/\/+$/, '');
  const absolute = /^https?:\/\//.test(normalized) ? normalized : `https://${normalized}`;
  return absolute.includes('/optimproject/json.wcl') ? absolute : `${absolute}/optimproject/json.wcl`;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement ${name} absente. Jamais dans le depot — voir docs/api/CONVENTIONS.md §8.25 point 2.3.`);
  return value;
}

/** Appel Clariprint réel — CheckAuth. Compte comme un appel facturé (point 2.3). */
async function realCheckAuth(credentials) {
  const body = new URLSearchParams({ login: credentials.login, password: credentials.password, action: 'CheckAuth', datas: '{}' });
  const response = await fetch(apiUrl(credentials.host), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  let payload = null;
  try { payload = JSON.parse(text); } catch { /* reponse non JSON : traitee comme un refus */ }
  return { allowed: response.ok && payload?.success !== false };
}

/**
 * Appel Clariprint réel — QuoteRequest. Ce banc parle à Clariprint EN
 * DIRECT (pas via `HttpClariprintQuoteGateway`) : c'est un instrument de
 * diagnostic qui a besoin de la réponse brute pour juger si une variante
 * chiffre, indépendamment de l'expurgation faite par la passerelle de
 * production pour ses propres appelants.
 */
async function realQuote(credentials, charge) {
  const body = new URLSearchParams({
    login: credentials.login,
    password: credentials.password,
    action: 'QuoteRequest',
    datas: JSON.stringify({ clariprint_product: charge }),
  });
  const response = await fetch(apiUrl(credentials.host), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  let payload = null;
  try { payload = JSON.parse(text); } catch { return { priced: false }; }
  if (!payload || payload.success !== true) return { priced: false };
  const price = payload.response;
  const priced = typeof price === 'number' && Number.isFinite(price) && price >= 0;
  return priced ? { priced: true, price } : { priced: false };
}

async function archiveTo(outDir, object) {
  await mkdir(outDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const path = join(outDir, `${date}-${object}.json`);
  return async (calls) => {
    // L'archive s'écrit après CHAQUE appel (point 2.3) : une interruption
    // ne perd donc pas les appels déjà payés.
    await writeFile(path, JSON.stringify({ archivedAt: new Date().toISOString(), calls }, null, 2), 'utf8');
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseCharge = await loadBaseCharge(options.chargePath);

  if (!options.execute) {
    const report = buildDryRunReport(baseCharge);
    console.log(JSON.stringify(report, null, 2));
    console.log(
      `\nMode sec : aucun appel reseau effectue. ${report.totalPlannedCalls} appel(s) facture(s) au plus si --execute (plafond ${report.maxBilledCalls}).`,
    );
    return;
  }

  const credentials = {
    host: requireEnv('CLARIPRINT_HOST'),
    login: requireEnv('CLARIPRINT_LOGIN'),
    password: requireEnv('CLARIPRINT_PASSWORD'),
  };

  const archive = await archiveTo(options.outDir, options.object);
  const outcome = await runClariprintVariantsBench({
    baseCharge,
    callCheckAuth: () => realCheckAuth(credentials),
    callQuote: (charge) => realQuote(credentials, charge),
    archive,
  });

  console.log(JSON.stringify(
    {
      verdict: outcome.verdict,
      deterministic: outcome.deterministic,
      cause: outcome.cause,
      acceptedFinishingCodes: outcome.acceptedFinishingCodes,
      totalBilledCalls: outcome.totalBilledCalls,
    },
    null,
    2,
  ));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
