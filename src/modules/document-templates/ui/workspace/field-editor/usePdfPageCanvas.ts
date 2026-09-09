/**
 * Rendu du fond PDF dans le navigateur (E10.10b-4b, contrat §8.18 reserve (g)) :
 * PDF.js (`pdfjs-dist`), en IMPORT DYNAMIQUE, charge UNIQUEMENT par cet ecran.
 * Aucun autre module ne l importe : le bundle de la boutique publique ne doit
 * jamais le voir passer (verifie par un build reel, voir rapport de fin de
 * story).
 *
 * `background_url` est une URL SIGNEE de 900 s (contrat, reserve (c)) : ce
 * hook ne la renouvelle PAS lui-meme (l ecran affiche un bandeau "Aperçu du
 * document expiré. [Recharger l'aperçu]", wireframe §4.5, quand le
 * chargement echoue apres l expiration).
 */
import { useEffect, useRef, useState } from 'react';

export type PdfPageRenderResult = Readonly<{
  loading: boolean;
  error: string | null;
  pageCount: number;
  widthPt: number;
  heightPt: number;
}>;

/**
 * Charge `backgroundUrl`, rend la page `pageIndex` (0-based) sur le
 * `<canvas>` reference par `canvasRef`, a la largeur `containerWidthPx`.
 * Le document PDF.js est charge UNE fois par `backgroundUrl` (mise en cache
 * interne), seule la page rendue change en re-render.
 */
export function usePdfPageCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  backgroundUrl: string | null,
  pageIndex: number,
  containerWidthPx: number,
): PdfPageRenderResult {
  const [state, setState] = useState<PdfPageRenderResult>({
    loading: true,
    error: null,
    pageCount: 0,
    widthPt: 0,
    heightPt: 0,
  });
  const documentRef = useRef<{ url: string; doc: unknown } | null>(null);

  useEffect(() => {
    if (!backgroundUrl || containerWidthPx <= 0) return;
    let cancelled = false;

    async function render() {
      setState((current) => ({ ...current, loading: true, error: null }));
      try {
        const pdfjs = await import('pdfjs-dist');
        // Worker en asset separe (Vite resout l URL au build ET en dev) —
        // seul cet ecran charge ce fichier, jamais le bundle boutique.
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.mjs',
          import.meta.url,
        ).toString();

        let doc = documentRef.current?.url === backgroundUrl ? documentRef.current.doc : null;
        if (!doc) {
          const loadingTask = pdfjs.getDocument(backgroundUrl!);
          doc = await loadingTask.promise;
          if (cancelled) return;
          documentRef.current = { url: backgroundUrl!, doc };
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfDocument = doc as any;
        const page = await pdfDocument.getPage(pageIndex + 1); // PDF.js est 1-based.
        if (cancelled) return;

        const unscaledViewport = page.getViewport({ scale: 1 });
        const scale = containerWidthPx / unscaledViewport.width;
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const context = canvas.getContext('2d');
        if (!context) return;

        await page.render({ canvasContext: context, viewport }).promise;
        if (cancelled) return;

        setState({
          loading: false,
          error: null,
          pageCount: pdfDocument.numPages,
          widthPt: unscaledViewport.width,
          heightPt: unscaledViewport.height,
        });
      } catch (cause) {
        if (cancelled) return;
        setState({
          loading: false,
          error:
            cause instanceof Error
              ? `Aperçu du document expiré ou illisible : ${cause.message}`
              : 'Aperçu du document expiré ou illisible.',
          pageCount: 0,
          widthPt: 0,
          heightPt: 0,
        });
      }
    }

    void render();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backgroundUrl, pageIndex, containerWidthPx]);

  return state;
}
