import React, { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera, PerspectiveCamera, Line } from '@react-three/drei';
import * as THREE from 'three';
import { apartment } from './apartment-model';
import './style.css';
import { AutomationBridge } from './automation';
import { RoomOverlays, ProjectRoomOverlays } from './room-overlays';
import { visibility, type View } from './view-mode';
import { newWalkInput, WalkCamera, WalkPanel } from './walkthrough';
const data = apartment.measurements;
function Soffit({soffit}:{soffit:typeof data.soffits[number]}) {
 const {min,max}=apartment.soffitBox(soffit);
 return <Box position={min.map((v,i)=>(v+max[i])/2)} size={min.map((v,i)=>max[i]-v)} color="#e7e3db"/>;
}
function Slab({ polygon, y=0, color }: {polygon:string[];y?:number;color:string}) {
  const geometry=useMemo(()=>{const s=new THREE.Shape(); apartment.polygon(polygon).forEach(([x,z],i)=>{ if(i===0)s.moveTo(x,-z);else s.lineTo(x,-z)});s.closePath();return new THREE.ShapeGeometry(s)},[polygon]);
  return <mesh geometry={geometry} rotation={[-Math.PI/2,0,0]} position={[0,y,0]}><meshStandardMaterial color={color} side={THREE.DoubleSide}/></mesh>;
}
function Box({position,size,color}:{position:number[];size:number[];color:string}) {return <mesh position={position as [number,number,number]}><boxGeometry args={size as [number,number,number]}/><meshStandardMaterial color={color}/></mesh>}
function Wall({wall,plan}:{wall:typeof data.walls[number];plan:boolean}) {
 const axis=apartment.wallAxis(wall);
 const pieces:React.ReactNode[]=[];
 function piece(start:number,end:number,bottom:number,top:number,key:string){if(end-start<.001||top-bottom<.001)return;pieces.push(<Box key={key} position={[(start+end)/2,(top+bottom)/2,0]} size={[end-start,top-bottom,wall.thickness]} color={wall.id.startsWith('exterior')?'#e7e3db':'#f6f2eb'}/>)}
 const h=plan?.10:wall.height;
 apartment.wallRuns(wall).forEach(run=>piece(run.start,run.end,0,h,'run'+run.start));
 apartment.openingsOf(wall).forEach(o=>{piece(o.offset,o.offset+o.width,0,Math.min(h,o.sill),o.id+'b');piece(o.offset,o.offset+o.width,o.sill+o.height,h,o.id+'c');
 if(!plan){
 const framed=o.type==='window'||wall.id==='balcony-glazing',f=data.defaults.frameWidth,d=data.defaults.frameDepth;
 if(framed)pieces.push(<group key={o.id+'frame'}>{[o.offset+f/2,o.offset+o.width-f/2].map(x=><Box key={x} position={[x,o.sill+o.height/2,0]} size={[f,o.height,d]} color="#608e99"/>)}{[o.sill+f/2,o.sill+o.height-f/2].map(y=><Box key={y} position={[o.offset+o.width/2,y,0]} size={[o.width,f,d]} color="#608e99"/>)}</group>);
 else pieces.push(<Box key={o.id} position={[o.offset+o.width/2,o.sill+o.height/2,0]} size={[o.width,.025,.035]} color="#a7845f"/>);
}
 if(o.type==='window'&&!plan){
 const panels=o.operation==='sliding'?o.panels!:1,f=data.defaults.frameWidth,d=data.defaults.frameDepth;
 pieces.push(<group key={o.id+'glass'} name={o.operation==='sliding'?'bedroom-sliding-window':undefined}>{Array.from({length:panels},(_,i)=>{
  const width=o.width/panels+(panels>1?f/2:0),x=o.offset+(panels>1?width/2+i*(o.width-width)/(panels-1):o.width/2),z=panels>1?(i-.5)*d:0;
  return <group key={i} position={[x,o.sill+o.height/2,z]}><mesh><boxGeometry args={[width,o.height,.012]}/><meshStandardMaterial color="#a8d1db" transparent opacity={.22}/></mesh>{panels>1&&[-1,1].map(side=><Box key={side} position={[side*(width-f)/2,0,0]} size={[f,o.height,d]} color="#608e99"/>)}{panels>1&&[-1,1].map(side=><Box key={'track'+side} position={[0,side*(o.height-f)/2,0]} size={[width,f,d]} color="#608e99"/>)}</group>;
 })}</group>);
}
 });
 return <group position={[axis.a[0],0,axis.a[1]]} rotation={[0,-axis.angle,0]}>{pieces}</group>
}
function App() {
 const overlays=useRef<HTMLDivElement>(null);
 const overviewCamera=useRef<THREE.PerspectiveCamera>(null);
 const overviewControls=useRef<React.ComponentRef<typeof OrbitControls>>(null);
 const overview=useRef({position:[11,10,13] as [number,number,number],target:[3.8,0,3] as [number,number,number]});
 const input=useRef(newWalkInput());
 const [view,setView]=useState<View>('3d'),[reset,setReset]=useState(0);
 const returnView=useRef<View>('3d');
 const plan=view==='2d',walk=view==='walk';
 const [ceiling,setCeiling]=useState(false),[labels,setLabels]=useState(true),[dimensions,setDimensions]=useState(false);
 function enterWalk() {
  if(walk)return;
  returnView.current=view;
  if(view==='3d'&&overviewCamera.current&&overviewControls.current){
   overview.current={position:overviewCamera.current.position.toArray(),target:overviewControls.current.target.toArray()};
  }
  setView('walk');
 }
 const visible=visibility(view,{ceiling,labels,measurements:dimensions});
 return <main className={walk?'walking':undefined}>
  <aside>
   <div className="eyebrow">ARCHITECTURAL STUDY / 01</div>
   <h1>Apartment 09<span>A place in perspective.</span></h1>
   <p className="intro">Explore the shared geometry of your home. A measured starting point, ready to refine.</p>
   <div className="stats"><div><strong>41.64 <small>m²</small></strong><span>Printed total area</span></div><div><strong>2.10–2.44 <small>m</small></strong><span>Approx. room ceilings</span></div></div>
   <h2>View & layers</h2>
   <div className="views"><button aria-pressed={view==='3d'} onClick={()=>setView('3d')}>3D perspective</button><button aria-pressed={plan} onClick={()=>setView('2d')}>2D floor plan</button></div>
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
    {walk?<PerspectiveCamera key="walk" makeDefault position={[6.35,1.6,2.35]} fov={65} near={.04}/>:plan?<OrthographicCamera key="plan" makeDefault position={[3.8,14,3]} up={[0,0,-1]} zoom={68}/>:<PerspectiveCamera key="overview" ref={overviewCamera} makeDefault position={overview.current.position} fov={43}/>}
    {walk?<WalkCamera input={input} reset={reset}/>:<OrbitControls ref={overviewControls} makeDefault key={String(plan)} target={plan?[3.8,0,3]:overview.current.target} enableRotate={!plan} minDistance={4} maxDistance={30} minZoom={25} maxZoom={180}/>}
    <ProjectRoomOverlays container={overlays} plan={plan}/>
    <AutomationBridge view={view} layers={visible.layers}/>
    <group>
     {data.rooms.map(r=><Slab key={r.id} polygon={r.polygon} color={r.color}/>)}
     {data.walls.map(w=><Wall key={w.id} wall={w} plan={visible.planWalls}/>)}
     {visible.interior&&data.fixtures.map(f=><group key={f.id}><Box position={f.position} size={f.size} color={f.kind==='hob'?'#484d4a':'#f5f5ef'}/>{f.kind==='sink'&&<Box position={[f.position[0],f.size[1]+.01,f.position[2]]} size={[f.size[0]*.7,.025,f.size[2]*.7]} color="#91a5aa"/>}</group>)}
     {visible.interior&&<group name="soffits">{data.soffits.map(s=><Soffit key={s.id} soffit={s}/>)}</group>}
     {visible.ceilingMesh&&<group name="ceiling">{data.rooms.map(r=><Slab key={r.id} polygon={r.polygon} y={r.ceiling.height} color="#faf7ef"/>)}</group>}
     <Line points={apartment.polygon(data.perimeter.concat(data.perimeter[0])).map(([x,z])=>[x,.015,z] as [number,number,number])} color="#6d756c" lineWidth={1}/>
    </group>
    {visible.grid&&<gridHelper args={[20,20,'#d4d6cf','#e1e2dc']} position={[4,-.05,3]}/>}
   </Canvas>
   <RoomOverlays container={overlays} labels={visible.layers.labels} dimensions={visible.layers.measurements}/>
   {walk?<WalkPanel input={input} onReset={()=>setReset(n=>n+1)} onExit={()=>setView(returnView.current)}/>:<footer><span>{plan?'Drag to pan · Scroll to zoom':'Drag to orbit · Right drag to pan · Scroll to zoom'}</span><span>1 unit = 1 metre</span></footer>}
  </section>
 </main>;
}createRoot(document.getElementById('root')!).render(<App/>);
