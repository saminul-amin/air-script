/**
 * Export utilities for downloading drawings and text.
 */

/** Download a text string as a .txt file */
export function downloadTextFile(text: string, filename: string = "air-writing.txt"): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
