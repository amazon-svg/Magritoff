import {
  CreateBucketCommand,
  ListBucketsCommand,
  PutBucketPolicyCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { readFile } from 'node:fs/promises';

const storageBuckets = JSON.parse(
  await readFile(new URL('../../config/storage-buckets.json', import.meta.url), 'utf8'),
);

const buckets = Object.values(storageBuckets);
const publicReadBuckets = [
  storageBuckets.product_mockups,
  storageBuckets.shop_backgrounds,
  storageBuckets.shop_product_mockups,
];

if (new Set(buckets).size !== buckets.length) {
  throw new Error('Deux buckets logiques utilisent le meme nom physique S3.');
}
for (const bucket of buckets) {
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) {
    throw new Error(`Nom de bucket S3 invalide : ${bucket}`);
  }
}

const endpoint = process.env.MAGRIT_DEV_S3_ENDPOINT ?? 'http://127.0.0.1:58333';
const client = new S3Client({
  endpoint,
  region: process.env.MAGRIT_DEV_S3_REGION ?? 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.MAGRIT_DEV_S3_ACCESS_KEY_ID ?? 'magrit-local',
    secretAccessKey: process.env.MAGRIT_DEV_S3_SECRET_ACCESS_KEY ?? 'magrit-local-secret',
  },
});

const wait = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));

async function listBucketsWithRetry() {
  let lastError;
  for (let attempt = 1; attempt <= 40; attempt += 1) {
    try {
      return await client.send(new ListBucketsCommand({}));
    } catch (error) {
      lastError = error;
      if (attempt < 40) await wait(500);
    }
  }
  throw new Error(
    `Le service S3 local n'est pas joignable sur ${endpoint}`,
    { cause: lastError },
  );
}

const response = await listBucketsWithRetry();
const existing = new Set((response.Buckets ?? []).flatMap((bucket) => (
  bucket.Name ? [bucket.Name] : []
)));

for (const bucket of buckets) {
  if (!existing.has(bucket)) {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    process.stdout.write(`Bucket S3 local cree : ${bucket}\n`);
  }
  if (publicReadBuckets.includes(bucket)) {
    await client.send(new PutBucketPolicyCommand({
      Bucket: bucket,
      Policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [{
          Sid: 'PublicReadObjects',
          Effect: 'Allow',
          Principal: '*',
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${bucket}/*`],
        }],
      }),
    }));
  }
}

process.stdout.write(`S3 local pret : ${buckets.length} buckets sur ${endpoint}\n`);
