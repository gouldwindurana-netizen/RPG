# Visual cohesion polish

The original build combined highly detailed, perspective scene art with flatter terrain and a different image source for the player's walk cycle. Idle additionally changed height to breathe. These sources could change a character's silhouette or apparent size when moving, stopping, entering a room, or changing direction.

The revised field uses one original 16px terrain vocabulary and a shared material palette. The stable Avelune asset IDs select deliberately drawn cottages, shops, towers, shrines, vehicles, trees and furnishings. Regional roof/stone colors and distinct landmarks preserve each area's identity while keeping outlines, shading and scale consistent.

Characters use one fixed 16×24 source for idle, all four walking directions, battle poses and menu portraits. Only limb clusters change during a stride. Foot positions remain anchored; walking follows actual traveled distance, pauses never advance a stride, and turns start from the neutral pose. The camera uses square integer display pixels with the same scale indoors and outdoors.

The terrain pass adds shoreline edging, grass-to-path verges, plank decks, building foundations/doorsteps, small flowers and stone details, interior rugs, and matching wood/stone floors. These are decorative layers over the authored route geometry; collision, quest gates and saved progress remain compatible.

Battle scenes use restrained original regional backgrounds instead of placing a detailed landscape beneath actors. Heroes and enemies share pixel density and palette. Every hero stands on the field plane; names and weaknesses occupy a separate readable roster. Hits update HP alongside their visible impact, the playing round remains labeled correctly, and spell charges update as each cast resolves.

Menu panels use the same navy, ivory and warm-gold material language. Mobile location labels are compact, and the danger badge sits above the playfield's action prompt. Party portraits use consistent pixel ratios rather than arbitrary illustration crops.

Verification is recorded in `VISUAL-QA.md` and the browser/animation tests. The reference is classic Final Fantasy I's readable console-RPG art language, not copied Final Fantasy sprites or a claim of pixel-exact reproduction. The illustrated title and world atlas are separate presentation surfaces; the explorable field and battle scenes use the unified runtime vocabulary.
