// @ts-nocheck
import { expect, test } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const storageState = process.env.PLAYWRIGHT_STORAGE_STATE;

if (storageState) {
  test.use({ storageState });
}

test.describe("Console do operador", () => {
  test("clona workflow, valida bloqueio e cria job", async ({ page }) => {
    test.skip(
      !storageState,
      "Configure PLAYWRIGHT_STORAGE_STATE com sessao autenticada de operador para executar este teste."
    );

    await page.goto(`${baseURL}/operator/workflows`);
    await expect(page.getByRole("heading", { name: "Workflows do tenant" })).toBeVisible();

    const cloneButton = page.getByRole("button", { name: "Clonar workflow" });
    const canClone = await cloneButton.isEnabled();
    test.skip(!canClone, "Nenhum template publicado para clonagem.");

    const workflowName = `Workflow QA ${Date.now()}`;

    await cloneButton.click();
    await expect(page.getByRole("heading", { name: "Clonar workflow" })).toBeVisible();

    const templateSelect = page.locator("#clone-template");
    const optionsCount = await templateSelect.locator("option").count();
    test.skip(optionsCount === 0, "Nenhum template disponivel no dialogo de clonagem.");

    const firstOptionValue = await templateSelect.locator("option").nth(0).getAttribute("value");
    if (firstOptionValue && firstOptionValue.length > 0) {
      await templateSelect.selectOption(firstOptionValue);
    } else if (optionsCount > 1) {
      const secondValue = await templateSelect.locator("option").nth(1).getAttribute("value");
      if (secondValue) {
        await templateSelect.selectOption(secondValue);
      }
    }

    await page.fill("#clone-name", workflowName);
    await page.getByRole("button", { name: "Confirmar clonagem" }).click();

    const workflowRow = page.locator("tr", { hasText: workflowName });
    await expect(workflowRow).toBeVisible({ timeout: 7000 });

    await workflowRow.getByRole("link", { name: "Abrir configuracoes" }).click();
    await page.waitForURL(/\/operator\/workflows\/.*\/settings/);
    await expect(page.getByRole("heading", { name: workflowName })).toBeVisible();

    const workflowId = new URL(page.url()).pathname.split("/")[3];
    expect(workflowId?.length).toBeGreaterThan(10);

    const blockResponse = await page.request.post(`${baseURL}/api/operator/jobs`, {
      data: {
        tenantWorkflowId: workflowId,
        sourcePdfUrl: "https://example.com/before-token.pdf",
      },
    });
    expect(blockResponse.status()).toBe(422);

    const promptTextarea = page
      .locator('textarea[placeholder="Use para ajustar instruções específicas do tenant"]')
      .first();
    test.skip(!(await promptTextarea.count()), "Nenhum passo de prompt disponivel para override.");

    await promptTextarea.fill("QA override de prompt");

    const providerInput = page.locator('input[placeholder="Ex.: openai"]').first();
    if (await providerInput.count()) {
      await providerInput.fill("openai");
    }

    const tokenInput = page.locator('input[placeholder="vault://tenant/provider"]').first();
    if (await tokenInput.count()) {
      await tokenInput.fill("vault://tenant/openai-qa");
    }

    await page.fill("#workflow-token", "vault://tenant/default-qa");
    await page.selectOption("#workflow-status", "ready");

    await page.getByRole("button", { name: "Salvar alteracoes" }).click();
    await expect(page.getByText("Configuracoes salvas com sucesso.")).toBeVisible({ timeout: 7000 });

    const pdfUrl = `https://storage.example.com/tests/${Date.now()}.pdf`;
    await page.goto(`${baseURL}/operator/start-translation`);
    await expect(page.getByRole("heading", { name: "Iniciar traducao" })).toBeVisible();

    const sourceInput = page.locator("#source-pdf");
    await sourceInput.fill(pdfUrl);
    await page.getByRole("button", { name: "Criar job" }).click();

    await expect(page.getByText(/Job .* criado/)).toBeVisible({ timeout: 7000 });
    const payloadPreview = page.locator("pre").first();
    await expect(payloadPreview).toContainText("defaultToken");
    await expect(payloadPreview).toContainText(pdfUrl);
  });
});
