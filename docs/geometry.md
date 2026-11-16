# Geometry and reconstruction

X/Z are metres on the finished floor; Y is elevation; Y=0 is finished floor. Source north is negative Z. Origin is aligned with the bedroom west clear face and north living clear face (approximately pixel 190,166 on the 1800px-wide rendering). Coordinates are rounded to 0.01m.

All room polygons reference one shared vertex dictionary in data/measurements.json. The perimeter is a single concave polygon including the balcony and the kitchen service-duct recess. Living and kitchen share an open edge U–D; the bathroom and bedroom share wall S–L. Balcony glazing Q–P is shared with living. Wall segments occur once, and openings reference wall IDs and metric offsets from wall.a. Exterior walls are approximate centre lines with thickness on both sides. Junctions intentionally overlap by their thickness to close corners; coincident duplicate segments are not required.

The north perimeter edge is split at Q into balcony parapet and living wall. Exterior-14 is balcony west parapet. Doors and windows split wall solids vertically and horizontally, preserving headers and window sills. Polygons use the same source for 2D, floor and ceiling surfaces. No independently positioned rectangular rooms.

Run npm run validate for polygon simplicity, room edge crossings, positive area, opening extents/overlaps, height bounds, door connectivity and room/perimeter area agreement. The kitchen connects along its open shared north edge. Area discrepancy beyond 20% fails as a coarse guard; the present 7.39% discrepancy is documented, not hidden. This guard is not evidence of survey accuracy. The test does not prove arbitrary polygon containment or detect every possible collinear wall overlap; inspect after significant edits.

## Source comparison

public/source-plan.svg is generated from the same data. Compare it to page 1 of the supplied PDF with north at top: west vertical balcony, living north of bedroom, southeast bathroom, east kitchen recess and northeast diagonal dining corner. These landmarks and the three calibration spans were visually compared against the source. Heights cannot be checked from this plan. Room area includes closets/circulation allocated to each polygon and is not equivalent to clear-room dimensions.

Reconstruction sequence: read dimensions; calibrate independently on bedroom width/depth and living width; trace connected boundaries; exclude common corridor and service shafts; add shared walls and openings; check partition area; compare landmarks. Keep a source and confidence entry whenever measurements change.

## Corrected bedroom openings

The owner-rejected north-wall door and west-wall window have been removed. The former north-wall door near R is filled, and wall M-N is continuous. Bedroom access uses a new shared wall segment R-S on the existing circulation recess, with a default 0.80 m door centered in its 0.90 m length. The source door swing supports that orientation. The owner clarified that the window belongs on shared balcony edge O-P, not L-M. It is 0.76 m wide, offset 0.05 m from O within the traced 0.86 m shared edge. The bedroom-top wall now starts at O, since exterior-13 already covers N-O; this avoids overlapping wall solids across the window. South wall L-M is solid. No perimeter or room polygon coordinates changed. The comparison SVG reflects these same opening assignments.
