import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { canStandAt, createWalkWorld, EYE_HEIGHT, stepWalk, WALK_START } from './walk-motion';

export type WalkInput = { keys: Set<string>; touch: Set<string>; yaw: number; pitch: number };
export const newWalkInput = (): WalkInput => ({ keys: new Set(), touch: new Set(), yaw: Math.PI / 2, pitch: 0 });
const world = createWalkWorld();
const movementKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'];

export function WalkCamera({ input, reset }: { input: RefObject<WalkInput>; reset: number }) {
  const { camera, gl } = useThree();
  useLayoutEffect(() => {
    if (!canStandAt(world, WALK_START)) throw new Error('Walkthrough start is obstructed; correct geometry before walking');
    camera.position.set(WALK_START[0], EYE_HEIGHT, WALK_START[1]);
    input.current.keys.clear(); input.current.touch.clear();
    input.current.yaw = Math.PI / 2; input.current.pitch = 0;
    gl.domElement.focus();
  }, [camera, gl, input, reset]);
  useEffect(() => {
    const canvas = gl.domElement;
    let drag: { id: number; x: number; y: number } | undefined;
    const clear = () => { input.current.keys.clear(); input.current.touch.clear(); drag = undefined; };
    const movementCode = (event: KeyboardEvent) => movementKeys.includes(event.code) ? event.code : ({w:'KeyW',a:'KeyA',s:'KeyS',d:'KeyD',arrowup:'ArrowUp',arrowleft:'ArrowLeft',arrowdown:'ArrowDown',arrowright:'ArrowRight'} as Record<string,string>)[event.key.toLowerCase()];
    const keydown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input,textarea,select,button'))) return;
      const code = movementCode(event);
      if (code) { event.preventDefault(); input.current.keys.add(code); }
    };
    const keyup = (event: KeyboardEvent) => { const code = movementCode(event); if (code) input.current.keys.delete(code); };
    const look = (dx: number, dy: number) => {
      input.current.yaw -= dx * .003;
      input.current.pitch = Math.max(-1.35, Math.min(1.35, input.current.pitch - dy * .003));
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || document.pointerLockElement === canvas) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId); canvas.focus();
    };
    const move = (event: PointerEvent) => {
      if (document.pointerLockElement === canvas) { look(event.movementX, event.movementY); return; }
      if (drag?.id !== event.pointerId) return;
      look(event.clientX - drag.x, event.clientY - drag.y);
      drag.x = event.clientX; drag.y = event.clientY;
    };
    const up = (event: PointerEvent) => { if (drag?.id === event.pointerId) drag = undefined; };
    canvas.tabIndex = 0;
    canvas.focus();
    canvas.setAttribute('aria-label', 'Walkthrough. Drag to look; use W A S D or arrow keys to walk.');
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup);
    window.addEventListener('blur', clear); document.addEventListener('visibilitychange', clear);
    document.addEventListener('pointerlockchange', clear);
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('lostpointercapture', up);
    return () => {
      clear(); if (document.pointerLockElement === canvas) document.exitPointerLock();
      window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', clear);
      document.removeEventListener('pointerlockchange', clear);
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); canvas.removeEventListener('lostpointercapture', up);
      canvas.removeAttribute('tabindex'); canvas.removeAttribute('aria-label');
    };
  }, [camera, gl, input]);
  useFrame((_, seconds) => {
    const state = input.current;
    const active = (...keys: string[]) => keys.some(key => state.keys.has(key) || state.touch.has(key)) ? 1 : 0;
    const [x, z] = stepWalk(world, [camera.position.x, camera.position.z], [active('KeyD', 'ArrowRight') - active('KeyA', 'ArrowLeft'), active('KeyW', 'ArrowUp') - active('KeyS', 'ArrowDown')], state.yaw, seconds);
    camera.position.set(x, EYE_HEIGHT, z);
    camera.rotation.set(state.pitch, state.yaw, 0, 'YXZ');
  });
  return null;
}

export function WalkPanel({ input, onReset, onExit }: { input: RefObject<WalkInput>; onReset(): void; onExit(): void }) {
  const [lockMessage, setLockMessage] = useState('Drag scene to look. W A S D / arrows or hold movement buttons to walk.');
  const held = useRef(new Map<number, string>());
  useEffect(() => {
    const clear = () => { held.current.clear(); input.current.touch.clear(); };
    const change = () => setLockMessage(document.pointerLockElement ? 'Mouse look enabled. Esc releases mouse.' : 'Drag scene to look. W A S D / arrows or hold movement buttons to walk.');
    window.addEventListener('blur', clear); document.addEventListener('visibilitychange', clear);
    document.addEventListener('pointerlockchange', change);
    return () => { clear(); window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', clear); document.removeEventListener('pointerlockchange', change); };
  }, [input]);
  const release = (pointerId: number) => {
    const code = held.current.get(pointerId); held.current.delete(pointerId);
    if (code && ![...held.current.values()].includes(code)) input.current.touch.delete(code);
  };
  const lock = async () => {
    const canvas = document.querySelector('canvas');
    try {
      if (!canvas?.requestPointerLock) throw new Error('Mouse lock unavailable');
      await canvas.requestPointerLock(); canvas.focus();
    } catch { setLockMessage('Mouse lock unavailable. Drag scene to look instead.'); }
  };
  return <div className="walk-panel">
    <p role="status">{lockMessage}</p>
    <div className="walk-actions"><button onClick={lock}>Enable mouse look</button><button onClick={onReset}>Reset position</button><button onClick={onExit}>Exit walkthrough</button></div>
    <div className="walk-pad" aria-label="Walk movement controls">
      {([['KeyW', 'Forward'], ['KeyA', 'Left'], ['KeyS', 'Back'], ['KeyD', 'Right']] as const).map(([code, label]) => <button key={code} aria-label={`Walk ${label.toLowerCase()}`}
        onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); held.current.set(event.pointerId, code); input.current.touch.add(code); }}
        onPointerUp={event => release(event.pointerId)} onPointerCancel={event => release(event.pointerId)} onLostPointerCapture={event => release(event.pointerId)}
        onKeyDown={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); input.current.touch.add(code); } }}
        onKeyUp={event => { if (event.key === ' ' || event.key === 'Enter') input.current.touch.delete(code); }}
        onBlur={() => input.current.touch.delete(code)}>{label}</button>)}
    </div>
  </div>;
}
