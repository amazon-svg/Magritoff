import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('compatibilité React 18 des wrappers Radix', () => {
  it('transmet les refs des overlays et contenus de dialogue', () => {
    const dialog = source('src/app/components/ui/dialog.tsx');
    expect(dialog).toContain('const DialogOverlay = React.forwardRef');
    expect(dialog).toContain('const DialogContent = React.forwardRef');
    expect(dialog).toMatch(/DialogPrimitive\.Overlay\s+ref=\{ref\}/);
    expect(dialog).toMatch(/DialogPrimitive\.Content\s+ref=\{ref\}/);
  });

  it('applique la même frontière aux dialogues de confirmation', () => {
    const alertDialog = source('src/app/components/ui/alert-dialog.tsx');
    expect(alertDialog).toContain('const AlertDialogOverlay = React.forwardRef');
    expect(alertDialog).toContain('const AlertDialogContent = React.forwardRef');
    expect(alertDialog).toMatch(/AlertDialogPrimitive\.Overlay\s+ref=\{ref\}/);
  });

  it('rend le bouton compatible avec Slot asChild', () => {
    const button = source('src/app/components/ui/button.tsx');
    expect(button).toContain('React.forwardRef<HTMLButtonElement, ButtonProps>');
    expect(button).toContain('ref={ref}');
  });
});
