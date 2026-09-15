import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('compatibilité React 18 des wrappers Radix', () => {
  it('transmet les refs des overlays et contenus de dialogue', () => {
    const dialog = source('src/shared/ui/dialog.tsx');
    expect(dialog).toContain('const DialogOverlay = React.forwardRef');
    expect(dialog).toContain('const DialogContent = React.forwardRef');
    expect(dialog).toMatch(/DialogPrimitive\.Overlay\s+ref=\{ref\}/);
    expect(dialog).toMatch(/DialogPrimitive\.Content\s+ref=\{ref\}/);
  });

  it('applique la même frontière aux dialogues de confirmation', () => {
    const alertDialog = source('src/shared/ui/alert-dialog.tsx');
    expect(alertDialog).toContain('const AlertDialogOverlay = React.forwardRef');
    expect(alertDialog).toContain('const AlertDialogContent = React.forwardRef');
    expect(alertDialog).toMatch(/AlertDialogPrimitive\.Overlay\s+ref=\{ref\}/);
  });

  it('rend le bouton compatible avec Slot asChild', () => {
    const button = source('src/shared/ui/button.tsx');
    expect(button).toContain('React.forwardRef<HTMLButtonElement, ButtonProps>');
    expect(button).toContain('ref={ref}');
  });

  // BCP-6 (2026-09-15) — le tiroir panier (Sheet) déclenchait l'avertissement
  // "Function components cannot be given refs" : Sheet enveloppe le même
  // primitif Radix (@radix-ui/react-dialog) que Dialog/AlertDialog, mais sans
  // forwardRef. Le correctif couvre toute la famille de composants qui
  // enveloppent un Overlay ou un Content Radix de la même façon (CONVENTIONS
  // §8.25 5.2) : un critère vérifié ici, pas une ligne isolée.
  it('transmet les refs des overlays et contenus du tiroir (Sheet)', () => {
    const sheet = source('src/shared/ui/sheet.tsx');
    expect(sheet).toContain('const SheetOverlay = React.forwardRef');
    expect(sheet).toContain('const SheetContent = React.forwardRef');
    expect(sheet).toContain('const SheetTrigger = React.forwardRef');
    expect(sheet).toContain('const SheetClose = React.forwardRef');
    expect(sheet).toContain('const SheetTitle = React.forwardRef');
    expect(sheet).toContain('const SheetDescription = React.forwardRef');
    expect(sheet).toMatch(/SheetPrimitive\.Overlay\s+ref=\{ref\}/);
    expect(sheet).toMatch(/SheetPrimitive\.Content\s+ref=\{ref\}/);
  });

  it.each([
    ['src/shared/ui/accordion.tsx', 'AccordionContent', 'AccordionPrimitive'],
    ['src/shared/ui/context-menu.tsx', 'ContextMenuContent', 'ContextMenuPrimitive'],
    ['src/shared/ui/context-menu.tsx', 'ContextMenuSubContent', 'ContextMenuPrimitive'],
    ['src/shared/ui/dropdown-menu.tsx', 'DropdownMenuContent', 'DropdownMenuPrimitive'],
    ['src/shared/ui/dropdown-menu.tsx', 'DropdownMenuSubContent', 'DropdownMenuPrimitive'],
    ['src/shared/ui/hover-card.tsx', 'HoverCardContent', 'HoverCardPrimitive'],
    ['src/shared/ui/popover.tsx', 'PopoverContent', 'PopoverPrimitive'],
    ['src/shared/ui/menubar.tsx', 'MenubarContent', 'MenubarPrimitive'],
    ['src/shared/ui/menubar.tsx', 'MenubarSubContent', 'MenubarPrimitive'],
    ['src/shared/ui/navigation-menu.tsx', 'NavigationMenuContent', 'NavigationMenuPrimitive'],
    ['src/shared/ui/select.tsx', 'SelectContent', 'SelectPrimitive'],
    ['src/shared/ui/tabs.tsx', 'TabsContent', 'TabsPrimitive'],
    ['src/shared/ui/tooltip.tsx', 'TooltipContent', 'TooltipPrimitive'],
  ])(
    'transmet la ref du wrapper %s (%s) — famille BCP-6',
    (path, componentName) => {
      const content = source(path);
      expect(content).toContain(`const ${componentName} = React.forwardRef`);
      expect(content).toMatch(new RegExp(`${componentName}\\.displayName =`));
    },
  );
});
