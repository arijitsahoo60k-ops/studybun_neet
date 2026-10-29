/**
 * Downscales + re-encodes an image file in the browser before it's
 * uploaded to Supabase Storage. There's no server-side image pipeline in
 * this app, so this is the only thing standing between a 12MP phone photo
 * and the bucket — keeps uploads fast and storage cheap without adding a
 * new dependency.
 */
export async function compressImage(file, { maxDimension = 1600, quality = 0.82 } = {}) {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  if (width > maxDimension || height > maxDimension) {
    const scale = maxDimension / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const outputType = file.type === "image/png" && !fileLooksPhotographic(file) ? "image/png" : "image/jpeg";

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, outputType, quality));
  return blob || file;
}

// Cheap heuristic: keep PNGs as PNG (likely a screenshot/graphic with
// transparency) only when small; otherwise re-encode as JPEG for size.
function fileLooksPhotographic(file) {
  return file.size > 900_000;
}
