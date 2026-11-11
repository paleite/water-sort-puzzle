# Scanline-resolved viscous gel settling

## Behavior

A receiving vial gets one continuous response when a pouring stream arrives.
The same per-vial response continues on the Pixi ticker for several seconds
after the stream ends: it is **not** linked to the pour timeline's lifespan
or to the four discrete color slots.

The fragment shader evaluates depth independently at each pixel/scanline.
Its surface-relative coordinate is the distance along the current liquid
surface normal, divided by the distance from the actual surface threshold to
the furthest interior polygon vertex. This also works while the vial is tilted.

A delayed perturbation reaches deeper scanlines later (up to 700 ms).
Amplitude diminishes exponentially with depth and reaches **exactly zero**
at the bottom boundary. Adjacent scanlines across a color boundary receive
the same continuous field, without a jump in movement speed.

The spring-like displacement has an oscillation period of about 1.2 s.
The persistent per-vial response uses an exponential decay constant of 2.4 s
after receiving stops. Another incoming pour restarts the response.

## Ownership

- `gel-settling.ts` owns the small per-vial temporal state and its
  deterministic reference calculation, with clamped frame deltas.
- `pixi-board-renderer.ts` detects incoming streams and advances that
  state on the existing Pixi ticker, even when React no longer rerenders.
- `liquid-shader.ts` evaluates continuous depth-dependent deformation,
  applying its offset to the glitter coordinates only.

No new dependencies or extra particle instances are created.

## Invariants

- The color bands are still selected using the original, unmodified
  `liquidProjection`; all band volumes and free-surface thresholds remain
  calculated by the existing CPU projection code.
- The movement field is **independent of pigment ID**, number of filled
  slots, or layer boundaries. Only the procedural glitter artwork is shifted.
- The vial glass, clip polygon, pour streams, splash trajectories,
  GSAP timelines and source/destination positions are unchanged.
- iOS reduced-motion preference zeroes the ornamental settling state
  immediately; gameplay pouring remains intact.
- No incoming stream means no new agitation, and once decayed the gel
  becomes stationary rather than drifting indefinitely.

## QA

1. Fill a vial with three colors, pour a fourth into it, and watch for
   lingering movement after the stream disappears.
2. Verify large motion near the top, delayed subtle motion midway, and
   near-zero motion at the last pixel of the interior.
3. Verify the motion gradient passes smoothly across each color boundary.
4. Test pouring into empty, half-full and nearly full vials and on tilted
   vials (surface-relative depth).
5. Test chained and simultaneous pours, switching levels, paused gameplay,
   and iOS Reduced Motion.
6. Compare mobile GPU frame time and WebGL shader compilation against main.

CI verifies the deterministic temporal response, attenuation, delayed
arrival, and shader contracts. **Actual mobile visual quality and GPU
performance still require device review.**
