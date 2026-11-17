# blueprint3d editor patterns - research

- Question: How does blueprint3d-modern implement floorplan editing (wall drawing, corner dragging, snapping, opening placement), how does its model map to ours, and which patterns transfer or conflict with the shared-vertex geometry in `data/measurements.json`?
- Ticket: `docs/wayfinder/structure-editor-v1/01-blueprint3d-editor-patterns.md` (read-only, user checkout). Context: `docs/wayfinder/structure-editor-v1/map.md`.
- Date: 2026-11-17.
- External repo read: `charmlinn/blueprint3d-modern` at commit `f56f0b2a4a6e177181aefbf535d2945b937b5c02` (2026-05-22, "docs: add buy me a coffee button"), shallow clone. Nothing was installed, built or run.
- Local files compared (worktree branch `research/blueprint3d-editor-patterns`, base `2a9cc00`): `data/measurements.json`, `docs/geometry.md`, `docs/assumptions.md`, `AGENTS.md`, `GLOSSARY.md`, `src/apartment-model.ts`, `scripts/validate.mjs`, `src/scene.tsx`, `src/walk-motion.ts`.
- Citation forms: external `charmlinn/blueprint3d-modern@<sha>:<path>#L<a>-L<b>`; local `<path>:<line>` with repo-relative paths.
- Units: blueprint3d stores centimetres; `data/measurements.json` stores metres. Numbers below give both where it matters.
- Absence claims ("no setter", "never called", "no undo") come from text search over the clone, not from a call graph.

## Summary

- blueprint3d is a shared-vertex planar graph (corners with wall back-references) that auto-merges, auto-splits and recomputes rooms on every edit; that automation is the main thing that conflicts with our data.
- Two vertex pairs in `data/measurements.json` (I-J and K-L, 0.16 m apart) are inside blueprint3d's 0.20 m corner-merge radius, so the first edit of either pair would delete a real wall.
- Openings in blueprint3d are world-space 3D items that do not follow their wall when a corner moves; our wall-relative `offset` model is the stronger design and should stay.
- Room polygons are derived in blueprint3d and authored in ours; the living/kitchen open edge (D-U, no wall) cannot be expressed by a wall-derived room model without merging the two rooms.
- Worth borrowing is UI behaviour (chained draw, hover precedence, clamped opening placement, explicit snapping); worth skipping is the half-edge/miter/derived-room engine.

## 1. Data model

### 1.1 Corners and walls (shared vertices)

