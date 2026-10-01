import type { UserId } from '../../kernel/ids/index.ts';
import type {
  GeneratePimDefinitionCommand,
  PimIngestReport,
  RunPimIngestCommand,
} from '../../modules/catalog/api/contracts.ts';
import type { AiPimDefinitionGenerator } from '../../modules/catalog/application/ai-pim-definition-generator.ts';
import type { CatalogAutomationGateway } from '../../modules/catalog/application/catalog-repository.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

type Candidate = Readonly<{
  id: string;
  raw_config: Record<string, unknown>;
  suggested_gamme: string | null;
}>;
type Gamme = Readonly<{
  slug: string;
  name: string;
  matching_rules: Record<string, unknown>;
  display_order: number;
}>;
type Definition = Readonly<{
  id: string;
  gamme_slug: string;
  variation_filter: Record<string, unknown>;
}>;

export class PostgresCatalogAutomationGateway implements CatalogAutomationGateway {
  constructor(
    private readonly transactions: PostgresTransactionRunner,
    private readonly generator: AiPimDefinitionGenerator,
  ) {}

  pendingCandidates(actor: UserId): Promise<number> {
    return this.transactions.run({ userId: actor }, async (client) => Number((
      await client.query<{ count: string }>(
        "select count(*) count from public.pim_candidates where status='pending'",
      )
    ).rows[0]?.count ?? 0));
  }

  async runIngest(actor: UserId, command: RunPimIngestCommand): Promise<PimIngestReport> {
    const snapshot = await this.transactions.run({ userId: actor }, async (client) => {
      const candidates = await client.query<Candidate>(`
          select id,raw_config,suggested_gamme from public.pim_candidates
           where status='pending' order by created_at,id limit 100
        `);
      const gammes = await client.query<Gamme>(`
          select slug,name,matching_rules,display_order from public.product_gammes
           order by display_order,slug
        `);
      const definitions = await client.query<Definition>(`
          select id,gamme_slug,variation_filter from public.product_definitions
        `);
      return { candidates: candidates.rows, gammes: gammes.rows, definitions: definitions.rows };
    });
    const report: PimIngestReport = {
      dryRun: command.dryRun,
      totalCandidates: snapshot.candidates.length,
      matched: [],
      rejected: [],
      enriched: [],
      errors: [],
    };

    for (const candidate of snapshot.candidates) {
      try {
        const raw = normalizeRaw(candidate.raw_config);
        const richness = richEnough(raw);
        if (richness !== null) {
          report.rejected.push({ candidateId: candidate.id, reason: richness });
          if (!command.dryRun) await this.reject(actor, candidate.id, richness);
          continue;
        }
        const gamme = resolveGamme(raw, candidate.suggested_gamme, snapshot.gammes);
        if (gamme === null) {
          const reason = 'Aucune gamme PIM ne matche cette configuration.';
          report.rejected.push({ candidateId: candidate.id, reason });
          if (!command.dryRun) await this.reject(actor, candidate.id, reason);
          continue;
        }
        const signature = canonicalKey(raw);
        const match = snapshot.definitions.find((definition) =>
          definition.gamme_slug === gamme.slug
          && definition.variation_filter['signature'] === signature);
        if (match !== undefined) {
          report.matched.push({ candidateId: candidate.id, matchedTo: match.id, gamme: gamme.slug });
          if (!command.dryRun) await this.supersede(actor, candidate.id, match.id);
          continue;
        }

        const enriched = await this.generator.generateDefinition({
          gammeSlug: gamme.slug,
          gammeName: gamme.name,
          gammeMatchingRules: gamme.matching_rules,
          locale: 'fr',
          variationFilter: raw,
          mode: 'generate',
        });
        if (command.dryRun) {
          report.enriched.push({ candidateId: candidate.id, definitionId: '(dry-run)', gamme: gamme.slug });
          continue;
        }
        const definitionId = await this.merge(actor, candidate, gamme, signature, raw, enriched);
        snapshot.definitions.push({
          id: definitionId,
          gamme_slug: gamme.slug,
          variation_filter: { signature },
        });
        report.enriched.push({ candidateId: candidate.id, definitionId, gamme: gamme.slug });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erreur inconnue.';
        report.errors.push({ candidateId: candidate.id, error: message });
        if (!command.dryRun) await this.noteError(actor, candidate.id, message);
      }
    }
    return report;
  }

  generateDefinition(_actor: UserId, command: GeneratePimDefinitionCommand): Promise<Record<string, unknown>> {
    return this.generator.generateDefinition(command);
  }

