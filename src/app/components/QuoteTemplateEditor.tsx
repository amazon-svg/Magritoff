/**
 * QuoteTemplateEditor
 * ───────────────────
 * Modale d'edition d'un gabarit de devis (cree via "Nouveau gabarit de devis"
 * OU via "Modifier" depuis la liste des gabarits dans le dashboard).
 *
 * Champs :
 *   - identite emetteur (company, adresse, tel, email, siret)
 *   - branding (couleur principale, accent, logo upload — data-url)
 *   - metadonnees (validite, footer)
 *
 * L'utilisateur peut aussi partir d'un gabarit "builtin" en le clonant puis
 * en le personnalisant. Le clone est fait cote appelant (DashboardQuotes) via
 * `cloneBuiltin`, puis l'editeur recoit le template custom a editer.
 *
 * Apercu minimal a droite : reproduit la structure visuelle du devis imprime
 * (logo block + titre DEVIS + couleurs brand/accent).
 */

import { useEffect, useRef, useState } from 'react';
import { X, Upload, Palette, Save, Trash2, Star } from 'lucide-react';
import type { QuoteTemplate } from '../utils/quote';
import { useQuoteTemplates } from '../contexts/QuoteTemplatesContext';

interface QuoteTemplateEditorProps {
  /** Si fourni : mode edition. Si null : mode creation a partir de zero. */
  template: QuoteTemplate | null;
  onClose: () => void;
}

