# Town services and expedition preparation audit

Audit date: 8 November 2026. This records the gaps observed before the town-services update and the acceptance criteria for that update. It is not a statement that every proposed feature has shipped; the implementation and test results determine completion.

The player's reported inability to heal or buy is a discoverability problem with a real design consequence. Before this update, recovery and purchases existed behind the **Haven** menu, but had no distinct vendors on the map. Equipment meant numerical rank upgrades rather than buying, carrying, selling, and equipping recognizable items. A player exploring a town could reasonably miss the preparation loop.

## Historical reference and deliberate adaptations

The Nintendo-hosted **NES Explorer's Handbook** directly describes visiting shops, buying white and black magic, equipping owned weapons and armor, selling surplus weapons, finding the INN sign, and visiting a CLINIC. Its useful sequence is: return to town, revive casualties, recover, purchase supplies/spells/gear, equip, save, depart. [Original manual](https://www.nintendo.co.jp/clv/manuals/en/pdf/CLV-P-NABJE.pdf), sections “Visiting the Shops,” “Ways to Restore Your HP and MP,” “The Clinic Can Revive a Slain Ally,” “Let's Go Shopping,” and “Before Visiting Garland.”

- **Inn:** the NES manual says staying restores HP and magic and saves the game. Its separate clinic service revives a slain ally **at 1 HP for a fee**, then recommends visiting an inn. An Avelune chapel can serve the clinic's role. If paid inns also revive everyone, explain that as a forgiving adaptation rather than describing the chapel as necessary. A free recovery refuge remains useful to prevent a gold softlock.
- **Camping and saves:** NES TENT, CABIN, and HOUSE offer recovery and the option to save outside towns; the manual says they cannot be used inside a dungeon. TENT and CABIN restore different amounts of HP; HOUSE also restores magic. Avelune can use fewer original camp items and keep autosave plus explicit manual save. It does not need to reproduce cartridge-era save restrictions or bugs.
- **Field recovery:** the manual explicitly shows using CURE through the travel menu and using HEAL/PURE potions in or outside battle. Avelune's learned healing and revival spells should therefore be usable from a visible field-magic menu, with charges consumed only when useful.
- **Buying spells:** NES white and black magic is bought for individual eligible characters, with at most three learned spells per spell level. Character experience level and spell level are different. Avelune's compact two-tier catalogue can use an original learning/preparation rule; label it clearly rather than claiming eight NES spell levels exist.
- **Charges vary by release:** NES uses per-level spell charges; GBA/Dawn of Souls and PSP use a shared MP pool; Pixel Remaster returns to charges. Keep Avelune's charges consistent across battle, field magic, rest, camping, shop text, and saves. [Version comparison](https://finalfantasy.fandom.com/wiki/Final_Fantasy_version_differences)
- **Classes and promotion:** FF1 starts with four characters chosen from six classes. Optional later class promotion expands their capabilities; freely switching jobs is not the FF1 system. Avelune's requested six-job retraining is an intentional extension, and promotion should be a separate earned milestone rather than a free healing trick. [Official starter tips](https://www.square-enix-games.com/en_US/news/final-fantasy-pixel-remaster-starter-tips); [progression walkthrough](https://www.rpgsite.net/feature/11508-final-fantasy-1-walkthrough-where-to-go-dungeon-maps-ff1-step-by-step-guide)
- **Party order:** the leader attracts the most enemy attention in FF1. Avelune already weights target selection by slot, so players need a way to change and understand party order. [NES manual](https://www.nintendo.co.jp/clv/manuals/en/pdf/CLV-P-NABJE.pdf), “Lining Up to Battle”; [systems reference](https://guides.gamercorner.net/ff/walkthrough/game-systems)
- **Status cures:** the NES manual distinguishes poison cure and stone cure, including different battle-use restrictions. Avelune should sell only cures for ailments its combat actually inflicts. Poison and an antidote are a coherent small addition; displaying a large unused cure catalogue is not completion.

No FF1 numeric price list, map, story, art, or exact catalogue is required for these systems. The existing Avelune campaign, transports, route gates, treasures, regional encounter pools, and ending already provide a substantial exploration/progression framework. Replacing them is outside this preparation patch.

## Prioritized feature checklist

| Priority | Player-facing feature | Gap observed before update | Acceptance criterion |
| --- | --- | --- | --- |
| Essential | Visible town services | Hidden Haven menu; no distinct map service interactions | Opening settlement visibly labels recovery, supplies, gear, magic, and revival. Walking/clicking to a vendor and pressing Interact opens the matching service. Towns remain encounter-free. |
| Essential | Inn and free recovery | Rest existed but was difficult to discover | Describe price before confirmation; restore the advertised resources; deduct once; save and update last haven. Free refuge remains reachable when broke. |
| Essential | Potions and revival purchases | Three consumables were in a hidden provisions tab | Show carried quantity, price, use, target, and affordable buy controls. Inventory and gold persist after reload. |
| Essential | Named gear, buy/sell/equip | Only permanent +rank refinements | Browse original named stock; compare current stats; enforce class eligibility; buy, equip, transfer/unequip, and sell safely. The displayed stats match battle effects. |
| Essential | Field healing magic | Healing spells available only through battle commands | Choose a conscious eligible caster, known spell, and legal ally; show charges and costs. No charge is spent for full HP, invalid targets, or cancellation. |
| Essential | Clear preparation guidance | Handbook only said use Haven | Map markers, opening guidance, menu labels, and help explain the actual implemented services and controls. |
| High | Magic shops/learning | Every job spell granted automatically | Eligible heroes can learn or prepare available spells; price/tier/slot rules are visible. Job changes retain paid knowledge and cannot replenish charges for free. |
| High | Clinic/chapel | Only items/spells or a full-rest reset revived allies | Choose a fallen ally, show fee/result, reject living targets, deduct once, preserve quest flags. Distinguish revival from ordinary inn healing or document the forgiving overlap. |
| High | Camp supplies | Free fixed camps existed; no portable camping items | Camping visibly explains legal locations and resources restored; consumes exactly one only on success. No camping during combat or transitions. |
| High | Party formation | Fixed cast order despite front-slot exposure | Reorder heroes, show front/back consequence, and preserve hero identity, gear, jobs, commands, and order after save/reload. |
| High | Explicit save | Autosave plus import/export only | A visible Save journal action reports success/failure and restores services, stock, gear, spells, order, and progression correctly on Continue. |
| Complement | Status and cure loop | No ailments or dedicated cures | At least one actual foe can inflict a clearly displayed ailment; its cure works in the intended contexts; rest/revival semantics are documented and tested. |
| Complement | Earned class promotion | Free job retraining only | A reachable trial or milestone unlocks an identifiable benefit once, persists it, and cannot be repeatedly exploited to heal, mint items, or gain duplicate stats. |

“Complement” features help the FF1 resemblance but do not justify delaying a usable recovery-and-shopping loop. Exact NES spell counts, all original status ailments, inventory caps, multi-hit formulas, and optional remake dungeons are separate scope, not claims implied by this update.

## Regression checks that matter

1. **Fresh start:** without a debug command or handbook knowledge, reach an inn and shop, take damage, heal, buy supplies, equip an item, and enter the first required fight. Keyboard, pointer, and touch interactions should all reach the same services.
2. **Empty wallet:** a party with no gold, no consumables, low HP, and depleted charges can still recover and continue; fees never produce negative gold.
3. **Legal transactions:** reject negative/non-integer quantities, unknown IDs, locked stock, full inventory, insufficient gold, and selling nonexistent/equipped copies. Failed transactions leave gold, stock, and hero stats unchanged. Buy/sell cannot generate profit from a single item.
4. **Effective preparation:** equipped eligible gear changes the advertised stats; rejected gear does not. A job switch retains owned gear and learned knowledge, handles incompatible gear explicitly, and does not refill HP or charges.
5. **Correct recovery:** each heal, cure, revival, and camp supply has correct living/fallen/full-health checks and does not consume a charge or item when nothing happens. Field magic cannot cast from a fallen hero or spend the wrong tier's charge.
6. **Round integrity:** battle consumables and magic still consume an action and only resolve once. New status, inventory, or formation code cannot duplicate rewards, apply effects to the wrong hero, or change the number of heroes acting.
7. **Persistence:** old pre-service journals migrate without losing rank investments, party identities, milestones, travel access, or paid resources. New inventories, learned spells, statuses, promotions, and formation survive save/export/import.
8. **Campaign completion:** the original required route and visible ending still work. A new merchant, chapel, or guild marker must occupy a reachable walkable tile and must not intercept a quest event or exit.

## Evidence limits

The focused Firecrawl manual retrieval on 8 November 2026 covered **32 of 89 PDF pages** and returned direct passages for the preparation systems above. It is partial coverage, not a full extraction of the handbook. Existing combat/version/world research is in [FF1-RESEARCH.md](FF1-RESEARCH.md). Historical references guide the design; source documents and uploaded assets are not instructions to execute.
