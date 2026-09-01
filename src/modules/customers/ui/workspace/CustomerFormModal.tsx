/**
 * CustomerFormModal — creation d un client (story E10.4, TF-165).
 *
 * Deroule en deux temps pour un client `company` : 1) creation (le format du
 * SIRET, 14 chiffres + Luhn, est controle par l API a l enregistrement,
 * jamais seulement ici) ; 2) verification SIRET optionnelle aupres de l INSEE
 * (bouchon E6.1), sur le client desormais reel — l endpoint
 * `POST /customers/{id}/siret-verifications` exige un client existant, la
 * verification ne peut donc pas precede sa creation. Un client `individual`
 * se ferme directement apres creation.
 *
 * M3/M4 (qa-review) : civilite obligatoire pour `individual` (CA2), TVA et
 * adresses de facturation/livraison saisissables pour `company` (adresse
 * unique pour `individual`) — l API les acceptait deja, seule la saisie
 * manquait.
 */
import { useState } from 'react';
import { Loader2, X, CheckCircle2 } from 'lucide-react';
import { TEST_IDS } from '@/shared/presentation/testIds';
import type {
  Address,
  Civility,
  CreateCustomerCommand,
  CustomerDto,
  CustomerType,
} from '@/modules/customers/api/contracts';
import { AddressFields, EMPTY_ADDRESS, isAddressBlank } from './AddressFields';

const inputCls =
  'w-full px-3 py-2 border border-line-2 rounded-lg bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand';
const labelCls = 'block text-sm font-medium text-ink-2 mb-1';
const btnPrimary =
  'px-4 py-2 bg-brand text-brand-ink rounded-lg hover:opacity-90 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2';
const btnGhost =
  'px-3 py-1.5 border border-line-2 rounded-lg text-sm text-ink-2 hover:bg-bg hover:text-ink';

export interface CustomerFormModalProps {
  onClose: () => void;
  onCreate: (command: CreateCustomerCommand) => Promise<CustomerDto>;
  onVerifySiret: (customerId: string) => Promise<{ verified: boolean; mocked: boolean } | null>;
}

type Step = 'form' | 'verify';

