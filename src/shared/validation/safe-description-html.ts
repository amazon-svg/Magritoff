import { z } from 'zod';

export const DESCRIPTION_HTML_MAX_LENGTH = 20_000;

const ALLOWED_TAGS = /<\/?(?:p|strong|em|ul|ol|li)>|<br\s*\/?>/gi;

export function isSafeDescriptionHtml(value: string): boolean {
  const withoutAllowedTags = value.replace(ALLOWED_TAGS, '');
  return !withoutAllowedTags.includes('<') && !withoutAllowedTags.includes('>');
}

export const safeDescriptionHtmlSchema = z.string()
  .trim()
  .max(DESCRIPTION_HTML_MAX_LENGTH)
  .refine(isSafeDescriptionHtml, {
    message: 'Seules les balises p, br, strong, em, ul, ol et li sans attribut sont autorisées.',
  });

export function escapeDescriptionHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildDescriptionHtml(
  label: string,
  details: Readonly<Record<string, unknown>> = {},
): string {
  const rows = Object.entries(details)
    .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
    .slice(0, 20)
    .map(([key, value]) => `<li><strong>${escapeDescriptionHtml(key)}</strong> : ${escapeDescriptionHtml(String(value))}</li>`);
  return `<p>${escapeDescriptionHtml(label)}</p>${rows.length > 0 ? `<ul>${rows.join('')}</ul>` : ''}`;
}
