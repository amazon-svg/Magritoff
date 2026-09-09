/**
 * Correspondance FERMEE extension -> type MIME (E10.17a, contrat
 * docs/api/CONVENTIONS.md §8.19 decision #6 et reserve (c)).
 *
 * Verifie que le depot NE SE FIE PAS a `File.type` (non teste ici, c est
 * precisement ce que cette fonction remplace) et que le ZIP resout de facon
 * DETERMINISTE independamment de ce qu un navigateur poserait selon le
 * systeme d exploitation du deposant.
 */
import { describe, expect, it } from 'vitest';
import {
  resolveOrderFileContentType,
  supportedOrderFileExtensions,
  UnsupportedOrderFileExtensionError,
} from '@/modules/order-files/api/content-type-map';

describe('resolveOrderFileContentType — correspondance fermee (E10.17a)', () => {
  it.each([
    ['bat.pdf', 'application/pdf'],
    ['BAT.PDF', 'application/pdf'],
    ['visuel.jpg', 'image/jpeg'],
    ['visuel.jpeg', 'image/jpeg'],
    ['visuel.png', 'image/png'],
    ['visuel.webp', 'image/webp'],
    ['scan.tif', 'image/tiff'],
    ['scan.tiff', 'image/tiff'],
    ['livraison.zip', 'application/zip'],
    ['archive.ZIP', 'application/zip'],
  ])('resout %s en %s depuis le NOM DE FICHIER, jamais File.type', (filename, expected) => {
    expect(resolveOrderFileContentType(filename)).toBe(expected);
  });

  it('le ZIP resout TOUJOURS sur application/zip, quel que soit le systeme d exploitation du deposant (deterministe)', () => {
    // Le contrat accepte DEUX types pour une archive (`application/zip` et
    // `application/x-zip-compressed`, selon le systeme du deposant) mais la
    // consigne opposable est de ne JAMAIS lire File.type : notre PROPRE
    // client pose toujours la MEME valeur, quel que soit le poste.
    expect(resolveOrderFileContentType('livraison-client.zip')).toBe('application/zip');
    expect(resolveOrderFileContentType('livraison-client.zip')).not.toBe('application/x-zip-compressed');
  });

  it('extension absente de la correspondance fermee -> UnsupportedOrderFileExtensionError, jamais application/octet-stream', () => {
    expect(() => resolveOrderFileContentType('document.docx')).toThrow(UnsupportedOrderFileExtensionError);
    expect(() => resolveOrderFileContentType('archive.rar')).toThrow(UnsupportedOrderFileExtensionError);
    expect(() => resolveOrderFileContentType('sans-extension')).toThrow(UnsupportedOrderFileExtensionError);
    expect(() => resolveOrderFileContentType('fichier.')).toThrow(UnsupportedOrderFileExtensionError);
  });

  it('supportedOrderFileExtensions() liste exactement les extensions couvertes (pour filtrer un selecteur de fichiers)', () => {
    const extensions = supportedOrderFileExtensions();
    expect(new Set(extensions)).toEqual(
      new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp', 'tif', 'tiff', 'zip']),
    );
  });
});
