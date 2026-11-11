# Restore visible soft-light glitter

## Report

The level 427 iPhone screenshot after PR #19 showed essentially no
perceptible glitter. The earlier white confetti had disappeared, but so had
the intended metallic material.

## Root cause

PR #19 combined signed deep and near glitter:
`deepMetal * 0.35 + nearMetal * 0.65`, then mapped the result to a
near-neutral 0.5 soft-light blend with just 65% opacity. Independent
positive/negative facets could cancel before compositing, and the
remaining near-neutral soft light produced almost no tonal difference.

## Correction

- Composite the deeper and nearer signed glitter layers **independently**.
- Use visibly different dark (`0.08`/`0.04`) and light
  (`0.92`/`0.96`) soft-light blend inputs, with coverage proportional
  to the facet's signed intensity.
- Keep the original underlying pigment hue and constrain outputs using
  the existing soft-light formula; no flat white or gold particle overlays.
- Preserve particle-stable intensities, continuous depth-dependent gel
  displacement, local bubble exclusion, and reduced motion.

Automated numeric tests require that a fully visible near-layer facet
changes a representative pigment channel by more than 0.08 in both
directions, without becoming pure white or black. These are **contrast
regression checks**, not proof of final iPhone visual quality.

## Device review

Compare level 427 at the same zoom and lighting:
- Fine metallic flecks should be immediately recognizable at rest.
- Flecks should both darken and lighten without the previous white confetti.
- Pouring should not trigger synchronous full-vial flashing.
- Bubble passage should only nudge nearby flecks, with no discontinuity.
- Confirm smooth scanline settling after the stream stops.
- Check WebGL compilation and GPU frame time on iPhone Safari.
