import { describe, expect, it } from 'vitest';
import {
  buildDescriptionHtml,
  isSafeDescriptionHtml,
  safeDescriptionHtmlSchema,
} from '@/shared/validation/safe-description-html';

describe('safeDescriptionHtml', () => {
  it('accepte uniquement le sous-ensemble HTML commercial sans attribut', () => {
    const html = '<p><strong>Affiche</strong><br>Recto verso</p><ul><li>500 ex.</li></ul>';

    expect(isSafeDescriptionHtml(html)).toBe(true);
    expect(safeDescriptionHtmlSchema.parse(html)).toBe(html);
  });

  it.each([
    '<script>alert(1)</script>',
    '<p onclick="alert(1)">Texte</p>',
    '<a href="https://example.test">Lien</a>',
    '<img src=x onerror=alert(1)>',
  ])('rejette le HTML actif ou non autorise : %s', (html) => {
    expect(isSafeDescriptionHtml(html)).toBe(false);
    expect(safeDescriptionHtmlSchema.safeParse(html).success).toBe(false);
  });

  it('echappe le libelle et les valeurs construits depuis un payload externe', () => {
    const html = buildDescriptionHtml('<img src=x>', {
      format: '<script>alert(1)</script>',
      quantity: 500,
      nested: { ignored: true },
    });

    expect(html).toContain('&lt;img src=x&gt;');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('<strong>quantity</strong> : 500');
    expect(html).not.toContain('<img');
    expect(isSafeDescriptionHtml(html)).toBe(true);
  });
});
