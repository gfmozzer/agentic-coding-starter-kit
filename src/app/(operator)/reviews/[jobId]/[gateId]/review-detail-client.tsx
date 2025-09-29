"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { initialReviewActionState, submitReviewAction } from "@/lib/actions/review/submit";
import type { ReviewAuditEntry, ReviewFieldState } from "@/lib/reviews/types";

interface ReviewDetailClientProps {
  jobId: string;
  gateId: string;
  workflowName: string;
  jobStatus: string;
  status: string;
  updatedAt: string;
  inputKind: string;
  refId: string;
  fields: ReviewFieldState[];
  pages: string[];
  keysTranslated?: Record<string, string>;
  context?: Record<string, unknown>;
  auditTrail: ReviewAuditEntry[];
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending}>
      {pending ? "Enviando…" : "Enviar revisão"}
    </Button>
  );
}

export default function ReviewDetailClient({
  jobId,
  gateId,
  workflowName,
  jobStatus,
  status,
  updatedAt,
  inputKind,
  refId,
  fields,
  pages,
  keysTranslated,
  context,
  auditTrail,
}: ReviewDetailClientProps) {
  const isEditable = status === "pending";
  const [formState, formAction] = useActionState(submitReviewAction, initialReviewActionState);
  const [fieldState, setFieldState] = useState<ReviewFieldState[]>(fields);

  useEffect(() => {
    if (formState?.success) {
      setFieldState((prev) =>
        prev.map((field) => ({
          ...field,
          originalValue: field.value,
          edited: false,
        }))
      );
    }
  }, [formState.success]);

  const serializedValues = useMemo(() => {
    const payload: Record<string, string> = {};
    for (const field of fieldState) {
      payload[field.key] = field.value;
    }
    return JSON.stringify(payload);
  }, [fieldState]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-muted-foreground">Workflow</p>
          <h1 className="text-2xl font-semibold text-foreground">{workflowName}</h1>
          <p className="text-sm text-muted-foreground">
            Job <span className="font-mono text-xs text-foreground">{jobId}</span> | Gate {gateId}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Status do job: {jobStatus}</Badge>
          <Badge variant={isEditable ? "default" : "secondary"}>
            {isEditable ? "Aguardando revisão" : "Já enviado"}
          </Badge>
          <Badge variant="outline">Atualizado em {new Date(updatedAt).toLocaleString("pt-BR")}</Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(260px,360px)_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pages.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma imagem recebida para este gate.
                </p>
              ) : (
                <div className="space-y-3">
                  {pages.map((pageUrl, index) => (
                    <figure key={pageUrl} className="space-y-1">
                      <figcaption className="text-xs text-muted-foreground">
                        Página {index + 1}
                      </figcaption>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={pageUrl}
                        alt={`Página ${index + 1} do documento em revisão`}
                        className="w-full rounded-md border"
                      />
                    </figure>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Metadados do gate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Input kind:</span> {inputKind}
              </p>
              <p>
                <span className="font-medium text-foreground">Ref id:</span> {refId}
              </p>
              {keysTranslated && Object.keys(keysTranslated).length > 0 ? (
                <div>
                  <p className="font-medium text-foreground">Traduções sugeridas</p>
                  <ul className="mt-2 space-y-1 text-xs">
                    {Object.entries(keysTranslated).map(([key, value]) => (
                      <li key={key}>
                        <span className="font-semibold text-foreground">{key}:</span> {value}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {context && Object.keys(context).length > 0 ? (
                <div className="space-y-1 text-xs">
                  <p className="font-medium text-foreground">Contexto bruto</p>
                  <pre className="max-h-48 overflow-y-auto rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                    {JSON.stringify(context, null, 2)}
                  </pre>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Auditoria</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {auditTrail.length === 0 ? (
                <p className="text-sm">Nenhuma edição registrada ainda.</p>
              ) : (
                <ul className="space-y-3 text-xs">
                  {auditTrail.map((entry) => (
                    <li key={entry.id} className="rounded-md border bg-muted/40 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">{entry.key}</span>
                        <Badge variant="outline">
                          {new Date(entry.editedAt).toLocaleString("pt-BR")}
                        </Badge>
                      </div>
                      <p className="mt-1">
                        <span className="text-muted-foreground">De:</span> {entry.oldValue ?? "—"}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Para:</span> {entry.newValue ?? "—"}
                      </p>
                      <p className="text-muted-foreground">
                        Fonte original: {entry.sourceAgentId ?? "não informado"}
                      </p>
                      <p className="text-muted-foreground">
                        Revisado por: {entry.editedBy ?? "—"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Chaves estruturadas</CardTitle>
          </CardHeader>
          <CardContent>
            {!isEditable && (
              <p className="mb-4 text-sm text-muted-foreground">
                Este gate já foi enviado ao n8n. As chaves abaixo refletem os valores aprovados.
              </p>
            )}
            <form action={formAction} className="space-y-4">
              <input type="hidden" name="jobId" value={jobId} />
              <input type="hidden" name="gateId" value={gateId} />
              <input type="hidden" name="keysReviewed" value={serializedValues} readOnly />

              <div className="space-y-4">
                {fieldState.map((field, index) => (
                  <div key={field.key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-foreground" htmlFor={`field-${field.key}`}>
                        {field.key}
                      </label>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {field.sourceAgentId ? (
                          <Badge variant="outline">Fonte: {field.sourceAgentId}</Badge>
                        ) : null}
                        {field.edited ? <Badge variant="default">Editado</Badge> : null}
                      </div>
                    </div>
                    <Textarea
                      id={`field-${field.key}`}
                      value={field.value}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setFieldState((prev) =>
                          prev.map((item, idx) =>
                            idx === index
                              ? {
                                  ...item,
                                  value: nextValue,
                                  edited: nextValue !== item.originalValue,
                                }
                              : item
                          )
                        );
                      }}
                      disabled={!isEditable}
                      className={field.edited ? "border-primary" : undefined}
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      Original: <span className="font-mono">{field.originalValue}</span>
                    </p>
                  </div>
                ))}
              </div>

              {formState.error ? (
                <p className="text-sm text-destructive">{formState.error}</p>
              ) : null}
              {formState.success ? (
                <p className="text-sm text-emerald-600">{formState.success}</p>
              ) : null}

              {isEditable ? <SubmitButton disabled={fieldState.length === 0} /> : null}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
