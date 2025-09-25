
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

interface WorkflowOption {
  id: string;
  name: string;
  status: "draft" | "ready";
  llmTokenRefDefault: string | null;
  templateName: string;
  templateVersion: string;
  updatedAt: string;
}

interface StartTranslationClientProps {
  workflows: WorkflowOption[];
}

interface JobSummary {
  id: string;
  status: string;
  sourcePdfUrl: string;
  pageImages: string[];
  createdAt?: string;
}

const ACCEPTED_FILE_TYPES = "application/pdf";

export function StartTranslationClient({ workflows }: StartTranslationClientProps) {
  const readyWorkflows = useMemo(
    () => workflows.filter((workflow) => workflow.status === "ready"),
    [workflows]
  );

  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>(
    readyWorkflows[0]?.id ?? ""
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [success, setSuccess] = useState<
    | {
        jobId: string;
        workflowName: string;
      }
    | null
  >(null);
  const [jobDetails, setJobDetails] = useState<JobSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (readyWorkflows.length === 0) {
      setSelectedWorkflowId("");
      return;
    }
    setSelectedWorkflowId((previous) => {
      if (previous && readyWorkflows.some((workflow) => workflow.id === previous)) {
        return previous;
      }
      return readyWorkflows[0].id;
    });
  }, [readyWorkflows]);

  const selectedWorkflow = workflows.find((workflow) => workflow.id === selectedWorkflowId) ?? null;

  const formattedJobDetails = useMemo(() => {
    if (!jobDetails) {
      return "";
    }
    try {
      return JSON.stringify(jobDetails, null, 2);
    } catch {
      return "";
    }
  }, [jobDetails]);

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setFileError(file ? null : "Selecione um arquivo PDF.");
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedWorkflowId) {
      setError("Selecione um workflow pronto para iniciar o job.");
      return;
    }

    if (!selectedFile) {
      setFileError("Selecione um arquivo PDF para upload.");
      return;
    }

    if (selectedFile.type && selectedFile.type !== ACCEPTED_FILE_TYPES) {
      setFileError("Envie um arquivo PDF valido.");
      return;
    }

    setSubmitting(true);

    try {
      const payload = new FormData();
      payload.append("tenantWorkflowId", selectedWorkflowId);
      payload.append("file", selectedFile);
      if (notes.trim().length > 0) {
        payload.append("notes", notes.trim());
      }

      const response = await fetch("/api/operator/jobs", {
        method: "POST",
        body: payload,
      });

      const data = await response
        .json()
        .catch(() => ({ error: "Nao foi possivel interpretar a resposta." }));

      if (response.status === 422) {
        setError(
          typeof data?.error === "string"
            ? data.error
            : "Workflow sem token padrao. Atualize as configuracoes."
        );
        return;
      }

      if (!response.ok) {
        setError(
          typeof data?.error === "string" ? data.error : "Nao foi possivel criar o job."
        );
        return;
      }

      const job: JobSummary | null = data?.job ?? null;

      setSuccess({
        jobId: job?.id ?? "(desconhecido)",
        workflowName: selectedWorkflow?.name ?? "",
      });
      setJobDetails(job);
      setNotes("");
      setSelectedFile(null);
      setFileError(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (jobError) {
      console.error(jobError);
      setError("Falha inesperada ao criar job.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Iniciar traducao</h2>
        <p className="text-sm text-muted-foreground">
          Selecione um workflow pronto, envie o PDF e acompanhe a fila de processamento.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Job {success.jobId} criado para o workflow {success.workflowName}. Geracao de imagens acontece em segundo plano.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Dados do job</CardTitle>
          <CardDescription>
            Apenas workflows com status pronto e token configurado podem iniciar jobs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="workflow-select">
                Workflow
              </label>
              <select
                id="workflow-select"
                value={selectedWorkflowId}
                onChange={(event) => setSelectedWorkflowId(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                disabled={readyWorkflows.length === 0}
              >
                {readyWorkflows.length === 0 && <option value="">Nenhum workflow pronto</option>}
                {readyWorkflows.map((workflow) => (
                  <option key={workflow.id} value={workflow.id}>
                    {workflow.name} (v{workflow.templateVersion})
                  </option>
                ))}
              </select>
              {selectedWorkflow && (
                <div className="space-y-1 rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <p>
                    Template: {" "}
                    <span className="font-medium text-foreground">{selectedWorkflow.templateName}</span> (v
                    {selectedWorkflow.templateVersion})
                  </p>
                  <p>
                    Token padrao:{" "}
                    {selectedWorkflow.llmTokenRefDefault ? (
                      <span className="font-medium text-foreground">
                        {selectedWorkflow.llmTokenRefDefault}
                      </span>
                    ) : (
                      <span className="text-destructive">
                        Configure em Configuracoes &gt; Tokens
                      </span>
                    )}
                  </p>
                  <p>
                    Atualizado em {" "}
                    {new Date(selectedWorkflow.updatedAt).toLocaleString("pt-BR")}
                  </p>
                  <Link
                    href={`/operator/workflows/${selectedWorkflow.id}/settings`}
                    className="inline-flex items-center text-xs font-medium text-primary hover:underline"
                  >
                    Abrir configuracoes
                  </Link>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="workflow-file">
                Upload do PDF
              </label>
              <input
                id="workflow-file"
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILE_TYPES}
                onChange={handleFileChange}
                className="w-full cursor-pointer rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <p className="text-xs text-muted-foreground">
                O arquivo sera armazenado em docs/{'{tenant_id}'}/jobs/{'{job_id}'}/original.pdf.
              </p>
              {fileError && <p className="text-xs text-destructive">{fileError}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="job-notes">
                Notas para o orquestrador (opcional)
              </label>
              <Textarea
                id="job-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Incluir informacoes adicionais, ex.: prazo ou idioma final."
                className="min-h-[100px]"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <Button type="submit" disabled={submitting || readyWorkflows.length === 0}>
                {submitting ? "Enviando..." : "Criar job"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workflows do tenant</CardTitle>
          <CardDescription>Resumo de disponibilidade e tokens.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {workflows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum workflow clonado ainda. Clone um workflow publicado para iniciar trabalhos.
            </p>
          ) : (
            workflows.map((workflow) => (
              <div
                key={workflow.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium text-foreground">{workflow.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Template {workflow.templateName} - v{workflow.templateVersion}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={workflow.status === "ready" ? "default" : "secondary"}>
                    {workflow.status === "ready" ? "Pronto" : "Rascunho"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {workflow.llmTokenRefDefault ? "Token configurado" : "Sem token"}
                  </span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {success && formattedJobDetails && (
        <Card>
          <CardHeader>
            <CardTitle>Resumo do job criado</CardTitle>
            <CardDescription>Confira o status inicial e caminhos de armazenamento.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[260px] overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
{formattedJobDetails}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
