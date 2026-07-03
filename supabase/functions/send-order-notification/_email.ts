/**
 * Helper email pour send-order-notification (Story S3.2-residual AC1).
 *
 * Isole de index.ts pour permettre les tests Deno sans declencher
 * le serve() top-level (qui essaye de bind un port).
 */

export interface OrderEmailContext {
  orderShortId: string;
  shopName: string;
  buyerEmail: string | null;
  totalLabel: string;
  dashboardLink: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatShortOrderId(uuid: string): string {
  return uuid.replace(/-/g, '').slice(0, 8).toUpperCase();
}

export function formatEuro(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

/**
 * Construit le contenu HTML + text de l'email.
 */
export function formatOrderNotificationEmail(ctx: OrderEmailContext): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Nouvelle commande #${ctx.orderShortId} sur ${ctx.shopName}`;
  const buyerLine = ctx.buyerEmail
    ? `Acheteur : ${escapeHtml(ctx.buyerEmail)}`
    : 'Acheteur : (compte sans email visible)';

  const text = [
    `Nouvelle commande #${ctx.orderShortId} vient d'etre passee sur votre boutique ${ctx.shopName}.`,
    '',
    buyerLine.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"),
    `Montant HT : ${ctx.totalLabel}`,
    '',
    `Detail : ${ctx.dashboardLink}`,
    '',
    '— Magrit',
  ].join('\n');

  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h2 style="font-size: 18px; font-weight: 500; margin: 0 0 16px;">
    Nouvelle commande <span style="font-family: monospace;">#${escapeHtml(ctx.orderShortId)}</span>
  </h2>
  <p style="font-size: 14px; line-height: 1.55; color: #555; margin: 0 0 16px;">
    Une commande vient d'etre passee sur votre boutique
    <strong>${escapeHtml(ctx.shopName)}</strong>.
  </p>
  <table style="border-collapse: collapse; margin: 16px 0; font-size: 13.5px;">
    <tr><td style="padding: 4px 12px 4px 0; color: #888;">${buyerLine}</td></tr>
    <tr><td style="padding: 4px 12px 4px 0; color: #888;">Montant HT : <strong>${escapeHtml(ctx.totalLabel)}</strong></td></tr>
  </table>
  <p style="margin: 24px 0;">
    <a href="${escapeHtml(ctx.dashboardLink)}"
       style="display: inline-block; padding: 10px 18px; background: #1a1a1a; color: #fff; text-decoration: none; border-radius: 6px; font-size: 13.5px;">
      Voir la commande
    </a>
  </p>
  <p style="font-size: 11.5px; color: #999; margin: 32px 0 0;">— Magrit</p>
</body></html>`.trim();

  return { subject, html, text };
}
