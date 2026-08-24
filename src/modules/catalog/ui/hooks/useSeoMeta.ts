/**
 * S7.5 — useSeoMeta : meta dynamiques client-side (ADR §4.19-2).
 *
 * Hook maison volontairement minimal (pas de react-helmet — un seul
 * consommateur, Rule of Three) : title, description, canonical, robots, og:*
 * et un bloc JSON-LD identifié. Chaque valeur absente = balise non touchée ;
 * cleanup au unmount (restaure title, retire les balises posées par le hook).
 *
 * Googlebot exécute le JS (rendering queue) : suffisant pour l'objectif
 * POC/bêta. Limite assumée : crawlers sociaux sans JS (ADR §4.19).
 */

import { useEffect } from 'react';

export interface SeoMetaOpts {
  title?: string;
  description?: string;
  canonical?: string;
  /** ex. 'noindex, nofollow' pour les boutiques privées (S7.13). */
  robots?: string;
  og?: { title?: string; description?: string; url?: string; type?: string };
  /** Objet(s) JSON-LD sérialisés dans un <script> identifié. */
  jsonLd?: unknown;
  /** id DOM du script JSON-LD (unicité entre navigations). */
  jsonLdId?: string;
}

const HOOK_ATTR = 'data-magrit-seo';

function upsertMeta(selector: string, create: () => HTMLElement, content: string) {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) {
    el = create();
    el.setAttribute(HOOK_ATTR, '1');
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
  return el;
}

export function useSeoMeta(opts: SeoMetaOpts): void {
  const {
    title,
    description,
    canonical,
    robots,
    og,
    jsonLd,
    jsonLdId = 'magrit-jsonld',
  } = opts;

  useEffect(() => {
    const prevTitle = document.title;
    const created: Element[] = [];
    const track = (el: Element | null) => {
      if (el && el.getAttribute(HOOK_ATTR) === '1' && !created.includes(el)) {
        created.push(el);
      }
    };

    if (title) document.title = title;

    if (description) {
      track(
        upsertMeta(
          'meta[name="description"]',
          () => {
            const m = document.createElement('meta');
            m.setAttribute('name', 'description');
            return m;
          },
          description,
        ),
      );
    }

    if (robots) {
      track(
        upsertMeta(
          'meta[name="robots"]',
          () => {
            const m = document.createElement('meta');
            m.setAttribute('name', 'robots');
            return m;
          },
          robots,
        ),
      );
    }

    if (canonical) {
      let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        link.setAttribute(HOOK_ATTR, '1');
        document.head.appendChild(link);
      }
      link.setAttribute('href', canonical);
      track(link);
    }

    if (og) {
      const entries: Array<[string, string | undefined]> = [
        ['og:title', og.title ?? title],
        ['og:description', og.description ?? description],
        ['og:url', og.url ?? canonical],
        ['og:type', og.type ?? 'website'],
      ];
      for (const [property, content] of entries) {
        if (!content) continue;
        track(
          upsertMeta(
            `meta[property="${property}"]`,
            () => {
              const m = document.createElement('meta');
              m.setAttribute('property', property);
              return m;
            },
            content,
          ),
        );
      }
    }

    let jsonLdEl: HTMLScriptElement | null = null;
    if (jsonLd) {
      jsonLdEl = document.getElementById(jsonLdId) as HTMLScriptElement | null;
      if (!jsonLdEl) {
        jsonLdEl = document.createElement('script');
        jsonLdEl.type = 'application/ld+json';
        jsonLdEl.id = jsonLdId;
        document.head.appendChild(jsonLdEl);
      }
      jsonLdEl.textContent = JSON.stringify(jsonLd);
    }

    return () => {
      document.title = prevTitle;
      // Retire uniquement ce que le hook a créé (pas les meta statiques).
      for (const el of created) el.remove();
      if (jsonLdEl) jsonLdEl.remove();
    };
  }, [
    title,
    description,
    canonical,
    robots,
    og?.title,
    og?.description,
    og?.url,
    og?.type,
    // Sérialisation stable : re-render uniquement si le contenu change.
    jsonLd ? JSON.stringify(jsonLd) : undefined,
    jsonLdId,
  ]);
}
