import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('architecture — runtime des commandes commerciales portable', () => {
  it('monte les routes Node avec PostgreSQL et S3', () => {
    const main = read('src/server/node/main.ts');
    expect(main).toContain(
      "import { PostgresCommercialOrdersRepository } from '../../adapters/postgres/commercial-orders-repository.ts'",
    );
    expect(main).toContain(
      "import { PostgresOrderDocumentsRepository } from '../../adapters/postgres/order-documents-repository.ts'",
    );
    expect(main).toContain(
      "import { PostgresOrderFilesRepository } from '../../adapters/postgres/order-files-repository.ts'",
    );
    expect(main).toContain(
      "import { PostgresOrderUploadLinksRepository } from '../../adapters/postgres/order-upload-links-repository.ts'",
    );
    expect(main).toContain('const commercialOrdersRoutes =');
    expect(main).toContain('...commercialOrdersRoutes');
    expect(main).toContain('...orderFilesRoutes');
    expect(main).toContain('...orderUploadLinksRoutes');
    expect(main).toContain("pathname.startsWith('/api/v1/commercial-orders/')");
    expect(main).not.toContain('SupabaseCommercialOrdersRepository');
    expect(main).not.toContain('SupabaseOrderDocumentsRepository');
    expect(main).not.toContain('SupabaseOrderFilesRepository');
    expect(main).not.toContain('SupabaseOrderUploadLinksRepository');
  });

  it('ne dépend pas du SDK Supabase dans les adaptateurs locaux', () => {
    for (const path of [
      'src/adapters/postgres/commercial-orders-repository.ts',
      'src/adapters/postgres/order-documents-repository.ts',
      'src/adapters/postgres/order-files-repository.ts',
      'src/adapters/postgres/order-upload-links-repository.ts',
    ]) {
      const source = read(path);
      expect(source).not.toContain('@supabase/supabase-js');
      expect(source).not.toContain('.rpc(');
      expect(source).not.toContain(".from('commercial_orders')");
      expect(source).not.toContain(".from('order_documents')");
    }
  });
});
