import test from 'node:test';
import assert from 'node:assert/strict';
import { apartment, createApartmentModel, polygonArea, polygonContains } from '../src/apartment-model.ts';

const close = (actual, expected) => assert(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('wall runs leave gaps exactly at the selected openings', () => {
  const wall = apartment.measurements.walls.find(w => apartment.openingsOf(w).length);
  const length = apartment.wallAxis(wall).length;
  const runs = apartment.wallRuns(wall), openings = apartment.openingsOf(wall);
  const solid = runs.reduce((s, r) => s + r.end - r.start, 0), gaps = openings.reduce((s, o) => s + o.width, 0);
  close(solid + gaps, length);
  for (const o of openings) assert(!runs.some(r => r.start < o.offset + o.width - 1e-9 && r.end > o.offset + 1e-9), `run overlaps ${o.id}`);
  assert.deepEqual(apartment.wallRuns(wall, () => false), [{ start: 0, end: length }]);
});

test('wall axis maps distance along the wall into world space', () => {
  const wall = apartment.measurements.walls[0], axis = apartment.wallAxis(wall);
  assert.deepEqual(axis.at(0), axis.a);
  close(axis.at(axis.length)[0], axis.b[0]); close(axis.at(axis.length)[1], axis.b[1]);
});

test('soffits hang from their room ceiling down to their underside', () => {
  for (const s of apartment.measurements.soffits) {
    const { min, max } = apartment.soffitBox(s);
    close(max[1], apartment.room(s.room).ceiling.height);
    close(min[1], s.underside);
    assert(min[1] < max[1] && min[0] < max[0] && min[2] < max[2], s.id);
  }
});

test('polygon helpers: area, edge-inclusive containment', () => {
  const square = [[0, 0], [2, 0], [2, 2], [0, 2]];
  close(polygonArea(square), 4);
  assert(polygonContains(square, [1, 1]));
  assert(polygonContains(square, [2, 1]));
  assert(!polygonContains(square, [3, 1]));
});

test('unknown references fail loudly', () => {
  const broken = createApartmentModel({ ...apartment.measurements, vertices: {} });
  assert.throws(() => broken.point('A'), /Unknown vertex A/);
  assert.throws(() => apartment.room('attic'), /Unknown room attic/);
});
