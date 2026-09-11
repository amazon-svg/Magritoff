import { readFileSync, readdirSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import process from 'node:process';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';

const root = process.cwd();
const specsDirectory = resolve(root, 'quality/specs');
const schemaPath = resolve(specsDirectory, 'spec.schema.json');
const templatePath = resolve(specsDirectory, '_template.spec.yaml');

function listSpecificationFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? listSpecificationFiles(path) : [path];
    })
    .filter((path) => path.endsWith('.spec.yaml') && !basename(path).startsWith('_'))
    .sort();
}

function displayPath(path) {
  return relative(root, path);
}

function readYaml(path) {
  try {
    return parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`${displayPath(path)} : YAML invalide — ${error.message}`);
  }
}

function assertUniqueIds(items, collectionName, path, errors) {
  const seen = new Set();
  for (const item of items ?? []) {
    if (seen.has(item.id)) {
      errors.push(`${displayPath(path)} : identifiant ${item.id} dupliqué dans ${collectionName}`);
    }
    seen.add(item.id);
  }
  return seen;
}

function checkSemanticLinks(specification, path) {
  const errors = [];
  const personaIds = assertUniqueIds(specification.personas, 'personas', path, errors);
  assertUniqueIds(specification.businessRules, 'businessRules', path, errors);
  const criterionIds = assertUniqueIds(
    specification.acceptanceCriteria,
    'acceptanceCriteria',
    path,
    errors,
  );
  assertUniqueIds(specification.scenarios, 'scenarios', path, errors);
  assertUniqueIds(specification.exemptions, 'exemptions', path, errors);

  for (const scenario of specification.scenarios ?? []) {
    if (!personaIds.has(scenario.persona)) {
      errors.push(
        `${displayPath(path)} : le scénario ${scenario.id} référence le persona inconnu ${scenario.persona}`,
      );
    }
    for (const criterionId of scenario.linkedCriteria) {
      if (!criterionIds.has(criterionId)) {
        errors.push(
          `${displayPath(path)} : le scénario ${scenario.id} référence le critère inconnu ${criterionId}`,
        );
      }
    }
  }

  return errors;
}

const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);
const files = [templatePath, ...listSpecificationFiles(specsDirectory)];
const errors = [];
const specificationIds = new Map();

for (const path of files) {
  const specification = readYaml(path);
  if (!validate(specification)) {
    for (const error of validate.errors ?? []) {
      errors.push(
        `${displayPath(path)}${error.instancePath || '/'} ${error.message ?? 'est invalide'}`,
      );
    }
    continue;
  }

  errors.push(...checkSemanticLinks(specification, path));

  if (path !== templatePath) {
    const firstPath = specificationIds.get(specification.id);
    if (firstPath) {
      errors.push(
        `${displayPath(path)} : identifiant de spécification ${specification.id} déjà utilisé dans ${displayPath(firstPath)}`,
      );
    } else {
      specificationIds.set(specification.id, path);
    }
  }
}

if (errors.length > 0) {
  console.error(`Spécifications invalides (${errors.length} erreur(s)) :`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Spécifications valides : modèle conforme, ${files.length - 1} spécification(s) importée(s).`,
);
