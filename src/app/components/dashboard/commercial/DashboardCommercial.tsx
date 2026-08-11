/**
 * REFONTE-UX (2026-08-08) — Gestion commerciale (point 7, demande Arnaud).
 *
 * Gere les considerations de prix et de marge par gamme de produit ou produit,
 * pour un client ou un groupe de clients. Les parametres definis ici sont
 * ensuite associes aux prix utilises pour ce client — devis faits pour lui,
 * boutique qui lui est dediee — via applyCommercialRules().
 *
 * Frontiere RP#070826 (BK-RP070826-24) : ici les PRIX DE VENTE ; les couts de
 * production restent dans le module parc machine / Clariprint Data.
 *
 * Style : charte Magrit v2 — tokens ink/paper/line/brand.
 * Prerequis DB : migration 20260808000100_gescom_price_rules.sql. Tant qu elle
 * n est pas jouee, la page affiche un etat "migration a appliquer" explicite.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgePercent, Plus, Loader2, Trash2, Users as UsersIcon, AlertTriangle,
  ToggleLeft, ToggleRight, X,
} from 'lucide-react';
import { supabase } from '/utils/supabase/client';
import { useTenant } from '../../../contexts/TenantContext';
import { useCurrency } from '../../../contexts/CurrencyContext';
import {
  formatMoney,
  getCurrencySymbol,
} from '../../../utils/currency';
import {
  adjustModeLabels, SCOPE_LABEL, TARGET_LABEL, TABLE_MISSING_CODES,
  listClientGroups, listPriceRules,
  type AdjustMode, type ClientGroup, type ClientPriceRule, type ScopeType, type TargetType,
} from './commercial.helpers';

interface MemberOption {
  user_id: string;
  email: string;
}

interface GammeOption {
  slug: string;
  name: string;
}

const inputCls =
  'w-full px-3 py-2 border border-line-2 rounded-lg bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand';
const labelCls = 'block text-sm font-medium text-ink-2 mb-1';
const btnPrimary =
  'px-4 py-2 bg-brand text-brand-ink rounded-lg hover:opacity-90 disabled:opacity-50 text-sm font-medium flex items-center gap-2';
const btnGhost =
  'px-3 py-1.5 border border-line-2 rounded-lg text-sm text-ink-2 hover:bg-bg hover:text-ink';

export function DashboardCommercial() {
  const { currentTenant } = useTenant();
  // Multi-devise tranche 1 : prix imposes et libelles suivent la devise du tenant.
  const currency = useCurrency();
  const adjustModeLabel = adjustModeLabels(currency);
  const [tab, setTab] = useState<'rules' | 'groups'>('rules');
  const [rules, setRules] = useState<ClientPriceRule[]>([]);
  const [groups, setGroups] = useState<ClientGroup[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [gammes, setGammes] = useState<GammeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrationMissing, setMigrationMissing] = useState(false);
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  const load = useCallback(async () => {
    if (!currentTenant) return;
    setLoading(true);

    const [rulesRes, groupsRes, membersRes, gammesRes] = await Promise.all([
      listPriceRules(currentTenant.id),
      listClientGroups(currentTenant.id),
      supabase.rpc('get_tenant_members_with_email', { p_tenant_id: currentTenant.id }),
      supabase.from('product_gammes').select('slug, name').order('display_order'),
    ]);

    if (rulesRes.error && TABLE_MISSING_CODES.has(rulesRes.error.code ?? '')) {
      setMigrationMissing(true);
      setLoading(false);
      return;
    }
    setMigrationMissing(false);
    setRules((rulesRes.data as ClientPriceRule[]) ?? []);
    setGroups((groupsRes.data as ClientGroup[]) ?? []);
    setMembers(
      (((membersRes.data as any[]) ?? []) as MemberOption[]).map((m: any) => ({
        user_id: m.user_id,
        email: m.email,
      })),
    );
    setGammes(((gammesRes.data as any[]) ?? []).map((g) => ({ slug: g.slug, name: g.name })));
    setLoading(false);
  }, [currentTenant]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleRule = async (rule: ClientPriceRule) => {
    setRules((rs) => rs.map((r) => (r.id === rule.id ? { ...r, active: !r.active } : r)));
    const { error } = await supabase
      .from('client_price_rules')
      .update({ active: !rule.active, updated_at: new Date().toISOString() })
      .eq('id', rule.id);
    if (error) void load();
  };

  const deleteRule = async (rule: ClientPriceRule) => {
    if (!window.confirm(`Supprimer la règle « ${rule.name} » ?`)) return;
    setRules((rs) => rs.filter((r) => r.id !== rule.id));
    await supabase.from('client_price_rules').delete().eq('id', rule.id);
  };

  const createGroup = async () => {
    if (!currentTenant || !newGroupName.trim()) return;
    setCreatingGroup(true);
    const { error } = await supabase
      .from('client_groups')
      .insert({ tenant_id: currentTenant.id, name: newGroupName.trim() });
    setCreatingGroup(false);
    if (!error) {
      setNewGroupName('');
      void load();
    }
  };

  const deleteGroup = async (group: ClientGroup) => {
    if (!window.confirm(`Supprimer le groupe « ${group.name} » ? Les règles liées seront supprimées.`))
      return;
    setGroups((gs) => gs.filter((g) => g.id !== group.id));
    await supabase.from('client_groups').delete().eq('id', group.id);
  };

  const describeRule = (r: ClientPriceRule): string => {
    const who =
      r.scope_type === 'user'
        ? members.find((m) => m.user_id === r.user_id)?.email ?? 'client supprimé'
        : r.scope_type === 'group'
          ? groups.find((g) => g.id === r.group_id)?.name ?? 'groupe supprimé'
          : SCOPE_LABEL.tenant;
    const what =
      r.target_type === 'gamme'
        ? gammes.find((g) => g.slug === r.gamme_slug)?.name ?? r.gamme_slug ?? ''
        : r.target_type === 'product'
          ? 'produit ciblé'
          : TARGET_LABEL.all;
    return `${who} · ${what}`;
  };

  const formatValue = (r: ClientPriceRule): string => {
    if (r.adjust_mode === 'margin_pct') return `+${r.value} %`;
    if (r.adjust_mode === 'discount_pct') return `−${r.value} %`;
    return formatMoney(r.value, currency);
  };

  // ── Etats speciaux ─────────────────────────────────────────────────────────
  if (migrationMissing) {
    return (
      <div className="max-w-2xl space-y-4">
        <PageHeader />
        <div className="border border-warn-fg/30 bg-warn-bg rounded-xl p-5 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-warn-fg shrink-0 mt-0.5" strokeWidth={1.5} />
          <div className="text-sm text-ink-2 space-y-1">
            <p className="font-medium text-ink">Module à activer côté base de données</p>
            <p>
              La migration <code className="font-mono text-xs">20260808000100_gescom_price_rules.sql</code>{' '}
              (dossier <code className="font-mono text-xs">supabase/migrations/</code>) doit être jouée
              dans l'éditeur SQL Supabase pour créer les tables des règles de prix et des groupes de
              clients. Recharger la page ensuite.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader />
        {tab === 'rules' && (
          <button className={btnPrimary} onClick={() => setShowRuleDialog(true)}>
            <Plus className="w-4 h-4" strokeWidth={1.5} />
            Nouvelle règle
          </button>
        )}
      </div>

      {/* Onglets */}
      <div className="flex gap-1 border-b border-line">
        {(
          [
            ['rules', 'Règles de prix'],
            ['groups', 'Groupes de clients'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm rounded-t-lg border-b-2 -mb-px transition-colors ${
              tab === key
                ? 'border-brand text-ink font-medium'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 grid place-items-center text-ink-muted">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : tab === 'rules' ? (
        rules.length === 0 ? (
          <EmptyState
            title="Aucune règle de prix"
            body="Créez une première règle pour appliquer une marge, une remise ou un prix imposé à une gamme ou un produit, pour un client ou un groupe de clients. Elle s'appliquera automatiquement aux devis de ce client et à sa boutique."
          />
        ) : (
          <div className="border border-line rounded-xl bg-paper overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-ink-mute-2 font-medium">Règle</th>
                  <th className="px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-ink-mute-2 font-medium">Porte sur</th>
                  <th className="px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-ink-mute-2 font-medium">Ajustement</th>
                  <th className="px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-ink-mute-2 font-medium">Valeur</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-b-0">
                    <td className="px-4 py-2.5">
                      <span className={r.active ? 'text-ink' : 'text-ink-mute-2 line-through'}>
                        {r.name}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">{describeRule(r)}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{adjustModeLabel[r.adjust_mode]}</td>
                    <td className="px-4 py-2.5 font-mono text-ink" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatValue(r)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => toggleRule(r)}
                          className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-bg"
                          title={r.active ? 'Désactiver' : 'Activer'}
                        >
                          {r.active ? (
                            <ToggleRight className="w-4.5 h-4.5 text-ok-fg" strokeWidth={1.5} />
                          ) : (
                            <ToggleLeft className="w-4.5 h-4.5" strokeWidth={1.5} />
                          )}
                        </button>
                        <button
                          onClick={() => deleteRule(r)}
                          className="p-1.5 rounded-md text-ink-muted hover:text-err-fg hover:bg-err-bg"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="space-y-4 max-w-2xl">
          <div className="flex gap-2">
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void createGroup()}
              placeholder="Nom du groupe (ex. Grands comptes)"
              className={inputCls}
            />
            <button className={btnPrimary} onClick={() => void createGroup()} disabled={creatingGroup || !newGroupName.trim()}>
              {creatingGroup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" strokeWidth={1.5} />}
              Créer
            </button>
          </div>
          {groups.length === 0 ? (
            <EmptyState
              title="Aucun groupe de clients"
              body="Un groupe rassemble plusieurs clients pour leur appliquer les mêmes conditions commerciales (ex. Grands comptes, Revendeurs)."
            />
          ) : (
            <div className="border border-line rounded-xl bg-paper divide-y divide-line">
              {groups.map((g) => (
                <GroupRow key={g.id} group={g} members={members} onDelete={() => void deleteGroup(g)} onChanged={load} />
              ))}
            </div>
          )}
        </div>
      )}

      {showRuleDialog && currentTenant && (
        <RuleDialog
          tenantId={currentTenant.id}
          groups={groups}
          members={members}
          gammes={gammes}
          onClose={() => setShowRuleDialog(false)}
          onCreated={() => {
            setShowRuleDialog(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

function PageHeader() {
  return (
    <div>
      <h2 className="text-lg font-medium text-ink mb-1 flex items-center gap-2" style={{ letterSpacing: '-0.015em' }}>
        <BadgePercent className="w-5 h-5" strokeWidth={1.5} />
        Gestion commerciale
      </h2>
      <p className="text-sm text-ink-muted max-w-xl">
        Marges, remises et prix imposés par gamme ou produit, pour un client ou un groupe de
        clients. Ces règles s'appliquent aux devis du client et à sa boutique. Les coûts de
        production, eux, se gèrent dans le Parc machine.
      </p>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-line rounded-xl bg-paper p-8 text-center max-w-2xl">
      <p className="text-ink font-medium mb-1">{title}</p>
      <p className="text-sm text-ink-muted">{body}</p>
    </div>
  );
}

// ─── Ligne groupe avec gestion des membres ───────────────────────────────────

function GroupRow({
  group, members, onDelete, onChanged,
}: {
  group: ClientGroup;
  members: MemberOption[];
  onDelete: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  const toggleOpen = async () => {
    setOpen(!open);
    if (!loaded) {
      const { data } = await supabase
        .from('client_group_members')
        .select('user_id')
        .eq('group_id', group.id);
      setGroupMembers(((data as any[]) ?? []).map((m) => m.user_id));
      setLoaded(true);
    }
  };

  const toggleMember = async (userId: string) => {
    if (groupMembers.includes(userId)) {
      setGroupMembers((ms) => ms.filter((id) => id !== userId));
      await supabase.from('client_group_members').delete().eq('group_id', group.id).eq('user_id', userId);
    } else {
      setGroupMembers((ms) => [...ms, userId]);
      await supabase.from('client_group_members').insert({ group_id: group.id, user_id: userId });
    }
    void onChanged();
  };

  return (
    <div className="p-4">
      <div className="flex items-center gap-3">
        <button onClick={() => void toggleOpen()} className="flex items-center gap-2 text-ink text-sm font-medium hover:text-brand">
          <UsersIcon className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
          {group.name}
        </button>
        <span className="font-mono text-[11px] text-ink-mute-2">
          {group.member_count ?? 0} membre{(group.member_count ?? 0) > 1 ? 's' : ''}
        </span>
        <button onClick={onDelete} className="ml-auto p-1.5 rounded-md text-ink-muted hover:text-err-fg hover:bg-err-bg" title="Supprimer le groupe">
          <Trash2 className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>
      {open && (
        <div className="mt-3 pl-6 space-y-1.5">
          {members.length === 0 && <p className="text-sm text-ink-muted">Aucun utilisateur dans l'espace.</p>}
          {members.map((m) => (
            <label key={m.user_id} className="flex items-center gap-2 text-sm text-ink-2">
              <input
                type="checkbox"
                checked={groupMembers.includes(m.user_id)}
                onChange={() => void toggleMember(m.user_id)}
              />
              {m.email}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Dialogue de creation de regle ───────────────────────────────────────────

function RuleDialog({
  tenantId, groups, members, gammes, onClose, onCreated,
}: {
  tenantId: string;
  groups: ClientGroup[];
  members: MemberOption[];
  gammes: GammeOption[];
  onClose: () => void;
  onCreated: () => void;
}) {
  // CORRECTIF 2026-08-11 : `currency` et `adjustModeLabel` etaient lus depuis
  // le composant PARENT, hors de portee ici — ReferenceError a louverture du
  // dialogue de creation de regle. Meme defaut que le Parc machine, introduit
  // par la meme purge des euros de la tranche 1 et invisible faute de typage.
  const currency = useCurrency();
  const adjustModeLabel = adjustModeLabels(currency);
  const [name, setName] = useState('');
  const [scopeType, setScopeType] = useState<ScopeType>('user');
  const [groupId, setGroupId] = useState('');
  const [userId, setUserId] = useState('');
  const [targetType, setTargetType] = useState<TargetType>('gamme');
  const [gammeSlug, setGammeSlug] = useState('');
  const [adjustMode, setAdjustMode] = useState<AdjustMode>('discount_pct');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = useMemo(() => {
    if (!name.trim() || !value || isNaN(Number(value))) return false;
    if (scopeType === 'group' && !groupId) return false;
    if (scopeType === 'user' && !userId) return false;
    if (targetType === 'gamme' && !gammeSlug) return false;
    if (targetType === 'product') return false; // cible produit : V2 (picker PIM)
    return true;
  }, [name, value, scopeType, groupId, userId, targetType, gammeSlug]);

  const save = async () => {
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from('client_price_rules').insert({
      tenant_id: tenantId,
      name: name.trim(),
      scope_type: scopeType,
      group_id: scopeType === 'group' ? groupId : null,
      user_id: scopeType === 'user' ? userId : null,
      target_type: targetType,
      gamme_slug: targetType === 'gamme' ? gammeSlug : null,
      product_definition_id: null,
      adjust_mode: adjustMode,
      value: Number(value),
    });
    setSaving(false);
    if (err) setError(err.message);
    else onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={onClose}>
      <div
        className="bg-paper rounded-xl border border-line shadow-xl w-full max-w-lg p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-ink">Nouvelle règle de prix</h3>
          <button onClick={onClose} className="p-1 rounded-md text-ink-muted hover:text-ink hover:bg-bg">
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <div>
          <label className={labelCls}>Nom de la règle</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Remise fidélité Biocoop" className={inputCls} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>S'applique à</label>
            <select value={scopeType} onChange={(e) => setScopeType(e.target.value as ScopeType)} className={inputCls}>
              {(Object.entries(SCOPE_LABEL) as [ScopeType, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            {scopeType === 'group' && (
              <>
                <label className={labelCls}>Groupe</label>
                <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={inputCls}>
                  <option value="">— choisir —</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </>
            )}
            {scopeType === 'user' && (
              <>
                <label className={labelCls}>Client</label>
                <select value={userId} onChange={(e) => setUserId(e.target.value)} className={inputCls}>
                  <option value="">— choisir —</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>{m.email}</option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Porte sur</label>
            <select value={targetType} onChange={(e) => setTargetType(e.target.value as TargetType)} className={inputCls}>
              <option value="all">{TARGET_LABEL.all}</option>
              <option value="gamme">{TARGET_LABEL.gamme}</option>
              <option value="product" disabled>{TARGET_LABEL.product} (bientôt)</option>
            </select>
          </div>
          <div>
            {targetType === 'gamme' && (
              <>
                <label className={labelCls}>Gamme</label>
                <select value={gammeSlug} onChange={(e) => setGammeSlug(e.target.value)} className={inputCls}>
                  <option value="">— choisir —</option>
                  {gammes.map((g) => (
                    <option key={g.slug} value={g.slug}>{g.name}</option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Type d'ajustement</label>
            <select value={adjustMode} onChange={(e) => setAdjustMode(e.target.value as AdjustMode)} className={inputCls}>
              {(Object.entries(adjustModeLabel) as [AdjustMode, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>
              {adjustMode === 'fixed_price'
                ? `Prix unitaire (${getCurrencySymbol(currency)})`
                : 'Valeur (%)'}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        {error && <p className="text-sm text-err-fg">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button className={btnGhost} onClick={onClose}>Annuler</button>
          <button className={btnPrimary} onClick={() => void save()} disabled={!valid || saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Créer la règle
          </button>
        </div>
      </div>
    </div>
  );
}
