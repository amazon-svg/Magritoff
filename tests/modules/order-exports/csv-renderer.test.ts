/**
 * Renderer CSV de l export comptable (story E10.18c, contrat §8.24 point 5
 * regles 2/3). Couvre la forme NON NEGOCIABLE du fichier (separateurs,
 * BOM, CRLF, guillemets), l absence de conversion numerique, la traduction
 * des codes techniques (customer_type/order_status/vat_regime, CRITERE
 * « enumeration fermee du contrat », amende 2026-09-13 qa-review round 1) et
 * l ordre DEFINITIF des colonnes pour les deux granularites
 * (openapi/magrit-core.v1.yaml, OrderExportGranularity, SEULE source
 * d ordre).
 */
import { describe, expect, it } from 'vitest';
import { csvOrderExportRenderer } from '@/modules/order-exports/application/renderers/csv-renderer';
import type { OrderExportRawRow } from '@/modules/order-exports/application/order-export-columns';

const BOM = '﻿';

function headerRow(overrides: Partial<Record<string, unknown>> = {}): OrderExportRawRow {
  return {
    order_number: 'CDE-2026-00001',
    quote_number: 'DEV-2026-00001',
    order_created_at: '2026-03-15T08:00:00+00:00',
    customer_type: 'company',
    customer_name: 'Client Test',
    customer_siret: '73282932000074',
    customer_vat_number: 'FR40303265045',
    customer_contact_name: null,
    customer_contact_email: null,
    order_status: 'validated',
    production_step_label: 'PAO',
    lines_subtotal: '1090.00',
    global_discount: '0.00',
    effective_discount_rate: null,
    net_total: '1090.00',
    vat_rate: '0.2000',
    vat_regime: 'metropole_fr',
    vat_amount: '218.00',
    total_incl_tax: '1308.00',
    ...overrides,
  };
}

function lineRow(overrides: Partial<Record<string, unknown>> = {}): OrderExportRawRow {
  return {
    order_number: 'CDE-2026-00001',
    quote_number: 'DEV-2026-00001',
    order_created_at: '2026-03-15T08:00:00+00:00',
    customer_type: 'individual',
    customer_name: 'Alix Bernard',
    customer_siret: null,
    customer_vat_number: null,
    customer_contact_name: 'Jean Dupont',
    customer_contact_email: 'jean.dupont@example.test',
    order_status: 'validated',
    production_step_label: null,
    line_position: 0,
    line_label: 'Depliants A5',
    quantity: 3,
    bracket_amount_excl_tax: '1100.00',
    discount_rate: '-0.0909',
    unit_price_indicative: '333.3333',
    sale_price: '1000.00',
    ...overrides,
  };
}

async function renderText(granularity: 'order' | 'line', rows: readonly OrderExportRawRow[]): Promise<string> {
  const result = await csvOrderExportRenderer.render({ granularity, rows });
  if (!result.ok) throw new Error(`rendu attendu OK, obtenu echec : ${result.code} ${result.detail}`);
  // `ignoreBOM: true` : un `TextDecoder` par defaut CONSOMME silencieusement
  // un BOM UTF-8 en tete de flux (comportement standard, cf. Encoding
  // Standard) — exactement ce qui rendrait ce test AVEUGLE au BOM que le
  // renderer doit poser. Ici on VEUT le voir, comme le ferait un octet-a-octet.
  return new TextDecoder('utf-8', { ignoreBOM: true }).decode(result.bytes);
}

