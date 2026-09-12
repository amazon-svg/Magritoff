/**
 * Implementation Supabase des ports de `NotificationDispatchConsumer`
 * (story E10.15c) : lecture du CONTEXTE de rendu (a partir de l AGREGAT,
 * jamais de la seule charge utile du bus), resolution des destinataires, et
 * mise en file IDEMPOTENTE/REGROUPANTE.
 *
 * `client` DOIT etre un client `service_role` : la mise en file delegue a
 * `api_enqueue_notification_message` (`security definer`, grantee au SEUL
 * `service_role`), et les lectures traversent des tables dont la RLS
 * n ouvre pas necessairement ce chemin (le drain n a pas de session
 * utilisateur).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantId } from '../../kernel/ids/index.ts';
import type {
  ActiveNotificationTemplate,
  CustomerNotificationContext,
  DefaultShop,
  EnqueuedNotificationMessage,
  NotificationDispatchGateway,
  NotificationLogsWriteGateway,
  NotificationRecipient,
  OrderStepChangedDispatchContext,
  QuoteSentDispatchContext,
} from '../../modules/notifications/application/notification-dispatch-consumer.ts';
import type { NotificationChannel, NotificationEventName } from '../../modules/notifications/api/contracts.ts';

/** Meme liste que `SupabaseQuoteNotificationGateway` (commercial-quotes-repository.ts) : comptes boutique NOTIFIABLES (`suspended`/`delegated_only` exclus). */
const NOTIFIABLE_ACCOUNT_STATUSES = ['active', 'invited'] as const;

function isNotificationChannel(value: unknown): value is NotificationChannel {
  return value === 'email' || value === 'sms';
}

export class SupabaseNotificationDispatchGateway implements NotificationDispatchGateway, NotificationLogsWriteGateway {
  /** @param client Client `service_role`. */
  constructor(private readonly client: SupabaseClient<any>) {}

  async findActiveTemplates(
    tenantId: TenantId,
    eventName: NotificationEventName,
    toStepId: string | null,
  ): Promise<readonly ActiveNotificationTemplate[]> {
    // `toStepId` ne s applique qu a `order.step_changed` (SEUL evenement
    // `supports_step_filter`, catalogue) : un modele des trois autres
    // evenements branches par E10.15d-1 ne peut de toute facon jamais porter
    // de `production_step_id` (contrainte de base, §8.23 §4) — pas de filtre
    // supplementaire a poser pour eux.
    let query = this.client
      .from('notification_templates')
      .select('id, channel, audience, recipients, subject, body')
      .eq('tenant_id', tenantId)
      .eq('event_name', eventName)
      .eq('is_active', true);
    if (toStepId) {
      query = query.or(`production_step_id.is.null,production_step_id.eq.${toStepId}`);
    }
    const { data, error } = await query;
    if (error) throw new Error(`Lecture des modeles de notification actifs impossible: ${error.message}`);
    return ((data ?? []) as Record<string, any>[]).map((row) => ({
      id: row.id as string,
      channel: isNotificationChannel(row.channel) ? row.channel : 'email',
      audience: row.audience === 'explicit' ? 'explicit' : 'customer',
      recipients: (row.recipients as readonly string[] | null) ?? null,
      subject: (row.subject as string | null) ?? null,
      body: row.body as string,
    }));
  }

