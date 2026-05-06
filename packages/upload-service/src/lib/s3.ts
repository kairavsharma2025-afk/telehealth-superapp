import {
  CreateBucketCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config.js";
import { logger } from "../logger.js";

const internalConfig: S3ClientConfig = {
  endpoint: config.s3.endpoint,
  region: config.s3.region,
  forcePathStyle: config.s3.forcePathStyle,
  credentials: {
    accessKeyId: config.s3.accessKeyId,
    secretAccessKey: config.s3.secretAccessKey,
  },
};

const publicConfig: S3ClientConfig = {
  ...internalConfig,
  endpoint: config.s3.publicEndpoint,
};

// internalClient is used for server-to-server ops (HEAD, DELETE, bucket bootstrap).
// publicClient signs URLs the *browser* will hit, so it must use the
// hostname clients can actually resolve.
const internalClient = new S3Client(internalConfig);
const publicClient = new S3Client(publicConfig);

export async function ensureBucketExists(): Promise<void> {
  try {
    await internalClient.send(new HeadBucketCommand({ Bucket: config.s3.bucket }));
  } catch (err: unknown) {
    if (isNotFound(err)) {
      await internalClient.send(new CreateBucketCommand({ Bucket: config.s3.bucket }));
      logger.info({ bucket: config.s3.bucket }, "created bucket");
      return;
    }
    throw err;
  }
}

export function presignPut(objectKey: string, contentType: string): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: config.s3.bucket,
    Key: objectKey,
    ContentType: contentType,
  });
  return getSignedUrl(publicClient, cmd, { expiresIn: config.presignPutSeconds });
}

export function presignGet(objectKey: string): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: config.s3.bucket, Key: objectKey });
  return getSignedUrl(publicClient, cmd, { expiresIn: config.presignGetSeconds });
}

export interface HeadResult {
  exists: boolean;
  size: number;
  contentType: string | undefined;
}

export async function headObject(objectKey: string): Promise<HeadResult> {
  try {
    const res = await internalClient.send(
      new HeadObjectCommand({ Bucket: config.s3.bucket, Key: objectKey }),
    );
    return {
      exists: true,
      size: typeof res.ContentLength === "number" ? res.ContentLength : 0,
      contentType: res.ContentType,
    };
  } catch (err: unknown) {
    if (isNotFound(err)) return { exists: false, size: 0, contentType: undefined };
    throw err;
  }
}

export async function deleteObject(objectKey: string): Promise<void> {
  await internalClient.send(
    new DeleteObjectCommand({ Bucket: config.s3.bucket, Key: objectKey }),
  );
}

function isNotFound(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { $metadata?: { httpStatusCode?: number }; name?: string; Code?: string };
  if (e.$metadata?.httpStatusCode === 404) return true;
  return e.name === "NotFound" || e.name === "NoSuchKey" || e.name === "NoSuchBucket";
}
