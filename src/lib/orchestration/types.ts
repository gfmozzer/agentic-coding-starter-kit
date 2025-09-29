export interface N8NStartPayload {
  tenant_id: string;
  job_id: string;
  workflow_id: string;
  pdf_url: string;
  llm: {
    provider: string;
    token_ref: string;
  };
  metadata?: Record<string, unknown>;
  workflow_definition?: Record<string, unknown>;
}

export interface N8NReviewPayload {
  tenant_id: string;
  job_id: string;
  gate_id: string;
  input_kind: "agent" | "group";
  ref_id: string;
  keys: Record<string, string>;
  pages: string[];
  key_sources?: Record<string, string>;
  keys_translated?: Record<string, string>;
  keys_reviewed?: Record<string, string>;
  context?: Record<string, unknown>;
}

export interface N8NReviewApprovalPayload {
  tenant_id: string;
  job_id: string;
  gate_id: string;
  keys_reviewed: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface N8NFinalizationPayload {
  tenant_id: string;
  job_id: string;
  status: "done";
  pdf_url_final: string;
  metadata?: Record<string, unknown>;
}

export interface N8NFailurePayload {
  tenant_id: string;
  job_id: string;
  status: "failed";
  error?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}
