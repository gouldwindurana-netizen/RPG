# Starting jobs, mana and mapped towns

New game opens a four-companion party setup before the journal is replaced or the story begins. Choose Vanguard, Monk, Ranger, Red Mage, White Mage or Black Mage for each companion; duplicate jobs are allowed. Begin adventure confirms all four choices. Cancel leaves an existing journal untouched. Jobs stay fixed after starting, including through towns, guilds, saves and Continue. Guilds retain formation and promotion within the existing calling. Existing journals keep their saved jobs.

Spells use one MP pool per caster in battle and in the field. Every spell displays its mana cost. The field HUD, status, town recovery windows and battle console show current/max MP and blue mana bars. Physical jobs have zero MP. Red Mages begin with 24 MP and gain four capacity per level; White and Black Mages begin with 28 and gain six. Advanced spells still unlock at level five and share the same pool.

| Spell group | MP cost |
| --- | ---: |
| Ember, Frost, Bolt, Starlight, Mend, Gale, Stone | 4 |
| Ward, Salve | 6 |
| Halo | 7 |
| Tempest, Deluge, Quake, Shelter | 10 |
| Emberstorm, Renewal, Greater Mend | 12 |
| Sunburst | 14 |
| Rekindle, Comet | 16 |

Invalid casts and unused full-health healing do not spend MP. Multi-target spells spend their cost once. Ethers restore up to 24 MP; Tents restore one quarter of maximum MP, rounded up, alongside their HP recovery. Paid inns and Cottage kits refill living companions' mana. Clinic revival preserves current mana and returns one fallen companion at 1 HP. Promotion raises the same job's capacity while retaining the current recovery proportions.

RPG snapshots now store `mp` and `jobsLocked` in version two. Legacy tier charges convert to a proportional mana amount using the hero's old charge capacities; an exhausted caster stays exhausted. Equipment, learned spells, formation, story flags and rewards remain saved. Town layout revision markers move older town positions to the new safe spawn once, preserving story progress.

Town gates follow their primary mapped approach. Regional shoreline, ridge, orchard, salt and snow features inform local boundaries and districts. Overworld miniatures carry the same gate and waterfront metadata. Arrival positions sit inside the corresponding town gate or outside its world miniature, leaving room before another automatic transition. Story doors, services, route gates, ferries and the Skiff remain part of the existing campaign.

`npm run test:party` covers actual starting choices, duplicates, permanent jobs, cancel/Continue, field and battle MP, insufficient-mana controls, recovery, accessible bar values and mobile layout. The regular Node, gameplay, services, UI, travel and visual suites cover transactions, campaign progression, geography paths, named story events and rendering.

Verification on 9 November 2026: all 80 Node tests passed. Browser groups passed: party/mana nine, travel nine (including actual exit/return in every cardinal direction), services 13, gameplay 17 and classic UI 13. The six local-visual and four overworld-visual groups also passed. Desktop and 320/390px captures showed readable setup and mana bars; six town/world pairs were inspected for matching shorelines, gates and regional detail. Chromium reported no page errors or missing resources.

Independent review checked startup cancellation, saved jobs, MP event replay, all 91 story events/postgame, safe arrivals, and 318 town stop/service paths with closed and open progression gates. No material findings remained after the battle roster's accessible label was updated to include MP. Campaign simulations now pay for actual inn/clinic services and consume purchased camping supplies; default, physical and all-mage parties still reach the ending and postgame without a free-rest fixture.
