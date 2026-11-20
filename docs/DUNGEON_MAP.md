# Dungeon map

The preview uses a finite orthogonal Tiled map with 80 × 64 tiles at 32 × 32 pixels each. Its world bounds are 2560 × 2048 pixels. Phaser displays a 640 × 360 viewport.

| Room                                    | Placement    | Connection and landmarks                                                                                                                              |
| --------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `room_a` · Forsaken Entrance            | Upper left   | Spawn under the north arch, pillars, west alcove, and a lava pool along the southwest wall                                                            |
| `room_b` · Molten Guard Chamber         | Upper right  | The eastbound corridor from the entrance turns south twice. A four-tile-long, two-tile-wide stone bridge joins the banks of the eastern lava channel. |
| `room_c` · Sanctuary of the Azure Flame | Lower center | The southbound corridor from the entrance turns east, then south. The cyan shrine faces an accessible rune floor above the southern lava pools.       |

The canonical map is [obsidian-dungeon.tmj](../apps/web/public/assets/dungeon/obsidian-dungeon.tmj). Layer order runs from `Ground` through `Overhead`. `LavaEdges` adds transparent shoreline art. `ObjectZones` carries world-space rectangles with stable Tiled numeric IDs and names. The room objects carry display titles and camera focus coordinates.

Key regions include `player_spawn`, `monster_patrol_zone`, `bridge`, `mana_shrine`, `mana_restoration_zone`, and `shrine_safe_area`. Three `hiding_*` regions mark dim walkable alcoves next to sight-blocking cover. The `lava_*` rectangles cover named parts of the lava channels. The `entrance_to_*` connection segments carry `from`, `to`, and `segment` properties.

The engine-independent query reports safe walkability, solid collision, hazard, and line-of-sight obstruction separately. The shrine pedestal is solid. Its adjacent restoration and safe zones use regular walkable floor. Lava is hazardous and leaves the solid flag clear. The bridge uses walkable stone tiles with lava immediately to its north and south. Unit tests flood-fill the actual map from spawn and verify that the bridge connects both banks.

## Editing in Tiled

Online runs load [obsidian-combat.tmj](../apps/web/public/assets/dungeon/obsidian-combat.tmj). The original three rooms and their geometry are preserved. The variant adds encounter and spawn zones, the Sanctuary gate, and the isolated arena with safe arrival slots and teleport anchors. Generate the variant with `node tools/dungeon/generate.mjs --combat`.

Open the `.tmj` file directly. Use the embedded atlas, keep all tile layers aligned with the map origin, and save tile data as a JSON array rather than base64 or chunked data. Mark new terrain via the embedded tile's `terrain` and `blocksSight` properties. Keep zone names and numeric IDs unique and preserve IDs already used by code. To add a room, paint the room and its corridor, place a `room` rectangle with a title and world-pixel camera point, then extend the connectivity test.

## Five-zone expedition

The five-zone expedition uses the five section maps beside the classic maps. Floors, obstacles, warning footprints, combat regions, interactive mechanisms, concealed passages and destination slots are Tiled data. Edit individual section files in Tiled and run `node tools/dungeon/expedition.mjs --pack` to regenerate the shared runtime map. The seeded procedural source can also regenerate all five sections. The full catalog, adjacency and gate conditions appear in [the expedition report](milestone-6.md).
