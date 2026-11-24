import "server-only";
import type { ServerBackendService } from "@/lib/backend/interfaces/server";
import { RealServerService } from "@/lib/backend/services/real/server";
import { StubServerService } from "@/lib/backend/services/stub/server";
import { stubStorage as stubObjects } from "@/lib/backend/services/stub/files";

export type { ServerBackendService } from "@/lib/backend/interfaces/server";

/** the stub backend is in use */
export const stubEnabled = process.env.USE_STUB_DATABASE === "true";

export const serverBackend: ServerBackendService = stubEnabled ? new StubServerService() : new RealServerService();

/** the stub's in-memory Storage bucket (/api/stub/storage), or null on Supabase */
export const stubStorage = stubEnabled ? stubObjects : null;
