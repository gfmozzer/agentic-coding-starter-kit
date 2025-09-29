import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionContext } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { jobEvents } from "@/lib/db/schema/job-events";
import { jobs } from "@/lib/db/schema/jobs";
import { workflows } from "@/lib/db/schema/workflows";
import { calculateAgentAccuracy } from "@/lib/metrics/agent-accuracy";
import type { AgentJobMetric } from "@/lib/metrics/types";
import { StorageClient } from "@/lib/storage/client";

interface JobDetailPageProps {
  params: { jobId: string };
}

interface JobEventItem {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function formatDateTime(value: Date) {
  return value.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPercentage(value: number) {
  const formatter = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  });
  return `${formatter.format(value * 100)}%`;
}

function statusVariant(status: string) {
  if (status === "failed") {
    return "destructive" as const;
  }
  if (status.startsWith("review:")) {
    return "secondary" as const;
  }
  if (status === "queued") {
    return "outline" as const;
  }
  return "default" as const;
}

function formatStatusLabel(status: string) {
  if (status.startsWith("review:")) {
    const [, gate] = status.split(":");
    return gate ? `Revisao (${gate})` : "Revisao";
  }
  switch (status) {
    case "queued":
      return "Na fila";
    case "processing":
      return "Processando";
    case "translating":
      return "Traduzindo";
    case "done":
      return "Concluido";
    case "failed":
      return "Falhou";
    default:
      return status;
  }
}

function extractFinalPdfUrl(result: Record<string, unknown> | null): string | null {
  if (!result) {
    return null;
  }
  const value = result.finalPdfUrl;
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return null;
}

function resolveS3Key(rawUrl: string, bucket: string) {
  if (rawUrl.startsWith("s3://")) {
    const withoutProtocol = rawUrl.slice("s3://".length);
    const slashIndex = withoutProtocol.indexOf("/");
    if (slashIndex === -1) {
      return null;
    }
    const keyBucket = withoutProtocol.slice(0, slashIndex);
    if (keyBucket !== bucket) {
      return null;
    }
    return withoutProtocol.slice(slashIndex + 1);
  }

  try {
    const url = new URL(rawUrl);
    if (url.hostname === `${bucket}.s3.amazonaws.com` || url.hostname === bucket) {
      return url.pathname.startsWith("/") ? url.pathname.slice(1) : url.pathname;
    }
  } catch {
    return null;
  }

  return null;
}

async function buildDownloadLink(rawUrl: string | null) {
  if (!rawUrl) {
    return null;
  }

  try {
    const storage = new StorageClient();
    const bucket = storage.getBucket();
    const key = resolveS3Key(rawUrl, bucket);

    if (key) {
      const signed = await storage.getSignedUrl(key);
      return { url: signed, signed: true } as const;
    }

    if (!rawUrl.startsWith("http")) {
      const signed = await storage.getSignedUrl(rawUrl);
      return { url: signed, signed: true } as const;
    }
  } catch {
    console.warn("download link fallback", error);
  }

  return { url: rawUrl, signed: false } as const;
}

