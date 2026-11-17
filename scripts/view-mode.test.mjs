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

import { createActor } from 'xstate';
import { OVERVIEW_POSE, viewMachine, viewOf } from '../src/view-mode.ts';

const start = () => createActor(viewMachine).start();
const pose = { position: [9, 6, 8], target: [3.8, 0, 3] };

test('starts in the 3d overview at the default pose', () => {
  const s = start().getSnapshot();
  assert.equal(viewOf(s), '3d'); assert.deepEqual(s.context.overview, OVERVIEW_POSE);
});

test('walk returns to the orbit view it was entered from', () => {
  const actor = start();
  actor.send({ type: 'SELECT_2D' }); actor.send({ type: 'ENTER_WALK' });
  assert.equal(viewOf(actor.getSnapshot()), 'walk');
  actor.send({ type: 'EXIT_WALK' }); assert.equal(viewOf(actor.getSnapshot()), '2d');
  actor.send({ type: 'SELECT_3D' }); actor.send({ type: 'ENTER_WALK', overview: pose }); actor.send({ type: 'EXIT_WALK' });
  assert.equal(viewOf(actor.getSnapshot()), '3d');
});

test('only the overview records its camera pose on entering walk', () => {
  const actor = start();
  actor.send({ type: 'ENTER_WALK', overview: pose }); actor.send({ type: 'EXIT_WALK' });
  assert.deepEqual(actor.getSnapshot().context.overview, pose);
  actor.send({ type: 'SELECT_2D' }); actor.send({ type: 'ENTER_WALK', overview: { position: [0, 0, 0], target: [0, 0, 0] } });
  assert.deepEqual(actor.getSnapshot().context.overview, pose);
});

test('reset counts only while walking; entering walk twice is a no-op', () => {
  const actor = start();
  actor.send({ type: 'RESET_WALK' }); assert.equal(actor.getSnapshot().context.walkResets, 0);
  actor.send({ type: 'ENTER_WALK' }); actor.send({ type: 'ENTER_WALK', overview: pose }); actor.send({ type: 'RESET_WALK' });
  assert.equal(actor.getSnapshot().context.walkResets, 1);
  assert.deepEqual(actor.getSnapshot().context.overview, OVERVIEW_POSE);
});
