import { Buffer } from "node:buffer";
import { S3Client, GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface StorageClientOptions {
  bucket?: string;
  region?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  client?: S3Client;
}

export interface PutObjectInput {
  key: string;
  body: Buffer | Uint8Array | string | Blob;
  contentType?: string;
  cacheControl?: string;
}

export class StorageClient {
  private readonly bucket: string;
  private readonly client: S3Client;

  constructor(options: StorageClientOptions = {}) {
    const bucket = options.bucket ?? process.env.S3_BUCKET;
    if (!bucket) {
      throw new Error("S3_BUCKET nao configurado.");
    }

    this.bucket = bucket;
    this.client =
      options.client ??
      new S3Client({
        region: options.region ?? process.env.S3_REGION ?? "us-east-1",
        endpoint: options.endpoint ?? process.env.S3_ENDPOINT,
        forcePathStyle:
          options.forcePathStyle ?? process.env.S3_FORCE_PATH_STYLE === "true",
        credentials:
          process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
            ? {
                accessKeyId: process.env.S3_ACCESS_KEY_ID,
                secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
              }
            : undefined,
      });
  }

  getBucket(): string {
    return this.bucket;
  }

  getClient(): S3Client {
    return this.client;
  }

  buildS3Uri(key: string): string {
    return `s3://${this.bucket}/${key}`;
  }

  async putObject(input: PutObjectInput): Promise<void> {
    const Body = await this.normalizeBody(input.body);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body,
        ContentType: input.contentType,
        CacheControl: input.cacheControl,
      })
    );
  }

  async listObjects(prefix: string): Promise<string[]> {
    const response = await this.client.send(
      new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix })
    );
    if (!response.Contents) {
      return [];
    }
    return response.Contents.map((item) => item.Key).filter(
      (value): value is string => Boolean(value)
    );
  }

  async getSignedUrl(key: string, expiresIn = 60 * 30): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  private async normalizeBody(
    body: PutObjectInput["body"]
  ): Promise<Buffer | Uint8Array | string> {
    if (typeof body === "string") {
      return body;
    }
    if (body instanceof Buffer || body instanceof Uint8Array) {
      return body;
    }
    const GlobalBlob = typeof Blob !== "undefined" ? (Blob as unknown as typeof Blob) : undefined;
    if (GlobalBlob && body instanceof GlobalBlob) {
      return Buffer.from(await body.arrayBuffer());
    }
    const maybeArrayBuffer = body as unknown as { arrayBuffer?: () => Promise<ArrayBuffer> };
    if (typeof maybeArrayBuffer?.arrayBuffer === "function") {
      const arrayBuffer = await maybeArrayBuffer.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
    throw new Error("Formato de body nao suportado para upload ao S3.");
  }
}
