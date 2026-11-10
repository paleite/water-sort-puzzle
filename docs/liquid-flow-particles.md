# Liquid flow particles — visual-only follow-up

Builds on PR #14 (glossy glitter slime) and uses the references' suspended liquid droplets, glowing trails and gentle impact reaction. This is **not** a fluid simulation: game state and exact liquid volumes remain unchanged.

## Inside vials

- Two existing pigment-linked procedural layers are rendered as small, soft, translucent droplets with subtle specular cores, rather than sharp diamond glitter.
- Both layers rise against the existing projected surface normal, so they follow the liquid's gravity direction as the glass tips.
- Existing `uJellyActivity` modulates a small lateral circulation only when source or receiving liquid moves.
- All flow coordinates are **sampling-only**. `chooseBand(liquidProjection)`, the CPU-computed band boundaries, free-surface clipping, volume projection and the Pixi polygon mask remain unchanged.
- The single existing Pixi `uTime` clock still drives ambient motion; reduced-motion freezes it.

## Between vials

- The existing quadratic Bézier ribbon now contains seven small highlight/bead samples moving along its tangent.
- Particle positions are deterministic functions of `PourStreamRenderState.timeSeconds` and the existing per-source/destination visual seed, **not** a global particle system. Paused debug seeks, queued handoffs and concurrent pours retain independent clocks.
- Samples stay close to the ribbon centerline; their radii are bounded by the ribbon width. Closing the ribbon removes the highlights.
- A faint short-lived ring accompanies the existing impact splash, without changing splash physics or transfer timing.
- Reduced-motion skips the new ribbon highlights and ripple while preserving the stream, existing gameplay feedback and liquid transfer.

## Rendering cost and ownership

- No new Pixi containers, shaders, texture uploads, third-party dependencies, DOM elements, state-machine events or game-state fields.
- Seven bead samples are computed per active visible stream frame. They are drawn into the **existing** reusable `Graphics` object, and no persistent per-particle arrays or time-step integration are introduced.
- The fragment shader reuses the existing two depth layers and uniforms rather than adding more layer loops or changing color semantics.
- Decorative sampling can be freely dropped or reduced without changing the puzzle outcome.

## Validation

- `stream-particles.test.ts`: deterministic timeline seeks, independent visual seeds, bounded placement/opacity and no highlights without a visible ribbon.
- `render-state.test.ts`: independent clocks for simultaneous visible pours.
- `liquid-shader.test.ts`: clipped pigmented droplet layers, motion along the surface normal and activity-driven circulation without modifying color-band selection.

## Manual visual QA before merge

- Check the 12 pigments with Classic, Mad Alchemist and Compact Alchemist skins.
- Seek the debug timeline at several positions; compare with real-time pouring.
- Test left/right pours, simultaneous independent pours and same-vial queued handoffs.
- Check full, empty, partially filled and rotated vials for leaks and color cross-contamination.
- Turn on iOS **Reduce Motion**; confirm the new ambient beads/ripple stop but poured quantities remain correct.
- Profile GPU/CPU frame times on an actual iPhone (including 2 rows of vials). Static shader assertions are not a substitute for screenshot or hardware validation.
