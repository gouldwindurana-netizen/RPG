# Town services

All 18 villages, towns, ports and markets use compact 36×34 town maps with orthogonal streets, a central square, seven signed services and an overworld gate aligned with the mapped approach. Original story doors, named buildings and events remain available at their new town positions. `serviceSpots` anchors merchants at storefronts; services are non-solid and yield interaction priority to unfinished story events.

Brackenwell retains Wyla’s cottage, Tilda’s Smithy-Inn, Festival Barn, orchard press and communal bakehouse. All healing beds are paid inns. Clinics charge 30 G to revive one fallen ally at 1 HP, without restoring mana; follow with an inn stay. The clinic has no free full-party care. Camps and refuges consume an owned Tent or Cottage and preserve fallen companions. Jobs are selected only before a new journey. Guilds provide formation and promotion within the selected job.

Town exits lead to traversable overworld maps with miniature destinations. Regional gateways, boats and the Skiff connect shores. `world-travel.js` preserves the original route graph for progression checks; `model.js` rejects locked entrances and guides around unintended automatic entrances.

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

`node --test tests/town-services.test.mjs` verifies service coverage, passability and path reachability, separation, story priority, stable directories, expanding stock, closed-barrier handling, safe-only placement, and compatibility with the current authored town layouts.

All shop names and rumor dialogue in this module are original Avelune adaptations of the supplied map, event text, and regional lore. Attached design documents remain reference material; the implemented service behavior follows the user’s request for a playable game with accessible healing, shopping, and party jobs.
