#!/usr/bin/env node

import process from 'node:process';
import { syncMeetingTracking, validateMeetingTracking } from './meeting-tracking.mjs';

const root = process.cwd();
const { added, total } = await syncMeetingTracking(root);
const { errors } = await validateMeetingTracking(root);

if (errors.length) {
  console.error(`Registre des réunions invalide (${errors.length} erreur(s)) :`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Registre des réunions synchronisé : ${added} ajout(s), ${total} document(s).`);
