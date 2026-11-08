# Avelune runtime art

The playable game uses the user's supplied Avelune artwork and original additions created for this adaptation. It includes no Final Fantasy artwork, music, maps, characters, or logos.

The visual direction borrows the readable silhouettes, crisp nearest-neighbor pixels, limited palettes, distinct role colors, separate battle presentation, and restrained ornament of classic console RPGs. It is a classic-inspired Avelune adaptation rather than a pixel-exact recreation of a particular Final Fantasy release.

## Source provenance

- **Avelune_World_Layout_Source.zip** provides the 284-frame scene atlas, all 108 ground maps, the world chart, scene geometry, and original asset provenance in `data/asset_origins.json`.
- **Avelune_Animation_Assets.zip** provides the Roadkeeper walk cycle and related animation source. The equivalent runtime animation atlas and metadata packaged in World Layout Source are used to preserve frame anchors.
- **The_Road_Beyond_the_World_Revised_Package (1).zip** provides the original cast, places, enemies, and narrative context; the campaign implementation adapts that content.
- **Avelune_World_Location_Assets.zip**, **Avelune_Style_References_Rev13.zip**, and **Avelune_Expanded_Art_Pack.zip** could not be transferred because each exceeds the file tool's 32 MiB limit. Existing derivatives present inside the accessible World Layout Source archive remain available; no claim is made to have inspected the inaccessible archives.

The original files are preserved outside the game directory in the extracted source archive. User-supplied provenance is retained as attribution information; this task does not independently establish third-party redistribution licenses.

## New artwork

`public/assets/landscape.webp` is a newly generated original Avelune pixel landscape. Its orchard, bridge, distant ivory city, lavender ring and seven stars were specified for this project. Image generation produced `/workspace/generated_images/exec-5b64d136-fe1c-4fb5-a842-9ba027dff3ac.png`; the runtime image is a 768×512, 64-color optimized derivative. The prompt requested classic early console RPG aesthetics and explicitly excluded any existing Final Fantasy location, character, logo or asset.

`src/enemy-art.js` defines thirteen original hand-authored 32×32 pixel creatures: slime, wolf, wisp, guardian, serpent, moth, crown, boar, crow, crab, plant, bell and star. Their shapes are constructed from pixel rectangles and ellipses with shared dark outlines and a 16-color palette. The function `drawAveluneEnemy(ctx,key,x,y,scale)` uses a bottom-center anchor; aliases map broad enemy families to these visual archetypes. Multiple named enemies can therefore share a silhouette.

Hero portraits are cropped from the supplied party sprites. `party_roadkeeper.png`, `party_mara.png`, `party_iven.png`, and `party_sella.png` are 48×48 transparent images with feet at logical y=44.

## Reproducible optimization

Run `node tools/assets.mjs` with `AVELUNE_SOURCE` pointing to the extracted `Avelune_World_Layout_Project` directory and optionally `AVELUNE_LANDSCAPE` pointing to the original generated landscape. The defaults match this build workspace.

The script retains every runtime asset key and every ground-map dimension. It:

1. Crops and resizes individual sprites using nearest-neighbor sampling, with a 64-pixel maximum dimension and 40 pixels for party sprites.
2. Converts soft source alpha to exact transparent or opaque pixels, and repacks all 284 frames with three-pixel transparent gutters.
3. Reduces individual sprite palettes before packing into a shared 96-color PNG atlas.
4. Uses two-pixel ground detail and 24-color palettes while preserving the original map dimensions and all collision geometry.
5. Preserves all animation rectangles, anchors, periods and clip names; optimizes their atlas to 48 colors.
6. Resizes the world chart to 1152×768 and compresses it as WebP.
7. Writes the complete runtime manifest to `src/art.json`.

For the original runtime atlas, all grounds, animation atlas and world chart, image files fell from **11,757,262 bytes to 2,357,878 bytes**, a **79.95% reduction**. The newly generated landscape and four hero crops are additions and are excluded from this like-for-like comparison. See `asset-metrics.json` for machine-readable measurements.

Validation checked 284 sprite rectangles against atlas bounds, exact transparent gutters, binary alpha, and all 108 ground-image dimensions. `asset-validation.json` records zero errors. Visual inspection covered the packed atlas, hero crop and new landscape. Browser-level composition and playfield readability are covered by the main playtest report.

## Cohesion polish

The active field now uses `src/pixel-art.js` and `src/terrain.js`, an original shared pixel vocabulary based on the supplied Avelune locations, fixtures, silhouettes and stable asset IDs. The earlier source atlas and baked grounds remain in the editable asset library; they are no longer mixed into the live field. All 284 keys have deliberate semantic renderers. Terrain and scenery use matching color ramps and integer coordinates.

Field and battle characters share the same fixed 16×24 source. Idle uses the neutral walking stance, with a common bottom-center anchor; only arm/leg clusters alternate. `classic-roadkeeper.png`, `classic-mara.png`, `classic-iven.png` and `classic-sella.png` are menu portraits rendered from this exact source. `classic-roadkeeper-walk.png` provides a four-direction, four-pose contact sheet. Run `npm run art:classic` to regenerate them.

The previous image-byte reduction figures describe the original asset optimization, not a new GPU or frame-rate benchmark. The current field also avoids loading the legacy raster atlas/ground textures and caches at most six generated grounds.