  private reject(actor: UserId, candidateId: string, reason: string): Promise<void> {
    return this.transactions.run({ userId: actor }, async (client) => {
      if (!await lockPendingCandidate(client, candidateId)) return;
      await client.query(`
        update public.pim_candidates
           set status='rejected',review_notes=$2,reviewed_by=$3,reviewed_at=clock_timestamp(),updated_at=clock_timestamp()
         where id=$1 and status='pending'
      `, [candidateId, reason, actor]);
    });
  }

  private supersede(actor: UserId, candidateId: string, definitionId: string): Promise<void> {
    return this.transactions.run({ userId: actor }, async (client) => {
      if (!await lockPendingCandidate(client, candidateId)) return;
      await client.query(`
        update public.product_definitions
           set order_count=order_count+1,last_ordered_at=clock_timestamp(),updated_at=clock_timestamp()
         where id=$1
      `, [definitionId]);
      await client.query(`
        update public.pim_candidates
           set status='superseded',merged_into=$2,reviewed_by=$3,
               reviewed_at=clock_timestamp(),updated_at=clock_timestamp()
         where id=$1 and status='pending'
      `, [candidateId, definitionId, actor]);
    });
  }

  private merge(
    actor: UserId,
    candidate: Candidate,
    gamme: Gamme,
    signature: string,
    raw: Record<string, unknown>,
    enriched: Record<string, unknown>,
  ): Promise<string> {
    return this.transactions.run({ userId: actor }, async (client) => {
      if (!await lockPendingCandidate(client, candidate.id)) {
        throw new Error('Le candidat PIM a deja ete traite.');
      }
      const result = await client.query<{ id: string }>(`
        insert into public.product_definitions(
          gamme_slug,variation_filter,locale,name,keywords,title_template,
          short_description_template,description_template,h1_template,seo_title,
          seo_description,seo_keywords,schema_org_type,usage_examples,faq,
          commercial_pitch,benefits,use_cases,technical_spec,generated_by,
          validated_by,order_count,last_ordered_at
        ) values(
          $1,$2,'fr',$3,$4,$5,$6,$7,$8,$9,$10,$4,'Product',$11,$12,$13,$14,$15,$16,
          'llm','pending',1,clock_timestamp()
        ) returning id
      `, [
        gamme.slug,
        { signature, kind: raw['kind'] ?? null, width: raw['width'] ?? null, height: raw['height'] ?? null },
        textValue(enriched['name']),
        stringArray(enriched['keywords'] ?? enriched['seo_keywords']),
        textValue(enriched['title_template']),
        textValue(enriched['short_description_template']),
        textValue(enriched['description_template']),
        textValue(enriched['h1_template']),
        textValue(enriched['seo_title']),
        textValue(enriched['seo_description']),
        jsonArray(enriched['usage_examples'] ?? enriched['use_cases']),
        jsonArray(enriched['faq']),
        textValue(enriched['commercial_pitch']),
        jsonArray(enriched['benefits']),
        jsonArray(enriched['use_cases']),
        raw,
      ]);
      const definitionId = result.rows[0]?.id;
      if (definitionId === undefined) throw new Error('Definition PIM non creee.');
      await client.query(`
        update public.pim_candidates
           set status='merged',merged_into=$2,llm_enrichment=$3,reviewed_by=$4,
               reviewed_at=clock_timestamp(),updated_at=clock_timestamp()
         where id=$1 and status='pending'
      `, [candidate.id, definitionId, enriched, actor]);
      return definitionId;
    });
  }

  private noteError(actor: UserId, candidateId: string, message: string): Promise<void> {
    return this.transactions.run({ userId: actor }, async (client) => {
      await client.query(`
        update public.pim_candidates set review_notes=$2,updated_at=clock_timestamp()
         where id=$1 and status='pending'
      `, [candidateId, message.slice(0, 2_000)]);
    }).catch(() => undefined);
  }
}

function normalizeRaw(raw: Record<string, unknown>): Record<string, unknown> {
  const nested = raw['clariprintData'] ?? raw['clariprint'];
  if (typeof nested !== 'object' || nested === null || Array.isArray(nested)) return raw;
  const normalized = { ...raw };
  for (const key of [
    'kind','width','height','papers','paper','front_colors','back_colors','finishing_front',
    'finishing_back','binding','folds','pages','with_bleeds','labels','reference','quantity',
  ]) {
    const value = (nested as Record<string, unknown>)[key];
    if (value !== undefined) normalized[key] = value;
  }
  return normalized;
}

