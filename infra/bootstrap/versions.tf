terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.72.0"
    }
  }

  # The state bucket is made once by hand (see infra/README.md), then this stack adopts it. Bucket and region come
  # from -backend-config.
  backend "s3" {
    key          = "bootstrap.tfstate"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      project = "together"
      stack   = "bootstrap"
    }
  }
}
