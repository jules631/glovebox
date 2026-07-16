// Client-side image handling. Phone photos are 8-12MB; downscaling to ~2000px
// long edge cuts upload time and token cost without hurting extraction
// accuracy (Claude's useful vision ceiling is 2576px).

async function loadBitmap(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file);
}

function drawScaled(bitmap: ImageBitmap, maxEdge: number): HTMLCanvasElement {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function downscaleImage(file: File, maxEdge = 2000, quality = 0.8): Promise<File> {
  try {
    const bitmap = await loadBitmap(file);
    if (Math.max(bitmap.width, bitmap.height) <= maxEdge && file.size < 4 * 1024 * 1024) {
      return file;
    }
    const canvas = drawScaled(bitmap, maxEdge);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/** Small dataURL preview stored with the visit. Originals are never persisted. */
export async function makeThumbnail(file: File, maxEdge = 400): Promise<string | null> {
  if (!file.type.startsWith("image/")) return null;
  try {
    const bitmap = await loadBitmap(file);
    const canvas = drawScaled(bitmap, maxEdge);
    return canvas.toDataURL("image/jpeg", 0.7);
  } catch {
    return null;
  }
}