function groupEvents(events: JobEventItem[]) {
  return [...events].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

function metricSummary(metrics: AgentJobMetric[]) {
  if (metrics.length === 0) {
    return null;
  }
  const totalAgents = metrics.length;
  const avg = metrics.reduce((acc, item) => acc + item.accuracy, 0) / totalAgents;
  return {
    totalAgents,
    avgAccuracy: avg,
  } as const;
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const session = await getSessionContext();
  if (!session || session.role !== "operator" || !session.tenantId) {
    notFound();
  }

  const jobRow = await db
    .select({
      id: jobs.id,
      status: jobs.status,
      workflowName: workflows.name,
      currentGateId: jobs.currentGateId,
      createdAt: jobs.createdAt,
      updatedAt: jobs.updatedAt,
      result: jobs.result,
    })
    .from(jobs)
    .innerJoin(workflows, eq(jobs.workflowId, workflows.id))
    .where(and(eq(jobs.id, params.jobId), eq(jobs.tenantId, session.tenantId)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!jobRow) {
    notFound();
  }

  const [metrics, events] = await Promise.all([
    calculateAgentAccuracy({ tenantId: session.tenantId, jobId: jobRow.id }),
    db
      .select({
        id: jobEvents.id,
        eventType: jobEvents.eventType,
        payload: jobEvents.payload,
        createdAt: jobEvents.createdAt,
      })
      .from(jobEvents)
      .where(and(eq(jobEvents.jobId, jobRow.id), eq(jobEvents.tenantId, session.tenantId)))
      .orderBy(asc(jobEvents.createdAt)),
  ]);

  const orderedEvents = groupEvents(
    events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      payload: toRecord(event.payload),
      createdAt: event.createdAt,
    }))
  );

  const resultRecord = toRecord(jobRow.result);
  const downloadLink = await buildDownloadLink(extractFinalPdfUrl(resultRecord));
  const summary = metricSummary(metrics);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase text-muted-foreground">Job</p>
          <h1 className="text-2xl font-semibold text-foreground">{jobRow.id}</h1>
          <p className="text-sm text-muted-foreground">Workflow: {jobRow.workflowName}</p>
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          <Badge variant={statusVariant(jobRow.status)}>{formatStatusLabel(jobRow.status)}</Badge>
          <p className="text-xs text-muted-foreground">Atualizado em {formatDateTime(jobRow.updatedAt)}</p>
          {jobRow.currentGateId ? (
            <p className="text-xs text-muted-foreground">Gate atual: {jobRow.currentGateId}</p>
          ) : null}
        </div>
      </div>

      {jobRow.status === "failed" ? (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold text-destructive">Job falhou</CardTitle>
          </CardHeader>
          <CardContent className="py-3 text-sm text-destructive">
            Consulte a <Link href="#timeline" className="underline">timeline de eventos</Link> para revisar o motivo enviado pelo n8n ou agentes.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Metricas por agente</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma metrica disponivel para este job ainda.
              </p>
            ) : (
              <div className="space-y-4">
                {summary ? (
                  <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                    <p>
                      Acuracia media: <span className="font-semibold text-foreground">{formatPercentage(summary.avgAccuracy)}</span>
                    </p>
                    <p>Agentes avaliados: {summary.totalAgents}</p>
                  </div>
                ) : null}
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2 font-medium">Agente</th>
                      <th className="px-2 py-2 font-medium">Chaves</th>
                      <th className="px-2 py-2 font-medium">Editadas</th>
                      <th className="px-2 py-2 font-medium">Acuracia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {metrics.map((metric) => (
                      <tr key={metric.agentId}>
                        <td className="px-2 py-2 font-mono text-xs text-muted-foreground">{metric.agentId}</td>
                        <td className="px-2 py-2">{metric.totalKeys}</td>
                        <td className="px-2 py-2">{metric.editedKeys}</td>
                        <td className="px-2 py-2">{formatPercentage(metric.accuracy)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Arquivos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div>
              <p className="text-xs uppercase">PDF final</p>
              {downloadLink ? (
                <div className="mt-2 flex items-center gap-3">
                  <Button asChild size="sm">
                    <a href={downloadLink.url} target="_blank" rel="noopener noreferrer">
                      Baixar PDF final
                    </a>
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {downloadLink.signed ? "URL assinada" : "Link direto"}
                  </span>
                </div>
              ) : (
                <p>PDF final ainda nao disponivel.</p>
              )}
            </div>
            <div>
              <p className="text-xs uppercase">Criado em</p>
              <p>{formatDateTime(jobRow.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs uppercase">Ultima atualizacao</p>
              <p>{formatDateTime(jobRow.updatedAt)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card id="timeline">
        <CardHeader>
          <CardTitle className="text-base">Timeline de eventos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {orderedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento registrado para este job.</p>
          ) : (
            <ol className="space-y-4">
              {orderedEvents.map((event) => (
                <li key={event.id} className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">{event.eventType}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(event.createdAt)}</span>
                  </div>
                  {Object.keys(event.payload).length > 0 ? (
                    <pre className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap text-xs text-muted-foreground">
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

