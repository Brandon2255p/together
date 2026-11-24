variable "region" {
  description = "AWS region for the state bucket and, by default, the files bucket. af-south-1 (Cape Town) is an opt-in region: enable it in the account first."
  type        = string
  default     = "af-south-1"
}

variable "state_bucket" {
  description = "The bucket made by hand for OpenTofu state, e.g. together-tofu-state-<account id>."
  type        = string
}

variable "github_repository" {
  description = "owner/name of the repository whose workflows may plan and apply infra/storage."
  type        = string
  default     = "Brandon2255p/together"
}
