import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, relative, resolve } from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';

const projectRoot = process.cwd();

function usage() {
  return `Usage : pnpm quality:audit --mode <diff|module|full> [options]

Options :
  --agent <id[,id]>   Limiter le run à un ou plusieurs auditeurs
  --base <ref>         Référence Git du mode diff (défaut: origin/main)
  --module <id>        Module requis pour le mode module
  --output <path>      Répertoire racine des rapports
  --plan               Générer le plan et les rapports sans exécuter les commandes
  --help               Afficher cette aide
`;
}

function parseArguments(argv) {
  const options = {
    mode: 'diff',
    agents: [],
    base: process.env.QUALITY_BASE_REF || 'origin/main',
    module: null,
    output: null,
    plan: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help') {
      console.log(usage());
      process.exit(0);
    }
    if (argument === '--plan') {
      options.plan = true;
      continue;
    }
    if (['--mode', '--agent', '--base', '--module', '--output'].includes(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Valeur manquante pour ${argument}`);
      index += 1;
      if (argument === '--mode') options.mode = value;
      if (argument === '--base') options.base = value;
      if (argument === '--module') options.module = value;
      if (argument === '--output') options.output = value;
      if (argument === '--agent') {
        options.agents.push(...value.split(',').map((item) => item.trim()).filter(Boolean));
      }
      continue;
    }
    throw new Error(`Option inconnue : ${argument}`);
  }

  if (!['diff', 'module', 'full'].includes(options.mode)) {
    throw new Error(`Mode inconnu : ${options.mode}`);
  }
  if (options.mode === 'module' && !options.module) {
    throw new Error('Le mode module exige --module <id>');
  }
  if (options.mode !== 'module' && options.module) {
    throw new Error('--module est uniquement accepté avec --mode module');
  }
  return options;
}

function runProcess(command, options = {}) {
  const result = spawnSync(command[0], command.slice(1), {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    env: process.env,
    ...options,
  });
  return result;
}

function git(args, allowFailure = false) {
  const result = runProcess(['git', ...args]);
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`git ${args.join(' ')} : ${result.stderr || result.stdout}`);
  }
  return (result.stdout ?? '').trim();
}

function splitLines(value) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function loadPolicy() {
  const path = resolve(projectRoot, 'quality/policy.yaml');
  const policy = parse(readFileSync(path, 'utf8'));
  if (policy?.schemaVersion !== '1.0' || policy?.policy !== 'advisory') {
    throw new Error('quality/policy.yaml doit déclarer schemaVersion 1.0 et policy advisory');
  }
  if (!policy.checks || !policy.agents) {
    throw new Error('quality/policy.yaml doit déclarer checks et agents');
  }
  return policy;
}

function validateConfiguration(policy, options) {
  const selectedAgents = options.agents.length > 0 ? [...new Set(options.agents)] : Object.keys(policy.agents);
  for (const agentId of selectedAgents) {
    const agent = policy.agents[agentId];
    if (!agent) throw new Error(`Auditeur inconnu : ${agentId}`);
    const profilePath = resolve(projectRoot, agent.profile);
    readFileSync(profilePath, 'utf8');
    for (const checkId of agent.checks?.[options.mode] ?? []) {
      const check = policy.checks[checkId];
      if (!check) throw new Error(`Contrôle inconnu ${checkId} pour l'auditeur ${agentId}`);
      if (!Array.isArray(check.command) || check.command.length === 0) {
        throw new Error(`Le contrôle ${checkId} doit déclarer une commande non vide`);
      }
    }
  }
  if (options.mode === 'module') {
    const modulePath = resolve(projectRoot, 'src/modules', options.module);
    const tracked = git(['ls-files', relative(projectRoot, modulePath)]);
    if (!tracked) throw new Error(`Module inconnu ou non suivi : ${options.module}`);
  }
  if (options.mode === 'diff') {
    git(['rev-parse', '--verify', options.base]);
  }
  return selectedAgents;
}

