// The SVG canvas includes transparent side padding, so its visible artwork can
// grow beyond the layout column while remaining comfortably inside that column.
export function getSavingsSceneLayout(
  containerWidth: number,
  windowHeight: number,
  isDesktop: boolean,
) {
  const targetWidth = Math.min(
    572, // Original 372px stage + 200px on roomy screens.
    Math.max(1, containerWidth) * 1.5,
    isDesktop ? 572 : Math.max(430, windowHeight * 0.6),
    // Keep the actions above the fixed navigation on shorter phones.
    isDesktop ? 572 : Math.max(240, (windowHeight - 210) * 372 / 402),
  );
  const scale = targetWidth / 372;
  // Raster jar: top -20 plus 150/1024 of its 340px canvas.
  // Together with the header's 4px margin this leaves 30px of visible space.
  const artworkOffset = isDesktop ? 0 : 26 - (340 * 150 / 1024 - 20) * scale;
  // Let the next card overlap the island tip, but never the action buttons.
  const panelOverlap = isDesktop ? 0 : Math.min(48 * scale, Math.max(0, 92 * scale - 60));
  return {
    scale,
    artworkHeight: 402 * scale,
    height: isDesktop ? 402 * scale - panelOverlap : 310 * scale + 32 + artworkOffset,
    // The visible island runs from about y=235 to y=401 in the source canvas.
    // Keep the 64px controls centred slightly above its visual midpoint.
    actionsTop: 310 * scale - 32 + artworkOffset,
    panelOverlap,
    stageTop: (370 * scale - 370) / 2 + artworkOffset,
  };
}
