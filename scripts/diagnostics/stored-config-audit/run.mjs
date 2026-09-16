#!/usr/bin/env node
/**
 * Audit BCP-2 (docs/api/CONVENTIONS.md §8.25 point 3.2 / point 3.4 (d) 2)
 * — LECTURE SEULE, AUCUN APPEL CLARIPRINT.
 *
 * Répartition réelle des formes de `config.clariprintData` sur les produits
 * de boutique (`public.shop_products`) et de bibliothèque
 * (`public.product_library`). Sert à confirmer ou infirmer les formes
 * canoniques du point 3.2, et à chiffrer ce que le masquage dorure /
 * soft-touch (Q3, point 3.4) retire aux acheteurs.
 *
 * N'écrit RIEN en base : uniquement des requêtes GET PostgREST, avec
 * `Prefer: count=exact` pour la pagination. N'appelle jamais Clariprint.
 *
 *   node scripts/diagnostics/stored-config-audit/run.mjs
 *
 * Lit `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` depuis l'environnement
 * (chargés depuis `.env.test` si présent — jamais depuis une valeur en dur
 * dans ce fichier). Le résultat est un JSON imprimé sur stdout ; l'appelant
 * (story doc) en fait la synthèse. Aucune clé, aucun jeton n'est jamais
 * écrit dans la sortie.
 */
import { config as loadDotenv } from 'dotenv';
import process from 'node:process';

loadDotenv({ path: '.env.test', quiet: true });
loadDotenv({ quiet: true }); // .env / .env.local en repli, ne doit rien écraser de déjà défini

const PAGE_SIZE = 500;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variable d'environnement ${name} absente. Ce script lit .env.test (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) — jamais de clé en dur.`,
    );
  }
  return value;
}

/** Récupère toutes les lignes `id, config` d'une table, par pages, en lecture seule. */
async function fetchAllRows(baseUrl, serviceRoleKey, table) {
  const rows = [];
  let offset = 0;
  let total = null;
  for (;;) {
    const url = `${baseUrl}/rest/v1/${table}?select=id,config&order=id.asc&offset=${offset}&limit=${PAGE_SIZE}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: 'count=exact',
        'Accept-Profile': 'public',
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Lecture ${table} en echec HTTP ${res.status} : ${body.slice(0, 300)}`);
    }
    const contentRange = res.headers.get('content-range'); // ex: "0-499/1234"
    if (contentRange && total === null) {
      const match = /\/(\d+|\*)$/.exec(contentRange);
      if (match && match[1] !== '*') total = Number(match[1]);
    }
    const page = await res.json();
    rows.push(...page);
    offset += PAGE_SIZE;
    if (page.length < PAGE_SIZE) break;
    if (total !== null && rows.length >= total) break;
  }
  return rows;
}

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Classe la forme d'une valeur, sans jamais la reproduire en clair dans le rapport. */
function shapeOf(value) {
  if (value === undefined) return 'absent';
  if (value === null) return 'null';
  if (Array.isArray(value)) return `array(${value.length})`;
  if (isPlainObject(value)) return `object[${Object.keys(value).sort().join(',')}]`;
  return typeof value; // 'string' | 'number' | 'boolean'
}

function bump(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function mapToSortedEntries(map) {
  return Object.fromEntries([...map.entries()].sort((a, b) => b[1] - a[1]));
}

/**
 * Extrait l'objet clariprint effectif d'une config produit, selon la même
 * règle que `extractInitialOptions` (ProductOverlay.helpers.ts:239) :
 * `config.clariprintData` si présent, sinon `config` lui-même.
 */
function extractClariprintData(config) {
  if (!isPlainObject(config)) return { data: {}, nested: false, empty: true };
  if ('clariprintData' in config) {
    const nested = config.clariprintData;
    return { data: isPlainObject(nested) ? nested : {}, nested: true, empty: Object.keys(config).length === 0 };
  }
  return { data: config, nested: false, empty: Object.keys(config).length === 0 };
}

const FINISHING_KEYS = ['finishing_front', 'finishing_back', 'finishingFront', 'finishingVerso', 'finish', 'finishRecto', 'finishVerso'];

function collectFinishingValues(data) {
  const values = [];
  for (const key of FINISHING_KEYS) {
    const v = data[key];
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) values.push(...v.filter((x) => typeof x === 'string'));
    else if (typeof v === 'string') values.push(v);
  }
  return values;
}

function isDorureLike(text) {
  return typeof text === 'string' && /dor/i.test(text);
}
function isSoftTouchLike(text) {
  return typeof text === 'string' && /soft.?touch/i.test(text.toLowerCase());
}

