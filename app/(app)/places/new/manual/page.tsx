import type { Metadata } from "next";
import { connection } from "next/server";
import { requireTogether } from "../../../_lib/load";
import { ManualPlaceView } from "./view";

export const metadata: Metadata = { title: "Add a place by hand" };

type Params = Partial<Record<"name" | "tab" | "street" | "area" | "city" | "province" | "country" | "maps", string>>;

/** ?name=…&street=…&city=…&maps=…: what a Google Maps link said, when Google Places didn't know the place */
export default async function ManualPlacePage({ searchParams }: { searchParams: Promise<Params> }) {
  await connection();
  const [params] = await Promise.all([searchParams, requireTogether()]);
  const text = (value: string | undefined, max: number) => (value ?? "").slice(0, max);
  return (
    <ManualPlaceView
      data={{
        name: text(params.name, 120),
        status: params.tab === "been" ? "been" : "want",
        address: {
          street: text(params.street, 80),
          area: text(params.area, 60),
          city: text(params.city, 80),
          province: text(params.province, 80),
          country: text(params.country, 80),
        },
        mapsUrl: params.maps?.slice(0, 500) || null,
      }}
    />
  );
}
