"use client";

import { DocumentsScreen } from "@/components/files/documents-screen";
import type { Documents, Together } from "@/lib/models";
import { useFolderViewModel } from "./view-model";

export function FolderView({ together, documents, folderId }: { together: Together; documents: Documents; folderId: string }) {
  const vm = useFolderViewModel(documents, together, folderId);
  return <DocumentsScreen {...vm} />;
}
