import "server-only";
import { todayKey } from "@/lib/format";
import type { JobsBackendService } from "@/lib/backend/interfaces/jobs";
import type { ChoreReminder } from "@/lib/models";
import { world } from "@/lib/backend/services/stub/state";

export class StubJobsService implements JobsBackendService {
  choreReminders() {
    const w = world();
    const today = todayKey();
    // chores in every Together the person is still in
    const data: ChoreReminder[] = w.pushSubscriptions
      .map(({ memberId, ...subscription }) => ({
        subscription,
        titles: Object.values(w.togethers)
          .filter((t) => t.together?.members.some((m) => m.id === memberId))
          .flatMap((t) => t.chores)
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
    const w = world();
    w.pushSubscriptions = w.pushSubscriptions.filter((p) => p.endpoint !== endpoint);
    return Promise.resolve();
  }
}
