// Handing a decrypted file to the person: save it, or open it in a tab. Browser only.

/** saves a Blob under its real name */
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * A tab opened now, while the tap still counts as a user gesture, to show a file once it's decrypted. Returns null
 * when the browser blocks it (the file is then saved instead).
 */
export function openPendingTab(): Window | null {
  const tab = window.open("", "_blank");
  if (tab) tab.document.title = "Opening…";
  return tab;
}

export function showInTab(tab: Window | null, blob: Blob, name: string) {
  if (!tab || tab.closed) return saveBlob(blob, name);
  const url = URL.createObjectURL(blob);
  tab.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
}
