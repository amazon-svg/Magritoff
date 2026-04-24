/**
 * DashboardQuoteTemplates
 * ───────────────────────
 * Page dediee a la gestion des gabarits de devis.
 *
 * Separee de DashboardQuotes pour :
 *   - isoler la responsabilite (une page = une fonction produit)
 *   - permettre un sous-menu dedie dans la sidebar (Devis > Gabarits)
 *
 * Affiche :
 *   - les 3 gabarits Magrit (builtins : classique / atelier / corporate)
 *   - les gabarits personnalises de l'utilisateur
 *   - un bandeau rappelant quel gabarit est applique par defaut a tous ses devis
 *
 * Actions :
 *   - Nouveau gabarit (part d'un formulaire vide)
 *   - Dupliquer un builtin pour l'editer
 *   - Editer un gabarit personnalise
 *   - Definir un gabarit par defaut (une etoile, un seul a la fois)
 *   - Supprimer un gabarit personnalise (via l'editeur)
 */

import { useState } from 'react';
import { Plus, Star, Copy, Pencil, Info } from 'lucide-react';
import { useQuoteTemplates } from '../../contexts/QuoteTemplatesContext';
import { QuoteTemplateEditor } from '../QuoteTemplateEditor';
import type { QuoteTemplate } from '../../utils/quote';

