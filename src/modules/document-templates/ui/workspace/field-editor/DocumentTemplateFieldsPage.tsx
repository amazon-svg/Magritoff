/**
 * DocumentTemplateFieldsPage — editeur visuel de correspondance coordonnees
 * d un gabarit PDF de devis (story E10.10b-4b).
 *
 * Design VALIDE par Arnaud le 09/09/2026 :
 * `.design-handoff/wireframes/E10.10b-4b-editeur-coordonnees.md`. Deux
 * arbitrages §6 respectes a la lettre : (1) AUCUN raccourci de remplacement
 * du fond ici — reste sur l ecran 4a (`DashboardDocumentTemplates`) ; (2)
 * enregistrement par bouton "Enregistrer" EXPLICITE, pas de sauvegarde
 * automatique.
 *
 * Rendu du fond PDF par PDF.js (`pdfjs-dist`), en IMPORT DYNAMIQUE
 * (`usePdfPageCanvas.ts`) : chargee UNIQUEMENT par cette route (lazy-loaded,
 * voir `src/app/surfaces/workspaceRuntimeRoutes.tsx`), aucun effet sur le
 * bundle de la boutique publique (contrat §8.18 reserve (g)).
 *
 * Aucun appel Supabase direct : tout passe par `DocumentTemplatesApiClient`
 * (`../../api/client.ts`). La validation SEMANTIQUE de la carte
 * (`validateDocumentFieldMap`, module `application/`) est REEXECUTEE ici
 * cote client pour un retour immediat (UX), mais reste une COPIE de la
 * verite serveur — le `PUT .../fields` la revalide integralement, et c est
 * lui qui fait foi (frontend.md : "un controle React est de l UX, jamais la
 * seule barriere").
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Eye, GripVertical, Loader2 } from 'lucide-react';
import { useAuth } from '@/modules/account/ui/runtime';
import { useTenant } from '@/modules/tenants/ui/runtime';
import { useTenantPath } from '@/modules/tenants/ui/hooks';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { ApiClientError } from '@/platform/api';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { DocumentTemplatesApiClient } from '@/modules/document-templates/api/client';
import type {
  DocumentFieldId,
  DocumentFieldPlacementDto,
  DocumentLinesBlockDto,
  DocumentPdfTemplateDetailDto,
} from '@/modules/document-templates/api/contracts';
import { validateDocumentFieldMap } from '@/modules/document-templates/application/document-field-map-validator';
import { fieldLabel, lineFieldLabel } from './field-catalog';
import { PaletteFieldsPanel } from './PaletteFieldsPanel';
import { FieldSettingsPanel } from './FieldSettingsPanel';
import { LinesTablePanel } from './LinesTablePanel';
import { PreviewOverlay } from './PreviewOverlay';
import { pdfPointToScreenPixel, scaleToFitWidth, screenPixelToPdfPoint } from './pdf-coordinates';
import { usePdfPageCanvas } from './usePdfPageCanvas';
import { SAMPLE_ORDER, SAMPLE_ORDER_LONG, SAMPLE_QUOTE, SAMPLE_QUOTE_LONG } from './sample-quote';
import { NO_SELECTION, type FieldSelection } from './types';

const ARROW_STEP_PT = 1;
const ARROW_STEP_PT_SHIFT = 10;
const DEFAULT_FONT_SIZE = 11;

type WorkingMap = Readonly<{
  placements: readonly DocumentFieldPlacementDto[];
  linesBlock: DocumentLinesBlockDto | null;
}>;

function useElementWidth<T extends HTMLElement>(): readonly [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function snapshot(map: WorkingMap): string {
  return JSON.stringify({ placements: map.placements, linesBlock: map.linesBlock });
}

export function DashboardDocumentTemplateFields() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const api = useWorkspaceApi(DocumentTemplatesApiClient);
  const tenantPath = useTenantPath();
  const navigate = useNavigate();
  const { templateId } = useParams<{ templateId: string }>();
  const enabled = Boolean(user && currentTenant && templateId);

  const [template, setTemplate] = useState<DocumentPdfTemplateDetailDto | null>(null);
  const [placements, setPlacements] = useState<readonly DocumentFieldPlacementDto[]>([]);
  const [linesBlock, setLinesBlock] = useState<DocumentLinesBlockDto | null>(null);
  const [fieldsEtag, setFieldsEtag] = useState<string | null>(null);
  const [initialSnapshotValue, setInitialSnapshotValue] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'fields' | 'table'>('fields');
  const [pageIndex, setPageIndex] = useState(0);
  const [selection, setSelection] = useState<FieldSelection>(NO_SELECTION);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [discardTarget, setDiscardTarget] = useState<string | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLong, setPreviewLong] = useState(false);

  const [canvasRef, canvasWidth] = useElementWidth<HTMLDivElement>();
  const backgroundCanvasRef = useRef<HTMLCanvasElement>(null);

  const dirty = initialSnapshotValue !== '' && snapshot({ placements, linesBlock }) !== initialSnapshotValue;

  const load = useCallback(async () => {
    if (!templateId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const { data: detail } = await api.getForEdit(templateId);
      setTemplate(detail);
      if (detail.status !== 'ready') {
        setNotReady(true);
        setLoading(false);
        return;
      }
      const { data: fieldMap, etag } = await api.getFields(templateId);
      setPlacements(fieldMap.placements);
      setLinesBlock(fieldMap.lines_block);
      setFieldsEtag(etag);
      setInitialSnapshotValue(snapshot({ placements: fieldMap.placements, linesBlock: fieldMap.lines_block }));
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'Lecture du gabarit impossible.');
    } finally {
      setLoading(false);
    }
  }, [api, templateId]);

  useEffect(() => {
    if (!enabled) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Echap desarme un champ de palette selectionne, ou referme le panneau de
  // reglages d un champ pose — accessibilite clavier, aucune souris requise.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape' && selection.kind !== 'none') setSelection(NO_SELECTION);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selection.kind]);

  const currentPage = template?.pages[pageIndex] ?? null;
  const scale = currentPage ? scaleToFitWidth(currentPage.width_pt, canvasWidth || 1) : 1;
  const backgroundRender = usePdfPageCanvas(
    backgroundCanvasRef,
    template?.background_url ?? null,
    pageIndex,
    canvasWidth || 1,
  );

  const visiblePlacements = useMemo(
    () => placements.filter((placement) => placement.page_index === pageIndex),
    [placements, pageIndex],
  );

  const clientErrors = useMemo(
    () =>
      template
        ? validateDocumentFieldMap(
            template.pages,
            { placements: [...placements], lines_block: linesBlock },
            template.document_type,
          )
        : [],
    [template, placements, linesBlock],
  );
  const totalInclTaxMissing = !placements.some((placement) => placement.field === 'totals.total_incl_tax');

  function updatePlacement(field: DocumentFieldId, next: DocumentFieldPlacementDto): void {
    setPlacements((current) => current.map((placement) => (placement.field === field ? next : placement)));
  }

  function removePlacement(field: DocumentFieldId): void {
    setPlacements((current) => current.filter((placement) => placement.field !== field));
    setSelection(NO_SELECTION);
  }

  function addPlacement(field: DocumentFieldId, point: { x: number; y: number }): void {
    const placement: DocumentFieldPlacementDto = {
      field,
      page_index: pageIndex,
      x: Math.round(Math.max(0, point.x) * 100) / 100,
      y: Math.round(Math.max(0, point.y) * 100) / 100,
      max_lines: 1,
      align: 'left',
      font: 'helvetica',
      font_size: DEFAULT_FONT_SIZE,
      color: '#111111',
    };
    setPlacements((current) => [...current, placement]);
    setSelection({ kind: 'placement', field });
  }

  function handlePlaceAtCenter(field: DocumentFieldId): void {
    if (!currentPage) return;
    addPlacement(field, { x: currentPage.width_pt / 2, y: currentPage.height_pt / 2 });
    setActiveTab('fields');
  }

  function handleCanvasClick(event: React.MouseEvent<HTMLDivElement>): void {
    if (selection.kind === 'placement') {
      // Clic sur le fond (pas sur une etiquette, qui stoppe la propagation) :
      // referme le panneau de reglages, retour a la palette/onglet Tableau.
      setSelection(NO_SELECTION);
      return;
    }
    if (selection.kind !== 'armed' || !currentPage) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = screenPixelToPdfPoint(
      { x: event.clientX - rect.left, y: event.clientY - rect.top },
      currentPage.height_pt,
      scale,
    );
    addPlacement(selection.field, point);
  }

  function handleCanvasDrop(event: React.DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    if (!currentPage) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = screenPixelToPdfPoint(
      { x: event.clientX - rect.left, y: event.clientY - rect.top },
      currentPage.height_pt,
      scale,
    );

    // qa-review R3 : le DEPLACEMENT d un champ deja pose passe desormais par
    // `onDrop` (evenement du CANVAS, coordonnees toujours fiables), jamais
    // par `onDragEnd` de l etiquette elle-meme — `onDragEnd` applique la
    // position MEME quand le depot a eu lieu HORS du canvas (drag annule),
    // et certains navigateurs (Firefox) y rapportent `clientX/clientY = 0`,
    // ce qui teleportait l etiquette en bas a gauche et perdait le
    // placement. Avec `onDrop`, aucun `drop` ne se declenche si le lacher a
    // eu lieu hors d une cible valide : le placement garde sa position.
    const moveFieldId = event.dataTransfer.getData('text/document-move-field-id') as DocumentFieldId;
    if (moveFieldId) {
      const existing = placements.find((placement) => placement.field === moveFieldId);
      if (existing) {
        updatePlacement(moveFieldId, {
          ...existing,
          x: Math.max(0, Math.round(point.x * 100) / 100),
          y: Math.max(0, Math.round(point.y * 100) / 100),
        });
      }
      return;
    }

    // qa-review R5 : deplacement de l ANCRE du tableau des lignes (glisse
    // sur le canvas, meme discipline que le deplacement d un champ simple) —
    // decale TOUTES les colonnes du MEME delta, pour preserver leur
    // espacement relatif (meme semantique que le controle numerique "Ancre
    // x" de `LinesTablePanel`).
    const isTableAnchor = event.dataTransfer.getData('text/document-table-anchor') === '1';
    if (isTableAnchor && linesBlock) {
      const anchorX = linesBlock.columns[0]?.x ?? 0;
      const deltaX = point.x - anchorX;
      const deltaY = point.y - linesBlock.first_row_baseline_y;
      setLinesBlock({
        ...linesBlock,
        first_row_baseline_y: Math.max(0, Math.round((linesBlock.first_row_baseline_y + deltaY) * 100) / 100),
        columns: linesBlock.columns.map((column) => ({
          ...column,
          x: Math.max(0, Math.round((column.x + deltaX) * 100) / 100),
        })),
      });
      return;
    }

    // qa-review R5 : deplacement de la poignee d ESPACEMENT (ligne fictive
    // grisee) — regle `row_height` en direct, sans deplacer l ancre ni les
    // colonnes (wireframe §2 ecran C : "glisser la poignee verticale entre
    // les deux lignes regle row_height en direct").
    const isTableSpacing = event.dataTransfer.getData('text/document-table-spacing') === '1';
    if (isTableSpacing && linesBlock) {
      const nextRowHeight = Math.max(4, Math.min(200, Math.round((linesBlock.first_row_baseline_y - point.y) * 100) / 100));
      setLinesBlock({ ...linesBlock, row_height: nextRowHeight });
      return;
    }

    const field = event.dataTransfer.getData('text/document-field-id') as DocumentFieldId;
    if (field) {
      addPlacement(field, point);
    }
  }

  function handlePlacementKeyDown(event: React.KeyboardEvent, placement: DocumentFieldPlacementDto): void {
    const step = event.shiftKey ? ARROW_STEP_PT_SHIFT : ARROW_STEP_PT;
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      updatePlacement(placement.field, { ...placement, y: placement.y + step });
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      updatePlacement(placement.field, { ...placement, y: Math.max(0, placement.y - step) });
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      updatePlacement(placement.field, { ...placement, x: Math.max(0, placement.x - step) });
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      updatePlacement(placement.field, { ...placement, x: placement.x + step });
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      removePlacement(placement.field);
    }
  }

  function handleCreateTable(): void {
    if (!currentPage) return;
    setLinesBlock({
      page_index: pageIndex,
      first_row_baseline_y: currentPage.height_pt / 2,
      row_height: 16,
      rows_per_page: 10,
      continuation_page_index: null,
      columns: [],
    });
    setActiveTab('table');
  }

  const selectedPlacement = selection.kind === 'placement' ? placements.find((p) => p.field === selection.field) ?? null : null;

  async function handleSave(): Promise<void> {
    if (!templateId || !fieldsEtag) return;
    setSaving(true);
    setSaveError(null);
    try {
      const { data, etag } = await api.replaceFields(templateId, { placements: [...placements], lines_block: linesBlock }, fieldsEtag);
      setPlacements(data.placements);
      setLinesBlock(data.lines_block);
      setFieldsEtag(etag);
      setInitialSnapshotValue(snapshot({ placements: data.placements, linesBlock: data.lines_block }));
      setSavedAt(new Date());
    } catch (cause) {
      if (cause instanceof ApiClientError) {
        if (cause.problem.status === 409) {
          setConflictOpen(true);
        } else if (cause.problem.status === 422) {
          const detail = cause.problem.errors?.map((error) => error.message).join(' ') ?? cause.problem.detail;
          setSaveError(
            detail ??
              'Le tableau des lignes doit avoir au moins une colonne avant d’être enregistré. Ajoutez-en une, ou supprimez le tableau si ce document n’en a pas besoin.',
          );
        } else {
          setSaveError(cause.problem.detail ?? 'L’enregistrement a échoué. Vérifiez votre connexion et réessayez.');
        }
      } else {
        setSaveError('L’enregistrement a échoué. Vérifiez votre connexion et réessayez.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleReloadAfterConflict(): Promise<void> {
    setConflictOpen(false);
    setSaveError(null);
    await load();
  }

  function handleBackClick(event: React.MouseEvent): void {
    if (!dirty) return;
    event.preventDefault();
    setDiscardTarget(tenantPath('/dashboard/document-templates'));
  }

  if (!enabled || loading) {
    return (
      <div className="flex items-center justify-center py-16 text-ink-muted" data-testid={TEST_IDS.documentTemplateFields.page}>
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-3" data-testid={TEST_IDS.documentTemplateFields.page}>
        <p className="text-sm text-err-fg" data-testid={TEST_IDS.documentTemplateFields.errorBanner}>
          {loadError}
        </p>
        <Link to={tenantPath('/dashboard/document-templates')} className="text-sm text-brand hover:underline">
          ← Gabarits de devis
        </Link>
      </div>
    );
  }

  if (notReady) {
    return (
      <div className="space-y-3" data-testid={TEST_IDS.documentTemplateFields.page}>
        <p className="text-sm text-ink-2">
          Ce gabarit n’a pas encore de fond importé. Importez d’abord un document avant de positionner les champs.
        </p>
        <Link
          to={tenantPath('/dashboard/document-templates')}
          className="inline-block px-4 py-2 bg-brand text-brand-ink rounded-lg text-sm font-medium"
        >
          Importer un PDF
        </Link>
      </div>
    );
  }

  if (!template) return null;

  if (previewOpen) {
    // E10.19a — jeu d exemple SELON LE TYPE DU GABARIT : un gabarit `order`
    // s apercoit avec une commande d exemple, jamais avec le devis (les
    // familles `quote.`/`order.` ne se melangent pas, meme dans l apercu).
    const isOrderTemplate = template.document_type === 'order';
    const sample = previewLong
      ? isOrderTemplate
        ? SAMPLE_ORDER_LONG
        : SAMPLE_QUOTE_LONG
      : isOrderTemplate
        ? SAMPLE_ORDER
        : SAMPLE_QUOTE;
    return (
      <PreviewOverlay
        backgroundUrl={template.background_url}
        pages={template.pages}
        fieldMap={{ template_id: template.id, placements: [...placements], lines_block: linesBlock }}
        sample={sample}
        documentTypeLabel={isOrderTemplate ? 'commande' : 'devis'}
        simulateLong={previewLong}
        onToggleLong={setPreviewLong}
        onExit={() => setPreviewOpen(false)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid={TEST_IDS.documentTemplateFields.page}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-line-2 gap-3 flex-wrap">
        <Link
          to={tenantPath('/dashboard/document-templates')}
          onClick={handleBackClick}
          data-testid={TEST_IDS.documentTemplateFields.backLink}
          className="text-sm text-ink-2 hover:text-ink"
        >
          ← Gabarits de devis
        </Link>
        <h1 className="text-sm font-bold text-ink truncate flex-1 text-center">
          Positionner les champs — {template.name}
        </h1>
        <div className="flex items-center gap-3">
          <span
            className="text-xs text-ink-muted"
            data-testid={TEST_IDS.documentTemplateFields.saveIndicator}
            data-state={saving ? 'saving' : dirty ? 'dirty' : 'saved'}
          >
            {saving ? 'Enregistrement…' : dirty ? '● Modifications non enregistrées' : savedAt ? `Enregistré · à l’instant` : 'Enregistré'}
          </span>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            data-testid={TEST_IDS.documentTemplateFields.previewBtn}
            className="px-3 py-1.5 border border-line-2 rounded-lg text-sm text-ink-2 hover:bg-bg flex items-center gap-1.5"
          >
            <Eye className="w-4 h-4" /> Aperçu avec devis
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !dirty}
            data-testid={TEST_IDS.documentTemplateFields.saveBtn}
            className="px-4 py-1.5 bg-brand text-brand-ink rounded-lg text-sm font-medium disabled:opacity-50"
          >
            Enregistrer
          </button>
        </div>
      </div>

      {saveError && (
        <p className="text-sm text-err-fg px-4 py-2" data-testid={TEST_IDS.documentTemplateFields.errorBanner}>
          {saveError}
        </p>
      )}
      {!totalInclTaxMissing ? null : (
        <p className="text-xs text-ink-muted px-4 py-1">
          Le total TTC n’apparaîtra sur aucun devis généré avec ce gabarit tant qu’il n’est pas positionné. Vous
          pouvez tout de même enregistrer ainsi.
        </p>
      )}

      <div className="flex flex-1 min-h-0">
        {template.pages.length > 1 && (
          <div className="w-20 border-r border-line-2 p-2 space-y-1 overflow-y-auto">
            {template.pages.map((page) => (
              <button
                key={page.index}
                type="button"
                onClick={() => setPageIndex(page.index)}
                data-testid={TEST_IDS.documentTemplateFields.pageTab}
                data-page-index={page.index}
                className={`w-full text-xs py-2 rounded-lg border ${
                  page.index === pageIndex ? 'border-brand bg-brand/10 text-ink' : 'border-line-2 text-ink-2'
                }`}
              >
                Page {page.index + 1}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-auto flex items-start justify-center p-6">
          <div
            ref={canvasRef}
            className="relative border border-line-2 shadow-sm bg-white w-full max-w-3xl"
            data-testid={TEST_IDS.documentTemplateFields.canvas}
            onClick={handleCanvasClick}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleCanvasDrop}
          >
            <canvas ref={backgroundCanvasRef} className="block w-full" />
            {backgroundRender.loading && <p className="text-xs text-ink-muted p-2">Chargement du fond…</p>}
            {backgroundRender.error && (
              <p className="text-xs text-err-fg p-2">Aperçu du document expiré. Rechargez la page pour continuer.</p>
            )}

            {currentPage &&
              visiblePlacements.map((placement) => {
                const pixel = pdfPointToScreenPixel({ x: placement.x, y: placement.y }, currentPage.height_pt, scale);
                const selected = selection.kind === 'placement' && selection.field === placement.field;
                return (
                  <div
                    key={placement.field}
                    role="button"
                    tabIndex={0}
                    draggable
                    data-testid={TEST_IDS.documentTemplateFields.placementLabel}
                    data-field-id={placement.field}
                    onDragStart={(event) => {
                      // qa-review R3 : la position est desormais appliquee
                      // par `handleCanvasDrop` (onDrop du CANVAS), jamais ici
                      // (`onDragEnd` s applique aussi hors cible valide, et
                      // ses coordonnees ne sont pas fiables sur tous les
                      // navigateurs).
                      event.dataTransfer.setData('text/document-move-field-id', placement.field);
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelection({ kind: 'placement', field: placement.field });
                    }}
                    onKeyDown={(event) => handlePlacementKeyDown(event, placement)}
                    className={`absolute px-1 cursor-move select-none text-xs bg-white/70 border ${
                      selected ? 'border-brand ring-2 ring-brand/40' : 'border-dashed border-ink-muted'
                    }`}
                    style={{
                      left: pixel.x,
                      top: pixel.y - placement.font_size * scale,
                      color: placement.color,
                      fontSize: Math.max(9, placement.font_size * scale),
                      width: placement.width ? placement.width * scale : undefined,
                      textAlign: placement.align,
                    }}
                  >
                    {fieldLabel(placement.field)}
                  </div>
                );
              })}

            {/* qa-review R5 (CONFIRME par Arnaud) — retour visuel du tableau
                des lignes sur le canvas, conforme au wireframe §2 ecran C :
                une ligne REELLE (premiere ligne, editable) + une ligne
                FICTIVE grisee/pointillee montrant le pas de repetition,
                jamais une donnee reelle (note A8 du wireframe). Rendu tant
                que le tableau est sur la page AFFICHEE, quel que soit
                l onglet actif (Champs/Tableau), pour garder une conscience
                spatiale de son emplacement. */}
            {currentPage && linesBlock && linesBlock.page_index === pageIndex && (
              <>
                {linesBlock.columns.map((column, index) => {
                  const pixel = pdfPointToScreenPixel(
                    { x: column.x, y: linesBlock.first_row_baseline_y },
                    currentPage.height_pt,
                    scale,
                  );
                  return (
                    <span
                      key={`table-row-real-${index}`}
                      data-testid={TEST_IDS.documentTemplateFields.tableRowOnCanvas}
                      data-column-field={column.field}
                      className="absolute text-xs text-ink bg-brand/10 border border-brand/60 px-1 pointer-events-none whitespace-pre"
                      style={{
                        left: pixel.x,
                        top: pixel.y - column.font_size * scale,
                        width: column.width * scale,
                        textAlign: column.align,
                      }}
                    >
                      {lineFieldLabel(column.field)}
                    </span>
                  );
                })}

                {linesBlock.first_row_baseline_y - linesBlock.row_height >= 0 &&
                  linesBlock.columns.map((column, index) => {
                    const ghostY = linesBlock.first_row_baseline_y - linesBlock.row_height;
                    const pixel = pdfPointToScreenPixel({ x: column.x, y: ghostY }, currentPage.height_pt, scale);
                    return (
                      <span
                        key={`table-row-ghost-${index}`}
                        title="Cette ligne grisée est un repère : elle montre où s’écrira la 2ᵉ ligne du devis, pas une donnée réelle."
                        className="absolute text-xs text-ink-muted bg-ink/5 border border-dashed border-ink-muted/60 px-1 pointer-events-none whitespace-pre"
                        style={{
                          left: pixel.x,
                          top: pixel.y - column.font_size * scale,
                          width: column.width * scale,
                          textAlign: column.align,
                        }}
                      >
                        {lineFieldLabel(column.field)}
                      </span>
                    );
                  })}

                {(() => {
                  const anchorPixel = pdfPointToScreenPixel(
                    { x: linesBlock.columns[0]?.x ?? 0, y: linesBlock.first_row_baseline_y },
                    currentPage.height_pt,
                    scale,
                  );
                  return (
                    <div
                      role="button"
                      tabIndex={0}
                      draggable
                      title="Glissez pour déplacer le tableau des lignes (ancre)."
                      aria-label="Déplacer le tableau des lignes"
                      data-testid={TEST_IDS.documentTemplateFields.tableAnchorHandle}
                      onDragStart={(event) => event.dataTransfer.setData('text/document-table-anchor', '1')}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelection(NO_SELECTION);
                        setActiveTab('table');
                      }}
                      className="absolute cursor-move bg-brand text-brand-ink rounded p-0.5 -translate-x-full"
                      style={{ left: anchorPixel.x - 4, top: anchorPixel.y - 16 }}
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                    </div>
                  );
                })()}

                {linesBlock.first_row_baseline_y - linesBlock.row_height >= 0 &&
                  (() => {
                    const ghostY = linesBlock.first_row_baseline_y - linesBlock.row_height;
                    const ghostPixel = pdfPointToScreenPixel(
                      { x: linesBlock.columns[0]?.x ?? 0, y: ghostY },
                      currentPage.height_pt,
                      scale,
                    );
                    return (
                      <div
                        role="button"
                        tabIndex={0}
                        draggable
                        title="Glissez pour régler l’espacement entre les lignes."
                        aria-label="Régler l’espacement du tableau des lignes"
                        data-testid={TEST_IDS.documentTemplateFields.tableSpacingHandle}
                        onDragStart={(event) => event.dataTransfer.setData('text/document-table-spacing', '1')}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelection(NO_SELECTION);
                          setActiveTab('table');
                        }}
                        className="absolute cursor-ns-resize bg-ink-muted text-white rounded p-0.5 -translate-x-full"
                        style={{ left: ghostPixel.x - 4, top: ghostPixel.y - 16 }}
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                      </div>
                    );
                  })()}
              </>
            )}
          </div>
        </div>

        <div className="w-72 border-l border-line-2 p-4 overflow-y-auto shrink-0">
          {selectedPlacement ? (
            <FieldSettingsPanel
              placement={selectedPlacement}
              onChange={(next) => updatePlacement(selectedPlacement.field, next)}
              onRemove={() => removePlacement(selectedPlacement.field)}
            />
          ) : (
            <>
              <div className="flex border-b border-line-2 mb-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('fields')}
                  data-testid={TEST_IDS.documentTemplateFields.tabFields}
                  className={`flex-1 text-sm py-2 border-b-2 ${
                    activeTab === 'fields' ? 'border-brand text-ink font-medium' : 'border-transparent text-ink-muted'
                  }`}
                >
                  Champs
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('table')}
                  data-testid={TEST_IDS.documentTemplateFields.tabTable}
                  className={`flex-1 text-sm py-2 border-b-2 ${
                    activeTab === 'table' ? 'border-brand text-ink font-medium' : 'border-transparent text-ink-muted'
                  }`}
                >
                  Tableau
                </button>
              </div>

              {activeTab === 'fields' ? (
                <PaletteFieldsPanel
                  placements={placements}
                  documentType={template.document_type}
                  hasTable={linesBlock !== null}
                  armedField={selection.kind === 'armed' ? selection.field : null}
                  onArm={(field) => setSelection({ kind: 'armed', field })}
                  onPlaceAtCenter={handlePlaceAtCenter}
                  onDragStart={(field, event) => event.dataTransfer.setData('text/document-field-id', field)}
                />
              ) : (
                <LinesTablePanel
                  pages={template.pages}
                  currentPageIndex={pageIndex}
                  linesBlock={linesBlock}
                  onCreate={handleCreateTable}
                  onChange={setLinesBlock}
                  onRemove={() => setLinesBlock(null)}
                />
              )}

              {clientErrors.length > 0 && (
                <p className="text-xs text-ink-muted mt-3">
                  {clientErrors.length} point(s) à corriger avant l’enregistrement (le serveur les détaillera).
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {conflictOpen && (
        <div className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-4">
          <div
            className="bg-paper rounded-xl p-5 max-w-md space-y-3"
            data-testid={TEST_IDS.documentTemplateFields.conflictDialog}
          >
            <p className="text-sm text-ink">
              Ce gabarit a été modifié depuis votre dernière ouverture — par vous dans un autre onglet, ou par un
              collègue. Rechargez la carte pour continuer ; vos derniers réglages non enregistrés seront perdus.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConflictOpen(false)} className="px-3 py-1.5 text-sm text-ink-2">
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void handleReloadAfterConflict()}
                data-testid={TEST_IDS.documentTemplateFields.conflictReloadBtn}
                className="px-3 py-1.5 bg-brand text-brand-ink rounded-lg text-sm font-medium"
              >
                Recharger la carte
              </button>
            </div>
          </div>
        </div>
      )}

      {discardTarget && (
        <div className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-4">
          <div
            className="bg-paper rounded-xl p-5 max-w-md space-y-3"
            data-testid={TEST_IDS.documentTemplateFields.discardDialog}
          >
            <p className="text-sm text-ink">
              Vos réglages de positionnement ne sont pas enregistrés. Les abandonner ?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDiscardTarget(null)}
                data-testid={TEST_IDS.documentTemplateFields.discardCancelBtn}
                className="px-3 py-1.5 text-sm text-ink-2"
              >
                Continuer à modifier
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = discardTarget;
                  setDiscardTarget(null);
                  if (target) navigate(target);
                }}
                data-testid={TEST_IDS.documentTemplateFields.discardConfirmBtn}
                className="px-3 py-1.5 bg-err-fg text-white rounded-lg text-sm font-medium"
              >
                Abandonner
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
