/**
 * Downscale an image File (longest edge ≤ 1280px) and return it as base64 JPEG,
 * ready for the AI vision endpoints (label scan, meal scan).
 */
export async function imageToBase64(
  file: File,
): Promise<{ data: string; mimeType: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { data: dataUrl.slice(dataUrl.indexOf(",") + 1), mimeType: "image/jpeg" };
}
