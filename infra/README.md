# Infra: S3 for shared files, and the Vercel settings that use it (OpenTofu)

Together keeps each Together's photos, videos and documents in **one private S3 bucket**. Everything else stays where it
was: the app runs on **Vercel**, and the database and sign-in are **Supabase**. Files are encrypted in the browser
before upload (`lib/files/crypto.ts`), so S3 only ever holds ciphertext.

```
browser ──POST (signed, exact size)──▶ S3 together-files-<account>
browser ◀──GET (signed, 1 hour)─────── S3
Vercel functions ── OIDC token ──▶ IAM role together-files-vercel ──▶ signs those requests, checks uploads arrived
GitHub Actions  ── OIDC token ──▶ github-together-tofu-plan / -apply ──▶ tofu plan / apply infra/storage
```

[`storage/`](storage) is the only stack. It makes:

- **The files bucket** `together-files-<account>` in af-south-1. It's private, encrypted, TLS only, with CORS for the
  app's origins.
- **Vercel's OIDC provider** and the **`together-files-vercel` role**. The role can get and put objects in that bucket
  and nothing else, and carries the `github-together-boundary` permissions boundary.
- **The Vercel project** `together`, adopted with an `import` block ([`vercel.tf`](storage/vercel.tf)). OpenTofu sets
  its OIDC issuer to the team, and the `FILES_BUCKET`, `FILES_REGION` and `AWS_ROLE_ARN` variables for Production and
  Preview. Other variables (Supabase keys and the like) stay in the dashboard so their values never land in the state
  file.

## What's made outside this repo

The pieces GitHub Actions runs on were set up by hand in AWS account 768321396008:

| Piece | What it allows |
|---|---|
| State bucket `tofu-state-768321396008-af-south-1-an` | Together's state lives under `together/` (`together/storage.tfstate`). |
| `github-together-tofu-plan` | Pull requests on this repository: read only, plus the state lock file. |
| `github-together-tofu-apply` | The `main` branch: `together-*` buckets, and IAM users, roles and policies named `together-*` that carry the boundary. |
| `github-together-boundary` | Every role or user this stack makes must carry it. It limits them to `together-*` buckets. |

So everything this stack makes is named `together-…`, and every IAM role or user sets
`permissions_boundary = …/github-together-boundary`. Anything else gets access denied.

## One-time setup

1. **Let the roles trust this repository's real name.** GitHub sends the repository as `Brandon2255p/together`
   (lowercase), and AWS compares the subject exactly. Both trust policies have to match it:
   - plan: `repo:Brandon2255p/together:pull_request`
   - apply: `repo:Brandon2255p/together:ref:refs/heads/main`
2. **Let the apply role make Vercel's OIDC provider.** Add this statement to its `tofu-apply-together` policy:
   ```json
   {
     "Sid": "VercelOidcProvider",
     "Effect": "Allow",
     "Action": [
       "iam:CreateOpenIDConnectProvider",
       "iam:DeleteOpenIDConnectProvider",
       "iam:UpdateOpenIDConnectProviderThumbprint",
       "iam:AddClientIDToOpenIDConnectProvider",
       "iam:RemoveClientIDFromOpenIDConnectProvider",
       "iam:TagOpenIDConnectProvider",
       "iam:UntagOpenIDConnectProvider"
     ],
     "Resource": "arn:aws:iam::768321396008:oidc-provider/oidc.vercel.com/*"
   }
   ```
3. **Give OpenTofu a Vercel token.** Vercel's API has no OIDC login from GitHub, so this is the one stored key. Make
   a token under Vercel → Account Settings → Tokens, scoped to the brandons-projects team, with an expiry. Save it as a
   repository secret, not an environment secret (the roles refuse jobs that use `environment:`):
   ```bash
   gh secret set VERCEL_API_TOKEN
   ```
4. **Open a pull request** that touches `infra/`. Read the plan in the **Plan** job's summary. On the Vercel project it
   should show only the import, `oidc_token_config` and the three new variables. If it wants to change anything else
   (framework, Git repository, build commands), make `vercel.tf` match the dashboard first.
5. **Merge it.** The **Apply** job makes the bucket and the role, sets the Vercel variables, and lists the outputs.
   Redeploy the app on Vercel so it picks up the new variables.

## Day to day

- **Change the bucket, the role or the Vercel settings:** edit `infra/storage`, open a pull request, read the plan,
  merge. Once a Vercel setting is managed here, a dashboard change to it shows up as drift and the next apply puts it
  back.
- **A custom domain** for the app: add it to `app_origins` in `infra/storage/variables.tf` so the browser may upload
  from it (CORS).
- **Other AWS services** (SES, Lambda…) for Together's roles: widen `github-together-boundary` first. It only allows
  `together-*` buckets today.
- **Run locally against the real bucket:** set `FILES_BUCKET`, `FILES_REGION` and AWS credentials the SDK can find
  (a profile, or `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`) that may use the bucket. Without `AWS_ROLE_ARN` the app
  uses those directly. The stub backend (`USE_STUB_DATABASE=true`) needs none of this.
- **Plan locally:** `tofu -chdir=infra/storage init`, then `plan`, with AWS credentials and `VERCEL_API_TOKEN` set.

## What the workflow checks

| Job | When | Does |
|---|---|---|
| **Format & validate** | every pull request and push touching `infra/` | `tofu fmt -check`, then `init -backend=false` and `validate` |
| **Plan** | pull requests from this repository | `tofu plan` as `github-together-tofu-plan`, shown in the job summary |
| **Apply** | pushes to `main` (and manual runs on `main`) | `tofu apply` as `github-together-tofu-apply` |

Until `VERCEL_API_TOKEN` is set, plan and apply are skipped with a notice, so the workflow stays green.
