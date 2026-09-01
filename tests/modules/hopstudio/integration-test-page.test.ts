import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('page de test d intégration HopeStudio', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/modules/hopstudio/ui/HopeStudioIntegrationTestPage.tsx'),
    'utf8',
  );
  const workspaceSource = readFileSync(
    resolve(process.cwd(), 'src/modules/hopstudio/ui/HopeStudioWorkspace.tsx'),
    'utf8',
  );
  const configuratorSource = readFileSync(
    resolve(process.cwd(), 'src/modules/catalog/ui/workspace/ConfiguratorWorkspace.tsx'),
    'utf8',
  );
  const homeSource = readFileSync(
    resolve(process.cwd(), 'src/modules/catalog/ui/workspace/MagritConfiguratorHome.tsx'),
    'utf8',
  );
  const dualWorkspaceSource = readFileSync(
    resolve(process.cwd(), 'src/modules/catalog/ui/workspace/DualToolWorkspace.tsx'),
    'utf8',
  );
  const historyTemplate = readFileSync(
    resolve(process.cwd(), 'public/hopstudio/ejs/chat_user_sessions.ejs'),
    'utf8',
  );
  const assetsSource = readFileSync(
    resolve(process.cwd(), 'src/modules/hopstudio/ui/assets.ts'),
    'utf8',
  );
  const magritStyles = readFileSync(
    resolve(process.cwd(), 'public/vendor/hopstudio/1.0.0/css/sugarcrepeHLUX.magrit.css'),
    'utf8',
  );
  const productCardTemplate = readFileSync(
    resolve(process.cwd(), 'public/hopstudio/ejs/chat_product_card.ejs'),
    'utf8',
  );

  it('charge le bundle versionné et configure toutes les racines statiques', () => {
    expect(assetsSource).toContain("HOPSTUDIO_ASSET_ROOT = '/vendor/hopstudio/1.0.0/'");
    expect(assetsSource).toContain("HOPSTUDIO_EJS_ROOT = '/hopstudio/ejs/'");
    expect(assetsSource).toContain('sugarcrepeHLUX.magrit.css?v=');
    expect(source).toContain('root_ejs');
    expect(source).toContain('base: HOPSTUDIO_EJS_ROOT');
    expect(workspaceSource).toContain('base: HOPSTUDIO_EJS_ROOT');
    expect(source).toContain('root_img');
    expect(source).toContain('root_css');
    expect(source).toContain('root_lang');
  });

  it('conserve une copie personnalisable de tous les templates EJS du bundle', () => {
    const templates = (directory: string) => readdirSync(resolve(process.cwd(), directory))
      .filter((name) => name.endsWith('.ejs'))
      .sort();

    expect(templates('public/hopstudio/ejs')).toEqual(expect.arrayContaining(
      templates('public/vendor/hopstudio/1.0.0/ejs'),
    ));
  });

  it('utilise une identité et une API simulées sans inclure de secret', () => {
    expect(source).toContain('data-tenant="magrit-test-tenant"');
    expect(source).toContain('data-user="magrit-test-user"');
    expect(source).toContain("const TEST_API_URL = '/dev/hopstudio-api'");
    expect(source).toContain('id="chat-bar"');
    expect(source).toContain("sendMessage?.('Je veux 500 flyers')");
    expect(source).not.toContain('X-CLARIPRINT-PASS');
  });

  it('sépare l accueil Magrit du panneau HopeStudio et conserve ses actions', () => {
    expect(homeSource).toContain('Le papier pense.');
    expect(homeSource).toContain('magrit-configurator-prompt');
    expect(configuratorSource).toContain('createInitialConfiguratorRequest');
    expect(dualWorkspaceSource).toContain('Clariprint Studio');
    expect(dualWorkspaceSource).toContain('Recherche PIM');
    expect(dualWorkspaceSource).toContain('h-[calc(100dvh-3.5rem)]');
    expect(dualWorkspaceSource).toContain('grid-rows-[minmax(0,1fr)]');
    expect(workspaceSource).toContain('enhanceChatChrome');
    expect(workspaceSource).toContain("send.id = 'hopstudio-send'");
    expect(workspaceSource).toContain('sentInitialRequestIds');
    expect(workspaceSource).not.toContain('hopstudio-prompt-grid');
    expect(historyTemplate).toContain('Nouvelle conversation');
    expect(historyTemplate).toContain('hs-history-entry');
  });

  it('transforme les réponses HopeStudio en cartes produit Magrit responsives', () => {
    expect(workspaceSource).toContain('decorateProductCards');
    expect(workspaceSource).toContain("container.classList.add('hs-product-card')");
    expect(workspaceSource).toContain('getCardFromUid?.(uid)');
    expect(workspaceSource).toContain('buildProductCardView');
    expect(workspaceSource).toContain('chat_product_card.ejs');
    expect(workspaceSource).toContain('prefetchEJS([templateUrl])');
    expect(workspaceSource).toContain('if (!rendered.trim())');
    expect(workspaceSource).not.toContain('PRODUCT_FIELD_PATTERN');
    expect(workspaceSource).toContain('action.dataset.hsAction = kind');
    expect(productCardTemplate).toContain('product.specs.forEach');
    expect(productCardTemplate).toContain('hs-product-card-spec-value');
    expect(magritStyles).toContain('.hs-product-card-specs');
    expect(magritStyles).toContain("[data-hs-action='price']::before");
    expect(magritStyles).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(magritStyles).toContain('flex-direction: column');
    expect(magritStyles).toContain('position: relative');
    expect(magritStyles).toContain('background: #fff');
  });
});