- A corner is a shared-vertex object that keeps lists of the walls starting and ending at it (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/corner.ts#L12-L17`).
- A wall attaches itself to both of its corners on construction (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/wall.ts#L66-L71`).
- Corner ids default to random GUIDs (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/corner.ts#L34-L41`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/core/utils.ts#L159-L166`).
- A wall's `id` is derived once from its corner ids and is not refreshed when its corners are replaced (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/wall.ts#L73-L75`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/wall.ts#L161-L173`).
- Walls have no persisted id; a saved wall is just a pair of corner ids plus textures (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/floorplan.ts#L225-L232`).
- Each wall has its own `thickness` and `height` fields, initialised from one global configuration (default 10 cm thick, 250 cm high) (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/wall.ts#L46-L50`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/core/configuration.ts#L25-L29`).
- No assignment to these fields appears in `src/` or `app/` after construction (text search); the README lists per-wall thickness as unchecked (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:README.md#L251-L251`).

### 1.2 Half-edges and rooms (derived, not stored)

- Half-edges are created by rooms and carry the wall's half-thickness as `offset` (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/half_edge.ts#L8-L14`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/half_edge.ts#L52-L60`).
- Every `Floorplan.update()` resets wall edge references, re-runs room discovery and rebuilds all rooms and half-edges (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/floorplan.ts#L309-L324`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/wall.ts#L77-L81`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/room.ts#L127-L168`).
- Rooms are the smallest cycles of the wall graph; clockwise loops, which include the outer boundary, are dropped (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/floorplan.ts#L382-L387`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/floorplan.ts#L511-L515`).
- The source itself flags the room search as unoptimised (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/floorplan.ts#L501-L501`).
- A room has no height, ceiling or stored identity beyond its corner list (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/room.ts#L24-L36`).
- A room's id is its sorted corner ids joined, and its floor texture is keyed on that string (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/room.ts#L50-L56`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/room.ts#L62-L66`).
- Floor textures whose room id no longer exists are deleted silently on every update (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/floorplan.ts#L282-L290`).

### 1.3 Persistence

- `saveFloorplan` writes corners as an id-to-{x,y} map and walls as corner-id pairs, plus textures; coordinates are written raw (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/floorplan.ts#L209-L235`).
- The shipped template shows the resulting float noise, e.g. `204.85099999999989` (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/templates/default.json#L4-L4`).
- `loadFloorplan` clears the model and rebuilds corners and walls; it does not merge, split or validate anything, and a dangling corner id is used unchecked (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/floorplan.ts#L237-L265`).
- The wall constructor calls `attachStart` on whatever corner it receives, so a missing id would surface as a TypeError rather than a validation message (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/wall.ts#L66-L70`) (inference from code, not run).
- Items are exported from fresh objects built from scene state, so any field not in `SerializedItem` is dropped on save (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/model.ts#L66-L95`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/model.ts#L7-L21`).
- Neither `SavedFloorplan` nor `SerializedItem` has a provenance, status or source field (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/floorplan.ts#L11-L22`).
- Items are saved in world coordinates (`xpos`, `ypos`, `zpos`, `rotation`) (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/model.ts#L76-L79`).

## 2. Wall drawing

- The 2D tool has three modes: MOVE (default), DRAW and DELETE (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/floorplanner/floorplanner.ts#L16-L16`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/floorplanner/floorplanner_view.ts#L11-L15`).
- In DRAW mode a click that does not move creates a corner at the snapped target and, if there is a previous corner, a wall from the previous corner to the new one (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/floorplanner/floorplanner.ts#L256-L270`).
- Chaining continues from the last corner; a merge with an existing corner or wall ends DRAW mode (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/floorplanner/floorplanner.ts#L262-L268`).
- Escape returns to MOVE, and any mode change clears the chain (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/floorplanner/floorplanner.ts#L129-L133`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/floorplanner/floorplanner.ts#L292-L297`).
- In DELETE mode a press on a corner removes all its walls, and a press on a wall removes that wall (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/floorplanner/floorplanner.ts#L173-L182`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/corner.ts#L124-L132`).
- Wall removal fires delete callbacks that also remove attached openings (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/wall.ts#L151-L159`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/items/wall_item.ts#L183-L183`).
- Hover picks a corner first and only falls back to a wall if no corner is under the pointer (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/floorplanner/floorplanner.ts#L206-L222`).
- Corner and wall hit tests use a 10 cm radius and return the first match in array order, not the nearest (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/floorplan.ts#L24-L25`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/floorplan.ts#L187-L205`).
- Wall length labels are drawn at the wall centre and hidden under 60 cm; the unit comes from a configuration value that defaults to inches (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/floorplanner/floorplanner_view.ts#L168-L192`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/core/dimensioning.ts#L21-L27`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/core/configuration.ts#L25-L25`).

## 3. Corner dragging and merging

- Dragging a corner moves it to the pointer, then calls `snapToAxis` (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/floorplanner/floorplanner.ts#L238-L241`).
- `Corner.move` runs the merge check before it notifies its walls, so a move can merge or split topology before snapping (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/corner.ts#L138-L151`).
- If the moved corner is within 20 cm of another corner, it takes that corner's position, absorbs its walls, and the other corner is removed (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/corner.ts#L7-L7`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/corner.ts#L289-L297`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/corner.ts#L272-L287`).
- After a merge, zero-length walls and duplicate walls are removed (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/corner.ts#L325-L335`).
- If the moved corner is within 20 cm of a wall interior (and not already connected to it), the corner is projected onto that wall, which is split into two walls at the corner (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/corner.ts#L299-L321`).
- The projection clamps to the segment ends (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/core/utils.ts#L61-L70`).
- The split does not move openings: the original wall keeps its `items` array and the new half starts empty (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/corner.ts#L314-L317`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/items/wall_item.ts#L203-L205`) (inference: no reassignment code found).
- Merge is only triggered by moves and by the draw click; `loadFloorplan` never calls it (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/floorplanner/floorplanner.ts#L265-L265`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/corner.ts#L141-L141`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/floorplan.ts#L237-L265`).
- Dragging a wall moves both of its corners by the same delta, and each corner runs the merge check, so an endpoint can merge into a third corner mid-drag (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/floorplanner/floorplanner.ts#L242-L249`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/wall.ts#L109-L112`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/corner.ts#L109-L111`).

## 4. Snapping

- Snapping is axis-only (x or y), not point-to-point, and each mechanism has its own threshold.
- Corner axis-snap during a corner drag uses only the corner's adjacent corners (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/corner.ts#L156-L165`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/corner.ts#L83-L103`).
- The snap loop overwrites on every matching neighbour, so the last matching neighbour wins rather than the nearest (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/corner.ts#L92-L101`).
- Wall drag snaps both endpoints, and a wall's own other endpoint is one of the adjacent corners, so a wall can snap to its own vertical or horizontal alignment (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/wall.ts#L83-L87`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/corner.ts#L156-L165`).
- In DRAW mode, the target snaps only to the last placed corner (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/floorplanner/floorplanner.ts#L146-L164`).
- Rotation of furniture snaps to 90-degree steps within pi/16 (11.25 degrees) (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/items/item.ts#L234-L255`).
- Furniture snaps to walls within a configurable 10 cm, releases after 30 cm (hard-coded), and can also snap to a perpendicular wall at a corner (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/items/floor_item.ts#L44-L104`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/core/configuration.ts#L29-L29`).

| Mechanism | Threshold | Source |
|---|---|---|
| Draw target axis-snap to last corner | 25 cm (0.25 m) | `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/floorplanner/floorplanner.ts#L8-L9` |
| Drag corner or wall axis-snap to neighbours | 25 cm (0.25 m) | `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/floorplanner/floorplanner.ts#L241-L247` |
| Corner merge into corner or wall | 20 cm (0.20 m) | `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/corner.ts#L7-L7` |
| Hover pick, corner or wall | 10 cm (0.10 m) | `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/floorplan.ts#L25-L25` |
| Furniture snap to wall (configurable) | 10 cm (0.10 m) | `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/core/configuration.ts#L29-L29` |
| Furniture release from wall (hard-coded) | 30 cm (0.30 m) | `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/items/floor_item.ts#L57-L57` |

- The source gives no rationale for the 20, 25 or 10 values; the only comment is "how much will we move a corner to make a wall axis aligned (cm)" (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/floorplanner/floorplanner.ts#L8-L8`).

## 5. Opening placement

- Doors and windows are wall items: the catalogue maps the window to item type 3 (`InWallItem`) and the door to type 7 (`InWallFloorItem`, bound to the floor) (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/items/factory.ts#L25-L33`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/constants.ts#L684-L684`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/constants.ts#L702-L702`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/items/in_wall_item.ts#L18-L18`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/items/in_wall_floor_item.ts#L18-L18`).
- Dragging raycasts onto the wall-face planes and takes the wall edge from the hit plane (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/items/wall_item.ts#L227-L229`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/three/controller.ts#L369-L382`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/floorplan.ts#L82-L97`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/items/wall_item.ts#L156-L161`).
- A new opening snaps to the nearest wall edge by distance from its centre and is centred at half the wall height (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/items/wall_item.ts#L71-L89`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/items/wall_item.ts#L140-L153`).
- Position is clamped along the wall interior with a 1 cm margin and to the wall height; z is fixed to the wall face (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/items/wall_item.ts#L232-L258`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/items/in_wall_item.ts#L22-L25`).
- A door's bottom is pinned to the floor, so its sill is implicit (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/items/wall_item.ts#L243-L246`).
- There is no stored sill, height or width for an opening; the cut-out in the wall is the 3D model's bounding box projected onto the wall plane, and it is added to both faces (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/three/edge.ts#L259-L276`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/items/item.ts#L110-L110`).
- The cut-out is not clamped to the wall's ends in that code (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/three/edge.ts#L259-L276`) (inference: no clamp found).
- The wall-item code acknowledges that half-edges are destroyed and recreated on every edit and says the item should hold a wall reference instead (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/items/wall_item.ts#L14-L19`).
- The helper that would re-point an item to its new half-edge, `updateWallEdgeReference`, has no callers (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/items/wall_item.ts#L212-L223`).
- Walls have a move callback, but nothing subscribes to it, so openings are not notified when a corner moves (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/wall.ts#L89-L91`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/items/wall_item.ts#L183-L183`).
- On load, a saved opening keeps its world position and is only re-linked to its nearest wall edge (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/items/wall_item.ts#L140-L153`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/items/item.ts#L103-L108`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/three/controller.ts#L87-L91`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/scene.ts#L167-L168`).
- Wall items always report a valid position, so no overlap check exists on that path (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/items/wall_item.ts#L261-L263`).

## 6. How the source is stale relative to its README

| README claim | What the code does | Verdict |
|---|---|---|
| Draw, move and delete walls "with snapping and measurement overlays" (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:README.md#L24-L24`) | Modes, snapping and labels exist (see sections 2 to 4) | Matches; labels hidden under 60 cm |
| Floorplan "emits geometry change events" (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:README.md#L141-L141`) | Room-level update event (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/floorplan.ts#L118-L120`) drives the 3D redraw (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/three/floorplan.ts#L21-L21`); items get no move event | Partly true |
| Loaders are an "OBJ/MTL model loader" (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:README.md#L49-L49`) | Loader folder holds `JSONLoader` and `GLBLoader`; GLB/GLTF is used by extension (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/scene.ts#L173-L175`) | README is stale |
| "GLB/GLTF model support" is unchecked (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:README.md#L249-L249`) | Implemented (see above) | Code is ahead of README |
| "Unit tests for model layer" unchecked (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:README.md#L248-L248`) | The only test file in the clone is `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/services/simplify-canvas-data.test.ts#L1-L1` | Consistent |
| "Undo / Redo" unchecked (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:README.md#L250-L250`) | No undo code found | Consistent |

## 7. Comparison with our model

### 7.1 Concept mapping

| Concept | blueprint3d-modern | Ours (`data/measurements.json`) | Mapping |
|---|---|---|---|
| Vertex | Corner object with wall back-refs (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/corner.ts#L12-L17`) | `vertices` dictionary with letter ids A-U (`data/measurements.json:34-119`) | Position maps cleanly; topology does not, because ours is implicit in `walls[].a/b` and `rooms[].polygon` |
| Wall | Corner pair with global thickness and height (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/wall.ts#L46-L50`) | `walls[]` with stable id, `a`, `b`, per-wall `thickness` and `height`, `heightRooms`, `status` (`data/measurements.json:255-527`) | Partial: ours has ids and per-wall values that theirs lacks |
| Junction | Derived by auto-merge and auto-split (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/corner.ts#L299-L321`) and mitred half-edges (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/half_edge.ts#L275-L342`) | Authored; overlap convention per `docs/geometry.md:5`; the renderer draws each wall as a box between its centreline vertices (`src/scene.tsx:64-68`) | Conflict |
| Room | Derived face of the wall graph (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/floorplan.ts#L388-L516`) | `rooms[]` with authored `polygon`, `ceiling`, `status` (`data/measurements.json:137-254`) | Conflict |
| Perimeter | No object (outer loop discarded) | `perimeter` vertex list (`data/measurements.json:120-136`) | Not mapped |
| Opening | Wall item with world position and 3D model (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/model.ts#L76-L79`) | `openings[]` with `wall`, wall-relative `offset`, `width`, `sill`, `height`, `type`, `connects`, `status` (`data/measurements.json:528-637`) | Conflict; ours is stronger |
| Soffit | None | `soffits[]` as a band between two wall endpoints (`data/measurements.json:638-669`) | Nothing to borrow |
| Ceiling and heights | One global wall height; rooms have no height (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/room.ts#L24-L36`) | Per-room `ceiling`, per-wall `height` and a `heightRooms` rule (`data/measurements.json:137-254`) | Nothing to borrow |
| Fixtures | Catalogue furniture items | `fixtures[]` boxes (`data/measurements.json:670-918`) | Out of scope (`docs/wayfinder/structure-editor-v1/map.md:22-24`) |
| Provenance | None | `status` and `source` on most records; provenance block (`data/measurements.json:970-974`) | Nothing to borrow |
| Units | Centimetres (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/floorplanner/floorplanner.ts#L8-L8`) | Metres, rounded to 0.01 m (`docs/geometry.md:3`; `data/measurements.json:11-11`) | Scale by 100 |

### 7.2 Conflicts with the shared-vertex geometry (computed from `data/measurements.json`)

- Two vertex pairs are 0.160 m apart: I-J (`data/measurements.json:67-74`) and K-L (`data/measurements.json:75-82`).
- Both are below blueprint3d's 0.20 m merge radius (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/corner.ts#L7-L7`).
- The wall between each pair is `exterior-8` (`data/measurements.json:341-351`) and `exterior-10` (`data/measurements.json:363-373`).
- Moving either endpoint would merge the pair, and the zero-length wall is then removed (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/corner.ts#L289-L297`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/corner.ts#L325-L335`).
- Our validator rejects zero-length walls, so the data itself is valid but would not survive an edit in blueprint3d (`scripts/validate.mjs:19`).
- Vertex P lies on the interior of `bedroom-top` (O-R) at distance 0.000 m (`data/measurements.json:91-98`; `data/measurements.json:417-429`); O-R is not split at P.
- Blueprint3d only splits walls during edits, so a loaded graph would leave P connected only to Q and would not split O-R (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/floorplan.ts#L237-L265`) (inference).
- Living and kitchen share the open edge D-U (`docs/geometry.md:5`; `data/measurements.json:146-156`; `data/measurements.json:216-225`).
- No wall connects D and U (search of `data/measurements.json:255-527`).
- In a wall-derived room model, a missing wall means no boundary there, so the two rooms would become one face (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/floorplan.ts#L388-L516`) (inference, not run).
- Heights differ per wall (2.40 to 2.44 m, and 1.20 m for parapets) and are constrained to the maximum of their rooms' ceilings (`data/measurements.json:256-263`; `data/measurements.json:409-415`; `scripts/validate.mjs:19`); blueprint3d has one height and no rule (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/wall.ts#L50-L50`).
- Wall thickness is 0.10 m for interior walls and 0.15 m for exterior walls (`data/measurements.json:260-260`; `data/measurements.json:420-420`); blueprint3d's default is 0.10 m (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/core/configuration.ts#L28-L28`), so exterior walls would need a per-wall value that the UI does not expose.
- Openings reference walls by id and an offset from `wall.a`, and the validator checks each opening fits the wall (`data/measurements.json:528-637`; `src/apartment-model.ts:31-31`; `scripts/validate.mjs:19`).
- In blueprint3d, openings store world coordinates, so moving a corner leaves them where they were (section 5).
- Saved walls have no id, only a pair of corner ids, so the saved format cannot let an opening reference a wall by id (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/floorplan.ts#L225-L232`).
- Room floor textures in blueprint3d are keyed on corner sets, so any structural edit to a room drops its texture; our room ids are stable (`data/measurements.json:139-139`) (see section 1.2).
- The B-C wall is the only diagonal wall (`data/measurements.json:264-274`); blueprint3d handles any angle through mitred half-edges, while our renderer draws axis-aligned boxes in each wall's own frame (`src/scene.tsx:60-72`) and does not mitre joins.
- `docs/geometry.md:5` says junctions "intentionally overlap by their thickness to close corners"; the renderer's boxes end exactly at the centreline vertices (`src/scene.tsx:64-68`), so outer corners may show a notch (not verified visually).

### 7.3 Provenance constraints

- Coordinates are estimated, and only the printed dimensions and area are verified (`data/measurements.json:970-971`; `docs/assumptions.md:3-7`; `AGENTS.md:3`).
- Blueprint3d's snapping and merging rewrite coordinates silently, so an editor using them would change estimated values without any record; any snap should be an explicit, recorded edit (`docs/wayfinder/structure-editor-v1/map.md:10`).
- The verified dimensions are standalone numbers with no link to vertices (`data/measurements.json:933-969`), so geometry edits cannot be checked against them automatically.
- Room area is gross, and the clear bedroom dimensions are not comparable to polygon bounds (`docs/geometry.md:13`; `docs/assumptions.md:15`), so a naive width check would fail.
- Area is already guarded at 20% and the 7.39% gap is documented (`scripts/validate.mjs:32`; `docs/geometry.md:9`; `docs/assumptions.md:21`).

## 8. Recommendations

### Adopt (smallest useful set)

- A1. Keep the shared-vertex dictionary with id references and recompute on read: moving a vertex moves every wall, room and soffit that uses it (`src/apartment-model.ts:14-19`; `src/apartment-model.ts:48-51`). Blueprint3d needs per-corner wall lists to do this; we do not.
- A2. Chained draw: click to add a vertex from the last one, Escape to stop, axis-snap to the last vertex within a threshold stated in metres (blueprint3d uses 0.25 m) (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/floorplanner/floorplanner.ts#L129-L133`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/floorplanner/floorplanner.ts#L146-L157`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/floorplanner/floorplanner.ts#L256-L270`).
- A3. Hover precedence: a vertex under the pointer wins over a wall; pick the nearest, not the first (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/floorplanner/floorplanner.ts#L206-L222`).
- A4. Openings stay wall-relative (`wall`, `offset`, `width`, `sill`, `height`) and are clamped on edit to `0 <= offset` and `offset + width <= wall length`, the same rule as `src/items/wall_item.ts` drags and `scripts/validate.mjs:19` (`data/measurements.json:528-637`).
- A5. Explicit, opt-in axis snapping during drags, with visible feedback, choosing the nearest neighbour rather than the last match (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/corner.ts#L92-L101`); thresholds expressed in metres.
- A6. Deleting a wall that has openings should be blocked with a list of the affected openings, not silently cascaded (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/wall.ts#L151-L159`); the validator already rejects unknown wall ids (`scripts/validate.mjs:21`).

### Avoid

- V1. Automatic merge during a drag (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/corner.ts#L138-L141`); it would delete `exterior-8` and `exterior-10` on the first edit (section 7.2).
- V2. Automatic wall split on proximity without reassigning openings (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/corner.ts#L299-L321`); a T-junction at P needs an explicit split with re-based offsets, if it is ever done.
- V3. World-space opening positions as persisted state (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/model.ts#L76-L79`).
- V4. Room identity derived from corner sets (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/room.ts#L50-L56`); use the stable room ids we already have.
- V5. Raw float persistence (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/floorplan.ts#L218-L223`); round to 0.01 m as `docs/geometry.md:3` does, so git diffs stay readable.
- V6. Long-lived handles to derived geometry (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/items/wall_item.ts#L13-L19`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/items/floor_item.ts#L14-L14`); hold ids and recompute.
- V7. Unlabelled thresholds in raw units (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/floorplanner/floorplanner.ts#L8-L9`); name them in metres.

### Skip

- S1. Half-edge, mitre and derived-room engine (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/half_edge.ts#L275-L342`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/floorplan.ts#L388-L516`). Our rooms are authored and the room-open-edge case cannot be expressed by it. Revisit only if joins must be computed (B-C is the only diagonal junction).
- S2. 3D raycast placement of openings (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/three/controller.ts#L369-L382`). Map says edits happen on the 2D plan (`docs/wayfinder/structure-editor-v1/map.md:5`).
- S3. Furniture snapping and placement rules (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/items/floor_item.ts#L44-L131`); furniture GUI is out of scope (`docs/wayfinder/structure-editor-v1/map.md:24-24`).
- S4. The commented-out furniture collision block (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/items/floor_item.ts#L133-L147`); it is dead code.
- S5. Undo: blueprint3d has none (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:README.md#L250-L250`); the map already decides on in-memory undo, so design it fresh.
- S6. Remote default textures (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/wall.ts#L8-L13`; `charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:src/model/room.ts#L15-L19`); do not copy.
- S7. The Next.js app, IndexedDB storage and i18n (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:README.md#L172-L197`); our editor is a dev-only Vite middleware writing JSON (`docs/wayfinder/structure-editor-v1/map.md:5`).

## 9. Open questions

- Q1. Are sub-0.20 m vertex separations (I-J, K-L at 0.16 m) valid? They come from the drawing and should stay; the editor should warn, not merge.
- Q2. Should O-R be split at P, or is a T-junction without a split valid? The current data keeps O-R whole, and the window offset (`data/measurements.json:596-608`) is measured from O.
- Q3. Are room polygons authored (recommended) or derived? If authored, what checks that adjacent rooms agree on shared edges? The validator checks crossings and the area partition only (`scripts/validate.mjs:27`; `scripts/validate.mjs:32`).
- Q4. Do outer corners show notches in the 3D view? This needs a browser check (see Gaps).
- Q5. When a wall's start vertex moves, should its openings move with it (offset from `a`)? For `bedroom-top` (starts at O) this changes the window's position in the plan.
- Q6. Should any check compare verified dimensions with geometry, and if so, against gross or clear dimensions? `docs/geometry.md:13` says gross, `docs/assumptions.md:15` says clear.
- Q7. Mid-drag policy: allow temporary overlap and resolve on release, or block? Blueprint3d merges immediately, which we should not copy without deciding.
- Q8. Should a drag that would violate a validator rule be blocked, flagged, or allowed with `edited` set? Map says a GUI change marks the value `edited` (`docs/wayfinder/structure-editor-v1/map.md:10`).

## Gaps

- Nothing was built, installed or run; no browser run of either project was done (AGENTS.md requires one for our own visual claims).
- Behaviours marked "inference" (open-edge face merge, mid-drag merge reach, openings not reassigned on split, unclamped cut-outs, the TypeError on a missing corner id) are from code reading and were not reproduced.
- Absence claims (no setter for per-wall thickness or height, `updateWallEdgeReference` never called, no undo, no model-layer tests, no subscriber for `Wall.fireOnMove`) come from text search, not a call graph.
- The `app/` directory was not read beyond the README; it is outside the floorplanner.
- The `LICENSE` file was not read; the README states MIT (`charmlinn/blueprint3d-modern@f56f0b2a4a6e177181aefbf535d2945b937b5c02:README.md#L293-L293`). Confirm before copying any code.
- The clone is shallow (depth 1), so no history was read; the SHA is HEAD only.
- `src/core/events.ts`, `src/three/controls.ts`, `src/three/main.ts` and `src/services/simplify-canvas-data.ts` were not read in full.
- Local visual checks of joins, openings and the living/kitchen boundary were not done.