export function CustomerFormModal({ onClose, onCreate, onVerifySiret }: CustomerFormModalProps) {
  const [type, setType] = useState<CustomerType>('company');
  const [companyName, setCompanyName] = useState('');
  const [siret, setSiret] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [civility, setCivility] = useState<Civility>('mr');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [billingAddress, setBillingAddress] = useState<Address>(EMPTY_ADDRESS);
  const [shippingDifferent, setShippingDifferent] = useState(false);
  const [shippingAddress, setShippingAddress] = useState<Address>(EMPTY_ADDRESS);
  const [step, setStep] = useState<Step>('form');
  const [created, setCreated] = useState<CustomerDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const billing = isAddressBlank(billingAddress) ? null : billingAddress;
      const shipping = shippingDifferent && !isAddressBlank(shippingAddress) ? shippingAddress : null;
      const command: CreateCustomerCommand =
        type === 'company'
          ? {
              type,
              company_name: companyName,
              siret: siret.replace(/[\s.-]/g, ''),
              vat_number: vatNumber || null,
              billing_address: billing,
              shipping_address: shipping,
            }
          : {
              type,
              civility,
              first_name: firstName,
              last_name: lastName,
              billing_address: billing,
            };
      const customer = await onCreate(command);
      setCreated(customer);
      if (customer.type === 'company') {
        setStep('verify');
      } else {
        onClose();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Création du client impossible.');
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    if (!created) return;
    setError(null);
    setVerifying(true);
    try {
      const result = await onVerifySiret(created.id);
      setVerified(Boolean(result?.verified));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Vérification SIRET impossible.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-paper rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
        data-testid={TEST_IDS.customer.formModal}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-ink">Nouveau client</h3>
          <button onClick={onClose} className="p-1 hover:bg-bg rounded" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'form' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <span className={labelCls}>Type de client</span>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-ink-2">
                  <input
                    type="radio"
                    name="customer-type"
                    checked={type === 'company'}
                    onChange={() => setType('company')}
                    data-testid={TEST_IDS.customer.typeRadio}
                    data-type="company"
                  />
                  Personne morale
                </label>
                <label className="flex items-center gap-2 text-sm text-ink-2">
                  <input
                    type="radio"
                    name="customer-type"
                    checked={type === 'individual'}
                    onChange={() => setType('individual')}
                    data-testid={TEST_IDS.customer.typeRadio}
                    data-type="individual"
                  />
                  Personne physique
                </label>
              </div>
            </div>

            {type === 'company' ? (
              <>
                <div>
                  <label className={labelCls}>Raison sociale</label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                    className={inputCls}
                    data-testid={TEST_IDS.customer.companyNameInput}
                  />
                </div>
                <div>
                  <label className={labelCls}>SIRET</label>
                  <input
                    type="text"
                    required
                    value={siret}
                    onChange={(event) => setSiret(event.target.value)}
                    placeholder="14 chiffres"
                    className={inputCls}
                    data-testid={TEST_IDS.customer.siretInput}
                  />
                  <p className="text-xs text-ink-muted mt-1">
                    Format contrôlé à l’enregistrement (14 chiffres, clé de Luhn). La
                    vérification INSEE se fait à l’étape suivante.
                  </p>
                </div>
                <div>
                  <label className={labelCls} htmlFor="customer-vat-number">
                    Numéro de TVA intracommunautaire
                  </label>
                  <input
                    id="customer-vat-number"
                    type="text"
                    value={vatNumber}
                    onChange={(event) => setVatNumber(event.target.value)}
                    className={inputCls}
                    placeholder="Optionnel"
                  />
                </div>

                <AddressFields
                  legend="Adresse de facturation"
                  value={billingAddress}
                  onChange={setBillingAddress}
                />

                <label className="flex items-center gap-2 text-sm text-ink-2">
                  <input
                    type="checkbox"
                    checked={shippingDifferent}
                    onChange={(event) => setShippingDifferent(event.target.checked)}
                  />
                  Adresse de livraison différente
                </label>
                {shippingDifferent && (
                  <AddressFields
                    legend="Adresse de livraison"
                    value={shippingAddress}
                    onChange={setShippingAddress}
                  />
                )}
              </>
            ) : (
              <>
                <div>
                  <label className={labelCls} htmlFor="customer-civility">
                    Civilité
                  </label>
                  <select
                    id="customer-civility"
                    value={civility}
                    onChange={(event) => setCivility(event.target.value as Civility)}
                    className={inputCls}
                  >
                    <option value="mr">Monsieur</option>
                    <option value="mrs">Madame</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Prénom</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Nom</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    className={inputCls}
                  />
                </div>

                <AddressFields legend="Adresse" value={billingAddress} onChange={setBillingAddress} />
              </>
            )}

            {error && <p className="text-sm text-err-fg">{error}</p>}

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={onClose} className={`flex-1 ${btnGhost}`}>
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className={`flex-1 ${btnPrimary}`}
                data-testid={TEST_IDS.customer.saveBtn}
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Créer
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-ink-2">
              Client « {created?.company_name} » créé. Vous pouvez vérifier son SIRET
              auprès de l’INSEE avant de continuer.
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleVerify}
                disabled={verifying || verified}
                className={btnGhost}
                data-testid={TEST_IDS.customer.siretVerifyBtn}
              >
                {verifying && <Loader2 className="w-4 h-4 animate-spin" />}
                {verified ? 'SIRET vérifié' : 'Vérifier le SIRET'}
              </button>
              {verified && <CheckCircle2 className="w-5 h-5 text-green-600" />}
            </div>

            {error && <p className="text-sm text-err-fg">{error}</p>}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className={`flex-1 ${btnPrimary}`}
                data-testid={TEST_IDS.customer.saveBtn}
              >
                Terminer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
