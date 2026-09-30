import { S3Client } from '@aws-sdk/client-s3';

/** Construit le client S3 portable depuis la configuration du runtime Node. */
export function createS3Client(environment: NodeJS.ProcessEnv = process.env): S3Client {
  const endpoint = optional(environment['S3_ENDPOINT']);
  const accessKeyId = optional(environment['S3_ACCESS_KEY_ID']);
  const secretAccessKey = optional(environment['S3_SECRET_ACCESS_KEY']);
  if ((accessKeyId === null) !== (secretAccessKey === null)) {
    throw new Error('S3_ACCESS_KEY_ID et S3_SECRET_ACCESS_KEY doivent etre fournis ensemble.');
  }
  return new S3Client({
    region: optional(environment['S3_REGION']) ?? 'us-east-1',
    ...(endpoint === null ? {} : { endpoint }),
    forcePathStyle: environment['S3_FORCE_PATH_STYLE'] === 'true',
    ...(accessKeyId === null ? {} : { credentials: { accessKeyId, secretAccessKey: secretAccessKey! } }),
  });
}

function optional(value: string | undefined): string | null {
  const normalized = value?.trim() ?? '';
  return normalized.length === 0 ? null : normalized;
}
