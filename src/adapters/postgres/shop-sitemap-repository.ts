import type { PostgresTransactionRunner } from './transaction-runner.ts';

export type PublicShopSitemap = Readonly<{
  shopSlug: string;
  gammeSlugs: readonly string[];
}>;

type SitemapPayload = Readonly<{
  shop_slug?: unknown;
  gamme_slugs?: unknown;
}>;

export class PostgresShopSitemapRepository {
  constructor(private readonly transactions: PostgresTransactionRunner) {}

  findPublicShop(slug: string): Promise<PublicShopSitemap | null> {
    return this.transactions.run({}, async (client) => {
      const payload = (await client.query<{ sitemap: SitemapPayload | null }>(
        'select magrit.public_shop_sitemap($1) sitemap',
        [slug],
      )).rows[0]?.sitemap ?? null;
      if (payload === null) return null;
      if (typeof payload.shop_slug !== 'string' || !Array.isArray(payload.gamme_slugs)
        || !payload.gamme_slugs.every((value) => typeof value === 'string')) {
        throw new Error('shop_sitemap.invalid_database_payload');
      }
      return {
        shopSlug: payload.shop_slug,
        gammeSlugs: payload.gamme_slugs,
      };
    });
  }
}
