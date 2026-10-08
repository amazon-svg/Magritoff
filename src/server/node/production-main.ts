import { validateProductionEnvironment } from './http-configuration.ts';

process.env['NODE_ENV'] = 'production';
validateProductionEnvironment(process.env);
process.env['MAGRIT_SERVE_WEB'] = 'true';
await import('./main.ts');
