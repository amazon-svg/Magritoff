# DEV Quickstart — Magrit beta/v5

> Mini-procédure pour lancer/stopper le serveur Vite dev en local sur le port 5177 (branche `beta/v5`).

## TL;DR

```bash
pnpm dev:b5          # lance Vite en foreground (Ctrl-C pour stopper)
pnpm dev:b5:bg       # lance Vite en background (logs /tmp/magrit-vite-5177.log)
pnpm dev:b5:status   # vérifie si le serveur tourne
pnpm dev:b5:stop     # stoppe le serveur
```

Une fois lancé : **http://localhost:5177**

## Détail

Le script `scripts/dev-b5.sh` :

1. **Libère le port 5177** s'il est déjà occupé (kill -9 propre).
2. Lance `pnpm exec vite --port 5177 --strictPort` (échec si port pris, pas de fallback silencieux).
3. En mode `--bg`, attend jusqu'à 10s que le serveur réponde HTTP 200 et confirme.

### Modes

| Commande | Effet |
|---|---|
| `pnpm dev:b5` | **Foreground**. Bloque le terminal. Ctrl-C stoppe le serveur. Recommandé en dev actif (voir les logs HMR direct). |
| `pnpm dev:b5:bg` | **Background**. Détaché du terminal, logs redirigés vers `/tmp/magrit-vite-5177.log`. Utile quand on veut un autre terminal pour bosser. |
| `pnpm dev:b5:status` | **Diagnostic**. Vérifie si un process écoute sur 5177 + ping HTTP. |
| `pnpm dev:b5:stop` | **Kill**. Stoppe tout process écoutant sur 5177. |

### Variante directe

Le script peut être appelé sans passer par pnpm :

```bash
./scripts/dev-b5.sh           # foreground
./scripts/dev-b5.sh --bg      # background
./scripts/dev-b5.sh --stop    # stop
./scripts/dev-b5.sh --status  # status
./scripts/dev-b5.sh --help    # aide
```

## Tests rapides après lancement

- Boutique B2B : http://localhost:5177/shop/boutique-1 (slug à adapter)
- Atelier (multi-tenant) : http://localhost:5177/tenants → choisir un tenant
- Login : http://localhost:5177/login

## Ports utilisés sur les autres branches

| Branche | Port | Script |
|---|---|---|
| `main` (B1, prod) | 5173 | n/a (ne pas toucher) |
| `design/v2` (B2) | 5174 | n/a |
| `beta/v3` (B3, Supabase mort) | 5175 | n/a |
| `beta/v4` (B4, démo client) | 5176 | `pnpm dev` (script historique) |
| **`beta/v5` (notre branche)** | **5177** | **`pnpm dev:b5`** |

## Troubleshooting

### Port 5177 occupé même après `dev:b5:stop`

```bash
lsof -ti:5177       # liste les PID
kill -9 <PID>       # kill manuel
```

### Vite répond lentement la 1ère fois après installation

Re-optimisation des deps Vite si le lockfile a changé. C'est normal, ~5-10 s au 1er run après `pnpm install`.

### Background lancé via Claude Code

Si je (Claude) lance le serveur via `run_in_background`, tu peux le stopper d'un seul coup avec `pnpm dev:b5:stop`. Pratique quand la session se termine et qu'un Vite résiduel traîne.

---

*Procédure ajoutée 2026-05-11 — Le script et les alias `pnpm dev:b5*` sont commités sur `beta/v5`.*
