# ADR 0001 — Sortie progressive de Supabase

- Statut : accepte
- Date : 2026-09-29
- Decisionnaires : equipe Magrit

## Contexte

Magrit depend actuellement de PostgreSQL, Auth, Storage, PostgREST et des
fonctions Edge fournis par Supabase. Cette concentration rend le developpement
et l'exploitation dependants d'une plateforme sans engagement de service
adapte au projet. Le projet n'etant pas encore en production, la migration est
moins risquee maintenant qu'apres la mise en service.

## Decision

Supabase est remplace progressivement par des composants standards et
substituables :

- PostgreSQL 17 accessible par le protocole PostgreSQL ;
- stockage objet compatible S3 ;
- API et worker TypeScript/Node 22 conteneurisables ;
- bibliotheque d'authentification open source utilisant PostgreSQL ;
- OpenID Connect configurable par boutique pour les identites clientes ;
- fournisseur d'email transactionnel derriere un adaptateur.

Les UUID metier existants sont conserves. La migration se fait par adaptateur.
La coexistence temporaire des chemins Supabase et standards a pris fin dans le
runtime applicatif le 1er octobre 2026 : les anciennes migrations SQL restent
une archive de reprise jusqu'aux repetitions de bascule. Aucun nouveau code,
outil actif ou workflow CI ne doit réintroduire une dependance Supabase.

Redis, ou un service compatible, ne fait pas partie du socle initial. Les
sessions, outbox, files de travaux et verrous restent dans PostgreSQL ; les
caches HTTP relevent du reverse proxy ou du CDN. Un cache distribue ne sera
ajoute qu'apres une mesure montrant un besoin de coordination ou de performance
que PostgreSQL et les caches locaux ne couvrent pas.

## Consequences

Le projet gagne la possibilite de changer separement de fournisseur de base,
de stockage, d'identite et de calcul. En contrepartie, Magrit devient
responsable de l'API, des migrations, de l'authentification, des sauvegardes,
de la supervision et des procedures de reprise.

La transition restante concerne les donnees et l'exploitation. Chaque reprise
doit etre testee, observable et reversible tant que des ecritures ne sont pas
acceptees exclusivement par la nouvelle cible.

## Mise en oeuvre

Le deroulement, les criteres de sortie et les inventaires sont maintenus dans
`docs/MIGRATION_HORS_SUPABASE.md`. Le premier socle livre PostgreSQL,
SeaweedFS/S3 et Mailpit en local ainsi qu'un garde-fou contre l'augmentation de
la dette Supabase.
