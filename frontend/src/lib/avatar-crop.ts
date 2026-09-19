export type PercentRegion = { x: number; y: number; width: number; height: number };

export function initialAvatarCrop(width: number, height: number): PercentRegion {
  const side = Math.min(width, height) * 0.8;
  return { x: (width - side) / width * 50, y: (height - side) / height * 50, width: side / width * 100, height: side / height * 100 };
}

// Export percentages against the decoded image, never against a centered viewport.
export function avatarCropPixels(crop: PercentRegion, width: number, height: number) {
  if (![width, height, crop.x, crop.y, crop.width, crop.height].every(Number.isFinite) || width <= 0 || height <= 0 || crop.width <= 0 || crop.height <= 0) throw new Error("Invalid crop dimensions");
  const x = Math.max(0, Math.min(width - 1, Math.round(crop.x / 100 * width)));
  const y = Math.max(0, Math.min(height - 1, Math.round(crop.y / 100 * height)));
  const side = Math.max(1, Math.min(width - x, height - y, Math.round(Math.min(crop.width / 100 * width, crop.height / 100 * height))));
  return { x, y, width: side, height: side };
}
