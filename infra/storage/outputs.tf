output "files_bucket" {
  description = "Set as FILES_BUCKET in the Vercel project."
  value       = aws_s3_bucket.files.bucket
}

output "files_region" {
  description = "Set as FILES_REGION in the Vercel project."
  value       = var.region
}

output "vercel_role_arn" {
  description = "Set as AWS_ROLE_ARN in the Vercel project."
  value       = aws_iam_role.vercel.arn
}
