import type { Metadata } from "next";
import { connection } from "next/server";
import { getDocuments } from "@/lib/actions/files";
import { must, requireTogether } from "../_lib/load";
import { FilesView } from "./view";

export const metadata: Metadata = { title: "Files" };

export default async function FilesPage() {
  await connection();
  const together = await requireTogether();
  const documents = must(await getDocuments(), "your files");
  return <FilesView together={together} documents={documents} />;
}
