import { describe, expect, it } from "vitest";
import { placeFromInput } from "./maps-link";

describe("placeFromInput", () => {
  it("takes the name from a /maps/place/ link", () => {
    expect(placeFromInput("https://www.google.com/maps/place/Nobu+Cape+Town/@-33.9,18.4,17z")).toEqual({
      name: "Nobu Cape Town",
      mapsUrl: "https://www.google.com/maps/place/Nobu+Cape+Town/@-33.9,18.4,17z",
    });
  });

  it("decodes encoded names", () => {
    expect(placeFromInput("https://www.google.co.za/maps/place/Caf%C3%A9+Paradiso")?.name).toBe("Café Paradiso");
  });

  it("falls back to ?q= and then a generic name for short links", () => {
    expect(placeFromInput("https://maps.google.com/?q=Truth+Coffee")?.name).toBe("Truth Coffee");
    expect(placeFromInput("https://maps.app.goo.gl/abc123")?.name).toBe("Pinned place");
  });

  it("treats plain text as a name", () => {
    expect(placeFromInput("  Kloof Street House ")).toEqual({ name: "Kloof Street House", mapsUrl: null });
  });

  it("rejects empty input and links that aren't Google Maps", () => {
    expect(placeFromInput("   ")).toBeNull();
    expect(placeFromInput("https://example.com/place")).toBeNull();
  });
});
