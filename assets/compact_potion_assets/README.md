# Compact Alchemist — layered transparent art pack

An implementation-sized PNG sprite pack for `paleite/water-sort-puzzle`, adapted from the **Create Image** fantasy neon/potion artwork. Art sources are included in `sources/`. The normalized files are under `assets/`, and exact, ready-to-slice grids are in `atlases/`.

**Important:** the Create Image render is illustrative, not a dimensionally precise export tool. Python standardized all exported sizes and transparent backgrounds. This pack is a visual asset starting point, not an automatic replacement for the working PixiJS renderer.

## Measured from `main`, November 4, 2026

The repository's `DEFAULT_VIAL_SKIN` and `vial-geometry.ts` establish the canonical dimensions:

| Component                     | Logical size (game units) | PNG pixels (4×) | Count                       | Alpha                            |
| ----------------------------- | ------------------------- | --------------- | --------------------------- | -------------------------------- |
| Glass background / foreground | **100 × 272**             | **400 × 1088**  | 2 + glossy variant          | RGBA, transparent glass interior |
| Compact stopper / ornament    | **100 × 18**              | **400 × 72**    | 5                           | RGBA, transparent margin         |
| Liquid interior               | x=14.5…85.5, y=22…259     | 284 × 948 at 4× | clipping polygon, not image | computed mask                    |
| One liquid band, capacity=4   | **71 × 59.25**            | **284 × 237**   | 12 pattern examples         | RGBA, opaque inside band         |
| Repeating pattern tile        | 64 × 64 reference         | **256 × 256**   | 12                          | RGBA, opaque texture             |
| Particle / splash icon        | up to 32 × 32 reference   | **128 × 128**   | 6                           | RGBA, clear edges                |

The liquid boundary is a rounded polygon. Use the **existing polygon** from `src/lib/water-sort/presentation/vial-skins.ts` to clip fills; a rectangular band alone will extend outside the curved bottom. The stream anchors are at `(12, 18)` and `(88, 18)` within the 100 × 272 logical box.

## Why the stoppers are deliberately short

The existing source renderer uses an oversized stopper outside the vial's art bounds:

```ts
stopper.position.set(0, -44);
stopper.width = 100;
stopper.height = 60;
```

For this pack, replace that positioning with:

```ts
stopper.position.set(0, 0);
stopper.width = 100;
stopper.height = 18;
```

**Do not add 18 units to the vial height.** The cap is constrained to `0 ≤ y ≤ 18`, and the mouth is already at `y=18`. No objects extend to a negative y coordinate. This directly addresses the top-row-overlap issue without shrinking the video or HUD.

`glass_front.png` already contains an illustrated rim, amethyst jewel, and base. Render the optional stopper over it. Fade or hide the stopper during pouring as the current code does. Keep the generated liquid tile assets behind `glass_front.png` and in front of `glass_back.png`.

## Asset contents

- `assets/vial/glass_back.png`, `glass_front.png`, `glass_front_glossy_variant.png` — exact 400 × 1088 RGBA full-vial layers
- `assets/toppers/{cork,wax,crystal,orb,moon}.png` — five small 400 × 72 RGBA components
- `assets/liquid/tiles/{color}.png` — twelve 256 × 256 pattern crops
- `assets/liquid/bands/{color}.png` — twelve 284 × 237 band-sized exports
- `assets/effects/{...}.png` — six 128 × 128 transparent sparkle/bubble/foam/splash components
- `assets/examples/` — fourteen precomposed 400 × 1088 sample vials for visual testing (not gameplay assets)
- `atlases/` — four RGBA sprite sheets with fixed grid cells
- `manifest.json` — geometry, palette mapping, dimensions, atlas grids and source cells
- `preview.jpg` — sprite review sheet; intentionally has a purple background
- `build_assets.py` — source cropping, masks, resizing and normalization
- `slice_atlases.py` — deterministic cutting of the normalized RGBA sheets

## Slicing after generation

```bash
python -m pip install --upgrade Pillow numpy
python build_assets.py
python slice_atlases.py
```

The second command is pure cropping; there is no estimation of object boundaries. The four normalized atlas sizes are: vials `1200 × 1088`, stoppers `2000 × 72`, textures `1024 × 768`, and effects `384 × 256`.

## Runtime layer order

1. `glass_back.png`
2. Existing PixiJS animated liquids clipped to the canonical interior polygon (do **not** flatten the liquid layers into the vial sprite)
3. `glass_front.png` (rim, edge highlights and reflections)
4. Optional compact stopper at `x=0, y=0`, inside the vial's 100 × 272 viewBox
5. Animated particles above the artwork, as needed

The repository already supplies real-time pouring, slosh, shader patterns, foam, and bubbles. These remain procedural; a pre-rendered sprite sheet cannot replace their geometry/interaction. The tile images are optional alternatives for a texture-driven shader or other UI views.

**Limitations:** The generated texture tiles are visually tileable but not guaranteed perfectly seamless at every edge. Some thin particle halos retain minor image-generation fringing. The game currently uses vector-rendered procedural liquid motifs; the raster tiles are not wired into production automatically. A visual device review is necessary before merging any skin switch.
