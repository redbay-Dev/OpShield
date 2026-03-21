import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config.js";

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      endpoint: config.storage.endpoint,
      region: config.storage.region,
      credentials: {
        accessKeyId: config.storage.accessKey,
        secretAccessKey: config.storage.secretKey,
      },
      forcePathStyle: true, // Required for MinIO
    });
  }
  return client;
}

/**
 * Upload a file buffer to the configured bucket.
 * Returns the storage key used.
 */
export async function uploadFile(params: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<string> {
  const s3 = getClient();

  await s3.send(
    new PutObjectCommand({
      Bucket: config.storage.bucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    }),
  );

  return params.key;
}

/**
 * Generate a time-limited presigned URL for downloading a file.
 * Default expiry: 15 minutes.
 */
export async function getDownloadUrl(
  key: string,
  expiresInSeconds = 900,
): Promise<string> {
  const s3 = getClient();

  const command = new GetObjectCommand({
    Bucket: config.storage.bucket,
    Key: key,
  });

  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}

/**
 * Delete a file from the bucket.
 */
export async function deleteFile(key: string): Promise<void> {
  const s3 = getClient();

  await s3.send(
    new DeleteObjectCommand({
      Bucket: config.storage.bucket,
      Key: key,
    }),
  );
}
