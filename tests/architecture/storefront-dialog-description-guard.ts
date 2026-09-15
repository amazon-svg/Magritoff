/**
 * BCP-6 — garde AST pour le critère architecte (CONVENTIONS §8.25 5.2) :
 * tout `SheetContent`/`DialogContent`/`AlertDialogContent` rendu sous
 * `src/modules/*\/ui/storefront/` porte une description.
 *
 * Round 2 de la qa-review (2026-09-15) a rejeté la version texte/regex du
 * round précédent : 4 contournements survivaient (alias d'import,
 * description vide, `aria-describedby={undefined}`, description placée
 * ailleurs dans le fichier). Cette version résout les identifiants via le
 * compilateur TypeScript (imports nommés, alias, `import * as`) et ne
 * cherche une description que dans le SOUS-ARBRE JSX du `*Content` trouvé —
 * jamais dans le reste du fichier.
 */
import ts from 'typescript';

export type ContentComponentName = 'SheetContent' | 'DialogContent' | 'AlertDialogContent';
export type DescriptionComponentName =
  | 'SheetDescription'
  | 'DialogDescription'
  | 'AlertDialogDescription';

export interface ContentFinding {
  component: ContentComponentName;
  /** true si une description (descendant *Description non vide, ou aria-describedby valide) a été trouvée. */
  hasDescription: boolean;
  /** Position (offset caractère) du début de l'élément, pour le diagnostic. */
  start: number;
}

interface ImportBinding {
  module: string;
  /** Nom tel qu'exporté par le module — résout l'alias local (`import { X as Y }`). */
  exported: string;
}

const CONTENT_SPECS: ReadonlyArray<{ module: string; exported: ContentComponentName }> = [
  { module: '@/shared/ui/sheet', exported: 'SheetContent' },
  { module: '@/shared/ui/dialog', exported: 'DialogContent' },
  { module: '@/shared/ui/alert-dialog', exported: 'AlertDialogContent' },
];

const DESCRIPTION_SPECS: ReadonlyArray<{ module: string; exported: DescriptionComponentName }> = [
  { module: '@/shared/ui/sheet', exported: 'SheetDescription' },
  { module: '@/shared/ui/dialog', exported: 'DialogDescription' },
  { module: '@/shared/ui/alert-dialog', exported: 'AlertDialogDescription' },
];

function collectImportBindings(source: ts.SourceFile): {
  named: Map<string, ImportBinding>;
  namespaces: Map<string, string>;
} {
  const named = new Map<string, ImportBinding>();
  const namespaces = new Map<string, string>();

  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const moduleName = statement.moduleSpecifier.text;
    const clause = statement.importClause;
    if (!clause?.namedBindings) continue;

    if (ts.isNamespaceImport(clause.namedBindings)) {
      // import * as SheetNS from '@/shared/ui/sheet' — résolu via <SheetNS.SheetContent>.
      namespaces.set(clause.namedBindings.name.text, moduleName);
      continue;
    }

    if (ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        // import { AlertDialogContent as ConfirmPanel } -> propertyName=AlertDialogContent, name=ConfirmPanel
        const exportedName = element.propertyName ? element.propertyName.text : element.name.text;
        named.set(element.name.text, { module: moduleName, exported: exportedName });
      }
    }
  }

  return { named, namespaces };
}

function resolveTagBinding(
  tagName: ts.JsxTagNameExpression,
  named: Map<string, ImportBinding>,
  namespaces: Map<string, string>,
): ImportBinding | null {
  if (ts.isIdentifier(tagName)) {
    return named.get(tagName.text) ?? null;
  }
  if (ts.isPropertyAccessExpression(tagName) && ts.isIdentifier(tagName.expression)) {
    const module = namespaces.get(tagName.expression.text);
    if (!module) return null;
    return { module, exported: tagName.name.text };
  }
  return null;
}

function matchSpec<T extends string>(
  binding: ImportBinding | null,
  specs: ReadonlyArray<{ module: string; exported: T }>,
): T | null {
  if (!binding) return null;
  return specs.find((spec) => spec.module === binding.module && spec.exported === binding.exported)
    ?.exported ?? null;
}

/** true si l'expression n'est ni `undefined`, ni une chaîne vide. */
function isMeaningfulExpression(expr: ts.Expression): boolean {
  if (expr.kind === ts.SyntaxKind.UndefinedKeyword) return false;
  if (ts.isIdentifier(expr) && expr.text === 'undefined') return false;
  if (ts.isStringLiteral(expr) && expr.text.trim().length === 0) return false;
  return true;
}

