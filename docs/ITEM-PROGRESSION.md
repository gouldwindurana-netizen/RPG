# Expanded consumables

The item catalog keeps the six original IDs and adds eight consumables with distinct recovery, protection, escape or elemental roles. It does not sell cures for status effects the game does not implement. Item inventory remains shared by the recruited party, with a 99-copy limit and half-price resale.

| Stock tier | Added role | Item | Price |
| --- | --- | --- | ---: |
| 1 | Reliable ordinary-encounter escape | Smoke bomb | 100 G |
| 1 | Single-target ember damage without a caster | Ember bomb | 80 G |
| 2 | Party recovery that preserves fallen allies | Morning dew, 60 HP per living ally | 150 G |
| 2 | Temporary damage reduction | Ward tonic, 20% for three rounds | 90 G |
| 2 | Single-target frost damage | Frost shard | 80 G |
| 3 | Larger mana recovery | High ether, 60 MP | 180 G |
| 3 | Group elemental damage | Storm orb | 140 G |
| 5 | Expensive full recovery for one living ally | Hearth elixir | 600 G |

Potion, Ether, Dawn feather and Tent remain early stock. High potion and Cottage kit become tier-two stock. Later shops and restored trade routes make stronger supplies available; selling already-owned supplies stays available in earlier towns.

The prices are original balance choices. Throwing items support physical parties without replacing spell progression: they consume gold and inventory while spells consume renewable MP. Ward tonic lasts several rounds and has a smaller reduction than guarding. Smoke bombs cannot bypass guardians. Full recovery is costly and never revives a fallen companion; the clinic and Dawn feather retain that role.

`src/item-catalog.js` contains immutable metadata. The combat engine must validate the use context and targets before consuming a copy, cap recovery to actual deficits, preserve fallen allies for ordinary healing, and apply an area item only once per selected command. The same catalog feeds field inventory and shop descriptions so effect values do not diverge between menus.
