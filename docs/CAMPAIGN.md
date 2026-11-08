# Avelune campaign adaptation

The playable world keeps the supplied **108 areas, 70 named locations, 91 field events, and original route gates**. The campaign adapter turns every field event whose source title begins with “Resolve” into a battle. It also adds the Hearth Warden, lock-intake eel, guarded Skiff parts, Caelan's escape conduit, and the Unmoored Hearth at the appropriate story events. World flags are committed only after victory by the application.

The six regional Hearths open the ferry, the three open pilgrimage regions, the Skiff, Ordel, and Edrin. The relief and Keeping chapters lead to the six anchor repairs and the Hollow Crown ending. Optional Fracture Well wardens, six elemental trials, the Unwritten, the Sixfold Warden, and the Seventh Star remain available afterwards. The map and gate graph are reused from `Avelune_World_Layout_Source.zip`.

## Implemented balance

This is an original, streamlined ruleset, with a main-path recommendation of roughly levels 1–19 and optional bosses at 20–24. It does not use the planned level-60 balance or every behavior in the source design documents. Normal enemy formations use fixed regional levels; they do not increase when the player levels up. Edrin's final approach changes to level 18 after the Keeping milestone, a visible story transition. The three open pilgrimage regions share a level-8 baseline and can be visited in any order.

Each region has five named enemy archetypes and four weighted formation patterns. Common groups account for 45%, mixed groups 35%, harder groups 15%, and rare three-enemy groups 5%. Early level-1/2 routes favor a single enemy. The application owns the walking-distance encounter counter and protected steps after battles.

The source enemy names and thematic weaknesses were retained where compatible with the implemented spell list. Some weaknesses were changed to keep player counters available. Bosses use the shared combat engine's announced heavy attacks; the full multi-phase source boss scripts, minions, bespoke statuses, and level-60 statistics are not implemented by this adapter. The escape sequence is an explicit battle against Caelan's conduit; the finale is one Hollow Crown battle. Corwin, Orrun, and Hesper survive their respective victories.

## Recovery and rewards

Towns, villages, ports, camps, shrines, markets, landing sites, Hearth exteriors, bridges, ferry decks, and refuge interiors have no random encounters. Shops, inns, and job changes are available at havens. Camps, shrines, Hearths, Wyla's cottage, and clinics provide free recovery. A pending scripted boss in the current room makes a pre-boss camp available. This ensures a player with no gold has a recovery path.

Field rewards require the matching committed world flag. `rpg.campaignRewards` persists each reward receipt, preventing repeated gold, consumables, or XP from a replayed interaction. Treasure caches grant consumables, currency, and XP; Hearth stabilization replenishes expedition supplies. Boss XP and gold come from the combat engine and are not duplicated in field rewards.

## Integration contract

- `bossFor(eventId, rpg, world)` returns a fresh battle specification or `null` for noncombat/already completed events. The app checks the event prerequisites before starting it.
- `encounterFor(area, rpg, world, rng)` returns a regional battle, or `null` in safe areas.
- `recommendedLevel(area, world)` and `region(area)` supply UI information.
- `services(area, world)` reports `shop`, `inn`, `jobs`, `camp`, and `innCost`.
- `rewardForEvent(event, rpg, world)` applies a committed event's one-time reward and returns a readable receipt.

The source documents are reference material. This implementation follows the user's explicit request for turn-based combat and freely customizable jobs, which is a deliberate extension beyond Final Fantasy I's mostly fixed initial class choices.
