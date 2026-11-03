import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("keeps a colour next to a custom type style", () => {
    expect(cn("text-on-accent", "text-body-strong")).toBe("text-on-accent text-body-strong");
  });
  it("still dedupes type styles and colours", () => {
    expect(cn("text-caption", "text-body")).toBe("text-body");
    expect(cn("text-ink", "text-accent")).toBe("text-accent");
  });
});
