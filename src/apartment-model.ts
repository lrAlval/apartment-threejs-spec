import raw from '../data/measurements.json' with { type: 'json' };

// The Apartment model: measurements.json resolved into world-space geometry shared by
// rendering, walk collision, overlays and validation. Pure: no three.js or React.
export type Measurements = typeof raw;
export type Room = Measurements['rooms'][number];
export type Wall = Measurements['walls'][number];
export type Opening = Measurements['openings'][number];
export type Soffit = Measurements['soffits'][number];
export type XZ = [number, number];
export type Run = { start: number; end: number };

export function createApartmentModel(measurements: Measurements) {
  const point = (id: string): XZ => {
    const v = (measurements.vertices as Record<string, number[]>)[id];
    if (!v) throw new Error(`Unknown vertex ${id}`);
    return [v[0], v[1]];
  };
  const polygon = (ids: string[]) => ids.map(point);
  const room = (id: string) => {
    const r = measurements.rooms.find(r => r.id === id);
    if (!r) throw new Error(`Unknown room ${id}`);
    return r;
  };
  /** Wall axis: start, end, length, and the world point at a distance along it. */
  const wallAxis = (wall: Wall) => {
    const a = point(wall.a), b = point(wall.b), length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return { a, b, length, angle: Math.atan2(b[1] - a[1], b[0] - a[0]),
      at: (d: number): XZ => [a[0] + (b[0] - a[0]) * d / length, a[1] + (b[1] - a[1]) * d / length] };
  };
  const openingsOf = (wall: Wall) => measurements.openings.filter(o => o.wall === wall.id).sort((a, b) => a.offset - b.offset);
  /** Full-height solid runs along a wall, leaving gaps at the openings `isGap` selects. */
  const wallRuns = (wall: Wall, isGap: (o: Opening) => boolean = () => true): Run[] => {
    const runs: Run[] = [], length = wallAxis(wall).length;
    let cursor = 0;
    for (const o of openingsOf(wall).filter(isGap)) {
      if (o.offset > cursor) runs.push({ start: cursor, end: o.offset });
      cursor = o.offset + o.width;
    }
    if (cursor < length) runs.push({ start: cursor, end: length });
    return runs;
  };
  /** Soffit as an axis-aligned box, from its underside up to its room's ceiling. */
  const soffitBox = (soffit: Soffit) => {
    const a = point(soffit.a), b = point(soffit.b);
    return { min: [a[0], soffit.underside, a[1]] as const, max: [b[0], room(soffit.room).ceiling.height, a[1] + soffit.depth] as const };
  };
  const roomBounds = (r: Room) => {
    const ps = polygon(r.polygon), xs = ps.map(p => p[0]), zs = ps.map(p => p[1]);
    return { width: Math.max(...xs) - Math.min(...xs), depth: Math.max(...zs) - Math.min(...zs) };
  };
  return { measurements, point, polygon, room, wallAxis, openingsOf, wallRuns, soffitBox, roomBounds };
}
export type ApartmentModel = ReturnType<typeof createApartmentModel>;
export const apartment = createApartmentModel(raw);

export function polygonArea(ps: XZ[]) {
  return Math.abs(ps.reduce((s, a, i) => { const b = ps[(i + 1) % ps.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0)) / 2;
}
/** Even-odd containment; points on an edge count as inside. */
export function polygonContains(ps: XZ[], q: XZ) {
  let inside = false;
  for (let i = 0, j = ps.length - 1; i < ps.length; j = i++) {
    const a = ps[j], b = ps[i];
    if (segmentDistance(q, a, b) < 1e-8) return true;
    if ((a[1] > q[1]) !== (b[1] > q[1]) && q[0] < (b[0] - a[0]) * (q[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
export function segmentDistance(p: XZ, a: XZ, b: XZ) {
  const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
}
