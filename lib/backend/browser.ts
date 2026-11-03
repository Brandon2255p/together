import type { BrowserBackendService } from "@/lib/backend/interfaces/browser";
import { RealBrowserService } from "@/lib/backend/services/real/browser";
import { StubBrowserService } from "@/lib/backend/services/stub/browser";

export type { BrowserBackendService } from "@/lib/backend/interfaces/browser";

const useBrowserStub = process.env.NEXT_PUBLIC_USE_STUB_DATABASE === "true";

export const browserBackend: BrowserBackendService = useBrowserStub ? new StubBrowserService() : new RealBrowserService();
