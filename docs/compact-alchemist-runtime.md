# Compact Alchemist — raster asset integration

The compact theme is based on the source pack uploaded to
`feat/mad-alchemist-vial-preview` under `assets/compact_potion_assets/`.
The original file hierarchy, asset manifest, atlases, source images and slicing
scripts remain untouched in that directory.

## What the game loads

The runtime copies of the 38 RGBA sprites live at `public/potions/compact/`:

| Asset family | Count | PNG dimensions | Current usage |
| --- | ---: | --- | --- |
| Glass background, front, glossy option | 3 | 400×1088 | Back/front layers rendered in PixiJS; glossy available for future variant |
| Compact stopper ornaments | 5 | 400×72 | Rendered in front of the glass at (0,0), 100×18 logical units |
| Liquid texture tiles | 12 | 256×256 | Available for future textured shader or UI; existing GLSL motifs remain active |
| Liquid band textures | 12 | 284×237 | Available for examples and previews; dynamic liquid shader stays active |
| Magic effect sprites | 6 | 128×128 | Available for effects; existing procedural bubbles/sparkles remain active |

The source `assets/compact_potion_assets/assets/examples/` consists of static
reference compositions only; they are intentionally not published in `public`.

### Geometry and render order

The game's canonical viewport remains **100×272 logical units**, and the
liquid volume polygon, free-surface projection, pour anchors and GSAP timings
are unchanged. The 4× PNG resolution is used only for high-density rendering.

1. Transparent glass-back PNG, inside the liquid container.
2. Existing animated PixiJS liquid mesh and polygon mask.
3. Transparent glass-front PNG.
4. Optional stopper PNG at **x=0, y=0, width=100, height=18**.
5. Existing PixiJS glints and debug geometry.

When the vial tips, the stopper fades to expose the mouth. The topper cannot
overlap the HUD or the vial row above because it stays in the vial's original
bounding box: **no negative Y offset**.

## Skin selection

The HUD flask action cycles through:

1. Compact Alchemist (new default for users without a stored preference)
2. Mad Alchemist (previous SVG theme)
3. Classic (original glass)

The preference key is unchanged (`water-sort-vial-skin`) so existing saved
preferences continue working. Both SVG skins use the same compact stopper
bounds if their ornaments are shown; no out-of-bounds art is introduced.

## Limitations and review

- Transparent PNGs are preprocessed Create Image assets, not mathematically
  perfect vectors. Look for fringing at very small device widths.
- The 12 image-sourced tiles may have edge seams when repeated; using the
  existing shader motifs avoids these seams during animated pours.
- Bright backgrounds/palettes and older saved preferences should be tested.
- Mobile Safari/Chrome layout, active pours, two-row separation, and the ad/video
  position still require device visual review.

The automated unit suite checks each of the 38 published images for its
declared dimensions and RGBA color type, checks vial polygon equivalence,
and asserts the compact topper cannot extend past y=18.
