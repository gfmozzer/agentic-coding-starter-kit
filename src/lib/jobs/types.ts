export type JobStatus =
  | "queued"
  | "processing"
  | "review:gate"
  | "translating"
  | "done"
  | "failed";

export interface JobRecord {
  id: string;
  tenantId: string;
  workflowId: string;
  status: JobStatus;
  sourcePdfUrl: string;
  pageImages: string[];
}
