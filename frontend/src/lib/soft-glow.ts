/** A soft disc profile, including the glow outside the original circle's bounds.
 * Radial stops avoid a per-frame blur pass on Android, including Android < 12.
 */
export function createSoftGlow(diameter: number, blurRadius: number) {
  const blur = Math.max(1, blurRadius);
  const radius = Math.max(1, diameter) / 2;
  const padding = blur * 3;
  const extent = radius + padding;

  // Smooth approximation of the Gaussian edge of a CSS-blurred solid circle.
  const stops = Array.from({ length: 25 }, (_, index) => {
    const offset = index / 24;
    const distance = offset * extent;
    const opacity = index === 24 ? 0 : 1 / (1 + Math.exp((distance - radius) / (blur * 0.6)));
    return { offset, opacity };
  });

  return { padding, size: extent * 2, stops };
}