  async getOrderStepChangedContext(
    tenantId: TenantId,
    orderId: string,
    customerId: string,
    toStepId: string,
    fromStepId: string | null,
  ): Promise<OrderStepChangedDispatchContext | null> {
    const [customerContext, orderResult, stepsResult] = await Promise.all([
      this.resolveCustomerNotificationContext(tenantId, customerId),
      this.client
        .from('commercial_orders')
        .select('customer_reference, expected_delivery_date')
        .eq('id', orderId)
        .eq('tenant_id', tenantId)
        .maybeSingle(),
      this.client
        .from('production_steps')
        .select('id, label')
        .eq('tenant_id', tenantId)
        .in('id', fromStepId ? [toStepId, fromStepId] : [toStepId]),
    ]);

    if (orderResult.error) throw new Error(`Lecture de la commande impossible: ${orderResult.error.message}`);
    if (stepsResult.error) throw new Error(`Lecture des etapes de production impossible: ${stepsResult.error.message}`);

    const orderRow = orderResult.data as { customer_reference: string | null; expected_delivery_date: string | null } | null;
    if (!customerContext || !orderRow) return null;

    const steps = new Map<string, string>();
    for (const row of (stepsResult.data ?? []) as Array<{ id: string; label: string }>) {
      steps.set(row.id, row.label);
    }
    const stepLabel = steps.get(toStepId);
    if (!stepLabel) return null; // Defensif : l etape d arrivee vient d etre posee sur la commande.

    return {
      tenantName: customerContext.tenantName,
      customerCompanyName: customerContext.customerCompanyName,
      customerDefaultContactName: customerContext.customerDefaultContactName,
      orderCustomerReference: orderRow.customer_reference ?? null,
      orderExpectedDeliveryDate: orderRow.expected_delivery_date ?? null,
      stepLabel,
      stepPreviousLabel: fromStepId ? (steps.get(fromStepId) ?? null) : null,
    };
  }

  /**
   * Contexte partage de `quote.converted` et `customer.created` (E10.15d-1,
   * §8.23 §11.5). Meme lecture tenant + client + interlocuteur principal
   * qu `getOrderStepChangedContext`, EXTRAITE ICI pour que les trois
   * evenements lisent EXACTEMENT la meme chose de la meme facon.
   */
  async getCustomerNotificationContext(
    tenantId: TenantId,
    customerId: string,
  ): Promise<CustomerNotificationContext | null> {
    return this.resolveCustomerNotificationContext(tenantId, customerId);
  }

  /**
   * Contexte de `quote.sent` (E10.15d-1) : le contexte partage + la date de
   * validite du devis, LUE A LA REMISE (jamais deduite de la charge utile —
   * un renvoi a pu la recalculer, meme discipline que
   * `SupabaseQuoteNotificationGateway.getQuoteContext`, E10.10b-3).
   */
  async getQuoteSentDispatchContext(
    tenantId: TenantId,
    quoteId: string,
    customerId: string,
  ): Promise<QuoteSentDispatchContext | null> {
    const [customerContext, quoteResult] = await Promise.all([
      this.resolveCustomerNotificationContext(tenantId, customerId),
      this.client
        .from('commercial_quotes')
        .select('valid_until')
        .eq('id', quoteId)
        .eq('tenant_id', tenantId)
        .maybeSingle(),
    ]);

    if (quoteResult.error) throw new Error(`Lecture du devis impossible: ${quoteResult.error.message}`);
    const quoteRow = quoteResult.data as { valid_until: string | null } | null;
    if (!customerContext || !quoteRow) return null;

    return {
      tenantName: customerContext.tenantName,
      customerCompanyName: customerContext.customerCompanyName,
      customerDefaultContactName: customerContext.customerDefaultContactName,
      quoteValidUntil: quoteRow.valid_until ?? null,
    };
  }

