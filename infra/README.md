# Infra: AWS for shared files (OpenTofu)

Together keeps each Together's photos, videos and documents in **one private S3 bucket**. Everything else stays where it
was: the app runs on **Vercel**, and the database and sign-in are **Supabase**. Files are encrypted in the browser
before upload (`lib/files/crypto.ts`), so S3 only ever holds ciphertext.

```
browser ──POST (signed, exact size)──▶ S3 together-files-<account>
browser ◀──GET (signed, 1 hour)─────── S3
Vercel functions ── OIDC token ──▶ IAM role together-files-vercel ──▶ signs those requests, checks uploads arrived
GitHub Actions  ── OIDC token ──▶ together-infra-plan / together-infra-apply ──▶ tofu plan / apply infra/storage
```

No AWS access keys are stored anywhere: Vercel and GitHub each prove who they are with short-lived OIDC tokens.

| Stack | What | Runs |
|---|---|---|
| [`bootstrap/`](bootstrap) | The state bucket's settings, GitHub's OIDC provider, and the two roles GitHub Actions uses | **By hand, once** (and when those roles change), with admin credentials |
| [`storage/`](storage) | The files bucket (private, encrypted, CORS for the app), Vercel's OIDC provider, and the `together-files-vercel` role | **By GitHub Actions** ([`infra.yml`](../.github/workflows/infra.yml)): plan on pull requests, apply on `main` |

State for both is in an S3 bucket, with S3's own lock file (`use_lockfile`, OpenTofu 1.10+).

## One-time setup

You need [OpenTofu](https://opentofu.org/docs/intro/install/) 1.10 or newer (`brew install opentofu`), the AWS CLI,
and credentials for an AWS account with administrator access (only for these steps).

### 1. Pick the region

The default is **af-south-1** (Cape Town), closest to South Africa. It's an opt-in region: enable it first under
**AWS console → Account → AWS Regions**, or pick another region and pass it everywhere `af-south-1` appears below.

```bash
export AWS_REGION=af-south-1
```

```bash
export STATE_BUCKET=together-tofu-state-$(aws sts get-caller-identity --query Account --output text)
```

### 2. Make the state bucket

OpenTofu can't keep its state in a bucket it hasn't made yet, so this one bucket is made by hand. `bootstrap` then
adopts it and turns on versioning, encryption and the public access block.

```bash
aws s3api create-bucket --bucket "$STATE_BUCKET" --region "$AWS_REGION" --create-bucket-configuration LocationConstraint="$AWS_REGION"
```

### 3. Apply `bootstrap`

```bash
tofu -chdir=infra/bootstrap init -backend-config="bucket=$STATE_BUCKET" -backend-config="region=$AWS_REGION"
```

```bash
tofu -chdir=infra/bootstrap apply -var="state_bucket=$STATE_BUCKET" -var="region=$AWS_REGION"
```

It prints `plan_role_arn` and `apply_role_arn`.

### 4. Tell GitHub

Set the repository variables. They aren't secrets: the roles only trust this repository's workflows.

```bash
gh variable set AWS_REGION --body "$AWS_REGION"
```

```bash
gh variable set AWS_STATE_BUCKET --body "$STATE_BUCKET"
```

```bash
gh variable set AWS_INFRA_PLAN_ROLE_ARN --body "$(tofu -chdir=infra/bootstrap output -raw plan_role_arn)"
```

```bash
gh variable set AWS_INFRA_APPLY_ROLE_ARN --body "$(tofu -chdir=infra/bootstrap output -raw apply_role_arn)"
```

Then create the **`infra`** environment (repo **Settings → Environments → New environment**). The apply role only
trusts jobs in that environment. Add yourself as a required reviewer there if you want to approve each apply.

### 5. Let GitHub apply `storage`

Run the **Infra** workflow (Actions → Infra → Run workflow on `main`), or merge any change under `infra/`. The apply
job creates the bucket and Vercel's role, and its summary lists the outputs.

### 6. Tell Vercel

In the Vercel project (**Settings → Environment Variables**, for Production and Preview):

| Variable | Value |
|---|---|
| `FILES_BUCKET` | `files_bucket` output, e.g. `together-files-123456789012` |
| `FILES_REGION` | `files_region` output, e.g. `af-south-1` |
| `AWS_ROLE_ARN` | `vercel_role_arn` output |

Check **Settings → Security → Secure backend access with OIDC federation** is on, with the **Team** issuer mode (the
default). Then redeploy.

## Day to day

- **Change the bucket or the app's role:** edit `infra/storage`, open a pull request, and read the plan in the
  **Plan storage** job's summary. Merging applies it.
- **Change GitHub's roles:** edit `infra/bootstrap` and apply it by hand as in step 3. A workflow can't safely change
  the roles it runs as.
- **A custom domain** for the app: add it to `app_origins` in `infra/storage/variables.tf` so the browser may upload
  from it (CORS).
- **Run locally against the real bucket:** set `FILES_BUCKET`, `FILES_REGION` and AWS credentials the SDK can find
  (a profile, or `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`) that may use the bucket. Without `AWS_ROLE_ARN` the app
  uses those directly. The stub backend (`USE_STUB_DATABASE=true`) needs none of this.

## What the workflow checks

| Job | When | Does |
|---|---|---|
| **Format & validate** | every pull request and push touching `infra/` | `tofu fmt -check`, then `init -backend=false` and `validate` for both stacks |
| **Plan storage** | pull requests from this repository | `tofu plan` as `together-infra-plan`, which can read AWS and the state but not change anything (except the state lock file) |
| **Apply storage** | pushes to `main` | `tofu apply` as `together-infra-apply`, in the `infra` environment. It may only manage `together-files-*` buckets and roles and Vercel's OIDC provider. |

Until the repository variables are set, plan and apply are skipped with a notice, so the workflow stays green.
