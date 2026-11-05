import { describe, expect, it } from "vitest";
import { addressFrom, isShortMapsLink, NO_ADDRESS, placeFromMapsUrl, readPlaceInput, regionQueries } from "./maps-link";

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
  it("reads the name and full address from what a maps.app.goo.gl share link redirects to", () => {
    // where https://maps.app.goo.gl/C9RXiPnrGQ8Vt7tw5 goes: the address has no pin and no country
    const place = details(
      "https://maps.app.goo.gl/C9RXiPnrGQ8Vt7tw5?g_st=ac",
      "https://www.google.com/maps/place/Wiesenhof+Adventure+Park,+R44+Adam+Tas+St,+Klapmuts,+7600/data=!4m2!3m1!1s0x1dcdac6ce16ee807:0xdc41f780c36e435f!18m1!1e1?utm_source=mstt_1&entry=gps&g_st=ac",
    );
    expect(place.name).toBe("Wiesenhof Adventure Park");
    expect(place.area).toBe("R44 Adam Tas St, Klapmuts");
    expect(place.address).toEqual({ street: "R44 Adam Tas St", area: "", city: "Klapmuts", province: "", country: "" });
    expect(place.mapsUrl).toBe("https://maps.app.goo.gl/C9RXiPnrGQ8Vt7tw5?g_st=ac");
    expect(place.postalCode).toBe("7600");
    // the link leaves out the province and country, so they're looked up, most specific first
    expect(regionQueries(place.address, place.postalCode)).toEqual(["R44 Adam Tas St, Klapmuts, 7600", "Klapmuts, 7600", "Klapmuts"]);
  });


  it("takes the name from a /maps/place/ link", () => {
    expect(details("https://www.google.com/maps/place/Nobu+Cape+Town/@-33.9,18.4,17z")).toEqual({
      name: "Nobu Cape Town",
      area: null,
      address: NO_ADDRESS,
      postalCode: null,
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
      address: { street: "De Villebois Mareuil Dr", area: "", city: "Pretoria", province: "", country: "South Africa" },
      postalCode: "0081",
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

describe("addressFrom", () => {
  it("splits street, suburb, city and country, dropping the postal code", () => {
    expect(addressFrom(["36 Buitenkant St", "Cape Town City Centre", "Cape Town", "8000", "South Africa"])).toEqual({
      street: "36 Buitenkant St",
      area: "Cape Town City Centre",
      city: "Cape Town",
      province: "",
      country: "South Africa",
    });
  });

  it("keeps a long street together", () => {
    expect(addressFrom(["Unit 5", "12 Main Rd", "Sea Point", "Cape Town", "8005"])).toMatchObject({
      street: "Unit 5, 12 Main Rd",
      area: "Sea Point",
      city: "Cape Town",
    });
  });

  it("reads a US state from its ZIP code", () => {
    expect(addressFrom(["123 Main St", "Springfield", "IL 62701", "USA"])).toEqual({
      street: "123 Main St",
      area: "",
      city: "Springfield",
      province: "IL",
      country: "USA",
    });
  });

  it("takes a single part as the city, and nothing as nothing", () => {
    expect(addressFrom(["Klapmuts"])).toMatchObject({ street: "", city: "Klapmuts" });
    expect(addressFrom([])).toEqual(NO_ADDRESS);
    expect(addressFrom(["CQ7X+2F"])).toEqual(NO_ADDRESS);
  });
});

describe("regionQueries", () => {
  it("has nothing to look up without a city", () => {
    expect(regionQueries(NO_ADDRESS, "7600")).toEqual([]);
  });
});
