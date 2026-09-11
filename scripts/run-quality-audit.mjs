import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, relative, resolve } from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
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
  --semantic           Exécuter les profils avec le fournisseur LLM configuré
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
    semantic: false,
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
    if (argument === '--semantic') {
      options.semantic = true;
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
  if (options.plan && options.semantic) {
    throw new Error('--plan et --semantic ne peuvent pas être utilisés ensemble');
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

const semanticFilePatterns = {
  architecture: [
    /^(src|tests\/architecture|openapi|docs|quality)\//,
    /^(ARCHITECTURE|CLAUDE|SPRINT_HANDOFF)\.md$/,
  ],
  api: [
    /^openapi\//,
    /^src\/server\/api\//,
    /^src\/modules\/[^/]+\/(api|application)\//,
    /^src\/adapters\/supabase\//,
    /^tests\/(contract|sql|server)\//,
    /^docs\/api\//,
  ],
  functional: [/^quality\/specs\//, /^src\/modules\//, /^tests\//, /^_bmad-output\//],
  ux: [
    /^docs\/UX_GUIDELINES\.md$/,
    /^\.design-handoff\/(README\.md|wireframes\/)/,
    /^_bmad-output\/planning-artifacts\/ux-/,
    /^src\/styles\//,
    /^src\/modules\/[^/]+\/ui\//,
    /^tests\/e2e\//,
    /^playwright\.config\.ts$/,
  ],
  'test-quality': [
    /^tests\//,
    /^quality\/specs\//,
    /^openapi\//,
    /^(vitest|playwright)\.config\.ts$/,
    /^package\.json$/,
  ],
};

const semanticTextExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.sql',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);

function extensionOf(path) {
  const match = path.match(/(\.[A-Za-z0-9]+)$/);
  return match?.[1]?.toLowerCase() ?? '';
}

function semanticSourcesForAgent(agentId, context, policy) {
  const candidates = new Set(context.trackedFiles);
  const addSources = (sources) => {
    for (const path of sources ?? []) {
      if (!context.missingSources.includes(path)) candidates.add(path);
    }
  };

  if (agentId === 'architecture') addSources(policy.context?.architectureSources);
  if (agentId === 'ux') addSources(policy.context?.uxSources);
  if (['functional', 'test-quality'].includes(agentId)) {
    for (const path of splitLines(git(['ls-files'], true)).filter(
      (trackedPath) =>
        trackedPath.startsWith('quality/specs/') && trackedPath.endsWith('.spec.yaml'),
    )) candidates.add(path);
  }

  const patterns = semanticFilePatterns[agentId] ?? [];
  return [...candidates]
    .filter((path) => patterns.some((pattern) => pattern.test(path)))
    .filter((path) => semanticTextExtensions.has(extensionOf(path)))
    .filter((path) => !basename(path).startsWith('.env'))
    .sort();
}

function numberedFileParts(path, targetPartSize) {
  let source;
  try {
    source = readFileSync(resolve(projectRoot, path), 'utf8');
  } catch {
    return [];
  }
  if (source.includes('\u0000')) return [];

  const lines = source.split(/\r?\n/);
  const parts = [];
  let current = [];
  let currentSize = 0;
  let partStart = 1;

  for (let index = 0; index < lines.length; index += 1) {
    const numberedLine = `${String(index + 1).padStart(6, '0')} | ${lines[index]}`;
    if (current.length > 0 && currentSize + numberedLine.length + 1 > targetPartSize) {
      parts.push({
        path,
        startLine: partStart,
        endLine: index,
        content: current.join('\n'),
      });
      current = [];
      currentSize = 0;
      partStart = index + 1;
    }
    current.push(numberedLine);
    currentSize += numberedLine.length + 1;
  }
  if (current.length > 0) {
    parts.push({
      path,
      startLine: partStart,
      endLine: lines.length,
      content: current.join('\n'),
    });
  }
  return parts;
}

function buildSemanticBatches(agentId, context, policy) {
  const requestedBatchChars = Number.parseInt(process.env.QUALITY_LLM_BATCH_CHARS ?? '80000', 10);
  const requestedMaxBatches = Number.parseInt(process.env.QUALITY_LLM_MAX_BATCHES ?? '24', 10);
  const batchChars = Number.isFinite(requestedBatchChars)
    ? Math.min(Math.max(requestedBatchChars, 20000), 200000)
    : 80000;
  const maxBatches = Number.isFinite(requestedMaxBatches)
    ? Math.min(Math.max(requestedMaxBatches, 1), 200)
    : 24;
  const files = semanticSourcesForAgent(agentId, context, policy);
  const parts = files.flatMap((path) => numberedFileParts(path, Math.floor(batchChars * 0.8)));
  const batches = [];
  let current = [];
  let currentSize = 0;

  for (const part of parts) {
    const header = `FILE ${part.path} L${part.startLine}-L${part.endLine}`;
    const document = `${header}\n${part.content}`;
    if (current.length > 0 && currentSize + document.length + 2 > batchChars) {
      batches.push(current);
      current = [];
      currentSize = 0;
    }
    current.push({ ...part, document });
    currentSize += document.length + 2;
  }
  if (current.length > 0) batches.push(current);

  const selectedBatches = batches.slice(0, maxBatches);
  const analyzedFiles = new Set(selectedBatches.flatMap((batch) => batch.map((part) => part.path)));
  const omittedParts = batches.slice(maxBatches).reduce((count, batch) => count + batch.length, 0);
  return {
    files,
    batches: selectedBatches,
    analyzedFiles: [...analyzedFiles],
    omittedParts,
    batchChars,
    maxBatches,
  };
}

function semanticConfiguration() {
  const baseUrl = (process.env.QUALITY_LLM_BASE_URL ?? '').replace(/\/$/, '');
  const model = process.env.QUALITY_LLM_MODEL ?? '';
  const api = process.env.QUALITY_LLM_API || 'responses';
  if (!['responses', 'chat-completions'].includes(api)) {
    return { error: `QUALITY_LLM_API invalide : ${api}` };
  }
  if (!baseUrl || !model) {
    return {
      error: 'QUALITY_LLM_BASE_URL et QUALITY_LLM_MODEL sont requis avec --semantic',
    };
  }
  return {
    api,
    baseUrl,
    model,
    apiKey: process.env.QUALITY_LLM_API_KEY || process.env.OPENAI_API_KEY || '',
  };
}

function providerSchema(schema) {
  const result = structuredClone(schema);
  delete result.$schema;
  delete result.$id;
  delete result.title;
  return result;
}

function providerEndpoint(configuration) {
  return configuration.api === 'responses'
    ? `${configuration.baseUrl}/responses`
    : `${configuration.baseUrl}/chat/completions`;
}

function extractProviderText(configuration, response) {
  if (configuration.api === 'responses') {
    if (typeof response.output_text === 'string') return response.output_text;
    for (const item of response.output ?? []) {
      for (const content of item.content ?? []) {
        if (content.type === 'output_text' && typeof content.text === 'string') return content.text;
      }
    }
  } else {
    const content = response.choices?.[0]?.message?.content;
    if (typeof content === 'string') return content;
  }
  throw new Error('Le fournisseur n’a retourné aucun texte exploitable');
}

export async function requestSemanticAssessment(configuration, instructions, input, schema) {
  const format = {
    type: 'json_schema',
    name: 'quality_agent_assessment',
    strict: true,
    schema: providerSchema(schema),
  };
  const body =
    configuration.api === 'responses'
      ? {
          model: configuration.model,
          instructions,
          input,
          store: false,
          text: { format },
        }
      : {
          model: configuration.model,
          messages: [
            { role: 'system', content: instructions },
            { role: 'user', content: input },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: format.name,
              strict: format.strict,
              schema: format.schema,
            },
          },
          stream: false,
        };
  const headers = { 'content-type': 'application/json' };
  if (configuration.apiKey) headers.authorization = `Bearer ${configuration.apiKey}`;
  const timeoutMs = Number.parseInt(process.env.QUALITY_LLM_TIMEOUT_MS ?? '180000', 10);
  const response = await fetch(providerEndpoint(configuration), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(Number.isFinite(timeoutMs) ? timeoutMs : 180000),
  });
  const responseBody = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} du fournisseur : ${responseBody.slice(0, 1000)}`);
  }
  const parsedResponse = JSON.parse(responseBody);
  const text = extractProviderText(configuration, parsedResponse);
  return { providerResponse: parsedResponse, assessment: JSON.parse(text) };
}

function semanticVerdict(assessments) {
  const order = ['FAIL', 'INCONCLUSIVE', 'WARN', 'PASS'];
  return order.find((verdict) => assessments.some((item) => item.verdict === verdict)) ?? 'INCONCLUSIVE';
}

function deterministicEvidenceSummary(checks) {
  return checks
    .map(
      (check) =>
        `${check.id}: status=${check.status}, exitCode=${check.exitCode ?? 'null'}, evidence=${check.evidence ?? 'none'}, reason=${check.reason ?? 'none'}`,
    )
    .join('\n');
}

async function executeSemanticAgent(agentId, agent, checks, context, policy, runDirectory) {
  const configuration = semanticConfiguration();
  if (configuration.error) {
    return {
      status: 'failed',
      verdict: 'INCONCLUSIVE',
      summary: 'Analyse sémantique non exécutée faute de configuration du fournisseur.',
      findings: [],
      limitations: [configuration.error],
      metadata: null,
    };
  }

  const assessmentSchema = JSON.parse(
    readFileSync(resolve(projectRoot, 'quality/schemas/agent-assessment.schema.json'), 'utf8'),
  );
  const assessmentAjv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(assessmentAjv);
  const validateAssessment = assessmentAjv.compile(assessmentSchema);
  const profile = readFileSync(resolve(projectRoot, agent.profile), 'utf8');
  const sourceBatches = buildSemanticBatches(agentId, context, policy);
  const semanticDirectory = resolve(runDirectory, 'evidence/semantic');
  mkdirSync(semanticDirectory, { recursive: true });

  if (sourceBatches.batches.length === 0) {
    return {
      status: 'failed',
      verdict: 'INCONCLUSIVE',
      summary: 'Aucun fichier textuel pertinent dans le périmètre de cet auditeur.',
      findings: [],
      limitations: ['Aucun fichier pertinent n’a été sélectionné pour l’analyse sémantique.'],
      metadata: {
        api: configuration.api,
        baseUrl: configuration.baseUrl,
        model: configuration.model,
        batches: 0,
        filesAnalyzed: 0,
      },
    };
  }

  const instructions = `${profile}\n\nRègles d'exécution :\n- Tu es en lecture seule.\n- Analyse uniquement les fichiers et preuves fournis.\n- Chaque constat doit citer une preuve du lot sous la forme chemin:ligne ou un contrôle nommé.\n- N'invente ni fichier, ni test, ni exigence.\n- Une zone non démontrée est une limitation, pas un succès.\n- Retourne uniquement l'objet JSON conforme au schéma imposé.`;
  const assessments = [];
  const semanticLimitations = [];

  for (let index = 0; index < sourceBatches.batches.length; index += 1) {
    const batch = sourceBatches.batches[index];
    const input = `AUDIT MAGRIT\nAgent: ${agentId}\nMode: ${context.mode}${context.module ? `:${context.module}` : ''}\nCommit: ${context.commit.sha}\nLot: ${index + 1}/${sourceBatches.batches.length}\n\nPREUVES DETERMINISTES\n${deterministicEvidenceSummary(checks)}\n\nFICHIERS DU LOT\n${batch.map((part) => part.document).join('\n\n')}`;
    try {
      const result = await requestSemanticAssessment(
        configuration,
        instructions,
        input,
        assessmentSchema,
      );
      writeFileSync(
        resolve(semanticDirectory, `${safeSegment(agentId)}-batch-${index + 1}.json`),
        `${JSON.stringify(result.providerResponse, null, 2)}\n`,
      );
      if (!validateAssessment(result.assessment)) {
        throw new Error(
          `sortie non conforme : ${assessmentAjv.errorsText(validateAssessment.errors, { separator: '; ' })}`,
        );
      }
      assessments.push(result.assessment);
    } catch (error) {
      semanticLimitations.push(`Lot ${index + 1} non analysé : ${error.message}`);
      break;
    }
  }

  if (sourceBatches.omittedParts > 0) {
    semanticLimitations.push(
      `${sourceBatches.omittedParts} partie(s) omise(s) par la limite QUALITY_LLM_MAX_BATCHES=${sourceBatches.maxBatches}.`,
    );
  }

  const complete =
    assessments.length === sourceBatches.batches.length &&
    sourceBatches.omittedParts === 0 &&
    semanticLimitations.length === 0;
  const findingsByFingerprint = new Map();
  for (const assessment of assessments) {
    for (const finding of assessment.findings) {
      const stableFingerprint = createHash('sha256')
        .update(`${agentId}:${finding.rule ?? ''}:${finding.location ?? ''}:${finding.title}`)
        .digest('hex')
        .slice(0, 20);
      if (!findingsByFingerprint.has(stableFingerprint)) {
        findingsByFingerprint.set(stableFingerprint, {
          ...finding,
          id: `${agentId}-${stableFingerprint}`,
          fingerprint: stableFingerprint,
        });
      }
    }
    semanticLimitations.push(...assessment.limitations);
  }

  return {
    status: complete ? 'completed' : 'failed',
    verdict: complete ? semanticVerdict(assessments) : 'INCONCLUSIVE',
    summary:
      assessments.length > 0
        ? assessments.map((assessment) => assessment.summary).join(' ')
        : 'Aucun lot n’a pu être analysé par le fournisseur.',
    findings: [...findingsByFingerprint.values()],
    limitations: [...new Set(semanticLimitations)],
    metadata: {
      api: configuration.api,
      baseUrl: configuration.baseUrl,
      model: configuration.model,
      batches: assessments.length,
      filesAnalyzed: sourceBatches.analyzedFiles.length,
    },
  };
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

function reportVerdict(checks, semanticAnalysis, assessmentVerdict) {
  if (checks.some((check) => check.status === 'error')) return 'ERROR';
  if (checks.some((check) => check.status === 'failed')) return 'FAIL';
  if (semanticAnalysis !== 'completed') return 'INCONCLUSIVE';
  if (checks.some((check) => ['skipped', 'planned'].includes(check.status))) return 'INCONCLUSIVE';
  return assessmentVerdict;
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

function buildLimitations(agentId, checks, context, policy, semanticResult) {
  const limitations = [...semanticResult.limitations];
  if (semanticResult.status === 'not-run') {
    limitations.push(
      "L'analyse sémantique par le profil d'agent n'est pas exécutée sans l'option --semantic.",
    );
  }
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

    const semanticResult = options.semantic
      ? await executeSemanticAgent(agentId, agent, checks, context, policy, runDirectory)
      : {
          status: 'not-run',
          verdict: 'INCONCLUSIVE',
          summary: 'Analyse sémantique non demandée.',
          findings: [],
          limitations: [],
          metadata: null,
        };
    const semanticAnalysis = semanticResult.status;
    const findings = [...buildFindings(agentId, checks), ...semanticResult.findings];
    const limitations = buildLimitations(agentId, checks, context, policy, semanticResult);
    const verdict = reportVerdict(checks, semanticAnalysis, semanticResult.verdict);
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
        semantic: semanticResult.metadata,
      },
      verdict,
      summary: `${
        verdict === 'FAIL'
          ? `${findings.length} constat(s) ou contrôle(s) en échec ; décision humaine requise.`
          : 'Preuves déterministes collectées.'
      } ${semanticResult.summary}`,
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

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`Erreur du runner qualité : ${error.message}`);
    process.exitCode = 2;
  });
}