function buildContext(policy, options) {
  const sha = git(['rev-parse', 'HEAD']);
  const branch = git(['branch', '--show-current']) || '(detached)';
  const statusLines = splitLines(git(['status', '--short'], true));
  let trackedFiles;

  if (options.mode === 'diff') {
    trackedFiles = splitLines(
      git(['diff', '--name-only', '--diff-filter=ACMR', `${options.base}...HEAD`]),
    );
  } else if (options.mode === 'module') {
    const modulePrefix = `src/modules/${options.module}/`;
    trackedFiles = splitLines(git(['ls-files'])).filter(
      (path) => path.startsWith(modulePrefix) || path.includes(options.module),
    );
  } else {
    trackedFiles = splitLines(git(['ls-files']));
  }

  const modules = [...new Set(
    trackedFiles
      .map((path) => path.match(/^src\/modules\/([^/]+)\//)?.[1])
      .filter(Boolean),
  )].sort();
  const declaredSources = [
    ...(policy.context?.architectureSources ?? []),
    ...(policy.context?.uxSources ?? []),
  ];
  const missingSources = [...new Set(declaredSources)].filter((path) => {
    const result = runProcess(['test', '-f', resolve(projectRoot, path)]);
    return result.status !== 0;
  });

  return {
    schemaVersion: '1.0',
    mode: options.mode,
    module: options.module,
    base: options.mode === 'diff' ? options.base : null,
    commit: { sha, branch, dirty: statusLines.length > 0 },
    statusPaths: statusLines.map((line) => line.slice(3)),
    trackedFiles,
    modules,
    missingSources,
  };
}

function safeSegment(value) {
  return value.replace(/[^A-Za-z0-9._-]+/g, '-');
}

function createRunDirectory(policy, options, context) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runId = `${timestamp}-${context.commit.sha.slice(0, 12)}`;
  const reportsRoot = resolve(projectRoot, options.output || policy.reportsDirectory);
  const runDirectory = resolve(reportsRoot, safeSegment(runId));
  mkdirSync(resolve(runDirectory, 'agents'), { recursive: true });
  mkdirSync(resolve(runDirectory, 'evidence/checks'), { recursive: true });
  return { runId, runDirectory };
}

async function urlIsReachable(url) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(2500),
    });
    return response.status < 500;
  } catch {
    return false;
  }
}

async function preflightCheck(check) {
  if (check.enabledByEnvironment) {
    const value = (process.env[check.enabledByEnvironment] ?? '').toLowerCase();
    if (!['1', 'true', 'yes'].includes(value)) {
      return `contrôle désactivé ; définir ${check.enabledByEnvironment}=1 pour l'exécuter`;
    }
  }
  if (check.requiresUrl) {
    const url = process.env[check.requiresUrl.environment] || check.requiresUrl.default;
    if (!(await urlIsReachable(url))) {
      return `application indisponible sur ${url}`;
    }
  }
  return null;
}

function writeEvidence(path, checkId, check, result, startedAt, finishedAt) {
  const content = [
    `check: ${checkId}`,
    `title: ${check.title}`,
    `command: ${check.command.join(' ')}`,
    `startedAt: ${startedAt}`,
    `finishedAt: ${finishedAt}`,
    `exitCode: ${result.status ?? 'null'}`,
    '',
    '--- stdout ---',
    result.stdout || '',
    '',
    '--- stderr ---',
    result.stderr || '',
  ].join('\n');
  writeFileSync(path, content, 'utf8');
}

async function executeCheck(checkId, check, runDirectory, plan) {
  if (plan) {
    return {
      id: checkId,
      title: check.title,
      command: check.command,
      status: 'planned',
      severity: check.severity,
      exitCode: null,
      durationMs: 0,
      evidence: null,
      reason: 'mode plan : commande non exécutée',
    };
  }

  const preflightReason = await preflightCheck(check);
  if (preflightReason) {
    return {
      id: checkId,
      title: check.title,
      command: check.command,
      status: 'skipped',
      severity: check.severity,
      exitCode: null,
      durationMs: 0,
      evidence: null,
      reason: preflightReason,
    };
  }

  const startedAt = new Date().toISOString();
  const started = Date.now();
  const result = runProcess(check.command);
  const finishedAt = new Date().toISOString();
  const evidencePath = resolve(runDirectory, 'evidence/checks', `${safeSegment(checkId)}.log`);
  writeEvidence(evidencePath, checkId, check, result, startedAt, finishedAt);

  return {
    id: checkId,
    title: check.title,
    command: check.command,
    status: result.error ? 'error' : result.status === 0 ? 'passed' : 'failed',
    severity: check.severity,
    exitCode: result.status,
    durationMs: Date.now() - started,
    evidence: relative(projectRoot, evidencePath),
    reason: result.error ? result.error.message : null,
  };
}

function fingerprint(agentId, checkId) {
  return createHash('sha256').update(`${agentId}:${checkId}`).digest('hex').slice(0, 20);
}