describe('csvOrderExportRenderer — forme du fichier (non negociable)', () => {
  it('porte le BOM UTF-8 en tete', async () => {
    const text = await renderText('order', []);
    expect(text.startsWith(BOM)).toBe(true);
  });

  it('separe les colonnes par point-virgule et les lignes par CRLF', async () => {
    const text = await renderText('order', [headerRow()]);
    const withoutBom = text.slice(BOM.length);
    const lines = withoutBom.split('\r\n');
    expect(lines[0]?.split(';').length).toBeGreaterThan(1);
    // Deux lignes de contenu (en-tete + une ligne) + une fin de fichier vide.
    expect(lines.length).toBe(3);
    expect(lines[2]).toBe('');
  });

  it('remplace le point decimal par une virgule, SANS AUCUNE conversion numerique', async () => {
    const text = await renderText('order', [headerRow({ lines_subtotal: '1090.00', vat_rate: '0.2000' })]);
    expect(text).toContain('1090,00');
    expect(text).toContain('0,2000');
    expect(text).not.toContain('1090.00');
  });

  it('recopie un montant negatif (remise globale majoree) sans le denaturer', async () => {
    const text = await renderText('order', [headerRow({ global_discount: '-5.00' })]);
    expect(text).toContain('-5,00');
  });

  it('entoure de guillemets doubles un champ portant le separateur, et double les guillemets internes', async () => {
    const text = await renderText('line', [lineRow({ line_label: 'Cartes "Premium"; format A6' })]);
    expect(text).toContain('"Cartes ""Premium""; format A6"');
  });

  it('ne quote pas un champ ordinaire', async () => {
    const text = await renderText('order', [headerRow({ customer_name: 'Client Ordinaire' })]);
    expect(text).toContain(';Client Ordinaire;');
  });

  it('rend une cellule nulle en chaine vide', async () => {
    const text = await renderText('order', [headerRow({ effective_discount_rate: null, customer_contact_name: null })]);
    const withoutBom = text.slice(BOM.length);
    const dataLine = withoutBom.split('\r\n')[1]!;
    // "Interlocuteur" (8e colonne) et "Courriel interlocuteur" (9e, egalement
    // nulle par defaut dans `headerRow()`) sont ADJACENTES et vides -> deux
    // `;;` consecutifs.
    expect(dataLine).toContain(';;');
  });
});

describe('csvOrderExportRenderer — traduction des codes techniques (exigence opposable)', () => {
  it('traduit customer_type : company -> Société, individual -> Particulier', async () => {
    const companyText = await renderText('order', [headerRow({ customer_type: 'company' })]);
    expect(companyText).toContain('Société');
    expect(companyText).not.toContain(';company;');

    const individualText = await renderText('order', [headerRow({ customer_type: 'individual' })]);
    expect(individualText).toContain('Particulier');
    expect(individualText).not.toContain(';individual;');
  });

  it('traduit les CINQ valeurs de vat_regime, jamais le code brut', async () => {
    const regimes: Record<string, string> = {
      metropole_fr: 'France métropolitaine',
      dom_tom: 'DOM-TOM',
      franchise_tva: 'Franchise en base de TVA',
      export_eu: 'Export UE',
      export_world: 'Export hors UE',
    };
    for (const [code, label] of Object.entries(regimes)) {
      const text = await renderText('order', [headerRow({ vat_regime: code })]);
      expect(text, `regime ${code}`).toContain(label);
      expect(text, `regime ${code} ne doit jamais porter le code brut`).not.toContain(`;${code};`);
    }
  });

  it('un vat_regime nul rend une cellule vide, jamais "null"', async () => {
    const text = await renderText('order', [headerRow({ vat_regime: null })]);
    expect(text).not.toContain('null');
  });

  it('traduit order_status : validated -> Validée (CRITIQUE, corrige qa-review round 1 — le fichier livrait "validated" en clair)', async () => {
    const text = await renderText('order', [headerRow({ order_status: 'validated' })]);
    expect(text).toContain('Validée');
    expect(text).not.toContain(';validated;');
  });

  it("NE traduit PAS « Étape de production » — c est un libelle de tenant, pas une enumeration du contrat (le piege inverse que le critere de traduction range)", async () => {
    const text = await renderText('order', [headerRow({ production_step_label: 'draft' })]);
    expect(text).toContain(';draft;');
  });

  it('echoue BRUYAMMENT (jamais un code brut silencieux) sur une valeur d enumeration inconnue — order_status, customer_type, vat_regime', async () => {
    await expect(csvOrderExportRenderer.render({ granularity: 'order', rows: [headerRow({ order_status: 'cancelled' })] })).resolves.toMatchObject(
      { ok: false, code: 'order_export.generation_failed' },
    );
    await expect(csvOrderExportRenderer.render({ granularity: 'order', rows: [headerRow({ customer_type: 'association' })] })).resolves.toMatchObject(
      { ok: false, code: 'order_export.generation_failed' },
    );
    await expect(csvOrderExportRenderer.render({ granularity: 'order', rows: [headerRow({ vat_regime: 'unknown_regime' })] })).resolves.toMatchObject(
      { ok: false, code: 'order_export.generation_failed' },
    );
  });
});

