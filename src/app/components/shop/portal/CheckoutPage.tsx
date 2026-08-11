/**
 * S7.12 — CheckoutPage : ≤ 2 écrans entre panier et confirmation (ADR §4.20).
 *
 * Une seule route `/checkout`, deux blocs :
 *  - non loggé → Identification (connexion, + création de compte si la
 *    boutique est en `self_signup` : signUp puis RPC self_register_shop_buyer
 *    allow-list S7.11 ; boutique invite_only → connexion + demande d'accès) ;
 *  - loggé → Récap (packs forfaitaires S-FIX-PANIER, totaux HT/TVA/TTC) +
 *    « Commander » → submitCart existant → PortalThankYou.
 * Erreurs inline, jamais de modal (Feedback Patterns spec UX).
 */

import { useState } from 'react';
import { AlertTriangle, Loader2, Lock, Mail } from 'lucide-react';
import { supabase } from '/utils/supabase/client';
import type { Shop } from '../../../contexts/ShopsContext';
import type { CartLine } from './types';
import { useAuth } from '../../../contexts/AuthContext';
import { useTenant } from '../../../contexts/TenantContext';
import { applyTax, getTaxRate } from '../../../utils/tax';
import { formatMoney } from '../../../utils/currency';
import { useCurrency } from '../../../contexts/CurrencyContext';
import { TEST_IDS } from '../../../lib/testIds';

export interface CheckoutPageProps {
  shop: Shop;
  cart: CartLine[];
  /** Soumet la commande (submitCart PublicShop) — navigue vers ThankYou. */
  onSubmit: () => Promise<void> | void;
  onGoCatalog: () => void;
}

const inputCls =
  'w-full px-3 py-2 rounded-md border border-line-2 bg-paper text-ink text-[13px] focus:outline-none focus:ring-2 focus:ring-accent';

