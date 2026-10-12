-- Execute apres les migrations, par le proprietaire de cette base dediee.
-- Les mots de passe arrivent via des variables psql, jamais depuis Git.
SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS', name)
FROM (VALUES ('magrit_api_login'), ('magrit_worker_login')) AS logins(name)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = name)
\gexec
ALTER ROLE magrit_api_login PASSWORD :'api_password';
ALTER ROLE magrit_worker_login PASSWORD :'worker_password';
GRANT magrit_api TO magrit_api_login WITH INHERIT FALSE;
GRANT magrit_auth TO magrit_api_login WITH INHERIT TRUE;
GRANT magrit_worker TO magrit_worker_login WITH INHERIT FALSE;