export function DashboardQuoteTemplates() {
  const {
    templates,
    customTemplates,
    defaultTemplateId,
    loading,
    setDefault,
    cloneBuiltin,
  } = useQuoteTemplates();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<QuoteTemplate | null>(null);

  const openNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };
  const openEdit = (t: QuoteTemplate) => {
    setEditing(t);
    setEditorOpen(true);
  };
  const duplicate = async (t: QuoteTemplate) => {
    const cloned = await cloneBuiltin(t.id);
    if (cloned) {
      setEditing(cloned);
      setEditorOpen(true);
    }
  };

  // Resout le gabarit reellement applique : celui selectionne par l'user OU
  // le builtin-classique si aucun defaut n'est defini.
  const effectiveId = defaultTemplateId ?? 'builtin-classique';
  const effective = templates.find((t) => t.id === effectiveId) ?? templates[0];

  return (
    <div className="max-w-[1400px]" style={{ fontFamily: 'var(--font-ui)' }}>
      {/* ── Titre + action principale ─────────────────────────────────── */}
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <div>
          <h1
            className="text-ink m-0"
            style={{
              fontWeight: 300,
              fontSize: '34px',
              letterSpacing: '-0.025em',
              lineHeight: 1.05,
            }}
          >
            Gabarits de devis
          </h1>
          <p
            className="text-ink-muted mt-1.5 max-w-2xl"
            style={{ fontSize: '13.5px', fontWeight: 300, lineHeight: 1.55 }}
          >
            Personnalisez l'en-tete, les couleurs et l'identite emetteur appliques a
            tous vos devis. Magrit vous fournit 3 gabarits prets a l'emploi — vous
            pouvez les utiliser tels quels ou les dupliquer pour les adapter.
          </p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-ink text-paper hover:bg-black shrink-0"
          style={{ fontSize: '13px', fontWeight: 500 }}
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={1.8} />
          Nouveau gabarit
        </button>
      </div>

      {/* ── Bandeau : gabarit applique par defaut ─────────────────────── */}
      {!loading && effective && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-md border border-line bg-bg mb-5"
          style={{ fontSize: '13px', fontWeight: 400 }}
        >
          <Info className="w-4 h-4 text-ink-muted shrink-0" strokeWidth={1.5} />
          <div className="flex-1 min-w-0">
            <span className="text-ink-muted">Gabarit applique par defaut a vos devis : </span>
            <span className="text-ink" style={{ fontWeight: 500 }}>
              {effective.name}
            </span>
            {!defaultTemplateId && (
              <span className="text-ink-mute-2 ml-2 font-mono" style={{ fontSize: '11.5px' }}>
                (fallback Magrit — aucun defaut choisi)
              </span>
            )}
          </div>
          {!defaultTemplateId && templates.length > 0 && (
            <button
              onClick={() => setDefault('builtin-classique')}
              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-line bg-paper text-ink-2 hover:bg-paper/80"
              style={{ fontSize: '11.5px', fontWeight: 500 }}
            >
              <Star className="w-3 h-3" strokeWidth={1.5} />
              Confirmer comme mon defaut
            </button>
          )}
        </div>
      )}

      {/* ── Gabarits Magrit ───────────────────────────────────────────── */}
      <Section title="Gabarits Magrit" subtitle="Prets a l'emploi, dupliquez pour personnaliser">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {templates
            .filter((t) => t.builtin)
            .map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                isDefault={defaultTemplateId === t.id}
                onDuplicate={() => duplicate(t)}
                onSetDefault={() => setDefault(t.id)}
              />
            ))}
        </div>
      </Section>

      {/* ── Mes gabarits ──────────────────────────────────────────────── */}
      <Section
        title="Mes gabarits"
        subtitle={
          customTemplates.length === 0
            ? 'Vous n\'avez pas encore de gabarit personnalise'
            : `${customTemplates.length} gabarit${customTemplates.length > 1 ? 's' : ''} cree${customTemplates.length > 1 ? 's' : ''}`
        }
      >
        {customTemplates.length === 0 ? (
          <div
            className="border border-dashed border-line-2 rounded-md px-6 py-10 text-center bg-bg"
          >
            <p className="text-ink-muted mb-3" style={{ fontSize: '13px', fontWeight: 400 }}>
              Creez votre premier gabarit — avec votre logo, votre adresse, vos couleurs.
            </p>
            <button
              onClick={openNew}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-line bg-paper text-ink-2 hover:bg-paper/80"
              style={{ fontSize: '12.5px', fontWeight: 500 }}
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.8} />
              Nouveau gabarit
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {customTemplates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                isDefault={defaultTemplateId === t.id}
                onEdit={() => openEdit(t)}
                onSetDefault={() => setDefault(t.id)}
              />
            ))}
          </div>
        )}
      </Section>

      {editorOpen && (
        <QuoteTemplateEditor
          template={editing}
          onClose={() => setEditorOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <div className="flex items-baseline justify-between mb-3">
        <h2
          className="text-ink m-0"
          style={{
            fontWeight: 300,
            fontSize: '20px',
            letterSpacing: '-0.02em',
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <span
            className="font-mono text-ink-mute-2 uppercase"
            style={{ fontSize: '10.5px', letterSpacing: '0.06em' }}
          >
            {subtitle}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function TemplateCard({
  template,
  isDefault,
  onEdit,
  onDuplicate,
  onSetDefault,
}: {
  template: QuoteTemplate;
  isDefault: boolean;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onSetDefault: () => void;
}) {
  const brand = template.brand_color || '#111';
  const accent = template.accent_color || '#f59e0b';
  return (
    <div
      className={`border rounded-md overflow-hidden bg-paper flex flex-col transition-colors ${
        isDefault ? 'border-brand' : 'border-line hover:border-line-2'
      }`}
    >
      {/* Apercu mini */}
      <div
        className="relative p-4 bg-bg"
        style={{
          aspectRatio: '210 / 148',
          fontFamily: template.font_family || 'var(--font-ui)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: accent,
          }}
        />
        <div className="flex items-start justify-between mb-3">
          {template.logo_url ? (
            <img
              src={template.logo_url}
              alt=""
              className="h-8 w-auto max-w-[80px] object-contain"
            />
          ) : (
            <div
              style={{
                background: brand,
                color: '#fff',
                padding: '4px 8px',
                borderRadius: '3px',
                fontSize: '9px',
                fontWeight: 600,
              }}
            >
              {(template.company_name || 'LOGO').slice(0, 18)}
            </div>
          )}
          <div style={{ color: brand, fontSize: '11px', fontWeight: 700 }}>DEVIS</div>
        </div>
        <div style={{ height: '2px', width: '55%', background: '#d1d5db', marginBottom: '3px' }} />
        <div style={{ height: '2px', width: '42%', background: '#d1d5db', marginBottom: '3px' }} />
        <div style={{ height: '2px', width: '48%', background: '#d1d5db', marginBottom: '8px' }} />
        <div style={{ height: '3px', width: '30%', background: brand, marginLeft: 'auto' }} />
      </div>

      {/* Meta */}
      <div className="px-3 py-2.5 border-t border-line">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span
            className="text-ink truncate"
            style={{ fontSize: '13.5px', fontWeight: 500 }}
          >
            {template.name}
          </span>
          {isDefault && (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-brand text-brand-ink font-mono"
              style={{ fontSize: '9.5px', letterSpacing: '0.04em', fontWeight: 600 }}
            >
              <Star className="w-2.5 h-2.5" strokeWidth={2.5} fill="currentColor" />
              DEFAUT
            </span>
          )}
        </div>
        <div
          className="font-mono text-ink-mute-2 uppercase"
          style={{ fontSize: '10px', letterSpacing: '0.04em' }}
        >
          {template.builtin ? 'Magrit' : 'Perso'} · {template.style}
        </div>
      </div>

      {/* Actions */}
      <div className="px-3 py-2 border-t border-line flex items-center gap-1.5 flex-wrap bg-bg">
        {template.builtin ? (
          <button
            onClick={onDuplicate}
            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-line bg-paper text-ink-2 hover:bg-paper/80"
            style={{ fontSize: '11.5px', fontWeight: 500 }}
          >
            <Copy className="w-3 h-3" strokeWidth={1.5} />
            Dupliquer
          </button>
        ) : (
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-line bg-paper text-ink-2 hover:bg-paper/80"
            style={{ fontSize: '11.5px', fontWeight: 500 }}
          >
            <Pencil className="w-3 h-3" strokeWidth={1.5} />
            Editer
          </button>
        )}
        {!isDefault && (
          <button
            onClick={onSetDefault}
            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-line bg-paper text-ink-muted hover:text-ink"
            style={{ fontSize: '11.5px', fontWeight: 500 }}
            title="Appliquer ce gabarit par defaut a tous mes devis"
          >
            <Star className="w-3 h-3" strokeWidth={1.5} />
            Definir par defaut
          </button>
        )}
      </div>
    </div>
  );
}
