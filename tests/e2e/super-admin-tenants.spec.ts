// @ts-nocheck
import { expect, test } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const storageState = process.env.PLAYWRIGHT_STORAGE_STATE;

if (storageState) {
  test.use({ storageState });
}

test.describe("Console do super-admin", () => {
  test("cria tenant e gera convite pendente", async ({ page }) => {
    test.skip(
      !storageState,
      "Configure PLAYWRIGHT_STORAGE_STATE com sessão autenticada de super-admin para executar este teste."
    );

    const slug = `pw-${Date.now()}`;
    const tenantName = `Playwright QA ${slug}`;
    const inviteEmail = `qa-${slug}@example.com`;

    await page.goto(`${baseURL}/super-admin/tenants`);
    await expect(page.getByRole("heading", { name: "Tenants e usuários" })).toBeVisible();

    await page.getByRole("button", { name: "Novo tenant" }).click();
    await page.fill("#tenant-name", tenantName);
    await page.fill("#tenant-slug", slug);
    await page.getByRole("button", { name: "Criar tenant" }).click();

    const tenantRow = page.locator("tr", { hasText: tenantName });
    await expect(tenantRow).toBeVisible({ timeout: 5000 });

    await tenantRow.getByRole("link", { name: "Gerenciar usuários" }).click();
    await page.waitForURL(/\/super-admin\/tenants\/.*\/users/);
    await expect(page.getByRole("heading", { name: tenantName })).toBeVisible();

    await page.fill("#invite-email", inviteEmail);
    await page.selectOption("#invite-role", "operator");
    await page.getByRole("button", { name: "Registrar" }).click();

    const inviteRow = page.locator("tr", { hasText: inviteEmail });
    await expect(inviteRow).toBeVisible({ timeout: 5000 });
    await expect(inviteRow.getByText("pending", { exact: false })).toBeVisible();
  });
});
