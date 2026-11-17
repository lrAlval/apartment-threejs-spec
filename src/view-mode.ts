// View mode: which of the three views is active, and what each view shows. Pure.
export type View = '3d' | '2d' | 'walk';
export type Layers = { ceiling: boolean; labels: boolean; measurements: boolean };

export function visibility(view: View, chosen: Layers) {
  const walk = view === 'walk', plan = view === '2d';
  // Walking forces the ceiling on and hides annotation; the plan never draws a ceiling.
  const layers = { ceiling: chosen.ceiling || walk, labels: chosen.labels && !walk, measurements: chosen.measurements && !walk };
  return { layers, ceilingMesh: layers.ceiling && !plan, interior: !plan, planWalls: plan, grid: !walk };
}

export type Vec3 = [number, number, number];
export type Pose = { position: Vec3; target: Vec3 };
/** Where each orbit view starts. The walk view starts at WALK_START in walk-motion. */
export const OVERVIEW_POSE: Pose = { position: [11, 10, 13], target: [3.8, 0, 3] };
export const PLAN_POSE: Pose = { position: [3.8, 14, 3], target: [3.8, 0, 3] };
