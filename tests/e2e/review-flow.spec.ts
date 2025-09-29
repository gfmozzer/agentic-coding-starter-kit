// @ts-nocheck
import { expect, test } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const storageState = process.env.PLAYWRIGHT_STORAGE_STATE;
const webhookUrl = process.env.N8N_WEBHOOK_URL;

if (storageState) {
  test.use({ storageState });
}

test.describe("Fluxo de revisão", () => {
  test("operador ajusta chave e submete aprovação", async ({ page }) => {
    test.skip(
      !storageState,
      "Configure PLAYWRIGHT_STORAGE_STATE com sessão autenticada de operador para executar este teste."
    );

    test.skip(!webhookUrl, "Defina N8N_WEBHOOK_URL para executar a submissão de revisão.");

    await page.goto(`${baseURL}/reviews`);
    await expect(page.getByRole("heading", { name: "Revisões pendentes" })).toBeVisible();

    const reviewLink = page.getByRole("link", { name: "Abrir revisão" }).first();
    test.skip((await reviewLink.count()) === 0, "Nenhum gate em revisão disponível para testes.");

    await reviewLink.click();
    await expect(page.getByRole("heading", { name: "Chaves estruturadas" })).toBeVisible({ timeout: 5000 });

    const textarea = page.locator("textarea").first();
    test.skip((await textarea.count()) === 0, "Nenhuma chave disponível para edição.");

    const currentValue = await textarea.inputValue();
    const nextValue = currentValue ? `${currentValue} (rev)` : "Valor ajustado (rev)";
    await textarea.fill(nextValue);

    const submitButton = page.getByRole("button", { name: "Enviar revisão" });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    await expect(page.getByText("Revisao enviada ao n8n com sucesso.")).toBeVisible({ timeout: 10000 });
  });
});
