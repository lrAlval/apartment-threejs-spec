import React, { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera, PerspectiveCamera, Line } from '@react-three/drei';
import * as THREE from 'three';
import data from '../data/measurements.json';
import './style.css';
import { AutomationBridge } from './automation';
import { RoomOverlays, ProjectRoomOverlays } from './room-overlays';
type Point = [number, number];
const points = data.vertices as unknown as Record<string, Point>;
const height = data.defaults.ceilingHeight;
function Slab({ polygon, y=0, color }: {polygon:string[];y?:number;color:string}) {
  const geometry=useMemo(()=>{const s=new THREE.Shape(); polygon.forEach((id,i)=>{const [x,z]=points[id]; if(i===0)s.moveTo(x,-z);else s.lineTo(x,-z)});s.closePath();return new THREE.ShapeGeometry(s)},[polygon]);
  return <mesh geometry={geometry} rotation={[-Math.PI/2,0,0]} position={[0,y,0]}><meshStandardMaterial color={color} side={THREE.DoubleSide}/></mesh>;
}
function Box({position,size,color}:{position:number[];size:number[];color:string}) {return <mesh position={position as [number,number,number]}><boxGeometry args={size as [number,number,number]}/><meshStandardMaterial color={color}/></mesh>}
function Wall({wall,plan}:{wall:typeof data.walls[number];plan:boolean}) {
 const a=points[wall.a],b=points[wall.b],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
 const openings=data.openings.filter(o=>o.wall===wall.id).sort((a,b)=>a.offset-b.offset);
 const pieces:React.ReactNode[]=[];let cursor=0;
 function piece(start:number,end:number,bottom:number,top:number,key:string){if(end-start<.001||top-bottom<.001)return;pieces.push(<Box key={key} position={[(start+end)/2,(top+bottom)/2,0]} size={[end-start,top-bottom,wall.thickness]} color={wall.id.startsWith('exterior')?'#e7e3db':'#f6f2eb'}/>)}
 const h=plan?.10:wall.height;
 openings.forEach(o=>{piece(cursor,o.offset,0,h,o.id+'a');piece(o.offset,o.offset+o.width,0,Math.min(h,o.sill),o.id+'b');piece(o.offset,o.offset+o.width,o.sill+o.height,h,o.id+'c');cursor=o.offset+o.width;
 if(!plan)pieces.push(<Box key={o.id} position={[o.offset+o.width/2,o.sill+o.height/2,0]} size={[o.width,.025,.035]} color={o.type==='door'?'#a7845f':'#608e99'}/>);
 if(o.type==='window'&&!plan)pieces.push(<mesh key={o.id+'glass'} position={[o.offset+o.width/2,o.sill+o.height/2,0]}><boxGeometry args={[o.width,o.height,.018]}/><meshStandardMaterial color="#a8d1db" transparent opacity={.22}/></mesh>);
 });piece(cursor,len,0,h,'end');
 return <group position={[a[0],0,a[1]]} rotation={[0,-Math.atan2(b[1]-a[1],b[0]-a[0]),0]}>{pieces}</group>
}
function App(){const overlays=useRef<HTMLDivElement>(null);const [plan,setPlan]=useState(false),[ceiling,setCeiling]=useState(false),[labels,setLabels]=useState(true),[dimensions,setDimensions]=useState(false);
return <main><aside><div className="eyebrow">ARCHITECTURAL STUDY / 01</div><h1>Apartment 09<span>A place in perspective.</span></h1><p className="intro">Explore the shared geometry of your home. A measured starting point, ready to refine.</p><div className="stats"><div><strong>41.64 <small>m²</small></strong><span>Printed total area</span></div><div><strong>2.40 <small>m</small></strong><span>Assumed ceiling</span></div></div><h2>View & layers</h2><div className="views"><button aria-pressed={!plan} onClick={()=>setPlan(false)}>3D perspective</button><button aria-pressed={plan} onClick={()=>setPlan(true)}>2D floor plan</button></div>{[['Ceiling',ceiling,setCeiling],['Room labels',labels,setLabels],['Measurements',dimensions,setDimensions]].map(([label,value,set])=><label className="toggle" key={label as string}>{label as string}<input type="checkbox" checked={value as boolean} onChange={e=>(set as (v:boolean)=>void)(e.target.checked)}/></label>)}<h2>Spaces</h2><div className="legend">{data.rooms.map(r=><div key={r.id}><i style={{background:r.color}}/>{r.name}</div>)}</div><div className="note"><strong>Provisional reconstruction</strong><p>Printed dimensions anchor the trace. Wall coordinates, openings and fixtures remain estimates. See the measurement specification before adjusting.</p></div><a href="/source-plan.svg" target="_blank" rel="noreferrer">Open traced comparison ↗</a></aside><section className="viewport" aria-label="Interactive apartment model"><div className="view-heading"><span>DPTO 309–2009 · 2209 · 2309 · 2509</span><b>{plan?'PLAN / XZ':'PERSPECTIVE'}</b></div><Canvas dpr={[1,2]}><color attach="background" args={['#eeede8']}/><ambientLight intensity={1.4}/><directionalLight position={[2,10,4]} intensity={2}/>{plan?<OrthographicCamera makeDefault position={[3.8,14,3]} up={[0,0,-1]} zoom={68}/>:<PerspectiveCamera makeDefault position={[11,10,13]} fov={43}/>}<OrbitControls makeDefault key={String(plan)} target={[3.8,0,3]} enableRotate={!plan} minDistance={4} maxDistance={30} minZoom={25} maxZoom={180}/><ProjectRoomOverlays container={overlays} plan={plan}/><AutomationBridge view={plan?'2d':'3d'} layers={{ceiling,labels,measurements:dimensions}}/><group>{data.rooms.map(r=><Slab key={r.id} polygon={r.polygon} color={r.color}/>)}{data.walls.map(w=><Wall key={w.id} wall={w} plan={plan}/>)}{!plan&&data.fixtures.map(f=><group key={f.id}><Box position={f.position} size={f.size} color={f.kind==='hob'?'#484d4a':'#f5f5ef'}/>{f.kind==='sink'&&<Box position={[f.position[0],f.size[1]+.01,f.position[2]]} size={[f.size[0]*.7,.025,f.size[2]*.7]} color="#91a5aa"/>}</group>)}{ceiling&&!plan&&<group name="ceiling">{data.rooms.filter(r=>r.id!=='balcony').map(r=><Slab key={r.id} polygon={r.polygon} y={height} color="#faf7ef"/>)}</group>}<Line points={data.perimeter.concat(data.perimeter[0]).map(id=>[points[id][0],.015,points[id][1]])} color="#6d756c" lineWidth={1}/></group><gridHelper args={[20,20,'#d4d6cf','#e1e2dc']} position={[4,-.05,3]}/></Canvas><RoomOverlays container={overlays} labels={labels} dimensions={dimensions}/><footer><span>{plan?'Drag to pan · Scroll to zoom':'Drag to orbit · Right drag to pan · Scroll to zoom'}</span><span>1 unit = 1 metre</span></footer></section></main>}
createRoot(document.getElementById('root')!).render(<App/>);
