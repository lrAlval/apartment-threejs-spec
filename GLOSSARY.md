# Glossary

- **Apartment model** - `data/measurements.json` resolved into world-space geometry: vertex points, wall axes and solid runs between openings, soffit boxes, room polygons and bounds. Lives in `src/apartment-model.ts`; rendering, walk collision, overlays and validation all read geometry through it.
- **Wall run** - a full-height solid stretch of a wall between openings. Rendering cuts runs at every opening; walk collision cuts only at walkable doors.
- **Soffit box** - a soffit footprint extruded from its underside up to its room's ceiling.
