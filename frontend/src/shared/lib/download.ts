/** Offer ``blob`` to the user as a download named ``filename``. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/** Download a file served by the backend (an absolute URL, see mediaUrl). */
export async function downloadFromUrl(url: string, filename: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`File not found: ${response.status}`);
  }
  saveBlob(await response.blob(), filename);
}