describe('csvOrderExportRenderer — ordre et jeu de colonnes par granularite (openapi/magrit-core.v1.yaml, OrderExportGranularity, SEULE source d ordre — arrete DEFINITIVEMENT le 2026-09-13)', () => {
  it('granularite order : en-tete commence par les ONZE colonnes partagees puis les colonnes d entete', async () => {
    const text = await renderText('order', []);
    const header = text.slice(BOM.length).split('\r\n')[0]!;
    const columns = header.split(';');
    expect(columns.slice(0, 11)).toEqual([
      'Numéro de commande',
      "Devis d'origine",
      'Date de commande',
      'Type de client',
      'Client',
      'SIRET',
      'Numéro de TVA',
      'Interlocuteur',
      'Courriel interlocuteur',
      'Statut commercial',
      'Étape de production',
    ]);
    expect(columns.slice(11)).toEqual([
      'Total lignes HT',
      'Remise globale',
      'Taux de remise effectif',
      'Net HT',
      'Taux de TVA',
      'Régime de TVA',
      'Montant TVA',
      'Total TTC',
    ]);
    // Aucun total repete a la ligne (arbitrage colonne 3) : par construction,
    // ce jeu de colonnes n en porte aucun a l identique du granularity line.
  });

  it('granularite line : PAS de total d entete, « Désignation » (pas « Libelle produit »), PU HT indicatif entre le montant bareme et le montant HT', async () => {
    const text = await renderText('line', []);
    const header = text.slice(BOM.length).split('\r\n')[0]!;
    const columns = header.split(';');
    expect(columns.slice(11)).toEqual([
      'Position',
      'Désignation',
      'Quantité',
      'Montant HT barème (avant remise)',
      'Taux de remise ligne',
      'PU HT indicatif',
      'Montant HT',
    ]);
    expect(columns).not.toContain('Libellé produit');
    expect(columns).not.toContain('Total TTC');
    expect(columns).not.toContain('Taux de TVA');
  });

  it('les colonnes partagees sont identiques, au nom et a la position pres, entre les deux granularites', async () => {
    const orderText = await renderText('order', []);
    const lineText = await renderText('line', []);
    const orderColumns = orderText.slice(BOM.length).split('\r\n')[0]!.split(';').slice(0, 11);
    const lineColumns = lineText.slice(BOM.length).split('\r\n')[0]!.split(';').slice(0, 11);
    expect(lineColumns).toEqual(orderColumns);
  });
});

describe('csvOrderExportRenderer — colonne "PU HT indicatif" (quatre decimales, jamais remultipliee)', () => {
  it('recopie 333,3333 (1000,00 / 3) sans arrondir davantage', async () => {
    const text = await renderText('line', [lineRow({ unit_price_indicative: '333.3333', sale_price: '1000.00' })]);
    expect(text).toContain('333,3333');
    expect(text).toContain('1000,00');
  });

  it('recopie 0,0900 (90,00 / 1000), jamais 0,1 ni 0,09', async () => {
    const text = await renderText('line', [lineRow({ unit_price_indicative: '0.0900' })]);
    expect(text).toContain('0,0900');
  });
});

describe('csvOrderExportRenderer — date de commande (conversion Europe/Paris, pas UTC)', () => {
  it('un instant UTC de fin de journee en France (23h30 Paris = 22h30 UTC en hiver friend, ete -1h) reste dans la BONNE date civile', async () => {
    // 2026-03-15T00:30:00Z = 2026-03-15T01:30 heure d hiver Paris (UTC+1,
    // avant le changement d heure de fin mars) -> meme jour civil.
    const text = await renderText('order', [headerRow({ order_created_at: '2026-03-15T00:30:00+00:00' })]);
    expect(text).toContain('2026-03-15');
  });

  it("bascule le jour civil quand l instant UTC tombe apres minuit heure de Paris (piege que la conversion existe pour eviter)", async () => {
    // 2026-09-01T22:30:00Z = 2026-09-02T00:30 heure d ete Paris (UTC+2) ->
    // le jour CIVIL change, contrairement a une lecture UTC brute.
    const text = await renderText('order', [headerRow({ order_created_at: '2026-09-01T22:30:00+00:00' })]);
    expect(text).toContain('2026-09-02');
    expect(text).not.toContain('2026-09-01');
  });
});
