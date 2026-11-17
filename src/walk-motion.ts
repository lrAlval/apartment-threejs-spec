import { apartment, polygonContains, segmentDistance, type ApartmentModel, type XZ } from './apartment-model.ts';

export type { XZ };
export type WalkWorld = {
  perimeter: XZ[];
  barriers: { a: XZ; b: XZ; padding: number }[];
  fixtures: { min: XZ; max: XZ }[];
};
export const EYE_HEIGHT = 1.6;
export const WALK_RADIUS = 0.18;
export const WALK_SPEED = 1.1;
export const WALK_START: XZ = [6.35, 2.35];

export function createWalkWorld(model: ApartmentModel = apartment): WalkWorld {
  // Windows/glazing remain solid. Only floor-level door gaps admit walking.
  const walkable = (o: { type: string; sill: number; height: number }) => o.type === 'door' && o.sill === 0 && o.height >= EYE_HEIGHT + .15;
  const barriers = model.measurements.walls.flatMap(wall => {
    const axis = model.wallAxis(wall);
    return model.wallRuns(wall, walkable).map(run => ({ a: axis.at(run.start), b: axis.at(run.end), padding: wall.thickness / 2 }));
  });
  return { perimeter: model.polygon(model.measurements.perimeter), barriers, fixtures: model.measurements.fixtures.map(f => ({
    min: [f.position[0] - f.size[0] / 2, f.position[2] - f.size[2] / 2],
    max: [f.position[0] + f.size[0] / 2, f.position[2] + f.size[2] / 2],
  })) };
}

export function canStandAt(world: WalkWorld, point: XZ) {
  if (!point.every(Number.isFinite)) return false;
  return polygonContains(world.perimeter, point)
    && !world.perimeter.some((a, i) => segmentDistance(point, a, world.perimeter[(i + 1) % world.perimeter.length]) < WALK_RADIUS)
    && !world.barriers.some(w => segmentDistance(point, w.a, w.b) < WALK_RADIUS + w.padding)
    && !world.fixtures.some(f => Math.hypot(Math.max(f.min[0] - point[0], 0, point[0] - f.max[0]), Math.max(f.min[1] - point[1], 0, point[1] - f.max[1])) < WALK_RADIUS);
}
export function moveBy(world: WalkWorld, position: XZ, delta: XZ): XZ {
  if (![...position, ...delta].every(Number.isFinite)) throw new Error('Walking requires finite coordinates');
  const steps = Math.max(1, Math.ceil(Math.hypot(...delta) / (WALK_RADIUS / 3)));
  let [x, z] = position;
  for (let i = 0; i < steps; i++) {
    // Small axis-separated steps prevent tunnelling and slide along walls.
    const nx = x + delta[0] / steps, nz = z + delta[1] / steps;
    if (canStandAt(world, [nx, z])) x = nx;
    if (canStandAt(world, [x, nz])) z = nz;
  }
  return [x, z];
}
export function stepWalk(world: WalkWorld, position: XZ, input: XZ, yaw: number, seconds: number): XZ {
  if (![...input, yaw, seconds].every(Number.isFinite) || seconds < 0) throw new Error('Invalid walking input');
  const scale = WALK_SPEED * Math.min(seconds, .1) / Math.max(1, Math.hypot(...input));
  const [side, forward] = input;
  return moveBy(world, position, [(side * Math.cos(yaw) - forward * Math.sin(yaw)) * scale, (-side * Math.sin(yaw) - forward * Math.cos(yaw)) * scale]);
}
