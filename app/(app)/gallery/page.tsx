import type { Metadata } from "next";
import { connection } from "next/server";
import { galleryMonths, getGallery } from "@/lib/actions/files";
import { must, requireTogether } from "../_lib/load";
import { GalleryView } from "./view";

export const metadata: Metadata = { title: "Gallery" };

export default async function GalleryPage() {
  await connection();
  const [together, page, months] = await Promise.all([requireTogether(), getGallery(null, 60), galleryMonths()]);
  const gallery = { ...must(page, "your photos"), months: must(months, "your photos") };
  return <GalleryView together={together} gallery={gallery} />;
}
