-- SQL genere depuis Better Auth 1.7.6, puis integre au runner Magrit afin
-- qu'aucune bibliotheque ne modifie le schema au demarrage de l'application.
create schema if not exists authn;

create table authn."user" (
  id text primary key,
  name text not null,
  email text not null unique,
  "emailVerified" boolean not null,
  image text,
  "createdAt" timestamptz not null default current_timestamp,
  "updatedAt" timestamptz not null default current_timestamp
);

create table authn.session (
  id text primary key,
  "expiresAt" timestamptz not null,
  token text not null unique,
  "createdAt" timestamptz not null default current_timestamp,
  "updatedAt" timestamptz not null,
  "ipAddress" text,
  "userAgent" text,
  "userId" text not null references authn."user"(id) on delete cascade
);

create table authn.account (
  id text primary key,
  "accountId" text not null,
  "providerId" text not null,
  "userId" text not null references authn."user"(id) on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope text,
  password text,
  "createdAt" timestamptz not null default current_timestamp,
  "updatedAt" timestamptz not null
);

create table authn.verification (
  id text primary key,
  identifier text not null,
  value text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default current_timestamp,
  "updatedAt" timestamptz not null default current_timestamp
);

create table authn."rateLimit" (
  id text primary key,
  key text not null unique,
  count integer not null,
  "lastRequest" bigint not null
);

create index "session_userId_idx" on authn.session ("userId");
create index "account_userId_idx" on authn.account ("userId");
create index verification_identifier_idx on authn.verification (identifier);

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'magrit_auth') then
    create role magrit_auth nologin nosuperuser nocreatedb nocreaterole noinherit;
  end if;
end
$$;

grant usage on schema authn to magrit_auth;
grant select, insert, update, delete
  on all tables in schema authn to magrit_auth;

comment on schema authn is
  'Tables internes Better Auth 1.7.6 ; interdites aux modules metier.';
comment on role magrit_auth is
  'Droits exclusifs du runtime d authentification locale Better Auth.';
