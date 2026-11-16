import assert from 'node:assert/strict';
import { apartment, polygonArea, polygonContains } from '../src/apartment-model.ts';
const d=apartment.measurements,p=apartment.point;
const area=poly=>polygonArea(apartment.polygon(poly));
function intersect(a,b,c,e){let cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);return cross(a,b,c)*cross(a,b,e)<-1e-9&&cross(c,e,a)*cross(c,e,b)<-1e-9}
for(const r of [...d.rooms,{id:'perimeter',polygon:d.perimeter}]){assert(area(r.polygon)>0);let q=r.polygon.map(p);for(let i=0;i<q.length;i++)for(let j=i+1;j<q.length;j++)assert(!intersect(q[i],q[(i+1)%q.length],q[j],q[(j+1)%q.length]),`Self intersection ${r.id}`)}
for(const r of d.rooms){assert(Number.isFinite(r.ceiling.height)&&r.ceiling.height>0,`Invalid ceiling ${r.id}`);assert.equal(r.ceiling.status,'estimated');assert(r.ceiling.source);}
const contains=(poly,q)=>polygonContains(apartment.polygon(poly),q);
for(const s of d.soffits){
 const room=apartment.room(s.room),a=p(s.a),b=p(s.b);
 assert(Number.isFinite(s.depth)&&s.depth>0&&a[1]===b[1]&&b[0]>a[0],`Invalid soffit footprint ${s.id}`);
 assert(Number.isFinite(s.underside)&&s.underside>0&&s.underside<room.ceiling.height,`Invalid soffit elevation ${s.id}`);
 // shortcut: soffits support horizontal rectangular bands only; extend when measured footprints need other shapes.
 assert([a,b,[a[0],a[1]+s.depth],[b[0],b[1]+s.depth]].every(q=>contains(room.polygon,q)),`Soffit outside room ${s.id}`);
 assert.equal(s.status,'estimated');assert(s.source);
}
assert(d.defaults.frameWidth>0&&d.defaults.frameDepth>0);
for(const w of d.walls){
 if(w.heightRooms)assert.equal(w.height,Math.max(...w.heightRooms.map(id=>{const room=d.rooms.find(r=>r.id===id);assert(room,`Unknown wall room ${id}`);return room.ceiling.height})),`Wall/ceiling mismatch ${w.id}`);const len=apartment.wallAxis(w).length;assert(len>0);const os=apartment.openingsOf(w);let end=0;for(const o of os){assert(o.offset>=end-1e-8&&o.offset+o.width<=len+1e-8,`Invalid opening ${o.id}`);assert(o.sill+o.height<=w.height);end=o.offset+o.width}}
for(const o of d.openings){
 const wall=d.walls.find(w=>w.id===o.wall);assert(wall,`Unknown opening wall ${o.id}`);
 assert(Number.isFinite(o.width)&&o.width>2*d.defaults.frameWidth,`Invalid frame fit ${o.id}`);
 if(o.operation==='sliding')assert(Number.isInteger(o.panels)&&o.panels===2,`Unsupported sliding panel count ${o.id}`);
 const center=apartment.wallAxis(wall).at(o.offset+o.width/2);
 for(const s of d.soffits){const {min,max}=apartment.soffitBox(s);if(center[0]>=min[0]-1e-8&&center[0]<=max[0]+1e-8&&center[1]>=min[2]-1e-8&&center[1]<=max[2]+1e-8)assert(o.sill+o.height<=s.underside+1e-8,`Soffit blocks opening ${o.id}`);}
}
for(let i=0;i<d.rooms.length;i++)for(let j=i+1;j<d.rooms.length;j++){let a=d.rooms[i],b=d.rooms[j];for(let k=0;k<a.polygon.length;k++)for(let l=0;l<b.polygon.length;l++)assert(!intersect(p(a.polygon[k]),p(a.polygon[(k+1)%a.polygon.length]),p(b.polygon[l]),p(b.polygon[(l+1)%b.polygon.length])),`Rooms cross: ${a.id}/${b.id}`)}
const reached=new Set(['outside']);for(let i=0;i<10;i++)for(const o of d.openings)if(o.connects?.some(r=>reached.has(r)))o.connects.forEach(r=>reached.add(r));
assert(['living','bedroom','bathroom','balcony'].every(r=>reached.has(r)));
// Kitchen shares its full open north edge with the living room.
assert(d.rooms.find(r=>r.id==='kitchen').polygon.includes('U'));
const gross=area(d.perimeter),sum=d.rooms.reduce((s,r)=>s+area(r.polygon),0);assert(Math.abs(sum-gross)<1e-6,'Room polygons must partition perimeter');assert(Math.abs(gross-41.64)/41.64<.2,'Trace area differs by over 20%');
console.log(JSON.stringify({perimeterArea:gross,roomAreaSum:sum,printedArea:41.64,differencePercent:100*(gross/41.64-1),rooms:d.rooms.map(r=>({id:r.id,area:area(r.polygon)}))},null,2));
