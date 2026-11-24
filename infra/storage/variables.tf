variable "region" {
  description = "Where the photos, videos and documents are kept. af-south-1 (Cape Town) is an opt-in region."
  type        = string
  default     = "af-south-1"
}

variable "vercel_team" {
  description = "The Vercel team slug: Vercel's OIDC issuer is https://oidc.vercel.com/<team>."
  type        = string
  default     = "brandons-projects-6992d786"
}

variable "vercel_team_id" {
  description = "The Vercel team's ID."
  type        = string
  default     = "team_f4WYf4JgLWndHgonQXXxA7SS"
}

variable "vercel_project_id" {
  description = "The Vercel project's ID (imported into vercel_project.together)."
  type        = string
  default     = "prj_z4qZNk7HctyR2E8cqfdnTfXHsNCd"
}

variable "vercel_project" {
  description = "The Vercel project name, as it appears in the OIDC token's subject."
  type        = string
  default     = "together"
}

variable "vercel_environments" {
  description = "Vercel environments whose functions may use the bucket."
  type        = list(string)
  default     = ["production", "preview"]
}

variable "app_origins" {
  description = "Browser origins that upload and download objects directly (CORS). One * is allowed per origin."
  type        = list(string)
  default     = ["https://together.openprocess.me", "https://*.vercel.app", "http://localhost:3000"]
}

variable "permissions_boundary" {
  description = "The boundary every IAM role this stack makes must carry (GitHub's apply role refuses roles without it)."
  type        = string
  default     = "github-together-boundary"
}
