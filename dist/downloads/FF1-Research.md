# Final Fantasy I research and Avelune implementation brief

Research date: 7 November 2026. Retrieved with the requested Firecrawl plugin. This is a design synthesis for an original game, not a reproduction of Final Fantasy maps, writing, graphics, audio, or data tables.

## Recommended reference version

Use **the NES game's expedition structure and four-character command rounds, with the clarity and convenience of modern remakes**. Final Fantasy I is not one mechanically identical release. The NES version has tiered spell charges and many documented bugs; Dawn of Souls (GBA) and the PSP lineage use a shared MP pool; Pixel Remaster returns to spell charges and combines elements from different versions. Redirecting attacks from already defeated targets became an option in WonderSwan/Origins and is mandatory in Dawn of Souls. [Version comparison](https://finalfantasy.fandom.com/wiki/Final_Fantasy_version_differences)

Recommended product language: “An original Avelune adventure inspired by classic 8-bit party RPGs.” Do not present the result as an exact FF1 simulation.

## Combat: what defines the original

- **Four adventurers, persistent roles.** The player chooses four characters from six initial classes. This is not FFIII's freely interchangeable job system. Each class trades physical damage, durability, equipment access, offensive spells, healing, and cost efficiency. Optional later class promotion expands possibilities. The official modern starter article describes six roles and multiple viable party combinations. [Square Enix starter tips](https://www.square-enix-games.com/en_US/news/final-fantasy-pixel-remaster-starter-tips)
- **Plan a whole round, then watch it resolve.** Enter one order per character before any actions execute. The original commands are Fight, Magic, Drink, Item, and Run. Fight selects a monster; magic can target an enemy, all enemies, or an ally depending on the spell. Items consume the character's action. The battle ends in victory, a party wipe, or successful escape. Victory awards gold and experience. [Original Explorer's Handbook, printed pp. 18–19](https://www.nintendo.co.jp/clv/manuals/en/pdf/CLV-P-NABJE.pdf)
- **Order is uncertain.** On NES, the technical guide describes shuffling slots for nine possible enemies and four heroes. Agility does not determine NES action order. Any speed-based initiative in an inspired game should be documented as its own rule, not a literal NES mechanic. [AstralEsper mechanics guide, Turn Order](https://gamefaqs.gamespot.com/nes/522595-final-fantasy/faqs/57009)
- **Party order is defensive strategy.** The manual tells the player that the front character is most exposed. The NES technical explanation gives single-target enemy selection shares of 50%, 25%, 12.5%, and 12.5%. This gives a durable front character an important role without requiring a spatial battle grid. [Manual, printed p. 17](https://www.nintendo.co.jp/clv/manuals/en/pdf/CLV-P-NABJE.pdf); [Gamer Corner systems](https://guides.gamercorner.net/ff/walkthrough/game-systems)
- **Physical attacks develop into multiple hits.** Strength/weapon attack, accuracy, armor absorb, evasion, and criticals contribute to attacks. NES accuracy also raises the number of possible hits. This can make weapon decisions more meaningful than a single power number. [Gamer Corner systems](https://guides.gamercorner.net/ff/walkthrough/game-systems)
- **Magic is a limited expedition resource.** White magic emphasizes healing/protection; black magic damage/control. The original allows up to three learned spells at each tier and tracks remaining casts per tier. Spell tier and character level are different concepts. Inns restore HP and charges. [Manual, printed pp. 13–15, 19–20](https://www.nintendo.co.jp/clv/manuals/en/pdf/CLV-P-NABJE.pdf)
- **Elemental and status counters matter.** Weaknesses, resistances, poison, paralysis, sleep, and other ailments alter which actions are sensible. An armored enemy may encourage magic; an enemy with high magic defense may encourage physical attacks or buffs. [Gamer Corner systems](https://guides.gamercorner.net/ff/walkthrough/game-systems)
- **Do not carry over accidental bugs.** Intelligence doing nothing on NES, malfunctioning weapon properties, wrong critical rates, and several spell defects are documented. An inspired game should make visible stats work and avoid failing attacks just because an earlier ally defeated their target. [Gamer Corner systems](https://guides.gamercorner.net/ff/walkthrough/game-systems); [version comparison](https://finalfantasy.fandom.com/wiki/Final_Fantasy_version_differences)

### Concrete compact combat adaptation

These values and features are **design recommendations**, not FF1 data.

1. Use four supplied Avelune characters as durable defender, nimble attacker, offensive caster, and healer. Start them equipped so the first battle is understandable.
2. Commands: Attack, Spell, Guard, Item; party Flee. Guard is an explicit quality-of-life addition for conservation and telegraphed attacks.
3. Select each living hero's order, show a small queued-command summary, then execute the round. Cancel/back must permit correcting an order before commitment.
4. Use initiative = speed plus a small random roll, or a shuffled queue. Document whichever is implemented.
5. Use simple readable damage: attack minus a portion of defense, modest variance, minimum one; spell power with 1.5× weakness and 0.5× resistance. Use wholly original values.
6. Keep early spells distinct: single-target fire, lightning against aquatic/metal foes, group damage, single heal, party ward, revive. Have two charge tiers if a short campaign cannot justify eight.
7. Automatically retarget when the chosen monster is already defeated. Consume spell charges or items only when the action actually resolves; skip defeated actors.
8. Favor 2–4 foes in routine battles. Telegraph bosses with a readable next-turn intent so Guard and healing become decisions.
9. Preserve HP and spell charges between encounters. Award gold and XP, show level changes, then restore exploration exactly where it stopped.
10. Party wipe should offer retry/return to the last haven, never silently erase progress. Avoid grind prerequisites in a short browser campaign.

## Encounters: what creates the journey

FF1 combines **random walking encounters**, **regional formations**, **fixed dangerous tiles**, and **one-time sprite-initiated bosses**. The NES technical guide documents eight encounter slots per domain, with common and rare formations. It also documents fixed encounters on “spiked” tiles and bosses triggered by talking to sprites. It explicitly flags the precise encounter-frequency description for further investigation, so that section should not be treated as definitive proof of a universal step formula across releases. [AstralEsper guide, Encounters/Formations](https://gamefaqs.gamespot.com/nes/522595-final-fantasy/faqs/57009)

Towns and services separate preparation from hostile travel. The manual emphasizes outfitting, healing, learning from inhabitants, and being prepared before a dungeon. Its command system makes a battle's resource cost matter beyond the fight itself. [Manual, printed pp. 9–20](https://www.nintendo.co.jp/clv/manuals/en/pdf/CLV-P-NABJE.pdf)

### Concrete compact encounter adaptation

These are new Avelune design rules:

- Increment danger only after a **successful tile movement** in hostile terrain, not every rendered frame or blocked input.
- Safe havens and marked roads do not trigger encounters. Forest, marsh, ruins, and deep dungeon tiles raise danger at different rates.
- Select the next trigger from a bounded interval, for example 14–24 hostile steps, then grant at least six protected steps after battle. Tune to actual map dimensions.
- Show a subtle danger gauge with text such as Calm / Uneasy / Threat nearby. This preserves uncertainty while making it legible.
- Define a weighted encounter pool for each region, with a common pair, a mixed formation, a dangerous rare formation, and region-specific weakness.
- De-duplicate one-time boss, chest, and quest encounters with persistent flags.
- Keep travel dangerous enough that inn/shop/camping matter, but avoid fights immediately after loading, dialogue, a boss victory, or entering a safe town.
- Test encounter movement accounting at different frame rates; diagonal input must not count twice.

## Whole-game structure

### The actual FF1 arc

1. **Local introduction:** begin near a town/castle, obtain an objective, buy gear and spells, learn combat nearby, then clear an introductory boss.
2. **First world expansion:** that victory opens a bridge. A later local conflict grants a ship.
3. **A key-item chain opens the broader sea:** several NPC problems and dungeon items lead to a key and an alteration of the geography.
4. **Elemental restoration:** increasingly dangerous dungeons and their bosses renew four elemental powers.
5. **New movement tools:** canoe and then airship transform which parts of the same world are accessible. A voluntary trial allows class promotion.
6. **Late knowledge and access gates:** items and translation/knowledge unlock final regions.
7. **Return and culmination:** the final route revisits an early location with new context, followed by the finale. [RPG Site complete walkthrough](https://www.rpgsite.net/feature/11508-final-fantasy-1-walkthrough-where-to-go-dungeon-maps-ff1-step-by-step-guide)

The reusable design principle is **progression that changes what a familiar map means**: a blocked route becomes a promise, and a later reward lets the party reach it. Town NPCs communicate directions and problems. Optional treasure paths trade increased exposure to encounters for better equipment. Consumables, spells, and equipment compete for gold, while inns are recovery anchors. [Original manual](https://www.nintendo.co.jp/clv/manuals/en/pdf/CLV-P-NABJE.pdf); [RPG Site walkthrough](https://www.rpgsite.net/feature/11508-final-fantasy-1-walkthrough-where-to-go-dungeon-maps-ff1-step-by-step-guide)

### Avelune-sized complete arc

Use the story, names, landmarks, and routes found in the supplied Avelune package; this structure is a recommendation rather than a replacement for that material.

- A clear opening objective in a safe settlement.
- An explorable overworld with connected roads, readable terrain, one visible blocked route, treasures, and named destinations.
- A first dungeon whose guardian opens a bridge or pass.
- A second region with stronger equipment/spells and a contrasting enemy pool.
- A second dungeon providing a travel relic.
- An optional shrine/trial providing a meaningful upgrade.
- A final region reached with that relic; final boss and explicit ending.
- Journal entries update after each milestone so a player who returns later knows the next destination.
- A title screen, continue/new game, keyboard and touch controls, audio settings, a pause menu, save handling, and ending/replay path complete the game loop.

For a small deliverable, three substantial regions and a finishable 30–60 minute arc communicate the original's structure better than a sprawling map with unfinished systems. The final documentation must state the implemented scope rather than imply a full commercial-length FF1 replacement.

## Visual direction and polish

The official interview with original artist and Pixel Remaster art director Kazuko Shibuya describes beginning with the illustration's defining characteristics and then placing pixels deliberately. It also distinguishes maintaining each original game's spirit within a unified remaster style. This supports **preserving the Avelune characters' identifying shapes while translating them into a coherent pixel vocabulary**, rather than merely blurring or reducing a finished illustration. [Square Enix interview](https://www.square-enix-games.com/en_US/news/final-fantasy-pixel-remaster-kazuko-shibuya)

Recommended visual rules (original design choices):

- Top-down orthogonal tiles, limited color ramps, clear coast/forest/mountain boundaries, crisp nearest-neighbor scaling.
- Small, readable overworld character silhouettes with visible walk cycles; larger battle portraits/sprites derived from supplied art.
- Enemy group on the left, party on the right, lower command and status panes. Deep navy panels, ivory borders/text, restrained warm gold accents and cool magic colors.
- Distinct regional palettes: warm meadow/settlement, desaturated moss forest, slate ruins, blue/cyan magical finale.
- Avoid mixing photographic textures, smooth modern vectors, and inconsistent pixel densities in the live playfield.
- Optimize shipping assets independently from archive sources: only referenced runtime files, transparent sprite crops, sensible display sizes, deduplicated atlases, metadata and licenses preserved, no unnecessary full-resolution contact sheets.
- High-contrast HP/charge indicators, target highlights, readable action text, short impact flashes, state-specific battle sounds, and a victory cue.
- Mute and reduced-motion support; animation should reinforce state, not delay every input.
- No FF character sprites, logos, maps, compositions, or soundtrack files are needed for this direction.

## Testing checklist linked to the research

- Can a fresh player reach the first town objective and first battle without outside instructions?
- Does each living hero act at most once per round? Are fallen heroes skipped?
- Do target changes, canceled selections, depleted charges, failed escape, victory, and defeat remain legal?
- Does an encounter arise only from actual hostile movement, and does it resume the correct map?
- Are towns truly safe? Are bosses/chests one-time and durable across save/reload?
- Does the resource economy allow the entire critical path without grinding or a permanent softlock?
- Do travel gates open only after their reward and remain open after reloading?
- Can every required location be reached, and can the game reach a visible ending?
- Are sprites crisp at supported screen sizes, command text readable, and touch controls usable?
- Does missing/corrupt save data recover gracefully?

## Sources and evidence limits

1. **Nintendo-hosted Final Fantasy Explorer's Handbook (NES)** — primary contemporary source for UI, command-round flow, magic learning, stores, equipment, inns, and travel. Firecrawl retrieved the first **32 of 89 PDF pages**; cited printed pages 9–20 are within that coverage. The manual's statement that escape depends on agility should not be used as the actual NES formula; reverse-engineering sources document bugs.
   https://www.nintendo.co.jp/clv/manuals/en/pdf/CLV-P-NABJE.pdf
2. **Square Enix, starter tips** — official class identities and party composition; it also discusses FFII and FFIII, which were kept separate in this report.
   https://www.square-enix-games.com/en_US/news/final-fantasy-pixel-remaster-starter-tips
3. **AstralEsper/Jeanne Mevnais, Game Mechanics Guide** — specialist NES technical reference, including explicit caveats on encounter frequency and known bugs. It is not assumed to describe every remake.
   https://gamefaqs.gamespot.com/nes/522595-final-fantasy/faqs/57009
4. **Gamer Corner Guides, Game Systems** — independent readable explanation of NES physical attacks, party targeting, magic, and bugs.
   https://guides.gamercorner.net/ff/walkthrough/game-systems
5. **RPG Site, full progression walkthrough** — route, world expansion, movement tools, services, dungeon structure, class promotion, and finale.
   https://www.rpgsite.net/feature/11508-final-fantasy-1-walkthrough-where-to-go-dungeon-maps-ff1-step-by-step-guide
6. **Final Fantasy Wiki, version differences** — community-maintained comparison used for GBA/PSP MP vs charge-system and targeting distinctions.
   https://finalfantasy.fandom.com/wiki/Final_Fantasy_version_differences
7. **Square Enix interview with Kazuko Shibuya** — primary artistic process and remaster philosophy.
   https://www.square-enix-games.com/en_US/news/final-fantasy-pixel-remaster-kazuko-shibuya

Coverage: combat, encounter families, roles/progression, world gates, towns/economy, magic, overall campaign structure, and visual adaptation. This is not an exhaustive reverse engineering of every release or every numeric battle formula. Recommendations are deliberately separate from sourced historical observations.
