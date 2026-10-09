import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fixture } from './fixtures/backoffice-shops';
const path = '/t/magrit-development/dashboard/shops';
const shopId = '51000000-0000-4000-8000-000000000001';


async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

for (const width of [375, 768, 1280]) {
  test(`création, réglages, erreurs et protection de saisie (${width}px)`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 900 });
    const { writes } = await fixture(page);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'Boutiques', exact: true })).toBeVisible();
    await noOverflow(page);
    const create = page.getByRole('button', { name: 'Créer une boutique', exact: true });
    await create.click();
    await page.getByLabel('Nom de la boutique (obligatoire)').fill('Boutique créée');
    await page.keyboard.press('Escape');
    await expect(create).toBeFocused();
    await create.click();
    await expect(page.getByLabel('Nom de la boutique (obligatoire)')).toHaveValue('Boutique créée');
    await page.getByRole('button', { name: 'Créer la boutique', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
    await expect(page.getByLabel('Nom de la boutique (obligatoire)')).toHaveValue('Boutique créée');
    await page.getByRole('button', { name: 'Créer la boutique', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(shopId));
    await expect(page.getByRole('tab', { name: 'Catalogue', exact: true })).toHaveAttribute('aria-selected', 'true');
    await page.getByLabel(/Produits de recette/).check();
    const information = page.getByRole('tab', { name: 'Informations générales', exact: true });
    await information.click();
    await expect(page).toHaveURL(/section=informations/);
    await page.getByLabel('Nom', { exact: true }).fill('Boutique renommée');
    await page.getByRole('tab', { name: 'Apparence', exact: true }).click();
    await expect(page.getByLabel('Couleur primaire', { exact: true })).toBeVisible();
    await information.click();
    await expect(page.getByLabel('Nom', { exact: true })).toHaveValue('Boutique renommée');
    await page.getByRole('link', { name: 'Toutes les boutiques', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toContainText('Quitter sans enregistrer');
    await page.getByRole('button', { name: 'Rester sur la boutique' }).click();
    await expect(page.getByLabel('Nom', { exact: true })).toHaveValue('Boutique renommée');
    await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'indisponible' })).toBeVisible();
    await expect(page.getByLabel('Nom', { exact: true })).toHaveValue('Boutique renommée');
    await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Modifications enregistrées.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enregistrer les modifications' })).toBeDisabled();
    await page.getByRole('tab', { name: 'Catalogue', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Clients', exact: true })).toBeFocused();
    await expect(page.getByRole('tab', { name: 'Clients', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByLabel(/Accès des acheteurs/)).toBeHidden();
    await information.click();
    await expect(page.getByRole('heading', { name: 'Publication et accès' })).toBeVisible();
    await expect(page.getByLabel(/Accès des acheteurs/)).toBeVisible();
    await noOverflow(page);
    const axe = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(axe.violations, JSON.stringify(axe.violations.map(value => ({ id: value.id, nodes: value.nodes.map(node => node.target) })))).toEqual([]);
    for (const label of ['Informations générales', 'Apparence', 'Catalogue']) {
      await page.getByRole('tab', { name: label, exact: true }).click();
      await noOverflow(page);
      const result = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(result.violations, JSON.stringify(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })))).toEqual([]);
    }
    await page.getByRole('tab', { name: 'Produits (2)', exact: true }).click();
    await expect(page.getByLabel('Prix de vente négocié HT de Article fixe 1', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Prix de vente négocié HT de Article fixe 2', { exact: true })).toBeVisible();
    const productAxe = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(productAxe.violations, JSON.stringify(productAxe.violations.map(v => v.id))).toEqual([]);
    await noOverflow(page);
    if (width === 375) {
      await page.getByRole('button', { name: 'Ouvrir le menu du back-office' }).click();
      await expect(page.getByRole('dialog', { name: 'Navigation du back-office' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: 'Ouvrir le menu du back-office' })).toBeFocused();
    }
    await page.screenshot({ path: test.info().outputPath(`boutique-${width}.png`), fullPage: true });
    expect(writes).toEqual(['create', 'create', 'save', 'save']);
    expect(errors).toEqual([]);
  });
}

test('une panne de liste permet de réessayer ; la suppression garde sa confirmation et son erreur', async ({ page }) => {
  const { writes } = await fixture(page, true);
  await page.goto(path);
  await expect(page.getByRole('alert')).toContainText('Impossible de charger');
  await expect(page.getByText('Votre première boutique')).toHaveCount(0);
  await page.getByRole('button', { name: 'Réessayer', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Boutique de recette', exact: true })).toBeVisible();
  const remove = page.getByRole('button', { name: 'Supprimer la boutique Boutique de recette' });
  await remove.click();
  await expect(page.getByRole('alertdialog')).toContainText('irréversible');
  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(remove).toBeFocused();
  expect(writes).toEqual([]);
  await remove.click();
  await page.getByRole('button', { name: 'Supprimer la boutique', exact: true }).click();
  await expect(page.getByRole('alertdialog').getByRole('alert')).toBeVisible();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  expect(writes).toEqual(['delete']);
});
