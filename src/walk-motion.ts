export type XZ = [number, number];
export type WalkWorld = {
  perimeter: XZ[];
  barriers: { a: XZ; b: XZ; padding: number }[];
  fixtures: { min: XZ; max: XZ }[];
};
type Model = {
  vertices: Record<string, number[]>;
  perimeter: string[];
  walls: { id: string; a: string; b: string; thickness: number }[];
  openings: { wall: string; type: string; offset: number; width: number; sill: number; height: number }[];
  fixtures: { position: number[]; size: number[] }[];
};
export const EYE_HEIGHT = 1.6;
export const WALK_RADIUS = 0.18;
export const WALK_SPEED = 1.1;
export const WALK_START: XZ = [6.35, 2.35];

export function createWalkWorld(model: Model): WalkWorld {
  const point = (id: string): XZ => [model.vertices[id][0], model.vertices[id][1]];
  const barriers: WalkWorld['barriers'] = [];
  for (const wall of model.walls) {
    const a = point(wall.a), b = point(wall.b), length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const at = (distance: number): XZ => [a[0] + (b[0] - a[0]) * distance / length, a[1] + (b[1] - a[1]) * distance / length];
    let cursor = 0;
    // Windows/glazing remain solid. Only floor-level door gaps admit walking.
    for (const door of model.openings.filter(o => o.wall === wall.id && o.type === 'door' && o.sill === 0 && o.height >= EYE_HEIGHT + .15).sort((a, b) => a.offset - b.offset)) {
      if (door.offset > cursor) barriers.push({ a: at(cursor), b: at(door.offset), padding: wall.thickness / 2 });
      cursor = door.offset + door.width;
    }
    if (cursor < length) barriers.push({ a: at(cursor), b, padding: wall.thickness / 2 });
  }
  return { perimeter: model.perimeter.map(point), barriers, fixtures: model.fixtures.map(f => ({
    min: [f.position[0] - f.size[0] / 2, f.position[2] - f.size[2] / 2],
    max: [f.position[0] + f.size[0] / 2, f.position[2] + f.size[2] / 2],
  })) };
}

function segmentDistance(point: XZ, a: XZ, b: XZ) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / lengthSquared)) : 0;
  return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dz);
}
export function canStandAt(world: WalkWorld, point: XZ) {
  if (!point.every(Number.isFinite)) return false;
  let inside = false;
  for (let i = 0, j = world.perimeter.length - 1; i < world.perimeter.length; j = i++) {
    const a = world.perimeter[i], b = world.perimeter[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    if (segmentDistance(point, a, b) < WALK_RADIUS) return false;
  }
  return inside && !world.barriers.some(w => segmentDistance(point, w.a, w.b) < WALK_RADIUS + w.padding)
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
