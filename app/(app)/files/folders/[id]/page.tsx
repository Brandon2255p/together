import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getDocuments } from "@/lib/actions/files";
import { must, requireTogether } from "../../../_lib/load";
import { FolderView } from "./view";

export const metadata: Metadata = { title: "Folder" };

export default async function FolderPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const [{ id }, together] = await Promise.all([params, requireTogether()]);
  const documents = must(await getDocuments(), "your files");
  if (!documents.folders.some((f) => f.id === id)) notFound();
  return <FolderView together={together} documents={documents} folderId={id} />;
}
