
import { Buffer } from "node:buffer";

import { PDFDocument } from "pdf-lib";

import { StorageClient } from "@/lib/storage/client";
import { buildJobPaths } from "@/lib/storage/jobs-paths";

const PLACEHOLDER_JPEG_BASE64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxISEBUQEBIQFRUVFRUWFRUVFRUVFRUVFRUWFhUVFRUYHSggGBolHRUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDg0OFxAQFS0dFR0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAKgBLAMBIgACEQEDEQH/xAAcAAABBQEBAQAAAAAAAAAAAAAFAQIDBAYABwj/xABDEAACAQIEBAQEAwYEBQQDAAABAhEAAwQSITEFBkFREyJhcYGRMqGxFCNCscHR8AcVI1Lh8SNSYoKS0fEWY3OCk8LxUwX/xAAaAQADAQEBAQAAAAAAAAAAAAABAgMABAUH/8QAJREAAwEAAgICAQQDAAAAAAAAAAECAxESITEFBEEFEyIyUYGh/9oADAMBAAIRAxEAPwD7voqiKioqKioqKMmSeY3sZso2bdhi8qM4d4xkYIiJ5JJ5z3B4P2wp9zbB5LOeJvOqiKioqKioqKijpIY3ixtIc9zHimG1Y8jeNykVnla0eI5zMxz1ckekZ1uYrkk8T7V8nBbbhP1lT2JJmRy17xVHsQDQAAAG5Vqqqqqqqqrsdxmiy2trfRyFrLyzyxSB0jkdUfLy6COI6lGplVUk1to1W8idHuZ6UquYTKW2YcDNN19neoyG8oy1Klv2Mug6yfvujxY8Q3yM7mpyjTxsF5EmwX8UxznzR4U2u5D5Nm2E42Zc0+eXHotay9bXSVJrU5uZb7v3Mwm0T6vxu6u7e4tN5WSPPdQunM47nVrdzr97BR7W0slO08yZIjOEVeVVVWVQqqqqqqgAAH//2Q==";

const PLACEHOLDER_JPEG_BUFFER = Buffer.from(PLACEHOLDER_JPEG_BASE64, "base64");

export interface GeneratePdfDerivativesOptions {
  storage: StorageClient;
  tenantId: string;
  jobId: string;
  pdfBuffer: Buffer;
}

export interface GeneratedPageImage {
  key: string;
  byteSize: number;
}

export interface GeneratePdfDerivativesResult {
  pageImages: GeneratedPageImage[];
}

export async function generatePdfDerivatives(
  options: GeneratePdfDerivativesOptions
): Promise<GeneratePdfDerivativesResult> {
  const { storage, tenantId, jobId, pdfBuffer } = options;
  const document = await PDFDocument.load(pdfBuffer);
  const pageCount = Math.max(document.getPageCount(), 1);
  const paths = buildJobPaths(tenantId, jobId);

  const pageImages: GeneratedPageImage[] = [];

  for (let index = 0; index < pageCount; index += 1) {
    const pageNumber = index + 1;
    const key = paths.pageImageKey(pageNumber);
    const body = Buffer.from(PLACEHOLDER_JPEG_BUFFER);
    await storage.putObject({
      key,
      body,
      contentType: "image/jpeg",
      cacheControl: "public, max-age=31536000",
    });
    pageImages.push({ key, byteSize: body.byteLength });
  }

  return { pageImages };
}
