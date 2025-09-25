
import { Buffer } from "node:buffer";
import assert from "node:assert/strict";
import { test } from "node:test";

import { mockClient } from "aws-sdk-client-mock";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PDFDocument } from "pdf-lib";

import { StorageClient } from "../../src/lib/storage/client";
import { buildJobPaths } from "../../src/lib/storage/jobs-paths";
import { generatePdfDerivatives } from "../../src/workers/pdf-derivatives";

test("envio de pdf e derivativos gera uploads no prefixo do job", async () => {
  process.env.S3_BUCKET = "test-bucket";
  const s3Mock = mockClient(S3Client);
  s3Mock.on(PutObjectCommand).resolves({});

  const storage = new StorageClient({ bucket: "test-bucket" });
  const tenantId = "tenant-test";
  const jobId = "job-test";
  const paths = buildJobPaths(tenantId, jobId);

  const pdf = await PDFDocument.create();
  pdf.addPage();
  pdf.addPage();
  const pdfBytes = await pdf.save();

  await storage.putObject({
    key: paths.originalPdfKey,
    body: Buffer.from(pdfBytes),
    contentType: "application/pdf",
  });

  await generatePdfDerivatives({
    storage,
    tenantId,
    jobId,
    pdfBuffer: Buffer.from(pdfBytes),
  });

  const putCommands = s3Mock.commandCalls(PutObjectCommand);
  const uploadedKeys = putCommands.map((command) => command.args[0].input.Key);

  assert(uploadedKeys.includes(paths.originalPdfKey));
  assert(uploadedKeys.includes(paths.pageImageKey(1)));
  assert(uploadedKeys.includes(paths.pageImageKey(2)));
});
