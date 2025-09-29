import { and, desc, eq } from "drizzle-orm";
import Link from "next/link";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSessionContext } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { reviewGates } from "@/lib/db/schema/review-gates";
import { jobs } from "@/lib/db/schema/jobs";
import { workflows } from "@/lib/db/schema/workflows";

function formatDate(value: Date) {
  return value.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ReviewsPage() {
  const session = await getSessionContext();
  if (!session || session.role !== "operator" || !session.tenantId) {
    return null;
  }

  const gateRows = await db
    .select({
      reviewGateId: reviewGates.id,
      jobId: reviewGates.jobId,
      gateId: reviewGates.gateId,
      updatedAt: reviewGates.updatedAt,
      pages: reviewGates.pages,
      keys: reviewGates.keys,
      workflowName: workflows.name,
      jobStatus: jobs.status,
    })
    .from(reviewGates)
    .innerJoin(jobs, eq(reviewGates.jobId, jobs.id))
    .innerJoin(workflows, eq(jobs.workflowId, workflows.id))
    .where(and(eq(jobs.tenantId, session.tenantId), eq(reviewGates.status, "pending")))
    .orderBy(desc(reviewGates.updatedAt));

  const pendingGates = gateRows.filter((gate) => gate.jobStatus.startsWith("review:"));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Revisões pendentes</h1>
        <p className="text-sm text-muted-foreground">
          Revise as chaves retornadas pelos agentes e libere o fluxo para os próximos passos do workflow.
        </p>
      </div>

      {pendingGates.length === 0 ? (
        <Card className="border-dashed bg-muted/30">
          <CardHeader>
            <CardTitle className="text-base">Nenhum gate aguardando revisão</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Assim que o n8n solicitar uma revisão humana, o job aparecerá aqui com acesso rápido ao documento e às chaves estruturadas.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pendingGates.map((gate) => {
            const pages = (gate.pages ?? []) as string[];
            const firstPage = pages[0];
            const keys = (gate.keys ?? {}) as Record<string, string>;
            const totalKeys = Object.keys(keys).length;
            return (
              <Card key={`${gate.jobId}-${gate.gateId}`} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between gap-2">
                    <span>{gate.workflowName}</span>
                    <Badge variant="secondary">{gate.gateId}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4 text-sm text-muted-foreground">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">Job</p>
                    <p className="font-mono text-xs">{gate.jobId}</p>
                    <p>Atualizado em {formatDate(gate.updatedAt)}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{totalKeys} chaves</Badge>
                    <Badge variant="outline">Status atual: {gate.jobStatus}</Badge>
                  </div>
                  {firstPage ? (
                    <div className="overflow-hidden rounded-md border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={firstPage}
                        alt="Primeira página do documento em revisão"
                        className="h-40 w-full object-cover"
                      />
                    </div>
                  ) : null}
                </CardContent>
                <CardFooter className="mt-auto flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Aguardando ação humana</span>
                  <Button size="sm" asChild>
                    <Link href={`/reviews/${gate.jobId}/${gate.gateId}`}>Abrir revisão</Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}


