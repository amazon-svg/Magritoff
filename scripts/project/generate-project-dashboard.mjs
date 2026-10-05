#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { buildProjectDashboardModel } from './project-dashboard-data.mjs';
import { renderProjectDashboard } from './project-dashboard-template.mjs';

const root = process.cwd();
const output = path.join(root, 'project', 'dashboard', 'index.html');
const model = await buildProjectDashboardModel(root);
const html = renderProjectDashboard(model);

await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, html, 'utf8');

console.log(
  `Tableau de bord généré : ${path.relative(root, output)} ` +
  `(${model.metrics.epics} epics, ${model.metrics.features} fonctionnalités, ` +
  `${model.metrics.stories} stories, ${model.metrics.openQuestions} questions ouvertes).`,
);