/**
 * `aria-describedby` valide : présent, avec une valeur qui n'est ni
 * `undefined`, ni `{undefined}`, ni une chaîne vide (§8.25 5.2 : « on ne se
 * contente pas de faire taire l'avertissement » — donc PAS un simple
 * `aria-describedby={undefined}`, qui fait taire Radix sans rien annoncer).
 */
function hasValidAriaDescribedBy(openingElement: ts.JsxOpeningLikeElement): boolean {
  for (const prop of openingElement.attributes.properties) {
    if (!ts.isJsxAttribute(prop)) continue;
    if (prop.name.getText() !== 'aria-describedby') continue;
    if (!prop.initializer) return false; // `aria-describedby` bare (true) — pas une vraie référence.
    if (ts.isStringLiteral(prop.initializer)) return prop.initializer.text.trim().length > 0;
    if (ts.isJsxExpression(prop.initializer)) {
      const expr = prop.initializer.expression;
      return expr ? isMeaningfulExpression(expr) : false;
    }
    return false;
  }
  return false;
}

function jsxChildHasContent(node: ts.JsxChild): boolean {
  if (ts.isJsxText(node)) return node.text.trim().length > 0;
  if (ts.isJsxExpression(node)) return node.expression ? isMeaningfulExpression(node.expression) : false;
  // Un élément/fragment imbriqué rend forcément quelque chose : compte comme contenu.
  if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) return true;
  return false;
}

/** `<AlertDialogDescription></AlertDialogDescription>` (ou self-closing) = vide, donc invalide. */
function hasNonEmptyContent(element: ts.JsxElement | ts.JsxSelfClosingElement): boolean {
  if (ts.isJsxSelfClosingElement(element)) return false;
  return element.children.some(jsxChildHasContent);
}

/**
 * Cherche un descendant `*Description` STRICTEMENT dans le sous-arbre de
 * `root` (jamais ailleurs dans le fichier — c'est ce qui tue G4).
 */
function findDescriptionDescendant(
  root: ts.Node,
  named: Map<string, ImportBinding>,
  namespaces: Map<string, string>,
): ts.JsxElement | ts.JsxSelfClosingElement | null {
  let found: ts.JsxElement | ts.JsxSelfClosingElement | null = null;

  function visit(node: ts.Node): void {
    if (found) return;
    if (ts.isJsxElement(node)) {
      const binding = resolveTagBinding(node.openingElement.tagName, named, namespaces);
      if (matchSpec(binding, DESCRIPTION_SPECS)) {
        found = node;
        return;
      }
    } else if (ts.isJsxSelfClosingElement(node)) {
      const binding = resolveTagBinding(node.tagName, named, namespaces);
      if (matchSpec(binding, DESCRIPTION_SPECS)) {
        found = node;
        return;
      }
    }
    ts.forEachChild(node, visit);
  }

  ts.forEachChild(root, visit);
  return found;
}

/**
 * Parcourt un fichier `.tsx` et retourne, pour chaque `SheetContent`/
 * `DialogContent`/`AlertDialogContent` résolu via ses imports réels (alias
 * et `import * as` compris), s'il porte une description valide.
 */
export function findStorefrontContentFindings(fileName: string, sourceText: string): ContentFinding[] {
  const source = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const { named, namespaces } = collectImportBindings(source);
  const findings: ContentFinding[] = [];

  function visit(node: ts.Node): void {
    let openingElement: ts.JsxOpeningLikeElement | null = null;
    let wholeElement: ts.JsxElement | ts.JsxSelfClosingElement | null = null;
    let tagName: ts.JsxTagNameExpression | null = null;

    if (ts.isJsxElement(node)) {
      tagName = node.openingElement.tagName;
      openingElement = node.openingElement;
      wholeElement = node;
    } else if (ts.isJsxSelfClosingElement(node)) {
      tagName = node.tagName;
      openingElement = node;
      wholeElement = node;
    }

    if (tagName && openingElement && wholeElement) {
      const binding = resolveTagBinding(tagName, named, namespaces);
      const matched = matchSpec(binding, CONTENT_SPECS);
      if (matched) {
        const ariaOk = hasValidAriaDescribedBy(openingElement);
        let descriptionOk = false;
        if (!ariaOk && ts.isJsxElement(wholeElement)) {
          const descendant = findDescriptionDescendant(wholeElement, named, namespaces);
          descriptionOk = descendant ? hasNonEmptyContent(descendant) : false;
        }
        findings.push({
          component: matched,
          hasDescription: ariaOk || descriptionOk,
          start: wholeElement.getStart(source),
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(source);
  return findings;
}
