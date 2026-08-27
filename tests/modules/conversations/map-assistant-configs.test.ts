import { describe, expect, it } from 'vitest';
import { mapAssistantConfigsToProducts } from '@/modules/conversations/ui/components/ChatInterface';

describe('mapping des configurations assistant', () => {
  it('ne fabrique aucune donnée métier absente de la réponse fournisseur', () => {
    const [product] = mapAssistantConfigsToProducts([{
      clariprint: { quantity: 500 },
      display: { productName: 'Dépliant' },
      hopStudio: { cardRef: 'card-1', dataRef: 'dbk-1' },
    }]);

    expect(product).toMatchObject({
      name: 'Dépliant',
      quantity: 500,
      format: '',
      material: '',
      printing: { recto: '', verso: '' },
      finishRecto: '',
      finishVerso: '',
      hopStudioData: { cardRef: 'card-1', dataRef: 'dbk-1' },
    });
    expect(JSON.stringify(product)).not.toContain('Quadrichromie');
    expect(JSON.stringify(product)).not.toContain('Sans impression');
    expect(JSON.stringify(product)).not.toContain('Sans finition');
  });

  it('conserve les codes réellement fournis par HopeStudio', () => {
    const [product] = mapAssistantConfigsToProducts([{
      clariprint: {
        front_colors: ['4-color'],
        back_colors: ['1-color'],
        finishing_front: 'PELLIC_MAT',
      },
      display: { productName: 'Flyer' },
    }]);

    expect(product.printing).toEqual({ recto: '4-color', verso: '1-color' });
    expect(product.finishRecto).toBe('PELLIC_MAT');
  });
});
