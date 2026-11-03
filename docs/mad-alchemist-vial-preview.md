# Mad Alchemist — playable visual theme

The generated fantasy-potion art inspired this theme. All artwork used by the runtime is a cleaned-up vector recreation rather than the original raster sprite sheet, which had baked-in interior color and edge fringing.

## Implemented

- Transparent purple-and-brass potion vial: `public/vials/mad-alchemist.svg`
- Matching full liquid colors, with **twelve** distinct shader-drawn motifs: flowers, diamonds, waves, zigzags, leaves, spirals, bubbles, stripes, stars, crescents, hearts, constellations
- Twelve standalone, reusable 64×64 SVG liquid tiles under `public/potions/liquids/` with exactly the same color-to-pattern mapping
- Five decorative cork/crystal/orb/moon stopper SVGs under `public/potions/stoppers/`, attached to the live vial sprites and hidden as a vial tips to pour
- Calm glints on each vial, which freeze under `prefers-reduced-motion`
- A **plain purple** default background; original backgrounds remain available
- A vial-style switch in the HUD between `Mad Alchemist` and `Classic`, persisted in localStorage
- Existing PixiJS liquid-volume projection and GSAP transfer timings preserved
- Pull-request workflow for typecheck, lint, tests, and production build
- Unit tests for 12-color/pattern uniqueness and default theme settings

## Implementation details

The original `classic.svg` is preserved, and both skins use the same 100×272 viewBox, liquid polygon, fill surface (y=22), and mouth anchors ((12,18) and (88,18)). Therefore the existing rotated-pour geometry works with both art styles.

The liquid shader draws decorative motifs in the same pass as the liquid, so they stay clipped and oriented correctly while vials move. UI tiles are available as SVG for thumbnails and other views without requiring a raster image texture for every liquid band.

## Validation

- [x] Pull-request CI runs typecheck, lint, unit tests, and build (see Checks tab for current status)
- [x] Invariant tests for twelve colors and distinct patterns
- [ ] Visual review on iPhone Safari and Android Chrome with 14 visible vials
- [ ] Inspect partially filled vials and color contrast under all palettes
- [ ] Check reduced-motion behavior on physical devices
- [ ] Review texture differences between shader motifs and the reusable SVG tiles

## Not in scope

The source Create Image PNG sheets are retained as design references outside the repository but are not directly used at runtime. Importing the opaque/sem-transparent bottle sprites as full texture layers would obscure the shader; the vector skin is purpose-built to remain transparent. The animated dangling pendants and extra particle sprite variants are not implemented yet. The core glints and stopper overlays are integrated.

## Reviewer checklist

Load a level with 12–14 vials in a phone-sized viewport, select and pour between vials, change the palette and background, then tap the flask icon to switch the glass style while preserving the game state.
