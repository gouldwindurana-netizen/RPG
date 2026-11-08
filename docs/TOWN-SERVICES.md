# Town services

The town overlay adds discoverable merchants, innkeepers, wardkeepers, job mentors, and road guides to the supplied maps. Every village, town, port, and market has separate recovery, provisions, equipment, spell, revival, job, and rumor interactions. The markers are signs or merchant counters beside existing buildings; they are not collision objects. The original 108 areas, 91 events, entrances, route gates, and terrain remain unchanged.

Brackenwell gives the first party a complete preparation loop. Tilda’s rooms and forge face the east square; the communal bakehouse sells provisions to the south; the orchard press hosts a spellwright; the Festival Barn hosts the job mentor; Wyla’s cottage has the revival sign and a free bed inside. A road guide stands near the existing road post. These locations are deliberately spread around the village rather than collected into one interaction point. Existing cottage, inn, clinic, and armory doors still enter their authored interiors, where dedicated counters are also available.

Camps, shrines, Hearth exteriors, and the Skiff mooring offer free recovery, a job mentor, and a guide. Wyla’s cottage and both clinic interiors offer free recovery; clinics also offer free revival. Brackenwell’s wayside wardkeeper also offers free care so a penniless party can recover immediately. Other town inns and wardkeepers carry `free: false`; the economy/application calculates their price. Hostile fields, dungeons, and boss rooms do not gain town shops.

## Runtime API

`AveluneTownServices.forArea(area, world?)` returns fresh service records:

```js
{
  id: 'alderreach_01:service:armory',
  type: 'weapon',
  name: 'Tilda’s forge stall',
  label: 'ARMS',
  at: [37, 22],             // Tile coordinates, like authored events/stops.
  asset: 'service_weapon',   // Procedural sign/icon hint for the renderer.
  catalogs: ['weapon', 'armor'],
  stockTier: 1,
  description: 'Buy and sell weapons and armor; compare equipment for every party job.',
  source: 'Tilda’s Smithy-Inn',
  interior: 'smithy_inn',
  free: false,
  solid: false
}
```

Types are `inn`, `item`, `weapon`, `armor`, `magic`, `chapel`, `guild`, `rumor`, and `camp`. A single armory normally exposes both weapon and armor catalogs; a magic merchant exposes both `white` and `black` catalogs. The Oakmere Armory interior has separate weapon and armor counters. `interior` identifies a nearby original door destination for a guide or description; interacting with the marker opens that service directly. `rumor` records also include current regional advice.

`directory(area, world?)` returns the same records for a clickable local guide. `near(world)` finds the nearest service within 24 logical pixels, yielding to a pending authored story interaction within 28 pixels. The application should keep original story events and stops ahead of service targeting where their ranges overlap. `tier(area, world?)` is available independently for shop stock filtering.

Tier baselines are Alderreach 1, Veyra 2, Kharad/Sereva/Isles 3, Ordel 4, and Edrin 5. Stabilizing Veyra raises the shared trade stock to at least 2; completing the Emergency Keeping raises it to at least 4; restoring the roads raises it to 5. Stock changes do not move shops.

## Placement and validation

Frontages use named authored buildings, stalls, and road posts. Brackenwell has explicit initial sign positions. Other safe hubs use deterministic frontage offsets with the nearest valid tile. A flood fill from the authored spawn excludes closed barriers. Every service stays at least two tiles from story events, doors, arrivals, and spawn, at least three tiles from another service, and off existing object anchor tiles. Placements are cached by area and barrier state, so walking animation, facing, and frame rate cannot move a merchant.

`node --test tests/town-services.test.mjs` verifies service coverage, passability and path reachability, separation, story priority, stable directories, expanding stock, closed-barrier handling, safe-only placement, and preservation of the authored world.

All shop names and rumor dialogue in this module are original Avelune adaptations of the supplied map, event text, and regional lore. Attached design documents remain reference material; the implemented service behavior follows the user’s request for a playable game with accessible healing, shopping, and party jobs.
