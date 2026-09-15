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
 *     node scripts/diagnostics/clariprint-variants/run.mjs --charge <fichier.json> --object <slug>
 *
 *   Exécution réelle (jamais lancée par un agent — décision d'Arnaud) :
 *     CLARIPRINT_HOST=... CLARIPRINT_LOGIN=... CLARIPRINT_PASSWORD=... \
 *     node scripts/diagnostics/clariprint-variants/run.mjs --charge <fichier.json> --object <slug> --execute
 *
 * `--charge <fichier.json>` est OBLIGATOIRE dans les deux modes : c'est la
 * charge EXACTE qui a produit le `-1` au smoke du 15/09 (capture réseau
 * réelle), jamais une reconstitution ni une valeur inventée par cet outil.
 *
 * Archive (arbitrage architecte, qa-review de `d8a0a57b`, point (2)) —
 * `results/<date>-<objet>/` :
 *   - `input.json` : la charge, sans `reference` ni `address` (COMMITÉ) ;
 *   - `calls.json` : le résumé de campagne + chaque appel, champs sur liste
 *     fermée (COMMITÉ) ;
 *   - `texts.local.json` : les textes d'erreur Clariprint après
 *     substitution des noms (IGNORÉ PAR GIT, `*.local.json`).
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { performRawCall } from './classification.mjs';
import { buildDryRunReport, runClariprintVariantsBench } from './runner.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, 'results');

function parseArgs(argv) {
  const options = { execute: false, chargePath: null, outDir: RESULTS_DIR, object: 'clariprint-variants' };
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

/** `performRawCall` fait le seul travail transport ; ici on ne fait que construire l'URL/le corps. */
function realCheckAuth(credentials) {
  const body = new URLSearchParams({ login: credentials.login, password: credentials.password, action: 'CheckAuth', datas: '{}' }).toString();
  return () => performRawCall(fetch, apiUrl(credentials.host), body);
}

function realQuote(credentials) {
  return (charge) => {
    const body = new URLSearchParams({
      login: credentials.login,
      password: credentials.password,
      action: 'QuoteRequest',
      datas: JSON.stringify({ clariprint_product: charge }),
    }).toString();
    return performRawCall(fetch, apiUrl(credentials.host), body);
  };
}

/**
 * `billed_calls_cumulative` (point 2) : somme des `billed_calls_used` des
 * campagnes PRÉCÉDENTES du même objet (autres dossiers `<date>-<objet>` sous
 * `results/`), lues depuis leur `calls.json` déjà commité. Best-effort : une
 * lecture impossible (dossier absent, JSON invalide) compte pour 0, jamais
 * une erreur bloquante — ce compteur est informatif, pas une barrière.
 */
async function readCumulativeBilledCalls(outDir, object, currentDirName) {
  let entries;
  try {
    entries = await readdir(outDir, { withFileTypes: true });
  } catch {
    return 0;
  }
  let total = 0;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === currentDirName) continue;
    if (!entry.name.endsWith(`-${object}`)) continue;
    try {
      // eslint-disable-next-line no-await-in-loop -- lecture sequentielle de quelques fichiers, hors chemin facture
      const raw = await readFile(join(outDir, entry.name, 'calls.json'), 'utf8');
      const parsed = JSON.parse(raw);
      if (typeof parsed.billed_calls_used === 'number') total += parsed.billed_calls_used;
    } catch {
      /* dossier partiel ou illisible : ignore, best-effort */
    }
  }
  return total;
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

  const date = new Date().toISOString().slice(0, 10);
  const campaignDirName = `${date}-${options.object}`;
  const campaignDir = join(options.outDir, campaignDirName);
  await mkdir(campaignDir, { recursive: true });

  const { expurgeChargeForDisplay } = await import('./plan.mjs');
  await writeFile(join(campaignDir, 'input.json'), JSON.stringify(expurgeChargeForDisplay(baseCharge), null, 2), 'utf8');

  const billedCallsCumulativeBefore = await readCumulativeBilledCalls(options.outDir, options.object, campaignDirName);

  const writeCallsJson = async ({ calls }) => {
    // Écrit APRÈS CHAQUE appel (point 2.3) — le résumé de campagne n'est pas
    // encore connu pendant la campagne : on écrit un résumé PARTIEL,
    // remplacé par le résumé final une fois `runClariprintVariantsBench`
    // terminé (voir plus bas). Une interruption laisse donc au pire un
    // résumé partiel, jamais aucun appel déjà payé perdu.
    const partial = {
      plan_version: undefined,
      max_billed_calls: undefined,
      billed_calls_used: calls.length,
      billed_calls_cumulative: billedCallsCumulativeBefore + calls.length,
      stop_reason: 'in_progress',
      phase_a_verdict: null,
      retained_rule: null,
      calls,
    };
    await writeFile(join(campaignDir, 'calls.json'), JSON.stringify(partial, null, 2), 'utf8');
  };
  const writeTextsLocal = async ({ texts }) => {
    if (texts.length === 0) return;
    await writeFile(join(campaignDir, 'texts.local.json'), JSON.stringify(texts, null, 2), 'utf8');
  };

  const outcome = await runClariprintVariantsBench({
    baseCharge,
    callCheckAuth: realCheckAuth(credentials),
    callQuote: realQuote(credentials),
    archive: async (state) => {
      await writeCallsJson(state);
      await writeTextsLocal(state);
    },
    billedCallsCumulativeBefore,
  });

  // Résumé FINAL, en remplacement du partiel écrit pendant la campagne.
  const {
    plan_version: planVersion,
    max_billed_calls: maxBilledCalls,
    billed_calls_used: billedCallsUsed,
    billed_calls_cumulative: billedCallsCumulative,
    stop_reason: stopReason,
    phase_a_verdict: phaseAVerdict,
    retained_rule: retainedRule,
    calls,
  } = outcome;
  await writeFile(
    join(campaignDir, 'calls.json'),
    JSON.stringify({ plan_version: planVersion, max_billed_calls: maxBilledCalls, billed_calls_used: billedCallsUsed, billed_calls_cumulative: billedCallsCumulative, stop_reason: stopReason, phase_a_verdict: phaseAVerdict, retained_rule: retainedRule, calls }, null, 2),
    'utf8',
  );
  await writeTextsLocal(outcome);

  console.log(JSON.stringify(
    {
      stop_reason: stopReason,
      phase_a_verdict: phaseAVerdict,
      retained_rule: retainedRule,
      cause: outcome.cause,
      acceptedFinishingCodes: outcome.acceptedFinishingCodes,
      billed_calls_used: billedCallsUsed,
      billed_calls_cumulative: billedCallsCumulative,
      archived_to: campaignDir,
    },
    null,
    2,
  ));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