function auditTable(tableName, rows) {
  const stats = {
    table: tableName,
    total_rows: rows.length,
    rows_with_config_object: 0,
    rows_with_empty_config: 0,
    rows_with_nested_clariprintData: 0,
    rows_flat_clariprintData: 0,
    width_shapes: new Map(),
    height_shapes: new Map(),
    papers_shapes: new Map(),
    front_colors_shapes: new Map(),
    back_colors_shapes: new Map(),
    kind_values: new Map(),
    finishing_field_names_seen: new Set(),
    finishing_values: new Map(),
    dorure_field_present_count: 0,
    dorure_value_shapes: new Map(),
    dorure_occurrences: 0, // valeur de dorure non vide / non "aucune"/"aucun"
    soft_touch_occurrences: 0,
    unexpected_forms: [],
  };

  for (const row of rows) {
    const { config } = row;
    if (isPlainObject(config)) stats.rows_with_config_object += 1;
    const { data, nested, empty } = extractClariprintData(config);
    if (empty) stats.rows_with_empty_config += 1;
    if (nested) stats.rows_with_nested_clariprintData += 1;
    else if (Object.keys(data).length > 0) stats.rows_flat_clariprintData += 1;

    if (Object.keys(data).length === 0) continue; // rien à classer pour cette ligne

    bump(stats.width_shapes, shapeOf(data.width));
    bump(stats.height_shapes, shapeOf(data.height));
    bump(stats.papers_shapes, shapeOf(data.papers ?? data.paper));
    bump(stats.front_colors_shapes, shapeOf(data.front_colors));
    bump(stats.back_colors_shapes, shapeOf(data.back_colors));
    bump(stats.kind_values, data.kind === undefined ? 'absent' : JSON.stringify(data.kind));

    for (const key of FINISHING_KEYS) {
      if (data[key] !== undefined) stats.finishing_field_names_seen.add(key);
    }
    const finishingValues = collectFinishingValues(data);
    for (const v of finishingValues) {
      bump(stats.finishing_values, v);
      if (isSoftTouchLike(v)) stats.soft_touch_occurrences += 1;
    }

    if (data.dorure !== undefined) {
      stats.dorure_field_present_count += 1;
      bump(stats.dorure_value_shapes, shapeOf(data.dorure));
      const v = data.dorure;
      if (typeof v === 'string' && v && !/^auc/i.test(v)) {
        stats.dorure_occurrences += 1;
      }
    }
    // Une "dorure" peut aussi apparaitre comme valeur de finition (mal rangee)
    for (const v of finishingValues) {
      if (isDorureLike(v)) stats.dorure_occurrences += 1;
    }

    // Filet de securite : recherche brute de "dor"/"gild"/"soft touch" sur
    // TOUT le sous-objet clariprint, au cas ou l'information vivrait sous une
    // cle non anticipee (ex. "gilding_front"). Ne compte qu'une fois par
    // ligne, independamment des compteurs cibles ci-dessus.
    const rawText = JSON.stringify(data).toLowerCase();
    if (/dor|gild/.test(rawText) && data.dorure === undefined && !finishingValues.some(isDorureLike)) {
      stats.unexpected_forms.push(`${tableName}#${row.id}: motif "dor"/"gild" trouve hors des cles anticipees (a inspecter manuellement)`);
    }
    if (/soft.?touch/.test(rawText) && !finishingValues.some(isSoftTouchLike)) {
      stats.unexpected_forms.push(`${tableName}#${row.id}: motif "soft touch" trouve hors des cles anticipees (a inspecter manuellement)`);
    }

    // Formes inattendues, notees sans jamais recopier de donnee commerciale ou personnelle
    if (data.width !== undefined && typeof data.width !== 'number' && typeof data.width !== 'string') {
      stats.unexpected_forms.push(`${tableName}#${row.id}: width de type ${typeof data.width}`);
    }
    if (data.kind !== undefined && !['leaflet', 'folded', 'book'].includes(data.kind)) {
      stats.unexpected_forms.push(`${tableName}#${row.id}: kind="${String(data.kind)}" hors formes canoniques (leaflet/folded/book)`);
    }
    if (data.papers !== undefined && !isPlainObject(data.papers) && !Array.isArray(data.papers) && typeof data.papers !== 'string') {
      stats.unexpected_forms.push(`${tableName}#${row.id}: papers de forme inattendue (${shapeOf(data.papers)})`);
    }
    if (isPlainObject(data.papers)) {
      const keys = Object.keys(data.papers);
      const expected = keys.length === 1 && (keys[0] === 'custom' || keys[0] === 'of');
      if (!expected) {
        stats.unexpected_forms.push(`${tableName}#${row.id}: papers objet avec cles [${keys.join(',')}] (canonique attend {custom} ou {of})`);
      }
    } else if (data.papers !== undefined || data.paper !== undefined) {
      // Canonique (point 3.2) : papers est TOUJOURS un objet a une cle. Une
      // chaine ou un tableau est une forme legacy, pas la forme canonique.
      stats.unexpected_forms.push(
        `${tableName}#${row.id}: papers/paper hors forme canonique objet (forme observee : ${shapeOf(data.papers ?? data.paper)})`,
      );
    }
    if (data.front_colors !== undefined && !Array.isArray(data.front_colors)) {
      stats.unexpected_forms.push(`${tableName}#${row.id}: front_colors hors forme canonique tableau (forme observee : ${shapeOf(data.front_colors)})`);
    }
    if (data.back_colors !== undefined && !Array.isArray(data.back_colors)) {
      stats.unexpected_forms.push(`${tableName}#${row.id}: back_colors hors forme canonique tableau (forme observee : ${shapeOf(data.back_colors)})`);
    }
  }

  return {
    ...stats,
    width_shapes: mapToSortedEntries(stats.width_shapes),
    height_shapes: mapToSortedEntries(stats.height_shapes),
    papers_shapes: mapToSortedEntries(stats.papers_shapes),
    front_colors_shapes: mapToSortedEntries(stats.front_colors_shapes),
    back_colors_shapes: mapToSortedEntries(stats.back_colors_shapes),
    kind_values: mapToSortedEntries(stats.kind_values),
    finishing_field_names_seen: [...stats.finishing_field_names_seen].sort(),
    finishing_values: mapToSortedEntries(stats.finishing_values),
    dorure_value_shapes: mapToSortedEntries(stats.dorure_value_shapes),
  };
}

async function main() {
  const baseUrl = requireEnv('SUPABASE_URL').replace(/\/+$/, '');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  const results = {};
  for (const table of ['shop_products', 'product_library']) {
    const rows = await fetchAllRows(baseUrl, serviceRoleKey, table);
    results[table] = auditTable(table, rows);
  }

  console.log(JSON.stringify({ source: baseUrl, generated_at: new Date().toISOString(), tables: results }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
