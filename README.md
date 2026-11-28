<p align="center">
  <img src="public/offline-icon-192.png" alt="Water Sort game icon" width="96" />
</p>

# Water Sort

**A little logic. A lot of color. One satisfying pour at a time.**

Turn a collection of mixed potions into neatly sorted vials. Watch colorful liquids swirl, sparkle and settle as you work your way through hundreds of puzzles.

Take a quick puzzle break or lose yourself in a longer challenge. There's no need to download anything or create an account. Just open the game and start pouring.

**[Play Water Sort](https://paleite.github.io/water-sort-puzzle/)** · [Start at level 1](https://paleite.github.io/water-sort-puzzle/?level=001) · [Browse levels](https://paleite.github.io/water-sort-puzzle/?view=levels)

## Why you'll want one more level

- **650+ puzzles** — explore a growing collection of color-sorting challenges.
- **Satisfying pours** — glossy liquids, shimmering particles, animated potion vials and celebrations make every move feel rewarding.
- **Your game, your look** — switch between color palettes, vial styles and backgrounds.
- **Play at your own pace** — undo a move, restart a puzzle or ask for a hint when you're stuck.
- **Recover from a dead end** — get help finding an earlier solvable position instead of losing all your progress.
- **Pick up where you left off** — completed levels and your current game are saved in your browser.
- **Take it offline** — once the game says "Ready to play offline", the full level collection is available without an internet connection.

## How to play

1. Tap or click a vial to select it.
2. Choose an empty vial or one with the same color on top and room for at least one layer.
3. Matching layers pour together as far as the available space allows.
4. Keep sorting until every vial is either empty or completely filled with a single color.

A simple rule can lead to surprisingly tricky decisions. Plan a few moves ahead, make room for the next color and enjoy the moment everything falls into place.

## Play anywhere

Water Sort runs in a modern browser with WebGL support, on a phone, tablet or computer. The game can also be installed from supported browsers as a web app.

For offline play, open the game while connected and wait for the readiness message. Progress and offline files live on your device; clearing browser data can remove them.

## Behind the game

The game combines a typed puzzle engine with real-time graphics and a solver that runs in a separate browser worker for hints and recovery. Levels are bundled with the application, so moving to another puzzle does not require a network request.

Built with [Next.js](https://nextjs.org/), [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [PixiJS](https://pixijs.com/), [GSAP](https://gsap.com/) and [XState](https://stately.ai/docs).

<!-- cspell:ignore PixiJS -->

### Run locally

Use the Node.js version in [`.nvmrc`](.nvmrc) and the pnpm version pinned in [`package.json`](package.json).

```bash
git clone https://github.com/paleite/water-sort-puzzle.git
cd water-sort-puzzle
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Open [localhost:3000](http://localhost:3000) to play. Run `pnpm build` to generate the production site in `out/`.

For level validation, tests and offline verification, see [Validation](VALIDATION.md). Implementation notes are in [the architecture guide](docs/AGENTS/ARCHITECTURE.md).

## Feedback

Found a tricky bug, an awkward pour or something that would make the game more enjoyable? [Open an issue](https://github.com/paleite/water-sort-puzzle/issues). Include the level number, browser and device where relevant.

[**Ready for another puzzle? Play Water Sort.**](https://paleite.github.io/water-sort-puzzle/)
