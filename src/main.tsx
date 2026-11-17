import React, { useRef, useState } from 'react';
import { useMachine } from '@xstate/react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { apartment } from './apartment-model';
import './style.css';
import { AutomationBridge } from './automation';
import { ApartmentScene } from './scene';
import { RoomOverlays, ProjectRoomOverlays } from './room-overlays';
import { PLAN_POSE, viewMachine, viewOf, visibility } from './view-mode';
import { EYE_HEIGHT, WALK_START } from './walk-motion';
import { newWalkInput, WalkCamera, WalkPanel } from './walkthrough';
const data = apartment.measurements;
function App() {
 const overlays=useRef<HTMLDivElement>(null);
 const overviewCamera=useRef<THREE.PerspectiveCamera>(null);
 const overviewControls=useRef<React.ComponentRef<typeof OrbitControls>>(null);
 const input=useRef(newWalkInput());
 const [snapshot,send]=useMachine(viewMachine);
 const view=viewOf(snapshot),overview=snapshot.context.overview;
 const plan=view==='2d',walk=view==='walk';
 const [ceiling,setCeiling]=useState(false),[labels,setLabels]=useState(true),[dimensions,setDimensions]=useState(false);
 function enterWalk() {
  const camera=overviewCamera.current,controls=overviewControls.current;
  send({type:'ENTER_WALK',overview:view==='3d'&&camera&&controls?{position:camera.position.toArray(),target:controls.target.toArray()}:undefined});
 }
 const visible=visibility(view,{ceiling,labels,measurements:dimensions});
 return <main className={walk?'walking':undefined}>
  <aside>
   <div className="eyebrow">ARCHITECTURAL STUDY / 01</div>
   <h1>Apartment 09<span>A place in perspective.</span></h1>
   <p className="intro">Explore the shared geometry of your home. A measured starting point, ready to refine.</p>
   <div className="stats"><div><strong>41.64 <small>m²</small></strong><span>Printed total area</span></div><div><strong>2.10–2.44 <small>m</small></strong><span>Approx. room ceilings</span></div></div>
   <h2>View & layers</h2>
   <div className="views"><button aria-pressed={view==='3d'} onClick={()=>send({type:'SELECT_3D'})}>3D perspective</button><button aria-pressed={plan} onClick={()=>send({type:'SELECT_2D'})}>2D floor plan</button></div>
   <button className="walk-entry" onClick={enterWalk}>Walk inside</button>
   {([['Ceiling',ceiling,setCeiling],['Room labels',labels,setLabels],['Measurements',dimensions,setDimensions]] as const).map(([label,value,set])=><label className="toggle" key={label}>{label}<input type="checkbox" checked={value} onChange={e=>set(e.target.checked)}/></label>)}
   <h2>Spaces</h2><div className="legend">{data.rooms.map(r=><div key={r.id}><i style={{background:r.color}}/>{r.name}</div>)}</div>
   <div className="note"><strong>Provisional reconstruction</strong><p>Room heights are approximate owner measurements. Soffit footprints and window proportions are provisional. Full-span bedroom window relationship to balcony/living remains unresolved.</p></div>
   <a href="/source-plan.svg" target="_blank" rel="noreferrer">Original traced reference ↗</a>
  </aside>
  <section className="viewport" aria-label="Interactive apartment model">
   <div className="view-heading"><span>DPTO 309–2009 · 2209 · 2309 · 2509</span><b>{walk?'WALK / EYE LEVEL':plan?'PLAN / XZ':'PERSPECTIVE'}</b></div>
   <Canvas dpr={[1,2]}>
    <color attach="background" args={['#eeede8']}/><ambientLight intensity={1.4}/><directionalLight position={[2,10,4]} intensity={2}/>
    {walk?<PerspectiveCamera key="walk" makeDefault position={[WALK_START[0],EYE_HEIGHT,WALK_START[1]]} fov={65} near={.04}/>:plan?<OrthographicCamera key="plan" makeDefault position={PLAN_POSE.position} up={[0,0,-1]} zoom={68}/>:<PerspectiveCamera key="overview" ref={overviewCamera} makeDefault position={overview.position} fov={43}/>}
    {walk?<WalkCamera input={input} reset={snapshot.context.walkResets}/>:<OrbitControls ref={overviewControls} makeDefault key={String(plan)} target={plan?PLAN_POSE.target:overview.target} enableRotate={!plan} minDistance={4} maxDistance={30} minZoom={25} maxZoom={180}/>}
    <ProjectRoomOverlays container={overlays} plan={plan}/>
    <AutomationBridge view={view} layers={visible.layers}/>
    <ApartmentScene visible={visible}/>
    {visible.grid&&<gridHelper args={[20,20,'#d4d6cf','#e1e2dc']} position={[4,-.05,3]}/>}
   </Canvas>
   <RoomOverlays container={overlays} labels={visible.layers.labels} dimensions={visible.layers.measurements}/>
   {walk?<WalkPanel input={input} onReset={()=>send({type:'RESET_WALK'})} onExit={()=>send({type:'EXIT_WALK'})}/>:<footer><span>{plan?'Drag to pan · Scroll to zoom':'Drag to orbit · Right drag to pan · Scroll to zoom'}</span><span>1 unit = 1 metre</span></footer>}
  </section>
 </main>;
}createRoot(document.getElementById('root')!).render(<App/>);
