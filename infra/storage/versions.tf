terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.72.0"
    }
  }

  # bucket and region come from -backend-config (the AWS_STATE_BUCKET and AWS_REGION repository variables)
  backend "s3" {
    key          = "storage.tfstate"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      project = "together"
      stack   = "storage"
    }
  }
}
