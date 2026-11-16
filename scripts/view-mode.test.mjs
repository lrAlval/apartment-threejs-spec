import test from 'node:test';
import assert from 'node:assert/strict';
import { visibility } from '../src/view-mode.ts';

const off = { ceiling: false, labels: false, measurements: false }, on = { ceiling: true, labels: true, measurements: true };

test('walk forces the ceiling and hides annotation and grid', () => {
  assert.deepEqual(visibility('walk', on).layers, { ceiling: true, labels: false, measurements: false });
  const v = visibility('walk', off);
  assert(v.ceilingMesh && v.interior && !v.planWalls && !v.grid);
});

test('plan shows low walls without ceiling, soffits or fixtures', () => {
  const v = visibility('2d', on);
  assert(v.planWalls && !v.ceilingMesh && !v.interior && v.grid);
  assert(v.layers.labels && v.layers.measurements);
});

test('3d follows the user layer choices', () => {
  assert.deepEqual(visibility('3d', off).layers, off);
  assert(!visibility('3d', off).ceilingMesh);
  assert(visibility('3d', on).ceilingMesh && visibility('3d', on).interior);
});
