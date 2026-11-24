output "plan_role_arn" {
  description = "Set as the AWS_INFRA_PLAN_ROLE_ARN repository variable."
  value       = aws_iam_role.plan.arn
}

output "apply_role_arn" {
  description = "Set as the AWS_INFRA_APPLY_ROLE_ARN repository variable."
  value       = aws_iam_role.apply.arn
}
