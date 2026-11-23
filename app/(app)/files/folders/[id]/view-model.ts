"use client";

import type { Documents, Together } from "@/lib/models";
import type { DocumentsScreenProps } from "@/components/files/documents-screen";
import { useDocumentsViewModel } from "../../view-model";

/** a folder (screen 40) is the drive narrowed to one folder: uploads go into it, and its ••• renames or deletes it */
export function useFolderViewModel(documents: Documents, together: Together, folderId: string): DocumentsScreenProps {
  return useDocumentsViewModel(documents, together, folderId);
}
