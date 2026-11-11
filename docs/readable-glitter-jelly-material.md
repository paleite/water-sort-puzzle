# Readable glitter jelly — visual correction

## Reason
The first two shader passes technically added suspended glitter, but their
subpixel-sized facets looked like noise at the actual iPhone board scale.
Highlights at 0.1–0.2 blend strength were also not strong enough to give the
liquid a recognizably curved, glossy body. The user's level 426 screenshot
still looks like opaque patterned color bands.

## Changes
- Restore a visibly darker curved sidewall and brighter gel center.
- Add two pronounced, spatially curved white highlights within the masked
  liquid surface. The thin reflection tapers along the bottle height.
- Rebalance metallic particle layers:
  - Fine rear glitter uses a 39-cell liquid-space grid.
  - Foreground flakes use a 16-cell liquid-space grid, specifically to be
    visible when rendered at small iPhone CSS-pixel widths.
  - A fraction of the foreground flakes have four-point glints.
- Continue using the existing pixel shader clock and the existing
  `uJellyActivity` uniform to make flashes react to movement.
- Keep the twelve color patterns at reduced weight.

## Invariants
No modifications to CPU area/volume projection, vial masks, GSAP timelines,
liquid source colors, animation scheduling, stream geometry, or accessibility
reduced-motion behavior. No new dependencies.

## Review / release criteria
- Compare before/after screenshots of level 426 at identical device size.
- Confirm the jelly has recognizable light/dark curvature without motion.
- Compare rapid pouring and two simultaneous streams; ensure no FPS regression
  on iOS Safari, particularly at 3x device-pixel ratio.
- Check that 12 colors remain distinguishable and that hidden/empty cells
  have no glitter.
- Inspect under iOS Reduce Motion and confirm glitter freezes.
- If the shader is still visually unconvincing, do not merge solely on CI;
  consider a baked material-normal/highlight map or dedicated in-game
  visual QA previews.

CI validates code contracts, not GPU appearance.
