# Where a Together's photos, videos and documents are kept: one private bucket of objects that are already encrypted
# in the browser (lib/files/crypto.ts), at <together_id>/<file_id>/{original,thumb,preview}.bin. The browser uploads
# and downloads them directly with short-lived signed requests made by the app's server; the server reaches AWS as
# the together-files-vercel role through Vercel's OIDC tokens, so no AWS keys are stored anywhere. The Vercel project
# itself is managed here too (vercel.tf), so its OIDC setting and env vars follow the bucket and role.

data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}

locals {
  account   = data.aws_caller_identity.current.account_id
  partition = data.aws_partition.current.partition
  issuer    = "oidc.vercel.com/${var.vercel_team}"
}

# ---- The bucket -----------------------------------------------------------------------------------------------------

resource "aws_s3_bucket" "files" {
  bucket = "together-files-${local.account}"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_public_access_block" "files" {
  bucket                  = aws_s3_bucket.files.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "files" {
  bucket = aws_s3_bucket.files.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

# Encrypted at rest by S3 too, on top of the app's own encryption.
resource "aws_s3_bucket_server_side_encryption_configuration" "files" {
  bucket = aws_s3_bucket.files.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# Objects never change once written (the app's bin keeps deleted files for 30 days itself), so no versioning.
resource "aws_s3_bucket_lifecycle_configuration" "files" {
  bucket = aws_s3_bucket.files.id
  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"
    filter {}
    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

# The browser POSTs uploads and GETs downloads straight to S3.
resource "aws_s3_bucket_cors_configuration" "files" {
  bucket = aws_s3_bucket.files.id
  cors_rule {
    allowed_methods = ["GET", "HEAD", "POST"]
    allowed_origins = var.app_origins
    allowed_headers = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

data "aws_iam_policy_document" "files_bucket" {
  statement {
    sid     = "TlsOnly"
    effect  = "Deny"
    actions = ["s3:*"]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    resources = [aws_s3_bucket.files.arn, "${aws_s3_bucket.files.arn}/*"]
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "files" {
  bucket     = aws_s3_bucket.files.id
  policy     = data.aws_iam_policy_document.files_bucket.json
  depends_on = [aws_s3_bucket_public_access_block.files]
}

# ---- Vercel's functions reach the bucket with OIDC ----------------------------------------------------------------

resource "aws_iam_openid_connect_provider" "vercel" {
  url            = "https://${local.issuer}"
  client_id_list = ["https://vercel.com/${var.vercel_team}"]
}

data "aws_iam_policy_document" "vercel_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.vercel.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.issuer}:aud"
      values   = ["https://vercel.com/${var.vercel_team}"]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.issuer}:sub"
      values   = [for env in var.vercel_environments : "owner:${var.vercel_team}:project:${var.vercel_project}:environment:${env}"]
    }
  }
}

resource "aws_iam_role" "vercel" {
  name                 = "together-files-vercel"
  description          = "The Together app on Vercel: signs uploads and downloads in the files bucket"
  assume_role_policy   = data.aws_iam_policy_document.vercel_trust.json
  max_session_duration = 3600
  permissions_boundary = "arn:${local.partition}:iam::${local.account}:policy/${var.permissions_boundary}"
}

# Signed requests act with the signer's rights: the app signs uploads (PutObject), downloads (GetObject), and checks
# an upload arrived (HeadObject, which needs GetObject; ListBucket makes a missing object a 404, not a 403).
data "aws_iam_policy_document" "vercel" {
  statement {
    actions   = ["s3:GetObject", "s3:PutObject"]
    resources = ["${aws_s3_bucket.files.arn}/*"]
  }
  statement {
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.files.arn]
  }
}

resource "aws_iam_role_policy" "vercel" {
  name   = "files"
  role   = aws_iam_role.vercel.id
  policy = data.aws_iam_policy_document.vercel.json
}
