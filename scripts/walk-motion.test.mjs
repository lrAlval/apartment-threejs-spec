import test from 'node:test';
import assert from 'node:assert/strict';
import { canStandAt, createWalkWorld, EYE_HEIGHT, moveBy, stepWalk, WALK_START, WALK_SPEED } from '../src/walk-motion.ts';


const world = createWalkWorld();
const empty = { perimeter: [[-10,-10],[10,-10],[10,10],[-10,10]], barriers: [], fixtures: [] };
const close = (actual, expected) => assert(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);

test('walking distance is speed × time, diagonal-normalized and frame-rate independent', () => {
  function travel(frames, input) {
    let p = [0,0];
    for (let i=0;i<frames;i++) p=stepWalk(empty,p,input,0,1/frames);
    return p;
  }
  close(Math.hypot(...travel(10,[0,1])),WALK_SPEED);
  close(Math.hypot(...travel(100,[1,1])),WALK_SPEED);
  close(travel(10,[0,1])[1],travel(100,[0,1])[1]);
  const east = stepWalk(empty,[0,0],[0,1],-Math.PI/2,.1);
  assert(east[0]>0);close(east[1],0);
});

test('swept movement blocks thin walls and slides along them without tunnelling', () => {
  const obstacle = { ...empty, barriers: [{a:[0,-4],b:[0,4],padding:.05}] };
  const p=moveBy(obstacle,[-1,0],[4,2]);
  assert(p[0]<-.22);close(p[1],2);
  assert(canStandAt(obstacle,p));
  assert.throws(()=>moveBy(empty,[0,0],[NaN,0]),/finite/);
  assert.throws(()=>stepWalk(empty,[0,0],[0,1],0,-1),/Invalid/);
});

test('actual flat admits bedroom, bathroom, kitchen and balcony routes but blocks new return and windows', () => {
  assert(canStandAt(world,WALK_START));assert.equal(EYE_HEIGHT,1.6);
  const bedroom=moveBy(world,[4.65,3.45],[-1.1,0]);close(bedroom[0],3.55);
  const bathroom=moveBy(world,[4.42,3.45],[0,.85]);close(bathroom[1],4.3);
  const kitchen=moveBy(world,[6.35,2.5],[0,1.1]);close(kitchen[1],3.6);
  const balcony=moveBy(world,[2.5,2.5],[-.95,0]);close(balcony[0],1.55);
  const blocked=moveBy(world,[4.65,3.45],[1.5,0]);assert(blocked[0]<5.03);
  const window=moveBy(world,[1.55,3.5],[0,-1]);assert(window[1]>3.22);
  assert(!canStandAt(world,[0,0]));
  assert(!canStandAt(world,[5.65,4.3]));
});

test('fixtures, glazing and parapets block walking even below eye height', () => {
  const p=moveBy(world,[1.55,2.5],[-3,0]);assert(p[0]>1.37);
  const glass=moveBy(world,[2.5,1],[-1,0]);assert(glass[0]>2.2);
  const fixture=moveBy(world,[6.35,4.3],[-1,0]);assert(fixture[0]>6.1);
});
