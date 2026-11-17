import { useEffect, useRef, type ComponentRef, type RefObject } from 'react';
import { OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import type * as THREE from 'three';
import { PLAN_POSE, type Pose, type View } from './view-mode';
import { EYE_HEIGHT, WALK_START } from './walk-motion';
import { WalkCamera, type WalkInput } from './walkthrough';

/** Reads the live overview pose so the view machine can restore it after walking. */
export type CaptureOverview = () => Pose | undefined;

/** The camera and controls for each view mode: orbit perspective, top-down plan, or eye-level walk. */
export function CameraRig({ view, overview, walkResets, input, capture }: {
  view: View; overview: Pose; walkResets: number; input: RefObject<WalkInput>; capture: RefObject<CaptureOverview | null>;
}) {
  const camera = useRef<THREE.PerspectiveCamera>(null);
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  useEffect(() => {
    capture.current = () => view === '3d' && camera.current && controls.current
      ? { position: camera.current.position.toArray(), target: controls.current.target.toArray() } : undefined;
  }, [capture, view]);
  if (view === 'walk') return <>
    <PerspectiveCamera key="walk" makeDefault position={[WALK_START[0], EYE_HEIGHT, WALK_START[1]]} fov={65} near={.04} />
    <WalkCamera input={input} reset={walkResets} />
  </>;
  const plan = view === '2d';
  return <>
    {plan
      ? <OrthographicCamera key="plan" makeDefault position={PLAN_POSE.position} up={[0, 0, -1]} zoom={68} />
      : <PerspectiveCamera key="overview" ref={camera} makeDefault position={overview.position} fov={43} />}
    <OrbitControls ref={controls} makeDefault key={String(plan)} target={plan ? PLAN_POSE.target : overview.target}
      enableRotate={!plan} minDistance={4} maxDistance={30} minZoom={25} maxZoom={180} />
  </>;
}
