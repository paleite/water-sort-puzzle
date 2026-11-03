# Mad Alchemist vial preview

This is a first, **reviewable visual integration** of the witch / mad-scientist water-sort concept, not the full generated asset pack.

## Included

- `public/vials/mad-alchemist.svg`: transparent potion-glass artwork with violet reflections, gold trim, an open lip, and a small amethyst setting.
- Existing PixiJS rendering and GSAP pour presentation continue to supply liquid movement, bubbles, foam, wave motion, and the 12 gameplay patterns.
- The vial keeps the **exact 100 × 272 viewBox**, liquid polygon, fill surface at `y=22`, and mouth anchors at `(12,18)` / `(88,18)` used by the current renderer. Only the overlay artwork changes.
- The original `classic.svg` remains in the repo for comparison.

## Why SVG rather than the generated PNG atlases?

The Create Image outputs establish the visual direction, but contain semi-transparent color inside the bottles and some unwanted edge effects. Shipping them as full-vial textures would obscure the dynamically rendered liquid and make pouring harder to animate correctly.

This first pass redraws the glass as a small transparency-aware SVG. The image-generated **pattern atlases, corks, and particles are not yet part of this PR**.

## Review checklist

- [ ] Validate the Next.js production build and TypeScript checks
- [ ] Check full / partially filled / empty vial visibility, especially at mobile scale
- [ ] Check pour origins, liquid surfaces, clipping, and moving vial rotation
- [ ] Confirm sufficient contrast on all existing backgrounds and color palettes
- [ ] Check reduced-motion behavior and frame times with 14 visible vials
- [ ] Assess whether the glass opacity is too strong over pale liquid colors

## Follow-up assets

1. Extract/clean the 12 image-generated liquid motifs, or reimplement the same motifs in the existing GLSL shader without introducing per-vial sprites.
2. Separate independent stopper and pendant assets and animate them inside the existing PixiJS scene.
3. Add an appearance selector that can switch between `classic` and `mad-alchemist` without affecting puzzles or saved progress.
4. Add visual regression screenshots for mobile portrait layouts.

The aim is to review rendering and geometry first, before importing large sprite atlases or changing the animation architecture.
