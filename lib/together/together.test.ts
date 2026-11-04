import { describe, expect, it } from "vitest";
import type { TogetherSummary } from "@/lib/models";
import { activityAgo, bubbleRadius, bubbleTone, layoutBubbles, MAX_RADIUS, MIN_RADIUS } from "./bubbles";
import { codeBoxes, expiryLabel, joinUrl, spacedCode } from "./invite";

const NOW = Date.parse("2026-11-04T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

const summary = (id: string, lastActivityAt: string, current = false): TogetherSummary => ({
  id,
  name: id,
  memberCount: 2,
  members: [],
  tone: "accent",
  role: "member",
  current,
  lastActivityAt,
  hasNews: false,
});

describe("bubbleRadius", () => {
  it("is biggest for activity right now and shrinks with age", () => {
    expect(bubbleRadius(hoursAgo(0), NOW)).toBeCloseTo(MAX_RADIUS);
    expect(bubbleRadius(hoursAgo(72), NOW)).toBeCloseTo((MIN_RADIUS + MAX_RADIUS) / 2);
    expect(bubbleRadius(hoursAgo(24 * 60), NOW)).toBeCloseTo(MIN_RADIUS, 2);
  });

  it("treats future or broken times sensibly", () => {
    expect(bubbleRadius(hoursAgo(-5), NOW)).toBeCloseTo(MAX_RADIUS);
    expect(bubbleRadius("not a date", NOW)).toBe(MIN_RADIUS);
  });
});

describe("bubbleTone", () => {
  it("gives a Together the same tone every time", () => {
    expect(bubbleTone("t-1")).toBe(bubbleTone("t-1"));
    expect(["accent", "partner", "success", "warning"]).toContain(bubbleTone("anything"));
  });
});

describe("layoutBubbles", () => {
  const togethers = [
    summary("old", hoursAgo(24 * 20)),
    summary("now", hoursAgo(1), true),
    ...Array.from({ length: 8 }, (_, i) => summary(`t${i}`, hoursAgo(i * 10))),
  ];
  const bubbles = layoutBubbles(togethers, NOW);

  it("puts the current Together in the middle", () => {
    expect(bubbles[0]?.id).toBe("now");
    expect(bubbles[0]?.position).toEqual([0, 0, 0]);
  });

  it("never overlaps two bubbles", () => {
    for (let i = 0; i < bubbles.length; i++) {
      for (let j = i + 1; j < bubbles.length; j++) {
        const a = bubbles[i]!;
        const b = bubbles[j]!;
        const dist = Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1], a.position[2] - b.position[2]);
        expect(dist).toBeGreaterThanOrEqual(a.radius + b.radius - 1e-6);
      }
    }
  });

  it("is the same every time", () => {
    expect(layoutBubbles(togethers, NOW)).toEqual(bubbles);
  });

  it("describes each bubble", () => {
    expect(bubbles[0]?.detail).toBe("2 people · active 1h ago");
  });
});

describe("activityAgo", () => {
  it("reads like a person would say it", () => {
    expect(activityAgo(hoursAgo(0), NOW)).toBe("just now");
    expect(activityAgo(hoursAgo(0.5), NOW)).toBe("30m ago");
    expect(activityAgo(hoursAgo(5), NOW)).toBe("5h ago");
    expect(activityAgo(hoursAgo(72), NOW)).toBe("3d ago");
    expect(activityAgo(hoursAgo(24 * 30), NOW)).toBe("4w ago");
  });
});

describe("invite codes", () => {
  it("spaces and splits the code", () => {
    expect(spacedCode("K7Q29X")).toBe("K7Q · 29X");
    expect(codeBoxes("K7Q29X")).toEqual(["K", "7", "Q", "2", "9", "X"]);
  });

  it("builds the join link", () => {
    expect(joinUrl("https://together.app/", "K7Q29X")).toBe("https://together.app/join/K7Q29X");
  });

  it("says when the code runs out", () => {
    expect(expiryLabel(new Date(NOW + 41.5 * 3_600_000).toISOString(), NOW)).toBe("Expires in 41 hours");
    expect(expiryLabel(new Date(NOW + 61 * 60_000).toISOString(), NOW)).toBe("Expires in 1 hour");
    expect(expiryLabel(new Date(NOW + 20 * 60_000).toISOString(), NOW)).toBe("Expires in 20 minutes");
    expect(expiryLabel(new Date(NOW - 1).toISOString(), NOW)).toBe("Expired");
  });
});
