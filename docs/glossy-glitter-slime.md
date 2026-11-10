# Glossy glitter slime — liquid presentation

This pass changes only the existing liquid fragment shader. No new sprite sheet,
third-party animation library, particle system, or gameplay state is introduced.

## Visual behavior

- **Translucent candy color:** retain the playable twelve-color palette and
  pigment-linked motif system, but lower the visual weight of printed patterns.
- **Wet gloss:** broad and narrow specular streaks move with the liquid mesh
  underneath the transparent front-glass PNG.
- **Suspended glitter:** two procedural layers of sparse diamond-like flecks,
  one faint/deep and one sharp/foreground. Flecks have deterministic,
  pigment-specific spatial seeds, drift slowly upward and shimmer over time.
- **Gel meniscus:** a brighter strip directly beneath the free surface
  emphasizes viscosity without changing actual color quantities.
- **Reactive wobble:** a subtle extra deformation follows the existing
  per-vial surface activity (`uJellyActivity`). Existing spring physics still
  owns sloshing; the CPU still calculates liquid-volume projection.

## Ownership and invariants

- The existing CPU surface-normal, per-band thresholds, liquid polygon mask
  and GSAP/vial geometry are unchanged. Glitter is shaded only after the
  fragment passes the free-surface clip.
- **One frame clock:** the same Pixi ticker `uTime` drives glitter drift and
  shimmer. Under `prefers-reduced-motion`, the clock stops progressing,
  so ambient particles become static. Incoming pours still update their
  gameplay position and fill amount.
- No texture uploads or particle allocations occur per frame. Sparse
  per-pixel cells early-return before evaluating additional random hashes.
- Color labels remain differentiable. Existing motif identity is preserved
  for users who rely on patterns to tell colors apart.

## Visual QA

- Test two rows of 7 vials on a mobile Safari-sized screen.
- Test empty, one-band and four-band fills while upright and rotated.
- Test simultaneous pours and a queued same-vial handoff.
- Verify glitter does not appear in empty slots or outside the glass mask.
- Check readability for all 12 pigments and with the alternate palettes.
- Turn on **Reduce Motion** in iOS accessibility settings and verify
  the shimmer/drift freezes while gameplay remains functional.
- Compare GPU/frame time with the previous shader on actual iPhone hardware.

The appearance is a first visual implementation, not a completed mobile
performance benchmark.
