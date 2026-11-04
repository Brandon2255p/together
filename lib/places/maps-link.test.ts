import { describe, expect, it } from "vitest";
import { isShortMapsLink, placeFromMapsUrl, readPlaceInput } from "./maps-link";

function details(link: string, resolved = link, label: string | null = null) {
  return placeFromMapsUrl(new URL(resolved), new URL(link), label);
}

describe("readPlaceInput", () => {
  it("treats plain text as a name", () => {
    expect(readPlaceInput("  Kloof Street House ")).toEqual({ kind: "name", name: "Kloof Street House" });
  });

  it("finds the link in the Maps app's share text and keeps the words around it as the name", () => {
    const input = readPlaceInput("Woodlands Boulevard\nhttps://maps.app.goo.gl/AbC123?g_st=ic");
    expect(input?.kind).toBe("link");
    if (input?.kind !== "link") return;
    expect(input.url.hostname).toBe("maps.app.goo.gl");
    expect(input.label).toBe("Woodlands Boulevard");
    expect(isShortMapsLink(input.url)).toBe(true);
  });

  it("has no label for a bare link", () => {
    const input = readPlaceInput("https://maps.app.goo.gl/AbC123");
    expect(input?.kind === "link" && input.label).toBeNull();
  });

  it("rejects empty input and links that aren't Google Maps", () => {
    expect(readPlaceInput("   ")).toBeNull();
    expect(readPlaceInput("https://example.com/place")).toBeNull();
  });
});

describe("placeFromMapsUrl", () => {
  it("takes the name from a /maps/place/ link", () => {
    expect(details("https://www.google.com/maps/place/Nobu+Cape+Town/@-33.9,18.4,17z")).toEqual({
      name: "Nobu Cape Town",
      area: null,
      mapsUrl: "https://www.google.com/maps/place/Nobu+Cape+Town/@-33.9,18.4,17z",
      coordinates: { lat: -33.9, lng: 18.4 },
    });
  });

  it("decodes encoded names", () => {
    expect(details("https://www.google.co.za/maps/place/Caf%C3%A9+Paradiso").name).toBe("Café Paradiso");
  });

  it("reads the name and area from a followed short link, and keeps the short link to open", () => {
    const place = details(
      "https://maps.app.goo.gl/AbC123",
      "https://maps.google.com/maps?q=Woodlands+Boulevard,+De+Villebois+Mareuil+Dr,+Pretoria,+0081,+South+Africa&ftid=0x1:0x2",
    );
    expect(place).toEqual({
      name: "Woodlands Boulevard",
      area: "De Villebois Mareuil Dr, Pretoria",
      mapsUrl: "https://maps.app.goo.gl/AbC123",
      coordinates: null,
    });
  });

  it("prefers the share text's name and doesn't repeat it as the area", () => {
    const place = details(
      "https://maps.app.goo.gl/AbC123",
      "https://www.google.com/maps/place/Truth+Coffee,+36+Buitenkant+St,+Cape+Town,+8000/@-33.9,18.4,17z",
      "Truth Coffee Roasting",
    );
    expect(place.name).toBe("Truth Coffee Roasting");
    expect(place.area).toBe("36 Buitenkant St, Cape Town");
  });

  it("ignores dropped-pin coordinates and falls back to a generic name", () => {
    expect(details("https://maps.google.com/?q=-25.79,28.27").name).toBe("Pinned place");
    expect(details("https://maps.app.goo.gl/abc123").name).toBe("Pinned place");
  });

  it("prefers the pin in /data= over the map's centre", () => {
    const url =
      "https://www.google.com/maps/place/Zeitz+MOCAA/@-33.9,18.4,17z/data=!3m1!4b1!4m6!3m5!1s0x1dcc:0x2!8m2!3d-33.9083!4d18.4225";
    expect(details(url).coordinates).toEqual({ lat: -33.9083, lng: 18.4225 });
  });

  it("reads a dropped pin's coordinates from ?q=", () => {
    expect(details("https://maps.google.com/?q=-25.79,28.27").coordinates).toEqual({ lat: -25.79, lng: 28.27 });
  });

  it("falls back to ?q=", () => {
    expect(details("https://maps.google.com/?q=Truth+Coffee").name).toBe("Truth Coffee");
  });
});
