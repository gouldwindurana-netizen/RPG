# Browser verification

Tested in Chromium 154.0.8037.57 on 7 November 2026 using Playwright against the built game.

- Passed: Title, handbook and fresh game boot without resource errors.
- Passed: Keyboard walking moves through collision model.
- Passed: Jobs can be reassigned at a safe haven.
- Passed: Inn charges gold and restores spell charges.
- Passed: Shop purchases consume gold and add inventory.
- Passed: World atlas exposes all 70 named locations.
- Passed: Normal navigation reaches the first guardian without committing its story flag.
- Passed: Queued commands resolve, reward once, and commit boss flag only after victory.
- Passed: Continue restores inventory, job, progression and combat rewards.
- Passed: Jobs are locked on hostile roads.
- Passed: Actual hostile movement triggers a regional random encounter.
- Passed: Defeat returns to a haven with recovered party and story progress intact.
- Passed: Portable journal export contains validated campaign and party state.
- Passed: Malformed journal scene keys are rejected safely.
- Passed: Journal-selected objective survives area travel.
- Passed: 390px touch layout, job menu and battle targeting have no horizontal overflow.
- Passed: No browser JavaScript errors or missing assets.

Screenshots were inspected at 1440×1000 desktop and 390×844 mobile sizes: title, overworld, jobs, battle, and victory. Reduced-motion mode was used for repeatable automation; normal-motion screenshots were also inspected during the initial first-battle pass.

The normal UI flow walks from Brackenwell through the cottage and milestone to the first boss, chooses and resolves party commands, collects its reward and continues after reload. Test-only fixtures isolate defeat, a random encounter, malformed import data, and later quest selection. These fixture checks are not a claim of human end-to-end gameplay across the whole campaign.

Browser run: 17 checks passed; no uncaught JavaScript errors or missing runtime resources. Full-world collision/progression and party balancing are covered by the separate Node simulation report.

Independent integration review found a journal tracking reset after travel, which was fixed and covered with a browser regression. A malformed inherited-key save-location case and frame-distance rounding were also repaired.

Limits: tested one Chromium version, not Safari/Firefox or physical mobile hardware. No human full-campaign elapsed-playtime measurement, accessibility audit, GPU instrumentation, or hardware benchmark was performed.

The self-contained offline HTML was additionally served unchanged over localhost and rendered its title, world, images, fonts and job menu with zero additional network requests and no JavaScript errors. Direct file:// navigation was blocked by the managed browser’s administrative policy, so opening the downloaded file on a user’s own browser remains unverified here.
