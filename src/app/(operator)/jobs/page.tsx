import { desc, eq, sql } from "drizzle-orm";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionContext } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { agentJobMetrics } from "@/lib/db/schema/job-metrics";
import { jobs } from "@/lib/db/schema/jobs";
import { workflows } from "@/lib/db/schema/workflows";

interface JobListItem {
  jobId: string;
  workflowName: string;
  status: string;
  currentGateId: string | null;
  createdAt: Date;
  updatedAt: Date;
  finalPdfUrl?: string;
}

interface JobMetricsSummary {
  avgAccuracy: number | null;
  agentCount: number;
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

function formatPercentage(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }
  const formatter = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  });
  return `${formatter.format(value * 100)}%`;
}


export default async function JobsDashboardPage() {
  const session = await getSessionContext();
  if (!session || session.role !== "operator" || !session.tenantId) {
    return null;
  }

  const [jobRows, metricsRows] = await Promise.all([
    db
      .select({
        jobId: jobs.id,
        workflowName: workflows.name,
        status: jobs.status,
        currentGateId: jobs.currentGateId,
        createdAt: jobs.createdAt,
        updatedAt: jobs.updatedAt,
        result: jobs.result,
      })
      .from(jobs)
      .innerJoin(workflows, eq(jobs.workflowId, workflows.id))
      .where(eq(jobs.tenantId, session.tenantId))
      .orderBy(desc(jobs.createdAt)),
    db
      .select({
        jobId: agentJobMetrics.jobId,
        avgAccuracy: sql<string>`AVG(${agentJobMetrics.accuracy})`,
        agentCount: sql<string>`COUNT(*)`,
      })
      .from(agentJobMetrics)
      .where(eq(agentJobMetrics.tenantId, session.tenantId))
      .groupBy(agentJobMetrics.jobId),
  ]);

  const metricsByJob = new Map<string, JobMetricsSummary>();
  for (const row of metricsRows) {
    const avgAccuracyRaw = row.avgAccuracy;
    const avgValue = avgAccuracyRaw === null ? null : Number(avgAccuracyRaw);
    const agentsValue = row.agentCount === null ? 0 : Number(row.agentCount);
    metricsByJob.set(row.jobId, {
      avgAccuracy: avgValue !== null && Number.isFinite(avgValue) ? avgValue : null,
      agentCount: Number.isFinite(agentsValue) ? agentsValue : 0,
    });
  }

  const jobsList: JobListItem[] = jobRows.map((row) => {
    const record = toRecord(row.result);
    const finalPdfUrl = typeof record.finalPdfUrl === "string" ? record.finalPdfUrl : undefined;
    return {
      jobId: row.jobId,
      workflowName: row.workflowName,
      status: row.status,
      currentGateId: row.currentGateId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      finalPdfUrl,
    };
  });

  const totals = jobsList.reduce(
    (acc, job) => {
      acc.total += 1;
      if (job.status === "done") {
        acc.done += 1;
      } else if (job.status === "failed") {
        acc.failed += 1;
      } else if (job.status.startsWith("review:")) {
        acc.review += 1;
      } else if (job.status === "processing" || job.status === "translating") {
        acc.active += 1;
      } else {
        acc.queued += 1;
      }
      return acc;
    },
    { total: 0, done: 0, failed: 0, review: 0, active: 0, queued: 0 }
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Historico de jobs</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe o status das traducoes, revise metricas por agente e acesse o PDF final quando disponivel.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Jobs totais</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{totals.total}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Concluidos</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold text-emerald-600">{totals.done}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Aguardando revisao</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold text-amber-600">{totals.review}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Falhados</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold text-destructive">{totals.failed}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Jobs recentes</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Job</th>
                <th className="px-3 py-2 font-medium">Workflow</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Atualizado</th>
                <th className="px-3 py-2 font-medium">Acuracia média</th>
                <th className="px-3 py-2 font-medium">PDF final</th>
                <th className="px-3 py-2 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {jobsList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Nenhum job encontrado para este tenant ainda.
                  </td>
                </tr>
              ) : (
                jobsList.map((job) => {
                  const metrics = metricsByJob.get(job.jobId);
                  return (
                    <tr key={job.jobId} className="hover:bg-muted/40">
                      <td className="px-3 py-2 align-middle font-mono text-xs text-muted-foreground">
                        {job.jobId}
                      </td>
                      <td className="px-3 py-2 align-middle">{job.workflowName}</td>
                      <td className="px-3 py-2 align-middle">
                        <Badge variant={statusVariant(job.status)}>{formatStatusLabel(job.status)}</Badge>
                      </td>
                      <td className="px-3 py-2 align-middle text-muted-foreground">
                        {formatDateTime(job.updatedAt)}
                      </td>
                      <td className="px-3 py-2 align-middle text-muted-foreground">
                        {formatPercentage(metrics?.avgAccuracy ?? null)}
                      </td>
                      <td className="px-3 py-2 align-middle text-muted-foreground">
                        {job.finalPdfUrl ? "Disponível" : "-"}
                      </td>
                      <td className="px-3 py-2 align-middle text-right">
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/jobs/${job.jobId}`}>Detalhes</Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}




