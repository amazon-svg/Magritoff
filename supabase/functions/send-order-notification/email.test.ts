/**
 * Tests Deno pour formatOrderNotificationEmail (Story S3.2-residual AC1).
 *
 * Lancer : `deno test --no-check supabase/functions/send-order-notification/email.test.ts`
 *
 * Cible : le helper pur de composition email (HTML + text + subject),
 * extrait pour testabilite. Pas de mock Resend/Supabase necessaire.
 */

import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { formatOrderNotificationEmail } from './_email.ts';

Deno.test('formatOrderNotificationEmail: subject contient short ID + shop name', () => {
  const r = formatOrderNotificationEmail({
    orderShortId: 'A1B2C3D4',
    shopName: 'Imprimerie IPA',
    buyerEmail: 'alice@example.com',
    totalLabel: '4 280,00 €',
    dashboardLink: 'https://b5.magrit.app/dashboard?tab=orders',
  });
  assertEquals(r.subject, 'Nouvelle commande #A1B2C3D4 sur Imprimerie IPA');
});

Deno.test('formatOrderNotificationEmail: HTML inclut tous les champs clefs', () => {
  const r = formatOrderNotificationEmail({
    orderShortId: 'XYZ12345',
    shopName: 'Cartes Pro',
    buyerEmail: 'arnaud@age-services.fr',
    totalLabel: '520,00 €',
    dashboardLink: 'https://b5.magrit.app/dashboard?tab=orders',
  });
  assertStringIncludes(r.html, 'XYZ12345');
  assertStringIncludes(r.html, 'Cartes Pro');
  assertStringIncludes(r.html, 'arnaud@age-services.fr');
  assertStringIncludes(r.html, '520,00');
  assertStringIncludes(r.html, 'https://b5.magrit.app/dashboard?tab=orders');
  assertStringIncludes(r.html, 'Voir la commande');
});

Deno.test('formatOrderNotificationEmail: text version contient les memes infos en plain text', () => {
  const r = formatOrderNotificationEmail({
    orderShortId: 'A1B2C3D4',
    shopName: 'Boutique Test',
    buyerEmail: 'test@example.com',
    totalLabel: '100,00 €',
    dashboardLink: 'https://example.com/dashboard',
  });
  assertStringIncludes(r.text, 'A1B2C3D4');
  assertStringIncludes(r.text, 'Boutique Test');
  assertStringIncludes(r.text, 'test@example.com');
  assertStringIncludes(r.text, '100,00');
  assertStringIncludes(r.text, 'https://example.com/dashboard');
  // Pas de balises HTML dans la version text
  assertEquals(r.text.includes('<'), false);
  assertEquals(r.text.includes('>'), false);
});

Deno.test('formatOrderNotificationEmail: buyer email absent => label fallback', () => {
  const r = formatOrderNotificationEmail({
    orderShortId: 'NULL1234',
    shopName: 'Test',
    buyerEmail: null,
    totalLabel: '50,00 €',
    dashboardLink: 'https://x.test',
  });
  assertStringIncludes(r.text, '(compte sans email visible)');
  assertStringIncludes(r.html, '(compte sans email visible)');
});

Deno.test("formatOrderNotificationEmail: echappe HTML dans les inputs (XSS defense)", () => {
  const r = formatOrderNotificationEmail({
    orderShortId: 'EVIL1234',
    shopName: '<script>alert("xss")</script>BadShop',
    buyerEmail: 'evil@<script>x</script>.com',
    totalLabel: '100 €',
    dashboardLink: 'https://x.test',
  });
  assertEquals(r.html.includes('<script>'), false);
  assertStringIncludes(r.html, '&lt;script&gt;');
});
