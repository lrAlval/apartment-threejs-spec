import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import data from '../data/measurements.json';

type ViewState = {
  view: '2d' | '3d';
  layers: { ceiling: boolean; labels: boolean; measurements: boolean };
};

// A small, versioned in-page interface shared by agents and CI. No server needed.
export function AutomationBridge(state: ViewState) {
  const { gl, scene, camera, controls, invalidate } = useThree();
  const frames = useRef(0);
  useFrame(() => { frames.current++; });

  useEffect(() => {
    const orbit = controls as unknown as { target: THREE.Vector3; update(): void } | undefined;
    const api = {
      version: 1,
      getState: () => {
        let meshes = 0;
        scene.traverse(object => { if (object instanceof THREE.Mesh) meshes++; });
        return {
          ...state,
          rooms: data.rooms.map(({ id, name }) => ({ id, name })),
          walls: data.walls.length,
          openings: data.openings.length,
          labels: document.querySelectorAll('.room-label').length,
          dimensions: document.querySelectorAll('.dimension').length,
          render: {
            frames: frames.current,
            calls: gl.info.render.calls,
            triangles: gl.info.render.triangles,
            meshes,
            ceilingMeshes: scene.getObjectByName('ceiling')?.children.length ?? 0,
            contextLost: gl.getContext().isContextLost(),
          },
          camera: { type: camera.type, position: camera.position.toArray(), target: orbit?.target.toArray(), zoom: camera.zoom },
          viewport: { width: window.innerWidth, height: window.innerHeight },
          horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
        };
      },
      setCamera: (position: number[]) => {
        if (state.view !== '3d') throw new Error('Select the 3D view before positioning the camera');
        if (position.length !== 3 || !position.every(Number.isFinite)) throw new Error('Camera requires three finite coordinates');
        if (!orbit) throw new Error('Camera controls are not ready');
        const next = new THREE.Vector3(...position as [number, number, number]);
        if (next.distanceTo(orbit.target) < 0.1) throw new Error('Camera must be separated from its target');
        camera.position.copy(next);
        camera.lookAt(orbit.target);
        orbit.update();
        invalidate();
      },
    };
    window.apartment = api;
    return () => { if (window.apartment === api) delete window.apartment; };
  }, [state.view, state.layers.ceiling, state.layers.labels, state.layers.measurements, gl, scene, camera, controls, invalidate]);
  return null;
}

declare global {
  interface Window {
    apartment?: {
      version: number;
      getState(): unknown;
      setCamera(position: number[]): void;
    };
  }
}