export function QuoteTemplateEditor({ template, onClose }: QuoteTemplateEditorProps) {
  const { createTemplate, updateTemplate, deleteTemplate, setDefault, defaultTemplateId } =
    useQuoteTemplates();

  const [form, setForm] = useState<Partial<QuoteTemplate>>({
    name: template?.name ?? 'Nouveau gabarit',
    style: template?.style ?? 'custom',
    company_name: template?.company_name ?? '',
    address: template?.address ?? '',
    postal_code: template?.postal_code ?? '',
    city: template?.city ?? '',
    phone: template?.phone ?? '',
    email: template?.email ?? '',
    website: template?.website ?? '',
    siret: template?.siret ?? '',
    tva_number: template?.tva_number ?? '',
    logo_url: template?.logo_url ?? '',
    brand_color: template?.brand_color ?? '#111111',
    accent_color: template?.accent_color ?? '#f59e0b',
    font_family: template?.font_family ?? "'Helvetica Neue', Arial, sans-serif",
    validity_days: template?.validity_days ?? 30,
    footer_text: template?.footer_text ?? '',
  });

  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm({
      name: template?.name ?? 'Nouveau gabarit',
      style: template?.style ?? 'custom',
      company_name: template?.company_name ?? '',
      address: template?.address ?? '',
      postal_code: template?.postal_code ?? '',
      city: template?.city ?? '',
      phone: template?.phone ?? '',
      email: template?.email ?? '',
      website: template?.website ?? '',
      siret: template?.siret ?? '',
      tva_number: template?.tva_number ?? '',
      logo_url: template?.logo_url ?? '',
      brand_color: template?.brand_color ?? '#111111',
      accent_color: template?.accent_color ?? '#f59e0b',
      font_family: template?.font_family ?? "'Helvetica Neue', Arial, sans-serif",
      validity_days: template?.validity_days ?? 30,
      footer_text: template?.footer_text ?? '',
    });
  }, [template?.id]);

  const isEdit = !!template && !template.builtin;

  const patch = <K extends keyof QuoteTemplate>(key: K, value: QuoteTemplate[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleLogoUpload = (file: File) => {
    // Conversion en data-url — simple, pas de bucket Supabase requis.
    // Limite taille raisonnable (~500 Ko) pour ne pas exploser la row DB.
    if (file.size > 500_000) {
      alert('Logo trop lourd (>500 Ko). Utilisez une version compressee ou un SVG.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => patch('logo_url', reader.result as string);
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setSaving(true);
    if (isEdit && template) {
      await updateTemplate(template.id, form);
    } else {
      await createTemplate(form);
    }
    setSaving(false);
    onClose();
  };

  const remove = async () => {
    if (!template || template.builtin) return;
    if (!confirm(`Supprimer le gabarit "${template.name}" ?`)) return;
    await deleteTemplate(template.id);
    onClose();
  };

  const makeDefault = async () => {
    if (!template) return;
    await setDefault(template.id);
  };

  const isBuiltin = template?.builtin;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div
        className="bg-paper rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-line"
        style={{ boxShadow: 'var(--v2-shadow-lg)', fontFamily: 'var(--font-ui)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <div>
            <h2 className="text-ink" style={{ fontSize: '17px', fontWeight: 500 }}>
              {isEdit ? 'Modifier le gabarit' : 'Nouveau gabarit de devis'}
            </h2>
            <p
              className="text-ink-muted mt-0.5"
              style={{ fontSize: '12.5px', fontWeight: 400 }}
            >
              Logo, couleurs, identite — applique a tous les devis qui utilisent ce gabarit.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-bg rounded-lg text-ink-muted hover:text-ink"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Body : form (gauche) + apercu (droite) */}
        <div className="flex-1 overflow-hidden grid" style={{ gridTemplateColumns: '1.1fr 1fr' }}>
          {/* ── Form ── */}
          <div className="overflow-y-auto px-6 py-5 space-y-5 border-r border-line">
            {isBuiltin && (
              <div
                className="px-3 py-2 rounded-md bg-info-bg text-info-fg"
                style={{ fontSize: '12.5px', fontWeight: 400 }}
              >
                Ce gabarit est fourni par Magrit. Pour le personnaliser, cliquez sur
                "Dupliquer pour editer" depuis la liste.
              </div>
            )}

            <Field label="Nom du gabarit">
              <input
                type="text"
                value={form.name ?? ''}
                onChange={(e) => patch('name', e.target.value)}
                className="input"
                disabled={isBuiltin}
              />
            </Field>

            {/* ─ Identite emetteur ─ */}
            <Section title="Identite emetteur">
              <Field label="Societe / Raison sociale">
                <input
                  type="text"
                  value={form.company_name ?? ''}
                  onChange={(e) => patch('company_name', e.target.value)}
                  className="input"
                  disabled={isBuiltin}
                />
              </Field>
              <Row>
                <Field label="Adresse">
                  <input
                    type="text"
                    value={form.address ?? ''}
                    onChange={(e) => patch('address', e.target.value)}
                    className="input"
                    disabled={isBuiltin}
                  />
                </Field>
              </Row>
              <Row>
                <Field label="Code postal">
                  <input
                    type="text"
                    value={form.postal_code ?? ''}
                    onChange={(e) => patch('postal_code', e.target.value)}
                    className="input"
                    disabled={isBuiltin}
                  />
                </Field>
                <Field label="Ville">
                  <input
                    type="text"
                    value={form.city ?? ''}
                    onChange={(e) => patch('city', e.target.value)}
                    className="input"
                    disabled={isBuiltin}
                  />
                </Field>
              </Row>
              <Row>
                <Field label="Telephone">
                  <input
                    type="text"
                    value={form.phone ?? ''}
                    onChange={(e) => patch('phone', e.target.value)}
                    className="input"
                    disabled={isBuiltin}
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    value={form.email ?? ''}
                    onChange={(e) => patch('email', e.target.value)}
                    className="input"
                    disabled={isBuiltin}
                  />
                </Field>
              </Row>
              <Row>
                <Field label="SIRET">
                  <input
                    type="text"
                    value={form.siret ?? ''}
                    onChange={(e) => patch('siret', e.target.value)}
                    className="input"
                    disabled={isBuiltin}
                  />
                </Field>
                <Field label="N° TVA intracom.">
                  <input
                    type="text"
                    value={form.tva_number ?? ''}
                    onChange={(e) => patch('tva_number', e.target.value)}
                    className="input"
                    disabled={isBuiltin}
                  />
                </Field>
              </Row>
            </Section>

            {/* ─ Branding ─ */}
            <Section title="Branding">
              <Field label="Logo (PNG, JPG, SVG — max 500 Ko)">
                <div className="flex items-center gap-3">
                  {form.logo_url ? (
                    <img
                      src={form.logo_url}
                      alt="Logo"
                      className="h-16 w-auto max-w-[200px] object-contain border border-line rounded-md bg-paper p-1"
                    />
                  ) : (
                    <div
                      className="h-16 w-32 border border-dashed border-line-2 rounded-md grid place-items-center text-ink-mute-2"
                      style={{ fontSize: '11px' }}
                    >
                      Aucun logo
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-line bg-paper text-ink-2 hover:bg-bg"
                      style={{ fontSize: '12.5px', fontWeight: 500 }}
                      disabled={isBuiltin}
                    >
                      <Upload className="w-3.5 h-3.5" strokeWidth={1.5} />
                      Televerser un logo
                    </button>
                    {form.logo_url && (
                      <button
                        type="button"
                        onClick={() => patch('logo_url', '')}
                        className="text-ink-mute-2 hover:text-err-fg text-left"
                        style={{ fontSize: '11.5px' }}
                        disabled={isBuiltin}
                      >
                        Retirer
                      </button>
                    )}
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleLogoUpload(f);
                      }}
                    />
                  </div>
                </div>
              </Field>

              <Row>
                <Field label="Couleur principale">
                  <ColorInput
                    value={form.brand_color ?? '#111111'}
                    onChange={(v) => patch('brand_color', v)}
                    disabled={isBuiltin}
                  />
                </Field>
                <Field label="Couleur d'accent">
                  <ColorInput
                    value={form.accent_color ?? '#f59e0b'}
                    onChange={(v) => patch('accent_color', v)}
                    disabled={isBuiltin}
                  />
                </Field>
              </Row>

              <Field label="Police d'ecriture">
                <input
                  type="text"
                  value={form.font_family ?? ''}
                  onChange={(e) => patch('font_family', e.target.value)}
                  className="input"
                  placeholder="'Helvetica Neue', Arial, sans-serif"
                  disabled={isBuiltin}
                />
              </Field>
            </Section>

            {/* ─ Metadonnees ─ */}
            <Section title="Metadonnees">
              <Field label="Validite (jours)">
                <input
                  type="number"
                  value={form.validity_days ?? 30}
                  onChange={(e) => patch('validity_days', Number(e.target.value))}
                  className="input"
                  disabled={isBuiltin}
                />
              </Field>
              <Field label="Mentions de pied de devis">
                <textarea
                  value={form.footer_text ?? ''}
                  onChange={(e) => patch('footer_text', e.target.value)}
                  rows={3}
                  className="input"
                  disabled={isBuiltin}
                />
              </Field>
            </Section>
          </div>

          {/* ── Apercu ── */}
          <div className="overflow-y-auto px-6 py-5 bg-bg">
            <div
              className="font-mono uppercase text-ink-muted mb-2"
              style={{ fontSize: '10.5px', letterSpacing: '0.06em', fontWeight: 500 }}
            >
              Apercu
            </div>
            <TemplatePreview form={form} />
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-line flex items-center justify-between gap-2 bg-paper">
          <div className="flex items-center gap-2">
            {isEdit && (
              <>
                <button
                  onClick={makeDefault}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-line bg-paper text-ink-2 hover:bg-bg"
                  style={{ fontSize: '12.5px', fontWeight: 500 }}
                >
                  <Star className="w-3.5 h-3.5" strokeWidth={1.5} />
                  {defaultTemplateId === template!.id
                    ? 'Gabarit par defaut ✓'
                    : 'Definir par defaut'}
                </button>
                <button
                  onClick={remove}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-line text-err-fg hover:bg-err-bg"
                  style={{ fontSize: '12.5px', fontWeight: 500 }}
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Supprimer
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-md border border-line bg-paper text-ink-2 hover:bg-bg"
              style={{ fontSize: '12.5px', fontWeight: 500 }}
            >
              Annuler
            </button>
            <button
              onClick={save}
              disabled={saving || isBuiltin}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-ink text-paper hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ fontSize: '12.5px', fontWeight: 500 }}
            >
              <Save className="w-3.5 h-3.5" strokeWidth={1.8} />
              {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Creer le gabarit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3
        className="font-mono uppercase text-ink-muted"
        style={{ fontSize: '10.5px', letterSpacing: '0.06em', fontWeight: 500 }}
      >
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span
        className="block text-ink-muted mb-1"
        style={{ fontSize: '11.5px', fontWeight: 500 }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function ColorInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 border border-line rounded-md px-2 py-1 bg-paper">
      <Palette className="w-3.5 h-3.5 text-ink-mute-2" strokeWidth={1.5} />
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-7 h-7 cursor-pointer bg-transparent border-0"
        disabled={disabled}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent outline-none text-ink font-mono"
        style={{ fontSize: '12.5px' }}
        disabled={disabled}
      />
    </div>
  );
}

function TemplatePreview({ form }: { form: Partial<QuoteTemplate> }) {
  const brand = form.brand_color || '#111';
  const accent = form.accent_color || '#f59e0b';
  const font = form.font_family || "'Helvetica Neue', Arial, sans-serif";
  return (
    <div
      className="bg-paper border border-line rounded-md shadow-sm overflow-hidden"
      style={{ fontFamily: font, aspectRatio: '210 / 297', maxWidth: '420px', margin: '0 auto' }}
    >
      <div style={{ borderTop: `4px solid ${accent}` }} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            {form.logo_url ? (
              <img
                src={form.logo_url}
                alt="Logo"
                className="h-12 w-auto max-w-[120px] object-contain"
              />
            ) : (
              <div
                style={{
                  background: brand,
                  color: '#fff',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  display: 'inline-block',
                }}
              >
                {form.company_name || 'Votre logo'}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: brand, fontSize: '18px', fontWeight: 700 }}>DEVIS</div>
            <div style={{ fontSize: '9px', color: '#666' }}>
              N° DEV-2026-______ · Validite {form.validity_days ?? 30} j
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div style={{ border: '1px solid #e5e7eb', padding: '8px', borderRadius: '4px' }}>
            <div style={{ color: brand, fontSize: '9px', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase' }}>
              Emetteur
            </div>
            <div style={{ fontSize: '9px', color: '#444', lineHeight: 1.4 }}>
              {form.company_name || 'Societe'} <br />
              {form.address || 'Adresse'} <br />
              {form.postal_code || ''} {form.city || 'Ville'} <br />
              {form.phone || ''}
            </div>
          </div>
          <div style={{ border: '1px solid #e5e7eb', padding: '8px', borderRadius: '4px' }}>
            <div style={{ color: brand, fontSize: '9px', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase' }}>
              Client
            </div>
            <div style={{ fontSize: '9px', color: '#444', lineHeight: 1.4 }}>
              Societe cliente <br />
              Adresse
            </div>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px' }}>
          <thead>
            <tr style={{ background: '#f3f4f6', color: brand }}>
              <th style={{ padding: '5px', fontSize: '9px', textAlign: 'left' }}>Produit</th>
              <th style={{ padding: '5px', fontSize: '9px', textAlign: 'left' }}>Qte</th>
              <th style={{ padding: '5px', fontSize: '9px', textAlign: 'right' }}>HT</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '5px', fontSize: '9px' }}>Cartes de visite</td>
              <td style={{ padding: '5px', fontSize: '9px' }}>500</td>
              <td style={{ padding: '5px', fontSize: '9px', textAlign: 'right' }}>49,00 €</td>
            </tr>
          </tbody>
        </table>

        <div style={{ textAlign: 'right', fontSize: '10px' }}>
          Total HT : <strong>49,00 €</strong>
          <div
            style={{
              borderTop: `2px solid ${brand}`,
              paddingTop: '4px',
              marginTop: '4px',
              fontSize: '12px',
              fontWeight: 700,
              color: brand,
            }}
          >
            TOTAL TTC : 58,80 €
          </div>
        </div>

        {form.footer_text && (
          <div
            style={{
              marginTop: '16px',
              paddingTop: '8px',
              borderTop: '1px solid #e5e7eb',
              fontSize: '8px',
              color: '#666',
              lineHeight: 1.4,
            }}
          >
            {form.footer_text}
          </div>
        )}
      </div>
    </div>
  );
}

// Utilitaire : style input commun (injecte via classe "input" sur les fields).
// Tailwind JIT genere la classe personnalisee ci-dessous.
const inputClass = `
  .input {
    width: 100%; padding: 6px 10px; border: 1px solid var(--line); border-radius: 6px;
    background: var(--paper); color: var(--ink); font-size: 13px; outline: none;
    font-family: var(--font-ui);
  }
  .input:focus { border-color: var(--line-2); }
  .input:disabled { opacity: 0.5; cursor: not-allowed; }
`;
if (typeof document !== 'undefined' && !document.getElementById('quote-template-editor-style')) {
  const s = document.createElement('style');
  s.id = 'quote-template-editor-style';
  s.textContent = inputClass;
  document.head.appendChild(s);
}
