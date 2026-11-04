import "server-only";
import { todayKey } from "@/lib/format";
import type { JobsBackendService } from "@/lib/backend/interfaces/jobs";
import type { ChoreReminder } from "@/lib/models";
import { seed, type StubState } from "@/lib/backend/services/stub/seed";

const g = globalThis as unknown as { __togetherStub?: StubState };
const state = (): StubState => (g.__togetherStub ??= seed());

export class StubJobsService implements JobsBackendService {
  choreReminders() {
    const s = state();
    const today = todayKey();
    const data: ChoreReminder[] = s.pushSubscriptions
      .map(({ memberId, ...subscription }) => ({
        subscription,
        titles: s.chores
          .filter((c) => !c.done && c.due !== null && c.due <= today && c.assignees.includes(memberId))
          .map((c) => c.title)
          .sort(),
      }))
      .filter((r) => r.titles.length > 0);
    console.log(`[stub] choreReminders: ${data.length} device(s)`);
    return Promise.resolve({ data });
  }

  forgetPushSubscription({ endpoint }: { endpoint: string }) {
    console.log("[stub] forgetPushSubscription");
    const s = state();
    s.pushSubscriptions = s.pushSubscriptions.filter((p) => p.endpoint !== endpoint);
    return Promise.resolve();
  }
}
