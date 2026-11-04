import "server-only";
import type { JobsBackendService } from "@/lib/backend/interfaces/jobs";
import { RealJobsService } from "@/lib/backend/services/real/jobs";
import { StubJobsService } from "@/lib/backend/services/stub/jobs";
import { stubEnabled } from "@/lib/backend/server";

export type { JobsBackendService } from "@/lib/backend/interfaces/jobs";

export const jobsBackend: JobsBackendService = stubEnabled ? new StubJobsService() : new RealJobsService();
