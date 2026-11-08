# Classic pixel art visual QA

Validated on 8 November 2026 with Chromium 154.0.8037.57 at desktop 1440×1000 and mobile 390×844, with animation enabled.

Run from the repository root after building:

```sh
npm run build
node tests/visual-polish.mjs
```

The script starts a temporary local server on port 3102 and closes it when finished. `VISUAL_PORT`, `CHROMIUM_PATH`, and `VISUAL_OUTPUT` can override the server port, browser binary, and artifact directory. The default artifact directory is `test-results/visual` (ignored by Git). This run wrote its artifacts outside the repository through `VISUAL_OUTPUT`.

## Results

- All 108 authored maps loaded and rendered after `__avelune.visit`, with two animation frames allowed after each area change. No uncaught JavaScript errors or failed resource requests occurred.
- All 64 combinations of four party identities, four cardinal directions, and four walking poses use the same 16×24 sprite cell. Each direction retains identical head pixels, silhouette bounds, and foot baseline throughout its poses. Every edge is opaque or transparent, without resampled fringe pixels.
- The actual actor renderer was also exercised through three idle samples and a complete walking stride. Its head pixels and body scale remain stable while its arm and leg poses advance.
- Field and interior views keep the same pixel scale and logical viewport at each tested device size. Entering a room does not shrink or stretch the hero.
- Both device layouts have no horizontal page overflow and fit the canvas inside its frame. Canvas image smoothing remains disabled.
- A mobile doorway regression checks that the interaction prompt and danger badge never overlap. The badge now sits at the top right, leaving the action prompt clear.

| Device / area | Logical canvas | CSS display | Display scale |
| --- | --- | --- | --- |
| Desktop field | 544×224 | 1088×448 | 2× |
| Desktop interior | 544×224 | 1088×448 | 2× |
| Mobile field | 352×224 | 352×224 | 1× |
| Mobile interior | 352×224 | 352×224 | 1× |

The wider desktop canvas fills the playfield while preserving square integer pixels. Its width depends on available space; interiors and outdoor maps use the same rule. Shorter frames can show fewer vertical tiles without changing actor dimensions.

## Visual review and artifacts

The audit captures orchard, marsh, basalt, salt, forest, island, sky, snow, and ivory environments, plus desktop and mobile interiors. Representative captures use the live world renderer, terrain, scenery, HUD, and party strip.

Initial screenshot review identified wide desktop side margins, stone interiors painted over by dark outlines, disconnected pine foliage, and a large mobile location plaque. The final captures include the wider integer-scaled viewport, repaired stone planes and joined pine foliage, and smaller mobile plaque. Terrain, scenery, party portraits, and field characters now share the same authored pixel palette and grid.

Artifacts in the output directory:

- `visual-report.json`: browser version, assertions, viewport measurements, and all 108 map results.
- `hero-metrics.json`: measured bounds and pixel hashes for all 64 source poses.
- `walk-contact-sheet.png`: all four directions and walking poses of the roadkeeper, enlarged with nearest-neighbor scaling.
- `theme-*.png`: nine representative environment captures.
- `desktop-field.png`, `desktop-interior.png`, `mobile-field.png`, `mobile-interior.png`: complete device layouts.

The animation unit tests in `tests/animation.test.mjs` additionally verify distance-based cadence at different movement speeds, direction and stop resets, teleports, area entry, reduced motion, fixed fallback atlas anchors, and stable integer viewport sizing. `tests/playtest.mjs` covers gameplay navigation, combat, jobs, services, saves, and touch controls separately.

Final regression results: 34 Node tests, 17 gameplay browser checks, and all six visual audit groups passed. Battle input/playback was additionally inspected at 1280×900, 390×844, and 320×740. These are software/browser checks, not a physical-device or GPU hardware benchmark.
