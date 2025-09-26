"use server";

import { N8NReviewApprovalPayload, N8NStartPayload } from "./types";

interface PostOptions<TPayload> {
  action: string;
  payload: TPayload;
  url: string;
}

function trimToNull(value?: string | null): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveBaseUrl(kind: "start" | "review") {
  const explicit =
    kind === "start"
      ? trimToNull(process.env.N8N_WEBHOOK_START_URL)
      : trimToNull(process.env.N8N_WEBHOOK_REVIEW_URL);

  if (explicit) {
    return explicit;
  }

  const base =
    trimToNull(process.env.N8N_WEBHOOK_URL) ??
    trimToNull(process.env.N8N_WEBHOOK_BASE_URL);

  if (!base) {
    throw new Error("Variavel N8N_WEBHOOK_URL nao configurada.");
  }

  if (kind === "review") {
    return joinUrl(base, "review");
  }

  return base;
}

function joinUrl(base: string, path: string) {
  const normalizedBase = base.replace(/\/+$/, "");
  const normalizedPath = path.replace(/^\/+/, "");
  return `${normalizedBase}/${normalizedPath}`;
}

async function postJson<TPayload>({ action, payload, url }: PostOptions<TPayload>) {
  const headers = new Headers({
    "Content-Type": "application/json",
  });

  const authHeader = trimToNull(process.env.N8N_WEBHOOK_AUTH_HEADER);
  if (authHeader) {
    headers.set("Authorization", authHeader);
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`n8n ${action} falhou (${response.status}): ${text}`);
  }

  if (response.headers.get("content-type")?.includes("application/json")) {
    await response.json().catch(() => undefined);
  }
}

export async function triggerWorkflow(payload: N8NStartPayload) {
  const url = resolveBaseUrl("start");
  await postJson({ action: "triggerWorkflow", payload, url });
}

export async function sendReviewApproval(payload: N8NReviewApprovalPayload) {
  const url = resolveBaseUrl("review");
  await postJson({ action: "sendReviewApproval", payload, url });
}
