# Glossy jelly with dense metallic glitter (v2)

Visual selection: **glossy jelly with metallic highlights**, **dense fine-grained
glitter**, **movement-reactive shimmer**, **subtle existing motifs**,
**soft highlights**, and coverage of **vial liquids, pouring streams, and
splash/detached droplets**.

## Ownership

- `liquid-shader.ts`: the same PixiJS WebGL liquid fragment shader now
  shades two fine-grained metallic layers (different spatial scales and
  pigment-locked seeds), soft subsurface color, rounded wet highlights,
  and movement-dependent brighter glints. GLSL calculates decorative color
  *after* the existing surface cutout and pigment-band selection.
- `render-state.ts`: exposes the existing clamped transfer fraction as
  `flowProgress`; no new animation clock or gameplay state.
- `glitter-effects.ts`: pure seeded stream sample generator. Samples follow
  the existing quadratic Bézier stream geometry, with a bounded offset from
  the ribbon's centerline. No mutable emitter, timers, randomness, or
  per-frame retained particles.
- `pixi-board-renderer.ts`: draws a restrained ribbon reflection and
  gold-white flecks inside the stream, and small metallic highlights inside
  the *existing* splash and terminal droplet geometry.

## Invariants and trade-offs

- No changes to glass artwork, input zones, board bounds, source/target
  anchors, GSAP timelines, scheduling or geometry.
- Existing 12 pigment IDs, palettes and motif shapes remain intact; motif
  opacity is lowered substantially, not eliminated.
- Existing CPU-computed `uBandThresholds` / `uBandVolumes` continue
  to own conserved fill proportions; the new effects are cosmetic.
- Liquid glitter shimmer uses the existing Pixi `uTime`; when the user
  enables reduced motion the ambient clock freezes. Stream particles still
  track the gameplay pour, but fewer are drawn (12 rather than 22).
- Dense glitter has two hash-based shader layers, not thousands of
  per-frame JavaScript sprites or a new dependency. The budget is constant
  per pixel per layer; hardware visual/performance QA is still necessary.
- Stream and splash highlights are color-independent glints applied *over*
  each underlying pigment; they cannot change color ID or the transfer
  amount.

## Review checklist

- Compare against the previous patterned-liquid screenshot at levels
  with 2 rows and all 12 colors.
- Validate an empty vial, partially filled vials, mixed bands, nearly full
  vials, and inverted/vertical free surfaces during pours.
- Test same-source queued handoffs and multiple overlapping pours.
- Ensure the stream flecks remain inside the curved, narrow ribbon and
  the splash glints remain inside individual droplets.
- Test iOS Safari with reduced motion enabled and disabled.
- Profile GPU/frame rate on low-power iPhones and compare with main.
- Consider whether this should be optional in a cosmetic theme selector
  once visual quality is reviewed on real devices.
