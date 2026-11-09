# Towns, recovery and overworld travel

The requested FF1-inspired structure now has two actual exploration scales. All 18 settlements use compact 36×34 maps with streets, a central square, signed storefronts and an approach gate (subsequently aligned with world geography). Leaving town loads a traversable overworld; walking onto a miniature enters its local scene. The broader map uses smaller scenery and a consistent miniature version of the same party leader. Desktop verification measured a 960×480 world viewport versus a 544×224 local viewport, with square integer pixels in both.

The build adds 32 overworld shores across seven regions to the 108 authored scenes. Separate shores keep boats and Skiff journeys meaningful. Cross-region walking routes now join labeled gateways on the overworld. The original route graph still determines story access, so wandering past a repaired bridge's geography cannot unlock its destination early. Towns retain story buildings, doors, transport counters and all 91 events. Automated collision traversal reaches every event, the ending and postgame through the new routes.

Clinics charge 30 G per fallen companion and revive only that companion at 1 HP, preserving depleted magic. Inns restore living companions for gold. Wyla's room is also paid. Camps require an owned Tent or Cottage and consume one only on a useful recovery; they do not revive fallen companions. Field magic, revival items, shopping, party jobs and save conveniences remain available. Defeat recovery retains the existing gold penalty and return-to-haven behavior.

Old town saves retain party, inventory, learned spells and story progress; their positions migrate to the revised town spawn. New overworld saves preserve position and shore. Automatic entrance arrivals leave space before another transition. Guided paths avoid unrelated entrances instead of entering a town while passing through it.

Verification commands:

```sh
npm test
npm run test:browser
npm run test:services
npm run test:travel
npm run test:visual
node tests/overworld-render.mjs
```

The browser checks cover actual town-exit movement, miniature entry, paid revival and insufficient gold, supply-based camps, wider camera, overworld saves, desktop/mobile bounds and missing assets. Visual checks render all 108 authored scenes and all 32 overworld shores, preserving local animation anchors and checking 64 miniature poses. Regression checks cover regional gates, visible water boundaries, every route arrival, and guided paths past other entrances.

Final results on 8 November 2026: 71 Node tests passed; browser gameplay 17 groups, services 13 groups, town/overworld travel eight groups, local visuals six groups, and overworld visuals four groups passed. Chromium reported no JavaScript errors or missing assets. The standalone HTML is 4.80 MiB; the game/source ZIP passed its CRC integrity check.

Independent integration review found and drove fixes for town exits bypassing the overworld, invisible shore boundaries, ferry arrivals triggering an immediate exit, and guidance entering intermediate scenes. Its final bounded review found no further material issues. Qodo's CLI and the Advisor's installed local transport were unavailable; no completed reviews from those services are claimed. Automated tactical simulations are not a human playthrough or a measured campaign-length claim.
