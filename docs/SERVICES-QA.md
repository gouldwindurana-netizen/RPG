# Town and preparation verification

The service update makes recovery and shopping explicit in the world and UI, rather than requiring knowledge of the old Haven button. All 18 town/village/port/market hubs expose seven distinct, signed interactions; refuges and named interiors bring service coverage to 37 safe areas. The world route, collision geometry, 91 events, jobs, ending and postgame are preserved.

## Implemented preparation loop

- Inn confirmation displays the fee and restores standing allies' HP and charges. Fallen members remain fallen.
- Paid clinics revive one fallen hero at 1 HP; rest afterwards. Brackenwell's wayside care, Wyla's cottage and refuges provide a zero-gold full-recovery fallback.
- Item counters buy/sell selected quantities, show stock, and reject unaffordable or overflowing purchases.
- Thirty named weapons/armor pieces support shared ownership, proficiency, accurate stat previews, equip/unequip, and selling only unworn copies. Old rank investments remain intact.
- Eight new spells can be learned permanently by eligible heroes. Job-specific custom preparations contain up to three spells per tier. Existing starter spellbooks remain compatible with old journals.
- Field healing, group healing and revival spend charges only when they affect a valid target. Potions, high potions, Ethers and Dawn feathers retain their advertised effects.
- Tents and cottage kits recover living allies outdoors or at designated camps; they cannot revive. Invalid uses do not consume supplies.
- Formation changes front-rank exposure and the visible field leader. Promotion requires the Alderreach Hearth, level 5 and 120 G; its stat/charge capacity increase persists without free healing.
- Manual save, autosave and export/import preserve named gear, spell purchases/loadouts, formation, promotions, inventory and original story flags.

## Checks run

`npm test` passes 56 tests, including 14 preparation and eight town-service tests. They cover transactional failures, worn-copy accounting, proficiency/job switching, field spell resources, inn/clinic distinctions, camp restrictions, promotion, save migration, reachable/non-overlapping service placements, story priority and progress-based stock. The full campaign route and tested physical/magical party compositions still finish.

`npm run test:browser` passes the 17 existing navigation/combat/job/save/mobile checks, adapted to enter the new town directory and inn confirmation.

`npm run test:services` passes 12 integrated Chromium groups. It starts from the actual new-game UI, walks to the inn and provisions counters, confirms recovery, performs bulk buy/sell and gear transactions, learns/prepares a spell, heals in the field, revives through a paid clinic, recovers a penniless party, advances/reorders/saves/reloads, and uses a tent. The checks include 390px and 320px touch layouts and reject browser errors or failed resources. Fixtures supply HP/resource conditions for isolated later scenarios; these checks do not claim human campaign playtime.

`npm run test:visual` again renders all 108 areas and 64 character pose combinations, checks integer scaling indoors/outdoors, and verifies mobile HUD separation. No visual or resource errors occurred.

Status ailments/cures, eight-tier NES magic, exact NES price/inventory tables and every remake feature are not part of this update. The implemented loop is an original FF1-inspired Avelune adaptation, with modern free-recovery and save conveniences. The source-backed reference distinctions are recorded in `FF1-SERVICES-GAP.md`.

Independent integration review reproduced a stale merchant-route action when the player switched to Follow marker or clicked another destination. Both overrides now cancel the pending merchant action; the integrated browser suite covers reaching the story marker without opening a remote shop. Physical E interaction at a vendor and selling owned later-tier supplies in the starting town were also checked.
