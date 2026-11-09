# Classic RPG interface

The interface uses an original window design inspired by classic Final Fantasy and Dragon Quest menus: cobalt blue, ivory double borders, pixel text and a decorative triangular cursor. It uses the existing Avelune artwork and gameplay.

Exploration places a command window beside a party status table. Status, Items, Atlas, Journal, Magic and Town retain their keyboard shortcuts. Each party row displays its job, level, HP and current/max MP with a blue mana bar. Low HP and fallen companions have distinct text colors. On small screens the same information becomes four compact status blocks with full-width command rows below.

Battles place commands to the left of party status, with enemy choices above and a message window below. Longer spell, item and targeting menus expand across the lower console on phones. The pixel battlefield keeps integer scaling. Shops and inns share framed selection lists, aligned prices, flat command tabs and the same cursor treatment. Status, equipment, spell preparation, journals, dialogue and the title screen share the window palette.

Arrow keys move focus through open menus; Enter activates a focused command and Escape closes the window. Walking remains available with arrows or WASD when menus close. Native select controls keep their normal keyboard behavior. Cursors use empty CSS shapes so screen readers receive the actual command name. Touch controls and primary menu actions use at least 44px targets.

`npm run test:ui` checks title, exploration, status/jobs, purchases, field casting and battle commands at 1440×1000, 1280×900, 390×844 and 320×724. It verifies numeric status, modal focus, world input isolation, responsive bounds, touch sizes, integer battlefield pixels, spell targeting and browser/resource errors, and captures screenshots for visual inspection. The existing gameplay, services and travel browser suites remain the regression checks for transactions, combat, saves and overworld entry.

Final verification on 8 November 2026 passed 71 Node tests and all browser groups: 13 interface, 17 gameplay, 13 services and eight travel. Screenshot inspection found no material layout issues across the four tested sizes; Chromium reported no page errors or missing resources. The offline game/source archive also passed its integrity check.

Source responsibilities: `style.css` owns the shared theme, exploration and generic menus; `services.css` owns merchant and preparation windows; `battle.css` owns the combat console. `app.js`, `services-ui.js` and `battle-ui.js` contain the corresponding DOM presentation. The later mana, starting-job and town-geography changes are documented in PARTY-MANA-GEOGRAPHY.md.
