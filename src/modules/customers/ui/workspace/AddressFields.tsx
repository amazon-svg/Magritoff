/**
 * AddressFields — saisie d une adresse structuree (line1/line2/postal_code/
 * city/country), partagee entre CustomerFormModal (creation) et
 * CustomerDetailPage (edition) — story E10.4, M4.
 */
import type { Address } from '@/modules/customers/api/contracts';

export const ADDRESS_INPUT_CLS =
  'w-full px-3 py-2 border border-line-2 rounded-lg bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand';

export const EMPTY_ADDRESS: Address = {
  line1: '',
  line2: null,
  postal_code: '',
  city: '',
  country: 'FR',
};

export function isAddressBlank(address: Address): boolean {
  return !address.line1.trim() && !address.postal_code.trim() && !address.city.trim();
}

export function AddressFields({
  legend,
  value,
  onChange,
}: {
  legend: string;
  value: Address;
  onChange: (next: Address) => void;
}) {
  return (
    <fieldset className="border border-line-2 rounded-lg p-3 space-y-2">
      <legend className="text-xs font-medium text-ink-muted px-1">{legend}</legend>
      <div>
        <label className="block text-sm font-medium text-ink-2 mb-1">Adresse</label>
        <input
          type="text"
          value={value.line1}
          onChange={(event) => onChange({ ...value, line1: event.target.value })}
          className={ADDRESS_INPUT_CLS}
          placeholder="N° et voie"
        />
      </div>
      <input
        type="text"
        value={value.line2 ?? ''}
        onChange={(event) => onChange({ ...value, line2: event.target.value || null })}
        className={ADDRESS_INPUT_CLS}
        placeholder="Complément (optionnel)"
      />
      <div className="grid grid-cols-3 gap-2">
        <input
          type="text"
          value={value.postal_code}
          onChange={(event) => onChange({ ...value, postal_code: event.target.value })}
          className={`${ADDRESS_INPUT_CLS} col-span-1`}
          placeholder="Code postal"
        />
        <input
          type="text"
          value={value.city}
          onChange={(event) => onChange({ ...value, city: event.target.value })}
          className={`${ADDRESS_INPUT_CLS} col-span-1`}
          placeholder="Ville"
        />
        <input
          type="text"
          value={value.country}
          onChange={(event) => onChange({ ...value, country: event.target.value.toUpperCase() })}
          className={`${ADDRESS_INPUT_CLS} col-span-1`}
          placeholder="Pays (FR)"
          maxLength={2}
        />
      </div>
    </fieldset>
  );
}

/** Rendu lecture seule, pour l affichage sur la fiche detaillee. */
export function AddressSummary({ address }: { address: Address | null }) {
  if (!address) return <p className="text-sm text-ink-muted">Non renseignée.</p>;
  return (
    <p className="text-sm text-ink">
      {address.line1}
      {address.line2 ? `, ${address.line2}` : ''}
      <br />
      {address.postal_code} {address.city}, {address.country}
    </p>
  );
}
