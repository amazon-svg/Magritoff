type Environment = Readonly<Record<string, string | undefined>>;

export function readHttpConfiguration(environment: Environment = process.env) {
  const production = environment['NODE_ENV'] === 'production';
  const value = environment['PORT'] ?? environment['MAGRIT_API_PORT'] ?? (production ? '8080' : '8787');
  const port = Number(value);
  if (!/^\d+$/.test(value) || !Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT ou MAGRIT_API_PORT doit être un entier entre 1 et 65535.');
  }
  return { host: environment['MAGRIT_API_HOST'] ?? (production || environment['PORT'] ? '0.0.0.0' : '127.0.0.1'), port };
}

export function validateProductionEnvironment(environment: Environment): void {
  const missing = ['DATABASE_URL', 'APP_BASE_URL', 'MAGRIT_AUTH_SECRET']
    .filter((name) => !environment[name]?.trim());
  if (missing.length > 0) throw new Error(`Configuration production manquante : ${missing.join(', ')}`);
}
