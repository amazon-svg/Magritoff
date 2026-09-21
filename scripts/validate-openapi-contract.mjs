#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';

const projectRoot = resolve(new URL('..', import.meta.url).pathname);
const contractPath = resolve(projectRoot, 'openapi/magrit-core.v1.yaml');

function fail(message) {
  console.error(`❌ OpenAPI invalide : ${message}`);
  process.exitCode = 1;
}

let document;
try {
  document = parse(readFileSync(contractPath, 'utf8'));
} catch (error) {
  fail(`YAML illisible (${error.message})`);
  process.exit();
}

const errors = [];
const warnings = [];
const operations = [];
const strictSummaries = process.env.OPENAPI_STRICT_SUMMARIES === '1';

if (document?.openapi !== '3.1.0') {
  errors.push('la version OpenAPI doit être 3.1.0');
}
if (!document?.info?.title || !document?.info?.version) {
  errors.push('info.title et info.version sont obligatoires');
}
if (!document?.paths || typeof document.paths !== 'object') {
  errors.push('paths doit être un objet non vide');
}

const methods = new Set(['get', 'put', 'post', 'patch', 'delete', 'options', 'head', 'trace']);
for (const [path, pathItem] of Object.entries(document?.paths ?? {})) {
  if (!path.startsWith('/')) errors.push(`${path}: un chemin doit commencer par /`);
  for (const [method, operation] of Object.entries(pathItem ?? {})) {
    if (!methods.has(method)) continue;
    if (!operation || typeof operation !== 'object') {
      errors.push(`${method.toUpperCase()} ${path}: opération invalide`);
      continue;
    }
    const label = `${method.toUpperCase()} ${path}`;
    if (!operation.operationId) errors.push(`${label}: operationId manquant`);
    if (!operation.summary) errors.push(`${label}: summary manquant`);
    if (operation.summary?.length > 120) {
      const message = `${label}: summary trop long (${operation.summary.length} caractères, maximum 120)`;
      if (strictSummaries) errors.push(message);
      else warnings.push(message);
    }
    if (!operation.responses || Object.keys(operation.responses).length === 0) {
      errors.push(`${label}: responses manquant`);
    }
    operations.push({ operationId: operation.operationId, label });
  }
}

const duplicateOperationIds = operations
  .map(({ operationId }) => operationId)
  .filter((operationId, index, values) => values.indexOf(operationId) !== index);
for (const operationId of [...new Set(duplicateOperationIds)]) {
  errors.push(`operationId dupliqué : ${operationId}`);
}

if (errors.length > 0) {
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`✅ Contrat OpenAPI valide (${operations.length} opérations vérifiées)`);
  if (warnings.length > 0) {
    console.warn(`⚠️ ${warnings.length} summary(s) dépassent 120 caractères (mode non strict)`);
    for (const warning of warnings.slice(0, 10)) console.warn(`- ${warning}`);
    if (warnings.length > 10) console.warn(`- ... ${warnings.length - 10} autre(s)`);
  }
}
