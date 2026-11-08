# Avelune · The Road Beyond the World

An original, playable classic party RPG using the supplied Avelune world and cast. Inspired by Final Fantasy I’s whole-party command rounds, class tradeoffs, scarce magic, regional encounters, and travel unlocks. It uses no Final Fantasy characters, writing, maps, graphics, or music.

## Play

Open **Avelune.html** in a modern browser for the self-contained offline edition. The hosted version has the same game and uses smaller separately cached assets. Saves are local to your browser and origin; use **Menu → Export journal / Import journal** to move your journey between versions or keep a backup.

- WASD or arrow keys: walk. Shift: run. Click the ground to walk there.
- E or Space: interact. **Follow marker** walks toward the tracked objective.
- P: party and jobs. I: items. M: atlas. J: journal. H: haven. Esc: menu/back.
- Touch: directional pad, Interact, and the same menus.
- In battle, choose one order for each living hero and **Resolve round**. Select a hero card to revise an order before committing it. Magic and items have explicit targets. The enemy’s third-round heavy strike is telegraphed; Guard reduces it.
- **Haven** offers recovery, supplies and equipment where available. Camps and Wyla’s cottage offer free recovery. Job changes are available at safe havens. Rest after changing jobs to replenish newly available charges.

## Implemented scope

- All **108 connected areas** and **70 named locations** in the supplied world layout, across seven regions.
- **91 field events**, including the **65-event main story**, an explicit ending, and optional postgame routes.
- **29 scripted encounters** and **35 regional enemy archetypes**. Random encounters accumulate from distance actually traveled in hostile areas, with a visible warning meter and postbattle grace period.
- Four named heroes available together from the beginning: Roadkeeper, Mara, Iven, and Sella.
- Six interchangeable jobs: **Vanguard, Monk, Ranger, Red Mage, White Mage, Black Mage**. Each changes stats, equipment proficiency, spells, and a passive trait. All purchased equipment ranks remain owned across job changes; effective ranks obey the current job’s limits.
- Turn-based party commands, speed-based initiative, elemental weaknesses, auto-retargeting, two tiers of limited spell charges, healing/revival, guarding, consumables, retreat, XP, level-ups, upgrades, and a level-30 cap.
- Inns, camps, shops, one-time treasure and story rewards, autosave, portable save import/export, desktop/touch controls, optional synthesized sound effects, and reduced-motion support.
- A unified original 16px world-art vocabulary, fixed 16×24 character source shared by standing/walking/battles/portraits, thirteen enemy silhouettes, and classic blue/ivory command menus. Buildings, foliage, water, paths, furnishings and regional battlefields share material colors and pixel density.

This is a streamlined complete adaptation of the supplied route, not the design bible’s proposed 35–45-hour commercial campaign. The full catalog of 332 items, 72 books, 48 native skills, 70 quests, crafting, summons, six-character roster/recruitment, bespoke multiphase boss mechanics, and unique art for every enemy are **not** all implemented. Bosses use tuned stats, weaknesses, and a shared heavy-strike cycle; multiple named enemies share silhouettes. Playtime has not been measured with human players.

The user requested random-encounter and job customization changes. Attached documents were treated as source references rather than overriding instructions. The four-hero starting party, retrainable jobs, streamlined progression, and new encounter rules are deliberate adaptations. Final Fantasy I’s original classes were chosen at the start; free retraining here is an extension requested for Avelune. Speed initiative and Guard are modernizations, not claims about exact NES rules.

## Build and test

Requires Node.js 20+ for the development tools. The game itself has no runtime framework dependency.

```sh
npm ci
npm run build
npm run dev
```

Open the printed localhost address. To produce the offline file:

```sh
node tools/build.mjs --standalone
```

The offline file is written to `release/Avelune.html`. The static web build is `dist/`.

```sh
npm test
npm run test:browser
npm run test:visual
```

Browser tests launch Chromium at `/usr/bin/chromium`; set `CHROMIUM_PATH` to an installed Chromium executable on other systems and `PLAYTEST_OUTPUT` to a writable test-results directory. Browser tests start and stop their own server on port 3101. They include a test-only fixture interface enabled solely by `?test=1`; ordinary play does not expose it.

The native canvas renderer preserves the authored geometry, collision and travel network. `pixel-art.js` supplies a common original character/scenery source and `terrain.js` supplies 16px terrain with shared regional material ramps. World motion uses fixed foot anchors, distance-driven strides and square integer display pixels; idle no longer switches to a different illustration or stretches its body. Gameplay rules remain separate from rendering: `model.js` owns exploration, `combat.js` owns combat/jobs, `campaign.js` owns content, and `battle-ui.js` presents battles. `app.js` integrates UI, services and saves.

## Research, assets and verification

- `docs/FF1-RESEARCH.md`: sourced combat, encounters, classes, version differences, whole-game progression, and art-direction research using Firecrawl.
- `docs/ASSETS.md`: asset provenance, inaccessible uploads, art processing and optimization measurements.
- `docs/CAMPAIGN.md`: campaign adaptation and mechanics.
- `docs/PLAYTEST.md`, `docs/balance-results.json`: deterministic full-route and party-composition verification.
- `docs/BROWSER-QA.md`: actual desktop/mobile Chromium checks and limits.
- `docs/VISUAL-QA.md` and `docs/VISUAL-POLISH.md`: full-map rendering, walking consistency, and visual integration evidence.

Equivalent runtime images fell from 11,757,262 to 2,357,878 bytes, about **80% smaller**. Source originals were preserved during development. The three larger uploaded art archives exceeded the transfer tool’s 32 MiB limit; their separate contents were not inspected. Existing derived scene artwork in the accessible world-layout archive was used.

Game Development Studio’s local `game-dev` CLI, Qodo’s local review command, and the Advisor’s required local transport were unavailable. No GPU/hardware-performance measurement or Qodo review is claimed. Actual Chromium playtests, local regression tests, and independent integration review were completed instead.

Fonts VT323 and Cinzel are bundled under their SIL Open Font Licenses in `docs/`. The supplied Avelune material retains its original ownership; see `docs/SOURCE-PROVENANCE.json`.

To regenerate the menu portraits and inspect the directional walk sheet from the exact live character drawing, run `npm run art:classic` with Chromium available. This exports original procedural artwork; normal builds use the shipped portraits and need no browser. The older source art optimization command remains available for archive regeneration; run `art:classic` afterwards to restore the current menu portraits.
