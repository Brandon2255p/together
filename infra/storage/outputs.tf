output "files_bucket" {
  description = "The files bucket (FILES_BUCKET in Vercel, set by vercel.tf)."
  value       = aws_s3_bucket.files.bucket
}

output "files_region" {
  description = "Its region (FILES_REGION in Vercel)."
  value       = var.region
}

output "vercel_role_arn" {
  description = "The role Vercel's functions assume (AWS_ROLE_ARN in Vercel)."
  value       = aws_iam_role.vercel.arn
}
