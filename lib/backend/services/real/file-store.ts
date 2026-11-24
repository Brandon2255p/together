import "server-only";
import { GetObjectCommand, HeadObjectCommand, S3Client, S3ServiceException } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { awsCredentialsProvider } from "@vercel/functions/oidc";
import type { UploadTarget } from "@/lib/models";

// The S3 bucket that holds every Together's encrypted photos, videos and documents (infra/storage). The server never
// touches the bytes: it signs short-lived uploads and downloads that the browser uses directly, and checks uploads
// arrived. Row-level security on public.files decides who may ask for what; this module only signs.
//
//   FILES_BUCKET   the bucket (infra/storage output files_bucket)
//   FILES_REGION   its region (output files_region)
//   AWS_ROLE_ARN   on Vercel: the role to assume with the deployment's OIDC token (output vercel_role_arn). Without
//                  it the AWS SDK's usual credentials are used (AWS_ACCESS_KEY_ID…, or a profile), for local runs.
//   FILES_ENDPOINT optional: another S3-compatible endpoint (LocalStack for tests), addressed path-style

const UPLOAD_SECONDS = 15 * 60;
const DOWNLOAD_SECONDS = 60 * 60;

let client: S3Client | null = null;

function config() {
  const bucket = process.env.FILES_BUCKET;
  const region = process.env.FILES_REGION;
  if (!bucket || !region) throw new Error("File storage isn't set up: FILES_BUCKET and FILES_REGION are missing.");
  return { bucket, region, roleArn: process.env.AWS_ROLE_ARN, endpoint: process.env.FILES_ENDPOINT };
}

function s3(): { client: S3Client; bucket: string } {
  const { bucket, region, roleArn, endpoint } = config();
  client ??= new S3Client({
    region,
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    ...(roleArn ? { credentials: awsCredentialsProvider({ roleArn, roleSessionName: "together-files", clientConfig: { region } }) } : {}),
  });
  return { client, bucket };
}

/** a signed POST that accepts exactly `bytes` bytes at `path`, for the next 15 minutes */
export async function signUpload(path: string, bytes: number): Promise<UploadTarget> {
  const { client, bucket } = s3();
  const { url, fields } = await createPresignedPost(client, {
    Bucket: bucket,
    Key: path,
    Conditions: [
      ["content-length-range", bytes, bytes],
      ["eq", "$Content-Type", "application/octet-stream"],
    ],
    Fields: { "Content-Type": "application/octet-stream" },
    Expires: UPLOAD_SECONDS,
  });
  return { path, url, fields };
}

/** signed GETs for these objects, good for an hour */
export async function signDownloads(paths: string[]): Promise<{ path: string; url: string }[]> {
  const { client, bucket } = s3();
  return Promise.all(
    paths.map(async (path) => ({
      path,
      url: await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: path }), { expiresIn: DOWNLOAD_SECONDS }),
    })),
  );
}

/** each object's size in bytes, or null when it isn't there */
export async function objectSizes(paths: string[]): Promise<(number | null)[]> {
  const { client, bucket } = s3();
  return Promise.all(
    paths.map(async (path) => {
      try {
        const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: path }));
        return head.ContentLength ?? null;
      } catch (e) {
        if (e instanceof S3ServiceException && e.$metadata.httpStatusCode === 404) return null;
        throw e;
      }
    }),
  );
}