function richEnough(raw: Record<string, unknown>): string | null {
  const kind = textValue(raw['kind']);
  const name = textValue(raw['name']);
  if (kind && (raw['width'] != null || raw['height'] != null || raw['quantity'] != null)) return null;
  if (kind && name && name.length > 2) return null;
  return 'Candidat trop pauvre : kind et dimensions ou quantite sont requis.';
}

function resolveGamme(raw: Record<string, unknown>, suggested: string | null, gammes: readonly Gamme[]): Gamme | null {
  if (suggested) {
    const explicit = gammes.find((gamme) => gamme.slug === suggested);
    if (explicit) return explicit;
  }
  const kind = textValue(raw['kind'])?.toLowerCase();
  const width = toMillimeters(raw['width']);
  const height = toMillimeters(raw['height']);
  const maxDimension = Math.max(width, height);
  return gammes
    .filter((gamme) => rulesMatch(gamme.matching_rules, raw, kind, width, height, maxDimension))
    .sort((left, right) => specificity(right.matching_rules) - specificity(left.matching_rules)
      || left.display_order - right.display_order
      || left.slug.localeCompare(right.slug))[0] ?? null;
}

function rulesMatch(rules: Record<string, unknown>, raw: Record<string, unknown>, kind: string | undefined, width: number, height: number, maxDimension: number): boolean {
  const allowedKinds = rules['kind'];
  if (typeof allowedKinds === 'string' && allowedKinds !== kind) return false;
  if (Array.isArray(allowedKinds) && !allowedKinds.includes(kind)) return false;
  const near = objectValue(rules['size_near']);
  if (near) {
    const expectedWidth = numberValue(near['width']);
    const expectedHeight = numberValue(near['height']);
    const tolerance = numberValue(near['tol']) ?? 5;
    if (expectedWidth !== undefined && expectedHeight !== undefined) {
      const direct = Math.abs(width - expectedWidth) <= tolerance && Math.abs(height - expectedHeight) <= tolerance;
      const swapped = Math.abs(height - expectedWidth) <= tolerance && Math.abs(width - expectedHeight) <= tolerance;
      if (!direct && !swapped) return false;
    }
  }
  const range = objectValue(rules['size_range']);
  if (range && maxDimension > 0) {
    const minimum = numberValue(range['min_dim']);
    const maximum = numberValue(range['max_dim']);
    if (minimum !== undefined && maxDimension < minimum) return false;
    if (maximum !== undefined && maxDimension > maximum) return false;
  }
  const bindings = rules['binding_in'];
  if (Array.isArray(bindings) && !bindings.includes(raw['binding'])) return false;
  if (rules['folds'] !== undefined && rules['folds'] !== raw['folds']) return false;
  const pages = objectValue(rules['pages_range']);
  const pageCount = numberValue(raw['pages']);
  if (pages && pageCount !== undefined) {
    const minimum = numberValue(pages['min']);
    const maximum = numberValue(pages['max']);
    if (minimum !== undefined && pageCount < minimum) return false;
    if (maximum !== undefined && pageCount > maximum) return false;
  }
  return true;
}

function specificity(rules: Record<string, unknown>): number {
  return (rules['kind'] ? 2 : 0) + (rules['size_near'] ? 5 : 0) + (rules['size_range'] ? 2 : 0)
    + (rules['binding_in'] ? 4 : 0) + (rules['folds'] ? 3 : 0) + (rules['pages_range'] ? 2 : 0);
}

function canonicalKey(raw: Record<string, unknown>): string {
  const paper = objectValue(raw['papers']);
  const custom = objectValue(paper?.['custom']);
  return [
    raw['kind'],raw['width'],raw['height'],
    custom ? `${custom['quality'] ?? ''}|${custom['weight'] ?? ''}` : raw['papers'] ?? raw['paper'],
    raw['finishing_front'],raw['finishing_back'],raw['binding'],raw['folds'],raw['pages'],
  ].map((value) => String(value ?? '').toLowerCase()).join('|');
}

function toMillimeters(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : 0;
  if (typeof value !== 'string') return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 10) : 0;
}
function textValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function stringArray(value: unknown): string[] | null {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : null;
}
function jsonArray(value: unknown): string {
  return JSON.stringify(Array.isArray(value) ? value : []);
}
function objectValue(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

async function lockPendingCandidate(
  client: { query: (text: string, values: readonly unknown[]) => Promise<{ rowCount: number | null }> },
  candidateId: string,
): Promise<boolean> {
  const result = await client.query(
    "select 1 from public.pim_candidates where id=$1 and status='pending' for update",
    [candidateId],
  );
  return result.rowCount === 1;
}
