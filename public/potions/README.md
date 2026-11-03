# Mad Alchemist motifs

The twelve 64×64 SVG tiles are independent, reusable color/pattern assets, adapted from the Create Image potion texture-sheet direction.

Each SVG corresponds to a color ID in `src/lib/water-sort/domain/colors.ts` and the pattern of the same ID in `src/lib/water-sort/rendering/liquid-shader.ts`. During gameplay, the liquid shader renders equivalent motifs directly to preserve volume, rotation, and performance without uploading a separate texture per vial. The SVG tiles are available for UI, previews, and design references.

These are clean vector recreations rather than exact pixel exports of the originally generated raster images; the raster sheets include fringing and baked-in lighting that would interfere with the real-time renderer.

A plain purple background and transparent vial body are deliberate. Keep color/pattern pairs fixed across moves.
