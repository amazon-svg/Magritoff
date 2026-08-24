/**
 * S7.4 — PimEditorial : rendu des product_definitions sur la page gamme.
 *
 * Sections (masquées si absentes — spec UX Custom Component n°6) :
 * pitch commercial → description (markdown léger) → bénéfices → exemples
 * d'usage → specs techniques (table) → FAQ (accordion Radix).
 * Hiérarchie Hn stricte sous l'unique H1 de la page.
 */

import { useMemo } from 'react';
import type { ProductDefinition } from '../../../utils/productEnrichment';
import { TEST_IDS } from '@/shared/presentation/testIds';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../../../shared/ui/accordion';
import {
  normalizeUsageExamples,
  parseLightMarkdown,
  pickDefinition,
  resolvePimTemplate,
  specRows,
  type PimTemplateOptions,
} from './pimEditorial.helpers';

export interface PimEditorialProps {
  definitions: ProductDefinition[];
  gammeSlug: string | undefined;
  familySlug?: string;
  /** Config courante — résout les placeholders des templates. */
  options?: PimTemplateOptions | null;
}

const H2_STYLE: React.CSSProperties = {
  fontSize: '19px',
  fontWeight: 500,
  letterSpacing: '-0.01em',
};

export function PimEditorial({
  definitions,
  gammeSlug,
  familySlug,
  options,
}: PimEditorialProps) {
  const definition = useMemo(
    () => pickDefinition(definitions, gammeSlug, familySlug),
    [definitions, gammeSlug, familySlug],
  );

  const description = resolvePimTemplate(definition?.description_template, options);
  const blocks = useMemo(
    () => (description ? parseLightMarkdown(description) : []),
    [description],
  );
  const benefits = Array.isArray(definition?.benefits) ? definition.benefits : [];
  const usages = normalizeUsageExamples(
    definition?.usage_examples?.length ? definition.usage_examples : definition?.use_cases ?? [],
  );
  const specs = specRows(definition?.technical_spec);
  const faq = Array.isArray(definition?.faq) ? definition.faq : [];

  if (!definition) return null;
  const hasContent =
    definition.commercial_pitch || blocks.length > 0 || benefits.length > 0 ||
    usages.length > 0 || specs.length > 0 || faq.length > 0;
  if (!hasContent) return null;

  return (
    <section
      data-testid={TEST_IDS.shop.gammeEditorial}
      className="flex flex-col gap-6 max-w-3xl"
      aria-label="Informations sur la gamme"
    >
      {definition.commercial_pitch && (
        <p
          className="text-ink m-0"
          style={{ fontSize: '15.5px', lineHeight: 1.6, fontWeight: 400 }}
        >
          {definition.commercial_pitch}
        </p>
      )}

      {blocks.length > 0 && (
        <div className="flex flex-col gap-3">
          {blocks.map((b, i) => {
            if (b.kind === 'h2')
              return (
                <h2 key={i} className="text-ink m-0 mt-2" style={H2_STYLE}>
                  {b.text}
                </h2>
              );
            if (b.kind === 'h3')
              return (
                <h3
                  key={i}
                  className="text-ink m-0 mt-1"
                  style={{ fontSize: '15.5px', fontWeight: 500 }}
                >
                  {b.text}
                </h3>
              );
            if (b.kind === 'ul')
              return (
                <ul key={i} className="m-0 pl-5 flex flex-col gap-1">
                  {b.items.map((item, j) => (
                    <li
                      key={j}
                      className="text-ink-muted"
                      style={{ fontSize: '14px', lineHeight: 1.55 }}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              );
            return (
              <p
                key={i}
                className="text-ink-muted m-0"
                style={{ fontSize: '14.5px', lineHeight: 1.6 }}
              >
                {b.text}
              </p>
            );
          })}
        </div>
      )}

      {benefits.length > 0 && (
        <div>
          <h2 className="text-ink m-0 mb-2" style={H2_STYLE}>
            Pourquoi choisir ce produit
          </h2>
          <ul className="m-0 pl-5 flex flex-col gap-1">
            {benefits.map((b, i) => (
              <li
                key={i}
                className="text-ink-muted"
                style={{ fontSize: '14px', lineHeight: 1.55 }}
              >
                {b}
              </li>
            ))}
          </ul>
        </div>
      )}

      {usages.length > 0 && (
        <div>
          <h2 className="text-ink m-0 mb-2" style={H2_STYLE}>
            Exemples d'usage
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {usages.map((u, i) => (
              <div key={i} className="rounded-md border border-line bg-paper px-3.5 py-3">
                <p className="text-ink m-0" style={{ fontSize: '13.5px', fontWeight: 500 }}>
                  {u.title}
                </p>
                {u.description && (
                  <p
                    className="text-ink-muted m-0 mt-1"
                    style={{ fontSize: '12.5px', lineHeight: 1.5 }}
                  >
                    {u.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {specs.length > 0 && (
        <div>
          {/* « Fiche technique » (pas « Caractéristiques techniques ») : le
              description_template PIM contient souvent déjà ce H2. */}
          <h2 className="text-ink m-0 mb-2" style={H2_STYLE}>
            Fiche technique
          </h2>
          <table className="w-full border-collapse" style={{ fontSize: '13px' }}>
            <tbody>
              {specs.map(([label, value], i) => (
                <tr key={i} className="border-b border-line">
                  <th
                    scope="row"
                    className="text-left text-ink-muted py-2 pr-4 align-top font-normal capitalize"
                    style={{ width: '38%' }}
                  >
                    {label}
                  </th>
                  <td className="text-ink py-2">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {faq.length > 0 && (
        <div data-testid={TEST_IDS.shop.gammeEditorialFaq}>
          <h2 className="text-ink m-0 mb-2" style={H2_STYLE}>
            Questions fréquentes
          </h2>
          <Accordion type="single" collapsible className="w-full">
            {faq.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger
                  className="text-left"
                  style={{ fontSize: '13.5px', fontWeight: 500 }}
                >
                  {item.question}
                </AccordionTrigger>
                <AccordionContent
                  className="text-ink-muted"
                  style={{ fontSize: '13px', lineHeight: 1.55 }}
                >
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}
    </section>
  );
}
