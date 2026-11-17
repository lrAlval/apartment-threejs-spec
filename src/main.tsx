import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { useMachine } from '@xstate/react';
import './style.css';
import { AutomationBridge } from './automation';
import { CameraRig, type CaptureOverview } from './camera-rig';
import { RoomOverlays, ProjectRoomOverlays } from './room-overlays';
import { ApartmentScene } from './scene';
import { Sidebar } from './sidebar';
import { viewMachine, viewOf, visibility, type Layers } from './view-mode';
import { newWalkInput, WalkPanel } from './walkthrough';

const HEADINGS = { walk: 'WALK / EYE LEVEL', '2d': 'PLAN / XZ', '3d': 'PERSPECTIVE' };

function App() {
  const overlays = useRef<HTMLDivElement>(null);
  const input = useRef(newWalkInput());
  const captureOverview = useRef<CaptureOverview>(null);
  const [snapshot, send] = useMachine(viewMachine);
  const [layers, setLayers] = useState<Layers>({ ceiling: false, labels: true, measurements: false });
  const view = viewOf(snapshot), visible = visibility(view, layers);
  return <main className={view === 'walk' ? 'walking' : undefined}>
    <Sidebar view={view} layers={layers}
      onSelect={next => send({ type: next === '2d' ? 'SELECT_2D' : 'SELECT_3D' })}
      onWalk={() => send({ type: 'ENTER_WALK', overview: captureOverview.current?.() })}
      onLayer={(layer, on) => setLayers(current => ({ ...current, [layer]: on }))} />
    <section className="viewport" aria-label="Interactive apartment model">
      <div className="view-heading"><span>DPTO 309–2009 · 2209 · 2309 · 2509</span><b>{HEADINGS[view]}</b></div>
      <Canvas dpr={[1, 2]}>
        <color attach="background" args={['#eeede8']} />
        <ambientLight intensity={1.4} />
        <directionalLight position={[2, 10, 4]} intensity={2} />
        <CameraRig view={view} overview={snapshot.context.overview} walkResets={snapshot.context.walkResets} input={input} capture={captureOverview} />
        <ProjectRoomOverlays container={overlays} plan={view === '2d'} />
        <AutomationBridge view={view} layers={visible.layers} />
        <ApartmentScene visible={visible} />
        {visible.grid && <gridHelper args={[20, 20, '#d4d6cf', '#e1e2dc']} position={[4, -.05, 3]} />}
      </Canvas>
      <RoomOverlays container={overlays} labels={visible.layers.labels} dimensions={visible.layers.measurements} />
      {view === 'walk'
        ? <WalkPanel input={input} onReset={() => send({ type: 'RESET_WALK' })} onExit={() => send({ type: 'EXIT_WALK' })} />
        : <footer>
          <span>{view === '2d' ? 'Drag to pan · Scroll to zoom' : 'Drag to orbit · Right drag to pan · Scroll to zoom'}</span>
          <span>1 unit = 1 metre</span>
        </footer>}
    </section>
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