  /**
   * Lecture PARTAGEE tenant + client + interlocuteur principal — MEME
   * requete EXACTE que celle jusqu ici EN LIGNE dans `getOrderStepChangedContext`
   * (E10.15c), extraite par E10.15d-1 pour servir aussi `quote.converted`,
   * `customer.created` et `quote.sent`. `null` si le tenant ou le client est
   * introuvable dans ce tenant (defensif).
   */
  private async resolveCustomerNotificationContext(
    tenantId: TenantId,
    customerId: string,
  ): Promise<CustomerNotificationContext | null> {
    const [tenantResult, customerResult, primaryContactResult] = await Promise.all([
      this.client.from('tenants').select('name').eq('id', tenantId).maybeSingle(),
      this.client
        .from('customers')
        .select('type, company_name, first_name, last_name')
        .eq('id', customerId)
        .eq('tenant_id', tenantId)
        .maybeSingle(),
      this.client
        .from('customer_contacts')
        .select('first_name, last_name')
        .eq('customer_id', customerId)
        .eq('is_primary', true)
        .maybeSingle(),
    ]);

    if (tenantResult.error) throw new Error(`Lecture du tenant impossible: ${tenantResult.error.message}`);
    if (customerResult.error) throw new Error(`Lecture du client impossible: ${customerResult.error.message}`);
    if (primaryContactResult.error) {
      throw new Error(`Lecture de l interlocuteur principal impossible: ${primaryContactResult.error.message}`);
    }

    const tenantRow = tenantResult.data as { name: string } | null;
    const customerRow = customerResult.data as
      | { type: string; company_name: string | null; first_name: string | null; last_name: string | null }
      | null;
    if (!tenantRow || !customerRow) return null;

    const primaryContact = primaryContactResult.data as { first_name: string; last_name: string } | null;
    const defaultContactName = primaryContact
      ? `${primaryContact.first_name} ${primaryContact.last_name}`.trim()
      : customerRow.type === 'individual'
        ? `${customerRow.first_name ?? ''} ${customerRow.last_name ?? ''}`.trim()
        : customerRow.company_name ?? '';

    return {
      tenantName: tenantRow.name,
      customerCompanyName: customerRow.company_name ?? null,
      customerDefaultContactName: defaultContactName,
    };
  }

  /** Meme requete EXACTE que `SupabaseQuoteNotificationGateway.resolveRecipients` (commercial-quotes-repository.ts) — jointure EXPLICITE `shops.tenant_id = tenantId` (le tenant de l EVENEMENT), meme raisonnement d isolation. */
  async resolveCustomerRecipients(tenantId: TenantId, customerId: string): Promise<readonly NotificationRecipient[]> {
    const { data, error } = await this.client
      .from('shop_customer_accounts')
      .select('email, full_name, status, customer_contacts!inner(customer_id), shops!inner(slug, name, tenant_id)')
      .eq('customer_contacts.customer_id', customerId)
      .eq('shops.tenant_id', tenantId)
      .in('status', NOTIFIABLE_ACCOUNT_STATUSES);
    if (error) throw new Error(`Resolution des destinataires de notification impossible: ${error.message}`);

    return ((data ?? []) as Record<string, any>[]).map((row) => {
      const shop = row['shops'] as { slug: string; name: string | null };
      const fullName = (row['full_name'] as string | null)?.trim();
      const email = row['email'] as string;
      const shopName = shop.name?.trim();
      return {
        email,
        contactName: fullName || email,
        shopSlug: shop.slug,
        shopName: shopName || shop.slug,
      };
    });
  }

  async resolveDefaultShop(tenantId: TenantId): Promise<DefaultShop | null> {
    // CORRIGE 2026-09-12 (M3, qa-review) : `.eq('active', true)` seul ne
    // filtre pas les boutiques SUPPRIMEES (soft delete, `deleted_at`) —
    // meme patron que `SupabaseShopRepository.loadActiveShopBySlug`
    // (shops-repository.ts).
    const { data, error } = await this.client
      .from('shops')
      .select('slug, name')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Resolution de la boutique par defaut impossible: ${error.message}`);
    if (!data) return null;
    const row = data as { slug: string; name: string | null };
    return { slug: row.slug, name: row.name?.trim() || row.slug };
  }

  async enqueue(
    tenantId: TenantId,
    event: Readonly<{
      id: string;
      name: string;
      aggregateType: string;
      aggregateId: string;
      coalescingWindowMinutes: number;
    }>,
    message: EnqueuedNotificationMessage,
  ): Promise<void> {
    const { error } = await this.client.rpc('api_enqueue_notification_message', {
      p_tenant_id: tenantId,
      p_event_id: event.id,
      p_event_name: event.name,
      p_aggregate_type: event.aggregateType,
      p_aggregate_id: event.aggregateId,
      p_template_id: message.templateId,
      p_channel: message.channel,
      p_status: message.status,
      p_recipient: message.recipient,
      p_subject: message.subject,
      p_body: message.body,
      p_last_error: message.lastError,
      p_coalescing_window_minutes: event.coalescingWindowMinutes,
    });
    if (error) throw new Error(`Mise en file de la notification impossible: ${error.message}`);
  }
}