function reportVerdict(checks, semanticAnalysis) {
  if (checks.some((check) => check.status === 'error')) return 'ERROR';
  if (checks.some((check) => check.status === 'failed')) return 'FAIL';
  if (semanticAnalysis !== 'completed') return 'INCONCLUSIVE';
  if (checks.some((check) => ['skipped', 'planned'].includes(check.status))) return 'INCONCLUSIVE';
  return 'PASS';
}

function buildFindings(agentId, checks) {
  return checks
    .filter((check) => ['failed', 'error'].includes(check.status))
    .map((check) => ({
      id: `${agentId}-${check.id}`,
      severity: check.status === 'error' ? 'critical' : check.severity,
      title: check.status === 'error' ? `Contrôle impossible : ${check.title}` : check.title,
      description:
        check.status === 'error'
          ? check.reason || 'Le contrôle n’a pas pu être exécuté.'
          : `La commande ${check.command.join(' ')} a terminé avec le code ${check.exitCode}.`,
      rule: null,
      location: null,
      evidence: check.evidence ? [check.evidence] : [],
      recommendation: 'Consulter la preuve avant de qualifier ou corriger le problème.',
      fingerprint: fingerprint(agentId, check.id),
    }));
}

function buildLimitations(agentId, checks, context, policy) {
  const limitations = [
    "L'analyse sémantique par le profil d'agent n'est pas encore exécutée par ce socle déterministe.",
  ];
  for (const check of checks.filter((item) => ['skipped', 'planned'].includes(item.status))) {
    limitations.push(`${check.title} : ${check.reason}`);
  }
  const relevantSources =
    agentId === 'ux'
      ? policy.context?.uxSources ?? []
      : agentId === 'architecture'
        ? policy.context?.architectureSources ?? []
        : [];
  for (const source of context.missingSources.filter((path) => relevantSources.includes(path))) {
    limitations.push(`Source canonique absente : ${source}`);
  }
  if (agentId === 'functional' && context.trackedFiles.every((path) => !path.startsWith('quality/specs/'))) {
    limitations.push('Aucune spécification fonctionnelle importée ne figure dans le périmètre audité.');
  }
  return limitations;
}

function markdownForReport(report) {
  const checkRows = report.checks.length
    ? report.checks
        .map(
          (check) =>
            `| ${check.id} | ${check.status} | ${check.exitCode ?? '—'} | ${check.durationMs} ms | ${check.reason ?? check.evidence ?? '—'} |`,
        )
        .join('\n')
    : '| — | skipped | — | 0 ms | Aucun contrôle configuré |';
  const findingLines = report.findings.length
    ? report.findings.map((finding) => `- **${finding.severity} — ${finding.title}** : ${finding.description}`).join('\n')
    : '- Aucun constat déterministe.';
  const limitationLines = report.limitations.map((item) => `- ${item}`).join('\n');

  return `# Rapport ${report.agent.title}

- Run : \`${report.runId}\`
- Commit : \`${report.commit.sha}\`
- Branche : \`${report.commit.branch}\`
- Mode : \`${report.mode}${report.module ? `:${report.module}` : ''}\`
- Politique : \`${report.policy}\` — non bloquante
- Verdict : **${report.verdict}**

${report.summary}

## Contrôles

| Contrôle | État | Code | Durée | Preuve ou raison |
|---|---:|---:|---:|---|
${checkRows}

## Constats

${findingLines}

## Limites

${limitationLines || '- Aucune limitation déclarée.'}
`;
}

function overallVerdict(reports) {
  const order = ['ERROR', 'FAIL', 'INCONCLUSIVE', 'WARN', 'PASS'];
  return order.find((verdict) => reports.some((report) => report.verdict === verdict)) ?? 'INCONCLUSIVE';
}

