export function getEnv() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    throw new Error(
      'tests E2E requirent SUPABASE_URL + SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY dans .env.test',
    );
  }
  const projectRef = new URL(url).hostname.split('.')[0];
  return { url, anonKey, serviceKey, projectRef };
}
