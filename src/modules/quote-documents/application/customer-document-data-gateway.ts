/**
 * Resolution des donnees CLIENT necessaires au document (`customer.*`),
 * story E10.10b-4c. Delegue ENTIEREMENT a `CustomersRepository.findDetailById`
 * (module `customers`, E10.4 — deja instancie ailleurs dans la composition) :
 * aucune requete Supabase n est ecrite ici, c est un ASSEMBLAGE de donnees
 * deja lues par un port existant, pas un nouvel acces base (regle R5 —
 * etendre, ne pas dupliquer).
 *
 * `contactName`/`email`/`phone` proviennent de l interlocuteur PRINCIPAL
 * (`is_primary`), ou du premier interlocuteur si aucun n est marque
 * principal (etat transitoire legitime, jamais bloquant) ; `null` si le
 * client n a AUCUN interlocuteur.
 */
import type { TenantId } from '../../../kernel/ids/index.ts';
import type { CustomersRepository } from '../../customers/application/customers-repository.ts';
import type { CustomerDocumentData, CustomerDocumentDataPort } from './quote-documents-service.ts';

export class CustomersRepositoryDocumentDataGateway implements CustomerDocumentDataPort {
  constructor(private readonly customers: CustomersRepository) {}

  async findCustomerForDocument(tenantId: TenantId, customerId: string): Promise<CustomerDocumentData | null> {
    const detail = await this.customers.findDetailById(tenantId, customerId);
    if (!detail) return null;

    const primaryContact = detail.contacts.find((contact) => contact.is_primary) ?? detail.contacts[0] ?? null;
    const contactName = primaryContact ? `${primaryContact.first_name} ${primaryContact.last_name}`.trim() : null;

    return {
      companyName: detail.company_name,
      contactName: contactName && contactName.length > 0 ? contactName : null,
      billingLine1: detail.billing_address?.line1 ?? null,
      billingLine2: detail.billing_address?.line2 ?? null,
      billingPostalCode: detail.billing_address?.postal_code ?? null,
      billingCity: detail.billing_address?.city ?? null,
      billingCountry: detail.billing_address?.country ?? null,
      email: primaryContact?.email ?? null,
      phone: primaryContact?.phone ?? null,
      siret: detail.siret,
      vatNumber: detail.vat_number,
    };
  }
}
