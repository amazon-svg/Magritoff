import { expect, type Page } from '@playwright/test';

type StoredCookies = Parameters<ReturnType<Page['context']>['addCookies']>[0];
const sessions = new Map<string, StoredCookies>();

/** Ouvre le formulaire Better Auth et établit une session par le flux utilisateur réel. */
export async function loginAs(page: Page, email: string, password: string): Promise<void> {
  const cached = sessions.get(email);
  if (cached !== undefined) {
    await page.context().addCookies(cached);
    await page.goto('/tenants');
    await expect(page.getByTestId('nav-tenant-switcher')).toBeVisible({ timeout: 10_000 });
    return;
  }

  await page.goto('/tenants');
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await page.getByTestId('auth-login-email-input').fill(email);
  await page.getByTestId('auth-login-password-input').fill(password);
  await page.getByTestId('auth-login-submit-btn').click();
  await expect(page.getByTestId('auth-login-submit-btn')).toBeHidden({ timeout: 10_000 });
  await expect(page.getByTestId('nav-tenant-switcher')).toBeVisible({ timeout: 10_000 });
  sessions.set(email, await page.context().cookies());
}
