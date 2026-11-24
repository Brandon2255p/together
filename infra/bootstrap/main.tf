# Run once by hand, with an administrator's credentials (infra/README.md). It sets up what the GitHub workflow needs
# to manage infra/storage on its own: the state bucket's settings, GitHub's OIDC provider, and two roles the
# workflow assumes without any stored AWS keys.
#   together-infra-plan   pull requests: read AWS, read state, write only the state lock file
#   together-infra-apply  pushes to main: create and change the storage stack

data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}

locals {
  account   = data.aws_caller_identity.current.account_id
  partition = data.aws_partition.current.partition
  state_arn = "arn:${local.partition}:s3:::${var.state_bucket}"
}

# ---- The state bucket (made by hand, adopted here) --------------------------------------------------------------

import {
  to = aws_s3_bucket.state
  id = var.state_bucket
}

resource "aws_s3_bucket" "state" {
  bucket = var.state_bucket

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

# ---- GitHub Actions signs in with OIDC ---------------------------------------------------------------------------

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

data "aws_iam_policy_document" "github_trust" {
  for_each = {
    # any pull request from a branch of this repository (forks get no token)
    plan = ["repo:${var.github_repository}:pull_request"]
    # only main, through the "infra" environment
    apply = ["repo:${var.github_repository}:environment:infra"]
  }

  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = each.value
    }
  }
}

resource "aws_iam_role" "plan" {
  name                 = "together-infra-plan"
  description          = "GitHub Actions: tofu plan for infra/storage on pull requests"
  assume_role_policy   = data.aws_iam_policy_document.github_trust["plan"].json
  max_session_duration = 3600
}

resource "aws_iam_role" "apply" {
  name                 = "together-infra-apply"
  description          = "GitHub Actions: tofu apply for infra/storage on main"
  assume_role_policy   = data.aws_iam_policy_document.github_trust["apply"].json
  max_session_duration = 3600
}

# Plan reads everything it manages, and may only write the lock file next to the state.
data "aws_iam_policy_document" "plan" {
  statement {
    sid       = "ReadState"
    actions   = ["s3:GetObject", "s3:ListBucket"]
    resources = [local.state_arn, "${local.state_arn}/*"]
  }
  statement {
    sid       = "Lock"
    actions   = ["s3:PutObject", "s3:DeleteObject"]
    resources = ["${local.state_arn}/*.tflock"]
  }
  statement {
    sid = "ReadStorageStack"
    actions = [
      "s3:GetBucket*",
      "s3:GetAccelerateConfiguration",
      "s3:GetEncryptionConfiguration",
      "s3:GetLifecycleConfiguration",
      "s3:GetReplicationConfiguration",
      "s3:ListBucket",
      "iam:GetRole",
      "iam:GetRolePolicy",
      "iam:ListRolePolicies",
      "iam:ListAttachedRolePolicies",
      "iam:GetOpenIDConnectProvider",
      "iam:ListOpenIDConnectProviders",
      "sts:GetCallerIdentity",
    ]
    resources = ["*"]
  }
}

# Apply manages only the files buckets, the together-* roles they use, and Vercel's OIDC provider.
data "aws_iam_policy_document" "apply" {
  source_policy_documents = [data.aws_iam_policy_document.plan.json]

  statement {
    sid       = "WriteState"
    actions   = ["s3:PutObject", "s3:DeleteObject"]
    resources = ["${local.state_arn}/storage.tfstate", "${local.state_arn}/storage.tfstate.tflock"]
  }
  statement {
    sid       = "FilesBuckets"
    actions   = ["s3:CreateBucket", "s3:DeleteBucket", "s3:PutBucket*", "s3:DeleteBucket*", "s3:PutEncryptionConfiguration", "s3:PutLifecycleConfiguration"]
    resources = ["arn:${local.partition}:s3:::together-files-*"]
  }
  statement {
    sid = "AppRoles"
    actions = [
      "iam:CreateRole",
      "iam:DeleteRole",
      "iam:UpdateRole",
      "iam:UpdateAssumeRolePolicy",
      "iam:TagRole",
      "iam:UntagRole",
      "iam:PutRolePolicy",
      "iam:DeleteRolePolicy",
    ]
    resources = ["arn:${local.partition}:iam::${local.account}:role/together-files-*"]
  }
  statement {
    sid = "VercelOidc"
    actions = [
      "iam:CreateOpenIDConnectProvider",
      "iam:DeleteOpenIDConnectProvider",
      "iam:UpdateOpenIDConnectProviderThumbprint",
      "iam:AddClientIDToOpenIDConnectProvider",
      "iam:RemoveClientIDFromOpenIDConnectProvider",
      "iam:TagOpenIDConnectProvider",
      "iam:UntagOpenIDConnectProvider",
    ]
    resources = ["arn:${local.partition}:iam::${local.account}:oidc-provider/oidc.vercel.com/*"]
  }
}

resource "aws_iam_role_policy" "plan" {
  name   = "plan-storage"
  role   = aws_iam_role.plan.id
  policy = data.aws_iam_policy_document.plan.json
}

resource "aws_iam_role_policy" "apply" {
  name   = "apply-storage"
  role   = aws_iam_role.apply.id
  policy = data.aws_iam_policy_document.apply.json
}
