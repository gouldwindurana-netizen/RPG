# Simulation and progression verification

Verified against the final combat/campaign values on 7 November 2026. These results describe deterministic Node simulation, not browser or human playtesting. Browser evidence is recorded separately by the main implementation task.

## Route and gate coverage

`node --test tests/progression.test.mjs` passes all five tests.

- The movement simulation follows collision-valid cell paths and executes `move`, `planTravel`, and `arrive`; it does not teleport between story events.
- It completes all 91 story/field events, including every main and optional gate, reaches the ending and Seventh Star, and visits all 108 areas.
- After every completed event, world save serialization/restoration is checked for equality.
- After the gates open, every exit in every area is verified reachable on foot from the entered area.
- Encounter accumulation is verified against equivalent traveled distances split into different frame-sized increments. Blocked movement and safe areas cannot create encounters; postbattle grace steps are enforced.

## Combat and economy

The default party completes the 65-event main route and 17 required scripted battles without random encounters or additional grinding. The simulator uses only earned XP/gold, purchased supplies/upgrades, and free recovery where the actual service API offers a camp. No battle HP, gold, XP, or item stock is injected. It selects healing, revival, guards, and weakness spells using visible state.

The production balance increases most non-tutorial boss HP by 60% and final Crown HP by 40% from the initial implementation. This lets the heavy-strike telegraph appear without making physical parties depend on grinding. The tutorial remains friendly.

| Party | Runs cleared | Non-tutorial boss rounds | Final Crown rounds | Ending level |
| --- | ---: | ---: | ---: | ---: |
| Red Mage / Vanguard / White Mage / Black Mage | 4/4 | 3–5 | 5 | 22 |
| Vanguard / Monk / Ranger / Monk | 4/4 | 5–11 | 9–10 | 22 |
| Vanguard / Monk / Ranger / White Mage | 4/4 | 4–10 | 7 | 22 |
| Four Black Mages | 4/4 | 2–5 | 5 | 22 |

Seeds: 1, 42, 2026, and 123456. The physical party spends potions and occasionally a revival item; it finishes with at least 25 potions and 7 revival items. The default party retains a generous supply reserve. These results support a forgiving campaign, not a tightly balanced challenge mode.

One seeded default-party run also completes all 29 scripted encounters through the optional Seventh Star route, reaches level 30, and defeats the last encounter in five rounds. Detailed final measurements are in `balance-results.json`.

## Limits of this evidence

- The tactical agent knows enemy weaknesses and chooses sensible orders. This does not establish that first-time players will discover the best tactic unaided.
- Combat runs suppress random encounters to prove that grinding is unnecessary. They do not reproduce the full attrition or elapsed playtime of a human exploring every map.
- The four tested compositions cover all six jobs, but not every possible party permutation or every player choice.
- Route tests establish topology, collision, prerequisites, and save integrity. They do not establish visual readability, responsive controls, audio quality, or browser rendering.
