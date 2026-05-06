// Charge .env.test si present, en silence sinon (tests skipped via SKIP_REASON)
import { config } from 'dotenv';
import { existsSync } from 'node:fs';

if (existsSync('.env.test')) {
  config({ path: '.env.test' });
} else if (existsSync('.env')) {
  config({ path: '.env' });
}
