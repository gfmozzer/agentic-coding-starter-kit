export interface JobPaths {
  basePrefix: string;
  originalPdfKey: string;
  pageImageKey: (pageNumber: number) => string;
  pageImagePrefix: string;
}

export function buildJobPaths(tenantId: string, jobId: string): JobPaths {
  const basePrefix = `docs/${tenantId}/jobs/${jobId}`;
  const pageImagePrefix = `${basePrefix}/pages`;

  return {
    basePrefix,
    pageImagePrefix,
    originalPdfKey: `${basePrefix}/original.pdf`,
    pageImageKey: (pageNumber: number) => `${pageImagePrefix}/p${pageNumber}.jpg`,
  };
}
