# Metallic glitter correction: soft light, stable facets, and bubble displacement

## iPhone feedback

The current shader shows over-bright white flecks and a whole-vial flash
while pouring. Rising bubbles should also temporarily displace nearby flakes.

## Implementation

1. **Lower brightness:** metallic flecks now use a pigment-relative
   soft-light material blend, rather than mixing the original color toward
   white or bright gold. Blend strength is deliberately restrained.
2. **Light and dark metal:** each seeded facet receives a stable signed
   polarity. Positive facets softly brighten their underlying pigment;
   negative facets softly darken it, retaining color identity.
3. **Stable pouring:** a facet's polarity and brightness are functions only
   of its deterministic material-space seed. We removed the sine phase
   `uTime * (0.85 + activity * 4.2)`: changing `activity` every frame
   changed the frequency against an accumulated clock and could make a
   full vial flash abruptly. Existing scanline gel displacement still
   transports the glitter, smoothly and independently from its brightness.
4. **Bubble exclusion:** the existing seven bubble positions/radii now
   generate a soft, local displacement around their bodies. Fine glitter
   moves sideways (plus a small upward displacement) as each bubble rises
   and returns to its prior material coordinates once it has passed.
   The same loop calculates visible bubble masks, preventing separate
   coordinate calculations from drifting apart.

## Unchanged invariants

- CPU-calculated liquid volumes, free-surface and color-band thresholds.
- The layer/pigment-linked patterns and all existing color IDs.
- The existing 2.4-second gel settling and continuous scanline attenuation.
- The current glass, liquid masks, pour paths, and collision/scheduling rules.
- iOS Reduce Motion: stopped shader time freezes ambient bubble movement,
  and gel settling remains disabled.
- No third-party dependencies, new sprite systems, or per-frame allocations.

## Verification

- Unit tests check both soft-light brightness directions across representative
  pigments, and no activity-driven phase in the glitter function.
- Shader contract tests check the shared bubble position/mask loop, local
  radial displacement, and the displacement preceding glitter samples.
- Manual iPhone review: compare level 426 before and after at rest and
  during a pour; verify dark and light flakes, no full-vial flicker,
  and subtle localized motion beside rising bubbles.
- Device GPU profiling remains necessary; passing CI does not validate
  actual shader compilation or visual performance on mobile Safari.
