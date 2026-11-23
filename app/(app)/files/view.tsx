"use client";

import { DocumentsScreen } from "@/components/files/documents-screen";
import type { Documents, Together } from "@/lib/models";
import { useDocumentsViewModel } from "./view-model";

export function FilesView({ together, documents }: { together: Together; documents: Documents }) {
  const vm = useDocumentsViewModel(documents, together, null);
  return <DocumentsScreen {...vm} />;
}
