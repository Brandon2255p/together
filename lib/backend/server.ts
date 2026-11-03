import "server-only";
import type { ServerBackendService } from "@/lib/backend/interfaces/server";
import { RealServerService } from "@/lib/backend/services/real/server";
import { StubServerService } from "@/lib/backend/services/stub/server";

export type { ServerBackendService } from "@/lib/backend/interfaces/server";

/** the stub backend is in use */
export const stubEnabled = process.env.USE_STUB_DATABASE === "true";

export const serverBackend: ServerBackendService = stubEnabled ? new StubServerService() : new RealServerService();
