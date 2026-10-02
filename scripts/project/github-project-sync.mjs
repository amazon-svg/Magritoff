#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import process from 'node:process';
import {
  FIELD_DEFINITIONS,
  buildSyncPlan,
  loadBacklog,
  summarizePlan,
} from './github-project-sync-lib.mjs';

function parseArguments(argv) {
  const options = {
    owner: process.env.GH_PROJECT_OWNER,
    project: process.env.GH_PROJECT_NUMBER,
    repository: process.env.GITHUB_REPOSITORY,
    ref: process.env.GH_PROJECT_SOURCE_REF || 'main',
    apply: false,
    bootstrapFields: false,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--') continue;
    if (argument === '--apply') options.apply = true;
    else if (argument === '--bootstrap-fields') options.bootstrapFields = true;
    else if (argument === '--json') options.json = true;
    else if (argument === '--owner') options.owner = argv[++index];
    else if (argument === '--project') options.project = argv[++index];
    else if (argument === '--repository') options.repository = argv[++index];
    else if (argument === '--ref') options.ref = argv[++index];
    else if (argument === '--help') options.help = true;
    else throw new Error(`Argument inconnu : ${argument}`);
  }
  return options;
}

function usage() {
  console.log(`Usage:
  node scripts/project/github-project-sync.mjs [options]

Sans --owner/--project, produit un plan local sans accès réseau.
Avec un projet configuré, compare le backlog au GitHub Project.
L'écriture distante exige toujours --apply.

Options:
  --owner LOGIN             propriétaire utilisateur ou organisation
  --project NUMBER          numéro du GitHub Project
  --repository OWNER/REPO   dépôt utilisé pour les liens canoniques
  --ref REF                 branche des liens, main par défaut
  --bootstrap-fields        crée les champs manquants (avec --apply)
  --apply                   applique les créations et mises à jour
  --json                    sortie JSON
  --help                    affiche cette aide
`);
}

function runGh(args, input) {
  try {
    return execFileSync('gh', args, {
      cwd: process.cwd(),
      encoding: 'utf8',
      input,
      maxBuffer: 20 * 1024 * 1024,
      env: process.env,
    }).trim();
  } catch (error) {
    const details = error.stderr?.toString().trim() || error.message;
    throw new Error(`Échec de gh ${args.join(' ')} : ${details}`);
  }
}

function ghJson(args) {
  const output = runGh(args);
  return output ? JSON.parse(output) : {};
}

function graphql(query, variables = {}) {
  const args = ['api', 'graphql', '-f', `query=${query}`];
  for (const [name, value] of Object.entries(variables)) {
    if (value !== null && value !== undefined) args.push('-f', `${name}=${value}`);
  }
  const response = ghJson(args);
  if (response.errors?.length) {
    throw new Error(response.errors.map((error) => error.message).join('; '));
  }
  return response.data;
}

