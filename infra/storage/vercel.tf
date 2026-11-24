# The Together project on Vercel, adopted as it was (an import, not a new project). Only what the files bucket needs is
# changed: OIDC tokens with the team issuer (the AWS role trusts oidc.vercel.com/<team>), and the three variables the
# app reads in lib/backend/services/real/file-store.ts. Every other variable (Supabase keys and the like) stays out of
# OpenTofu so its value never lands in the state file; set those in the dashboard as before.
#
# Settings left out here are Vercel's to keep, but a few are cleared when they're missing (framework, git_repository,
# build commands), so they're spelled out to match the dashboard. Read the plan on the pull request before merging: it
# should show the import, the OIDC setting and three new variables, nothing else on the project.

import {
  to = vercel_project.together
  id = "${var.vercel_team_id}/${var.vercel_project_id}"
}

resource "vercel_project" "together" {
  name      = var.vercel_project
  team_id   = var.vercel_team_id
  framework = "nextjs"

  git_repository = {
    type              = "github"
    repo              = "Brandon2255p/together"
    production_branch = "main"
  }

  oidc_token_config = {
    issuer_mode = "team"
  }

  lifecycle {
    prevent_destroy = true
  }
}

locals {
  vercel_env = {
    FILES_BUCKET = aws_s3_bucket.files.bucket
    FILES_REGION = var.region
    AWS_ROLE_ARN = aws_iam_role.vercel.arn
  }
}

# Not secrets: the bucket is private and the role only trusts this project's deployments.
resource "vercel_project_environment_variable" "files" {
  for_each = local.vercel_env

  project_id = vercel_project.together.id
  team_id    = var.vercel_team_id
  key        = each.key
  value      = each.value
  target     = var.vercel_environments
  sensitive  = false
}