function summaryMarkdown(manifest, reports) {
  const rows = reports
    .map(
      (report) =>
        `| ${report.agent.title} | ${report.verdict} | ${report.checks.filter((item) => item.status === 'passed').length}/${report.checks.length} | ${report.findings.length} |`,
    )
    .join('\n');
  return `# Audit qualité Magrit

- Run : \`${manifest.runId}\`
- Commit : \`${manifest.commit.sha}\`
- Branche : \`${manifest.commit.branch}\`
- Mode : \`${manifest.mode}${manifest.module ? `:${manifest.module}` : ''}\`
- Politique : **advisory — aucun blocage de merge**
- Verdict consolidé : **${manifest.verdict}**

| Auditeur | Verdict | Contrôles réussis | Constats |
|---|---:|---:|---:|
${rows}

Les verdicts reflètent les preuves disponibles. Un rapport \`INCONCLUSIVE\`
signale notamment que l'analyse sémantique LLM ou un environnement réel n'a
pas encore été exécuté.
`;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const policy = loadPolicy();
  const selectedAgents = validateConfiguration(policy, options);
  const context = buildContext(policy, options);
  const { runId, runDirectory } = createRunDirectory(policy, options, context);
  writeFileSync(resolve(runDirectory, 'context.json'), `${JSON.stringify(context, null, 2)}\n`);

  console.log(`Audit ${runId} — mode ${options.mode}${options.module ? `:${options.module}` : ''}`);
  console.log(`Auditeurs : ${selectedAgents.join(', ')}`);
  if (options.plan) console.log('Mode plan : aucune commande ne sera exécutée.');

  const resultCache = new Map();
  const reports = [];
  const reportSchema = JSON.parse(
    readFileSync(resolve(projectRoot, 'quality/schemas/agent-report.schema.json'), 'utf8'),
  );
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validateReport = ajv.compile(reportSchema);

  for (const agentId of selectedAgents) {
    const agent = policy.agents[agentId];
    const startedAt = new Date().toISOString();
    const started = Date.now();
    const checks = [];
    for (const checkId of agent.checks?.[options.mode] ?? []) {
      if (!resultCache.has(checkId)) {
        console.log(`→ ${checkId} : ${policy.checks[checkId].title}`);
        resultCache.set(
          checkId,
          await executeCheck(checkId, policy.checks[checkId], runDirectory, options.plan),
        );
      }
      checks.push(structuredClone(resultCache.get(checkId)));
    }

    const semanticAnalysis = 'not-run';
    const findings = buildFindings(agentId, checks);
    const limitations = buildLimitations(agentId, checks, context, policy);
    const verdict = reportVerdict(checks, semanticAnalysis);
    const finishedAt = new Date().toISOString();
    const report = {
      schemaVersion: '1.0',
      runId,
      generatedAt: finishedAt,
      mode: options.mode,
      module: options.module,
      policy: 'advisory',
      commit: {
        sha: context.commit.sha,
        branch: context.commit.branch,
        base: context.base,
        dirty: context.commit.dirty,
      },
      agent: { id: agentId, title: agent.title, profile: agent.profile },
      execution: {
        startedAt,
        finishedAt,
        durationMs: Date.now() - started,
        semanticAnalysis,
      },
      verdict,
      summary:
        verdict === 'FAIL'
          ? `${findings.length} contrôle(s) déterministe(s) en échec ; décision humaine requise.`
          : 'Preuves déterministes collectées ; analyse sémantique restant à exécuter.',
      checks,
      findings,
      limitations,
    };

    if (!validateReport(report)) {
      throw new Error(
        `Rapport ${agentId} non conforme : ${ajv.errorsText(validateReport.errors, { separator: '; ' })}`,
      );
    }
    const jsonPath = resolve(runDirectory, 'agents', `${safeSegment(agentId)}.json`);
    const markdownPath = resolve(runDirectory, 'agents', `${safeSegment(agentId)}.md`);
    writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(markdownPath, markdownForReport(report));
    reports.push(report);
  }

  const manifest = {
    schemaVersion: '1.0',
    runId,
    generatedAt: new Date().toISOString(),
    mode: options.mode,
    module: options.module,
    policy: 'advisory',
    verdict: overallVerdict(reports),
    commit: context.commit,
    reports: reports.map((report) => ({
      agent: report.agent.id,
      verdict: report.verdict,
      json: `agents/${report.agent.id}.json`,
      markdown: `agents/${report.agent.id}.md`,
    })),
  };
  const summary = summaryMarkdown(manifest, reports);
  writeFileSync(resolve(runDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(resolve(runDirectory, 'summary.md'), summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);

  console.log(`Verdict consolidé : ${manifest.verdict}`);
  console.log(`Rapport : ${relative(projectRoot, resolve(runDirectory, 'summary.md'))}`);

  if (reports.some((report) => report.verdict === 'ERROR')) process.exitCode = 2;
}

main().catch((error) => {
  console.error(`Erreur du runner qualité : ${error.message}`);
  process.exitCode = 2;
});
