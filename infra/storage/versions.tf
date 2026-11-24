terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.72.0"
    }
    vercel = {
      source  = "vercel/vercel"
      version = "5.26.1"
    }
  }

  # The shared OpenTofu state bucket (made by hand, outside this repo). Together's state lives under together/, which
  # is all GitHub's roles may touch.
  backend "s3" {
    bucket       = "tofu-state-768321396008-af-south-1-an"
    key          = "together/storage.tfstate"
    region       = "af-south-1"
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

# Reads VERCEL_API_TOKEN (a team-scoped token, the GitHub secret of the same name).
provider "vercel" {
  team = var.vercel_team_id
}