function inferRepository() {
  const remote = runGh(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']);
  if (!remote) throw new Error('Impossible de déterminer le dépôt GitHub');
  return remote;
}

function projectInfo(owner, number) {
  const data = ghJson(['project', 'view', String(number), '--owner', owner, '--format', 'json']);
  if (!data.id) throw new Error(`Projet GitHub introuvable : ${owner}/${number}`);
  return data;
}

function projectFields(owner, number) {
  const data = ghJson([
    'project',
    'field-list',
    String(number),
    '--owner',
    owner,
    '--limit',
    '100',
    '--format',
    'json',
  ]);
  return data.fields ?? data;
}

function createMissingFields(owner, number, fields, apply) {
  let current = fields;
  const existing = new Set(current.map((field) => field.name));
  const missing = FIELD_DEFINITIONS.filter((field) => !existing.has(field.name));
  if (missing.length === 0) return current;
  if (!apply) {
    throw new Error(
      `Champs GitHub Project manquants : ${missing.map((field) => field.name).join(', ')}. ` +
        'Relancer avec --bootstrap-fields --apply.',
    );
  }
  for (const field of missing) {
    const args = [
      'project',
      'field-create',
      String(number),
      '--owner',
      owner,
      '--name',
      field.name,
      '--data-type',
      field.type,
    ];
    if (field.options) args.push('--single-select-options', field.options.join(','));
    runGh(args);
    console.log(`Champ créé : ${field.name}`);
  }
  current = projectFields(owner, number);
  return current;
}

function normalizeFields(fields) {
  return new Map(
    fields.map((field) => [
      field.name,
      {
        id: field.id,
        name: field.name,
        type: field.type ?? field.dataType,
        options: new Map((field.options ?? []).map((option) => [option.name, option.id])),
      },
    ]),
  );
}

function extractFieldValue(node) {
  if (node.text !== undefined) return node.text;
  if (node.name !== undefined) return node.name;
  if (node.date !== undefined) return node.date;
  if (node.number !== undefined) return String(node.number);
  return null;
}

function listRemoteItems(projectId) {
  const query = `
    query($projectId: ID!, $after: String) {
      node(id: $projectId) {
        ... on ProjectV2 {
          items(first: 100, after: $after) {
            pageInfo { hasNextPage endCursor }
            nodes {
              id
              content {
                ... on DraftIssue { id title body }
                ... on Issue { id title body url }
                ... on PullRequest { id title body url }
              }
              fieldValues(first: 50) {
                nodes {
                  ... on ProjectV2ItemFieldTextValue {
                    text
                    field { ... on ProjectV2FieldCommon { name } }
                  }
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    name
                    field { ... on ProjectV2FieldCommon { name } }
                  }
                  ... on ProjectV2ItemFieldDateValue {
                    date
                    field { ... on ProjectV2FieldCommon { name } }
                  }
                  ... on ProjectV2ItemFieldNumberValue {
                    number
                    field { ... on ProjectV2FieldCommon { name } }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
  const items = [];
  let after;
  do {
    const data = graphql(query, { projectId, after });
    const connection = data.node.items;
    for (const node of connection.nodes) {
      if (!node.content) continue;
      const fields = {};
      for (const fieldValue of node.fieldValues.nodes) {
        const name = fieldValue.field?.name;
        if (name) fields[name] = extractFieldValue(fieldValue);
      }
      const marker = node.content.body?.match(/<!-- magrit-backlog-id:\s*([^>]+?)\s*-->/)?.[1];
      items.push({
        itemId: node.id,
        contentId: node.content.id,
        title: node.content.title,
        body: node.content.body ?? '',
        url: node.content.url,
        fields,
        backlogId: fields['Backlog ID'] ?? marker ?? null,
      });
    }
    after = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : undefined;
  } while (after);
  return items;
}

function addDraft(projectId, title, body) {
  const mutation = `
    mutation($projectId: ID!, $title: String!, $body: String!) {
      addProjectV2DraftIssue(input: {projectId: $projectId, title: $title, body: $body}) {
        projectItem { id content { ... on DraftIssue { id } } }
      }
    }
  `;
  const data = graphql(mutation, { projectId, title, body });
  return {
    itemId: data.addProjectV2DraftIssue.projectItem.id,
    contentId: data.addProjectV2DraftIssue.projectItem.content.id,
  };
}

function fieldMutation(projectId, itemId, values, fieldsByName) {
  const declarations = ['$projectId: ID!', '$itemId: ID!'];
  const selections = [];
  const variables = { projectId, itemId };
  let index = 0;
  for (const [name, value] of Object.entries(values)) {
    const field = fieldsByName.get(name);
    if (!field) throw new Error(`Champ GitHub Project absent : ${name}`);
    const fieldVariable = `field${index}`;
    declarations.push(`$${fieldVariable}: ID!`);
    variables[fieldVariable] = field.id;
    if (value === null || value === undefined || value === '') {
      selections.push(
        `f${index}: clearProjectV2ItemFieldValue(input: {projectId: $projectId, itemId: $itemId, fieldId: $${fieldVariable}}) { projectV2Item { id } }`,
      );
    } else if (field.options.size > 0) {
      const optionId = field.options.get(value);
      if (!optionId) throw new Error(`Option absente pour ${name} : ${value}`);
      const valueVariable = `value${index}`;
      declarations.push(`$${valueVariable}: String!`);
      variables[valueVariable] = optionId;
      selections.push(
        `f${index}: updateProjectV2ItemFieldValue(input: {projectId: $projectId, itemId: $itemId, fieldId: $${fieldVariable}, value: {singleSelectOptionId: $${valueVariable}}}) { projectV2Item { id } }`,
      );
    } else {
      const valueVariable = `value${index}`;
      declarations.push(`$${valueVariable}: String!`);
      variables[valueVariable] = String(value);
      selections.push(
        `f${index}: updateProjectV2ItemFieldValue(input: {projectId: $projectId, itemId: $itemId, fieldId: $${fieldVariable}, value: {text: $${valueVariable}}}) { projectV2Item { id } }`,
      );
    }
    index += 1;
  }
  if (selections.length === 0) return;
  graphql(`mutation(${declarations.join(', ')}) { ${selections.join('\n')} }`, variables);
}

function updateDraft(contentId, title, body) {
  const mutation = `
    mutation($draftIssueId: ID!, $title: String!, $body: String!) {
      updateProjectV2DraftIssue(input: {draftIssueId: $draftIssueId, title: $title, body: $body}) {
        draftIssue { id }
      }
    }
  `;
  graphql(mutation, { draftIssueId: contentId, title, body });
}

function printPlan(actions, summary, json) {
  if (json) {
    console.log(
      JSON.stringify(
        {
          summary,
          actions: actions.map(({ action, id, title }) => ({ action, id, title })),
        },
        null,
        2,
      ),
    );
    return;
  }
  console.log(
    `Projection : ${summary.create} création(s), ${summary.update} mise(s) à jour, ` +
      `${summary.noop} inchangé(s), ${summary.stale} distant(s) sans source locale.`,
  );
  for (const action of actions.filter((entry) => entry.action !== 'noop')) {
    console.log(`- ${action.action.toUpperCase()} ${action.id}`);
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }
  const documents = await loadBacklog(process.cwd());
  if (!options.owner || !options.project) {
    if (options.apply || options.bootstrapFields) {
      throw new Error('--owner et --project sont requis pour une écriture distante');
    }
    const actions = documents.map((document) => ({
      action: 'create',
      id: document.id,
      title: `[${document.id}] ${document.title}`,
    }));
    printPlan(actions, summarizePlan(actions), options.json);
    return;
  }

  options.repository ||= inferRepository();
  const project = projectInfo(options.owner, options.project);
  let fields = projectFields(options.owner, options.project);
  const missing = FIELD_DEFINITIONS.filter(
    (definition) => !fields.some((field) => field.name === definition.name),
  );
  if (missing.length > 0) {
    if (!options.bootstrapFields) {
      throw new Error(
        `Champs manquants : ${missing.map((field) => field.name).join(', ')}. ` +
          'Utiliser --bootstrap-fields --apply pour les créer.',
      );
    }
    fields = createMissingFields(options.owner, options.project, fields, options.apply);
  }
  const fieldsByName = normalizeFields(fields);
  const remoteItems = listRemoteItems(project.id);
  const actions = buildSyncPlan(documents, remoteItems, options.repository, options.ref);
  const summary = summarizePlan(actions);
  printPlan(actions, summary, options.json);

  if (!options.apply) {
    console.log('Dry-run uniquement. Ajouter --apply pour écrire dans GitHub Project.');
    return;
  }

  for (const action of actions) {
    if (action.action === 'create') {
      const created = addDraft(project.id, action.title, action.body);
      fieldMutation(project.id, created.itemId, action.fields, fieldsByName);
      console.log(`Créé : ${action.id}`);
    } else if (action.action === 'update') {
      if (action.remote.url) {
        throw new Error(
          `${action.id}: élément lié à une issue ou PR ; la projection refuse de modifier son contenu`,
        );
      }
      if (action.contentChanged) {
        updateDraft(action.remote.contentId, action.title, action.body);
      }
      fieldMutation(project.id, action.remote.itemId, action.fields, fieldsByName);
      console.log(`Mis à jour : ${action.id}`);
    }
  }
  console.log('Projection terminée. Aucun élément distant absent du Markdown n’a été supprimé.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
