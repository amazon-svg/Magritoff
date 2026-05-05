/**
 * TenantOnboarding (E6.1 enrichi)
 * ────────────────────────────────
 * Page /tenants/new : wizard de creation d'un tenant racine.
 *
 * E6.1 — Validation B2B :
 *   - email pro obligatoire (pas de @gmail/@yahoo/@hotmail/...) → check
 *     contre l'email du user connecte
 *   - SIREN (FR) requis : verification format Luhn + lookup INSEE (bouchonne)
 *   - badge "Entreprise verifiee" stocke en DB pour affichage UI
 */

import { useNavigate } from 'react-router';
import { FormEvent, useState } from 'react';
import { CheckCircle2, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { useAuth } from '../../contexts/AuthContext';
import { validateProEmail } from '../../lib/emailValidator';
import { validateSiren, SirenInfo } from '../../lib/sirenValidator';
import { REQUIRE_PRO_EMAIL, REQUIRE_VERIFIED_SIREN } from '../../lib/featureFlags';

export function TenantOnboarding() {
  const { createTenant } = useTenant();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [siren, setSiren] = useState('');
  const [sirenInfo, setSirenInfo] = useState<SirenInfo | null>(null);
  const [sirenError, setSirenError] = useState<string | null>(null);
  const [verifyingSiren, setVerifyingSiren] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // E6.1 — Feature flags : en beta, on n'oblige pas l'email pro ni la
  // verification SIREN. Les fonctions de validation restent appelables et
  // exposees dans l'UI (warning informatif), seul le BLOCAGE est leve.
  const emailCheck = user?.email ? validateProEmail(user.email) : { ok: false };
  const emailIsGeneric = !emailCheck.ok;
  const blockOnGenericEmail = REQUIRE_PRO_EMAIL && emailIsGeneric;
  const sirenRequired = REQUIRE_VERIFIED_SIREN;

  const autoSlug = (n: string) =>
    n
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

  const handleNameChange = (v: string) => {
    setName(v);
    setSlug(autoSlug(v));
  };

  const handleVerifySiren = async () => {
    setSirenError(null);
    setSirenInfo(null);
    setVerifyingSiren(true);
    const result = await validateSiren(siren);
    setVerifyingSiren(false);
    if (!result.ok || !result.info) {
      setSirenError(result.error ?? 'SIREN invalide.');
      return;
    }
    setSirenInfo(result.info);
    // Si la raison sociale INSEE est plus complete que le nom saisi, proposer la
    // basculer dans le champ nom (sans ecraser si l'user a deja saisi).
    if (!name.trim()) {
      handleNameChange(result.info.raisonSociale);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (blockOnGenericEmail) {
      setError(emailCheck.error ?? 'Email generique non autorise.');
      return;
    }
    if (!name.trim() || !slug.trim()) {
      setError('Nom et identifiant requis.');
      return;
    }
    if (sirenRequired && !sirenInfo) {
      setError('Verifiez votre SIREN avant de creer l\'espace.');
      return;
    }

    setSaving(true);
    const tenantId = await createTenant({
      slug: slug.trim(),
      name: name.trim(),
      // SIREN/data ne sont passes que si la verification a ete faite.
      // En beta sans flag, on accepte de creer un tenant sans SIREN.
      siren: sirenInfo?.siren,
      sirenData: sirenInfo ?? undefined,
    });
    setSaving(false);

    if (!tenantId) {
      setError(
        'Creation impossible. Le slug ou le SIREN est peut-etre deja utilise, ou vous n\'etes pas connecte.'
      );
      return;
    }
    navigate(`/t/${slug}`);
  };

  return (
    <form
      onSubmit={submit}
      className="min-h-[calc(100vh-56px)] bg-bg px-6 py-10"
      style={{ fontFamily: 'var(--font-ui)' }}
    >
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <Sparkles className="w-8 h-8 text-brand mx-auto mb-3" strokeWidth={1.5} />
          <h1
            className="text-ink m-0"
            style={{
              fontWeight: 200,
              fontSize: '36px',
              letterSpacing: '-0.025em',
              lineHeight: 1.05,
            }}
          >
            Creer un nouvel espace
          </h1>
          <p
            className="mt-3 text-ink-muted max-w-xl mx-auto"
            style={{ fontSize: '14.5px', fontWeight: 300, lineHeight: 1.55 }}
          >
            Un espace = un dataset isole : vos devis, clients, boutiques et
            bibliotheques ne sont accessibles qu'aux membres de cet espace.
          </p>
        </div>

        {emailIsGeneric && (
          <div
            className={`mb-4 p-3 rounded-md flex items-start gap-2 ${
              blockOnGenericEmail
                ? 'bg-warn-bg text-warn-fg'
                : 'bg-bg text-ink-muted border border-line'
            }`}
            style={{ fontSize: '12.5px' }}
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={1.8} />
            <div>
              <strong>
                {blockOnGenericEmail ? 'Email professionnel requis.' : 'Email generique detecte.'}
              </strong>
              <p className="mt-0.5">
                {blockOnGenericEmail ? (
                  <>
                    Magrit cible un public B2B : votre email actuel{' '}
                    <span className="font-mono">{user?.email}</span> est sur un domaine
                    generique. Reconnectez-vous avec votre email professionnel.
                  </>
                ) : (
                  <>
                    Votre email <span className="font-mono">{user?.email}</span> est sur un
                    domaine generique. En beta, c'est tolere ; en production il faudra un
                    email pro.
                  </>
                )}
              </p>
            </div>
          </div>
        )}

        <div className="bg-paper border border-line rounded-md p-6 space-y-5">
          {/* ── SIREN ─────────────────────────────────────────────────── */}
          <label className="block">
            <span
              className="block text-ink-muted mb-1"
              style={{ fontSize: '11.5px', fontWeight: 500 }}
            >
              SIREN <span className="text-ink-mute-2">
                {sirenRequired ? '(9 chiffres, verification requise)' : '(9 chiffres, optionnel en beta)'}
              </span>
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                value={siren}
                onChange={(e) => {
                  setSiren(e.target.value.replace(/[^\d\s-]/g, ''));
                  setSirenInfo(null);
                  setSirenError(null);
                }}
                placeholder="552 100 554"
                className="flex-1 px-3 py-2 border border-line rounded-md bg-paper text-ink focus:outline-none focus:border-line-2 font-mono"
                style={{ fontSize: '14px' }}
                disabled={blockOnGenericEmail}
              />
              <button
                type="button"
                onClick={handleVerifySiren}
                disabled={!siren.trim() || verifyingSiren || blockOnGenericEmail}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-line bg-paper text-ink hover:bg-bg disabled:opacity-40"
                style={{ fontSize: '13px', fontWeight: 500 }}
              >
                {verifyingSiren && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {verifyingSiren ? 'Verification…' : 'Verifier'}
              </button>
            </div>
            {sirenError && (
              <p
                className="mt-1.5 text-err-fg flex items-center gap-1"
                style={{ fontSize: '12px' }}
              >
                <AlertCircle className="w-3.5 h-3.5" strokeWidth={1.8} />
                {sirenError}
              </p>
            )}
            {sirenInfo && (
              <div
                className="mt-2 p-2.5 rounded-md bg-ok-bg text-ok-fg flex items-start gap-2"
                style={{ fontSize: '12.5px' }}
              >
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={1.8} />
                <div>
                  <div>
                    <strong>{sirenInfo.raisonSociale}</strong>
                    <span className="ml-2 font-mono text-ok-fg/70" style={{ fontSize: '11px' }}>
                      NAF {sirenInfo.codeNaf}
                    </span>
                  </div>
                  {sirenInfo.mocked && (
                    <p className="mt-0.5 text-ok-fg/70" style={{ fontSize: '11px' }}>
                      Verification bouchonnee (compte INSEE non encore configure).
                    </p>
                  )}
                </div>
              </div>
            )}
          </label>

          {/* ── Nom ───────────────────────────────────────────────────── */}
          <label className="block">
            <span
              className="block text-ink-muted mb-1"
              style={{ fontSize: '11.5px', fontWeight: 500 }}
            >
              Nom de l'espace
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Imprimerie Dupont"
              className="w-full px-3 py-2 border border-line rounded-md bg-paper text-ink focus:outline-none focus:border-line-2"
              style={{ fontSize: '14px' }}
              disabled={blockOnGenericEmail}
            />
          </label>

          {/* ── Slug ──────────────────────────────────────────────────── */}
          <label className="block">
            <span
              className="block text-ink-muted mb-1"
              style={{ fontSize: '11.5px', fontWeight: 500 }}
            >
              Identifiant d'URL (slug)
            </span>
            <div
              className="flex items-center border border-line rounded-md bg-paper overflow-hidden"
              style={{ fontSize: '14px' }}
            >
              <span
                className="px-3 py-2 bg-bg text-ink-mute-2 font-mono border-r border-line"
                style={{ fontSize: '12.5px' }}
              >
                magrit.app/t/
              </span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(autoSlug(e.target.value))}
                placeholder="imprimerie-dupont"
                className="flex-1 px-3 py-2 bg-transparent outline-none text-ink font-mono"
                style={{ fontSize: '13px' }}
                disabled={blockOnGenericEmail}
              />
            </div>
            <p
              className="mt-1 text-ink-mute-2"
              style={{ fontSize: '11.5px', fontWeight: 300 }}
            >
              Lettres minuscules, chiffres et tirets uniquement. Doit etre unique.
            </p>
          </label>

          {error && (
            <div
              className="px-3 py-2 rounded-md bg-err-bg text-err-fg"
              style={{ fontSize: '12.5px', fontWeight: 400 }}
            >
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <button
              type="button"
              onClick={() => navigate('/tenants')}
              className="px-3 py-1.5 rounded-md border border-line bg-paper text-ink-2 hover:bg-bg"
              style={{ fontSize: '13px', fontWeight: 500 }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving || blockOnGenericEmail || (sirenRequired && !sirenInfo)}
              className="px-3.5 py-1.5 rounded-md bg-ink text-paper hover:bg-black disabled:opacity-40"
              style={{ fontSize: '13px', fontWeight: 500 }}
            >
              {saving ? 'Creation…' : 'Creer l\'espace'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
