# Measurement status and unresolved questions

The supplied two-page Departamento_09_Plano_Con_Cotas.pdf is a cropped, enhanced extraction, not the original full sheet. This reconstruction inspected that attachment; the original full sheet was not available here.

Verified means supported by the drawing, not field surveyed. Page 2 transcribes 41.64 m² roofed and total, bedroom 3.37 × 2.81 m, living width 4.94 m, dining return 1.24 m, entrance vertical dimension 1.00 m, and passage dimensions 0.69 / 0.70 / 0.50 m. The passage values are contextual references, not confidently assigned to wall endpoints.

Coordinates, door locations, room polygons and fixture footprints are estimated. Room ceilings are approximate owner measurements: living 2.44 m, balcony 2.10 m, main bedroom 2.40 m, bathroom 2.42 m, kitchen 2.43 m. Local soffit undersides near the bathroom, in the kitchen and bedroom are approximately 2.12 m. None are professionally surveyed or drawing-verified. Wall thicknesses, fixture elevations and door sizes remain defaults. Decimal coordinate storage does not imply centimetre accuracy.

The image scale is approximately 159.5 px/m at a 1800px-wide page render: 535/3.37 = 158.8, 448/2.81 = 159.4 and 789/4.94 = 159.7. Differences include line thickness and endpoint selection.

## Corrections to the preliminary room table

- Balcony is approximately 0.86 × 3.00 m, along the living room west side. The 2.50 × 0.50 m provisional value was rejected.
- Living space includes circulation into a recess above the bathroom. Its gross polygon bounds are approximately 4.99 × 3.90 m; these are not clear rectangular room dimensions.
- Bedroom clear sleeping zone retains 3.37 × 2.81 m; gross polygon includes the closet zone and wall allowances.
- Bathroom trace is approximately 1.20 × 2.12 m, rather than 1.30 × 1.80 m.
- Kitchen has a stepped east boundary around excluded service ducts. The right-hand common corridor and upper-right utility enclosure are excluded.

## Area uncertainty

The traced floor partition covers 38.5623 m², 7.39% below the printed 41.64 m². These floor polygons mix clear-face and approximate wall-axis endpoints; do not interpret this as net or cadastral area. Wall ownership, gross-area convention, shaft inclusion and line interpretation remain unresolved. No scale factor was applied to force agreement. Wall thickness adds visible surface outside the partition. Bathroom and kitchen shafts remain excluded.

## Openings and fixtures

The entrance is in the living room east wall at its southern end. Bedroom access is on the short recessed R-S edge beside the bathroom; the door swing in the source plan supports this placement. The previous opening in the north wall was rejected by the owner and has been filled. Bathroom access is from the recessed circulation space. Kitchen north side is open. The balcony opening is modeled as a door plus tall glazing; the drawing suggests sliding aluminium carpentry, whose exact leaf divisions are uncertain. The bedroom west wall is solid, as confirmed by the owner. The owner's clarification places the bedroom window on the balcony-shared O-P edge of the north wall, not on south wall L-M. Its provisional 0.76 m width fits within the 0.86 m shared edge with 0.05 m clearance at either end. Height 1.20 m and sill 0.90 m remain defaults. No bathroom window is invented: mechanical extraction is indicated.

Doors are represented by clear gaps and a thin reference rail, not animated leaves. Fixture blocks indicate sink, hob, fridge, washer, laundry sink, toilet, basin and shower locations. Heights are illustrative. No furniture is required for room boundaries.

Before higher fidelity work, verify balcony clear depth, glazing subdivisions, door offsets, bathroom clear size and how 41.64 m² is defined.

## Video review and provisional overhead geometry

`flat.mp4` shows local downstands near the bathroom approach (approximately 01:12-01:22) and bedroom window wall (approximately 01:28-01:40). The owner clarified that 2.12 m is a local minimum, not a replacement for each room's main ceiling. All heights refer to each room's finished floor; no floor level changes are inferred.

Three provisional soffits visualize these clearances: the bathroom approach uses the existing R-U-T-S circulation recess; kitchen uses a 0.20 m deep band south of U-D; bedroom uses a 0.20 m deep band south of N-R. These footprints, widths and continuity are unmeasured defaults, not video-verified dimensions. Confirm on site before refining; do not interpret them as proof of load-bearing beams. Soffits stay visible with the main ceiling hidden in 3D, and are omitted in 2D.

The balcony now has a ceiling at 2.10 m. Shared walls reach the higher adjacent room ceiling; this does not imply equal clear heights on both sides. Parapets remain unchanged. Window and balcony-access perimeter frames use default 25 mm face width and 35 mm depth, inside the existing opening. No unverified panel subdivisions are added. Bedroom opening stays on O-P with existing 0.76 m width, 0.90 m sill and 1.20 m height: the video suggests different proportions, but widening outside this traced shared edge would require evidence for a plan change. Measure window width, sill and head before resizing.

The earlier `docs/images` captures are historical, not current geometry baselines. Use fresh `test-results/browser` captures. Furniture, fixture placement, room footprints and printed dimensions are unchanged.

## Owner feedback corrections

The three annotated model screenshots take precedence over the initial opening estimates:

- `image.png`: make the north-wall bedroom opening solid. Move access to the existing short R-S circulation edge, where page 1 shows the door swing. The door placement remains drawing-inferred; width/elevation are defaults.
- `image(1).png`: remove the bedroom window from west wall M-N and restore continuous wall solids.
- `image(2).png` plus the owner clarification: the intended wall is the bedroom/balcony shared O-P edge. The previous south-wall interpretation was incorrect. Wall selection is owner-confirmed; centering and dimensions remain provisional.

These corrections do not change room polygons, calibrated dimensions or area. Measurement `source` fields record the evidence without reclassifying owner feedback as drawing-verified dimensions.