export function CheckoutPage({ shop, cart, onSubmit, onGoCatalog }: CheckoutPageProps) {
  const { user } = useAuth();
  const { currentTenant, reload } = useTenant();
  const taxRate = getTaxRate(currentTenant);
  const currency = useCurrency();
  const [submitting, setSubmitting] = useState(false);

  const totalHT = cart.reduce((s, l) => s + l.product.price_ht * l.qty, 0);
  const totalTTC = applyTax(totalHT, taxRate);

  if (cart.length === 0) {
    return (
      <div className="px-5 lg:px-9 py-10 text-center">
        <p className="text-ink-muted m-0 mb-3" style={{ fontSize: '13.5px' }}>
          Votre panier est vide.
        </p>
        <button
          type="button"
          onClick={onGoCatalog}
          className="px-4 py-2 rounded-md bg-ink text-paper hover:bg-black transition-colors"
          style={{ fontSize: '13px', fontWeight: 500 }}
        >
          Parcourir le catalogue
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid={TEST_IDS.shop.checkoutPage}
      className="px-5 lg:px-9 py-6 grid grid-cols-1 lg:grid-cols-5 gap-6 items-start"
    >
      <div className="lg:col-span-3 flex flex-col gap-4">
        <h1
          className="text-ink m-0"
          style={{ fontSize: '24px', fontWeight: 300, letterSpacing: '-0.02em' }}
        >
          {user ? 'Récapitulatif de votre commande' : 'Identifiez-vous pour commander'}
        </h1>

        {!user && (
          <CheckoutIdentification shop={shop} onAuthenticated={() => reload()} />
        )}

        {/* Récap lignes (toujours visible : l'acheteur voit ce qu'il commande) */}
        <div className="bg-paper border border-line rounded-xl overflow-hidden">
          {cart.map((l) => {
            const qtyEx = Number(
              (l.product.config as Record<string, unknown> | undefined)?.quantity ?? l.qty,
            );
            return (
              <div
                key={l.product.id}
                className="flex items-baseline justify-between gap-4 px-4 py-3 border-b border-line last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-ink m-0 truncate" style={{ fontSize: '13.5px', fontWeight: 500 }}>
                    {l.product.name}
                  </p>
                  <p className="text-ink-muted m-0" style={{ fontSize: '12px' }}>
                    {qtyEx.toLocaleString('fr-FR')} exemplaire{qtyEx > 1 ? 's' : ''}
                    {l.qty > 1 ? ` × ${l.qty} packs` : ''}
                  </p>
                </div>
                <span
                  className="font-mono text-ink shrink-0"
                  style={{ fontSize: '13.5px', fontVariantNumeric: 'tabular-nums' }}
                >
                  {formatMoney(l.product.price_ht * l.qty, currency)} HT
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Totaux + CTA */}
      <div className="lg:col-span-2 lg:sticky lg:top-4 bg-paper border border-line rounded-xl p-4 flex flex-col gap-3">
        <Row label="Sous-total HT" value={formatMoney(totalHT, currency)} />
        <Row label={`TVA (${Math.round(taxRate * 100)} %)`} value={formatMoney(totalTTC - totalHT, currency)} />
        <div className="border-t border-line pt-2">
          <Row label="Total TTC" value={formatMoney(totalTTC, currency)} strong />
        </div>
        <button
          type="button"
          data-testid={TEST_IDS.shop.checkoutSubmitBtn}
          disabled={!user || submitting}
          onClick={async () => {
            setSubmitting(true);
            try {
              await onSubmit();
            } finally {
              setSubmitting(false);
            }
          }}
          className="mt-1 px-4 py-2.5 rounded-md bg-ink text-paper hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          style={{ fontSize: '13.5px', fontWeight: 500 }}
        >
          {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />}
          Commander
        </button>
        {!user && (
          <p className="text-ink-mute-2 m-0 text-center" style={{ fontSize: '11.5px' }}>
            Identifiez-vous ci-contre pour valider la commande.
          </p>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-ink-muted" style={{ fontSize: '12.5px' }}>
        {label}
      </span>
      <span
        className="font-mono text-ink"
        style={{ fontSize: strong ? '16px' : '13px', fontWeight: strong ? 500 : 400, fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Identification (écran 1, même page) ────────────────────────────────────

function CheckoutIdentification({
  shop,
  onAuthenticated,
}: {
  shop: Shop;
  onAuthenticated: () => void;
}) {
  const selfSignup = shop.access_mode === 'self_signup';
  const [mode, setMode] = useState<'login' | 'signup'>(selfSignup ? 'signup' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const login = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) setError('Connexion impossible : vérifiez votre email et votre mot de passe.');
    else {
      // Si la boutique est ouverte, garantir l'accès (idempotent, no-op si membre).
      if (selfSignup) {
        await supabase.rpc('self_register_shop_buyer', { p_shop_id: shop.id });
      }
      onAuthenticated();
    }
    setBusy(false);
  };

  const signup = async () => {
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, company } },
    });
    if (err) {
      setError(
        err.message.includes('already registered')
          ? 'Un compte existe déjà avec cet email — connectez-vous.'
          : `Création du compte impossible : ${err.message}`,
      );
    } else if (!data.session) {
      // Confirmation email exigée par le projet : pas de session immédiate.
      setNotice(
        'Vérifiez votre boîte mail pour confirmer votre compte, puis revenez vous connecter.',
      );
    } else {
      const { error: rpcErr } = await supabase.rpc('self_register_shop_buyer', {
        p_shop_id: shop.id,
      });
      if (rpcErr) {
        setError('Compte créé, mais l\'accès boutique a échoué. Contactez la boutique.');
      } else {
        onAuthenticated();
      }
    }
    setBusy(false);
  };

  return (
    <div
      data-testid={TEST_IDS.shop.checkoutIdentification}
      className="bg-paper border border-line rounded-xl p-4 flex flex-col gap-3"
    >
      {selfSignup ? (
        <div className="flex gap-1 rounded-lg bg-bg p-1 w-fit" role="tablist">
          {(
            [
              ['signup', 'Créer un compte'],
              ['login', 'Se connecter'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={mode === key}
              onClick={() => setMode(key)}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                mode === key ? 'bg-paper text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
              }`}
              style={{ fontSize: '12.5px', fontWeight: 500 }}
            >
              {label}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-ink-muted m-0" style={{ fontSize: '12.5px' }}>
          Cette boutique est réservée aux acheteurs invités par {shop.name}.
        </p>
      )}

      <form
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (mode === 'signup' && selfSignup) void signup();
          else void login();
        }}
      >
        {mode === 'signup' && selfSignup && (
          <>
            <label className="flex flex-col gap-1">
              <FieldLabel>Nom</FieldLabel>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} autoComplete="name" />
            </label>
            <label className="flex flex-col gap-1">
              <FieldLabel>Société</FieldLabel>
              <input value={company} onChange={(e) => setCompany(e.target.value)} className={inputCls} autoComplete="organization" />
            </label>
          </>
        )}
        <label className="flex flex-col gap-1">
          <FieldLabel>Email</FieldLabel>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
            autoComplete="email"
            data-testid={TEST_IDS.shop.checkoutEmailInput}
          />
        </label>
        <label className="flex flex-col gap-1">
          <FieldLabel>Mot de passe</FieldLabel>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            data-testid={TEST_IDS.shop.checkoutPasswordInput}
          />
        </label>

        <div className="sm:col-span-2 flex items-center gap-3">
          <button
            type="submit"
            data-testid={TEST_IDS.shop.checkoutAuthBtn}
            disabled={busy}
            className="px-4 py-2 rounded-md bg-ink text-paper hover:bg-black transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            style={{ fontSize: '13px', fontWeight: 500 }}
          >
            {busy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
            ) : mode === 'signup' && selfSignup ? (
              <Mail className="w-3.5 h-3.5" strokeWidth={1.5} />
            ) : (
              <Lock className="w-3.5 h-3.5" strokeWidth={1.5} />
            )}
            {mode === 'signup' && selfSignup ? 'Créer mon compte' : 'Se connecter'}
          </button>

          {!selfSignup && (
            <a
              data-testid={TEST_IDS.shop.checkoutRequestAccess}
              href={
                shop.contact_email
                  ? `mailto:${shop.contact_email}?subject=${encodeURIComponent(`Demande d'accès à la boutique ${shop.name}`)}`
                  : undefined
              }
              aria-disabled={!shop.contact_email}
              className={`text-ink-muted hover:text-ink hover:underline ${!shop.contact_email ? 'pointer-events-none opacity-50' : ''}`}
              style={{ fontSize: '12.5px' }}
            >
              Demander un accès
            </a>
          )}
        </div>
      </form>

      {error && (
        <p
          className="m-0 inline-flex items-start gap-1.5 text-warn-fg"
          style={{ fontSize: '12.5px' }}
          role="alert"
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={1.5} />
          {error}
        </p>
      )}
      {notice && (
        <p className="m-0 text-ink-muted" style={{ fontSize: '12.5px' }} role="status">
          {notice}
        </p>
      )}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="font-mono uppercase text-ink-mute-2"
      style={{ fontSize: '10px', letterSpacing: '0.08em', fontWeight: 500 }}
    >
      {children}
    </span>
  );
}
