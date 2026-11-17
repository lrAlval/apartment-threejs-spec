import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { apartment, type Opening, type Soffit, type Wall } from './apartment-model';
import type { visibility } from './view-mode';

type Vec3 = [number, number, number];
const data = apartment.measurements;
const { frameWidth, frameDepth } = data.defaults;
const FRAME_COLOR = '#608e99';

/** The Apartment model drawn as meshes, filtered by what the current view mode shows. */
export function ApartmentScene({ visible }: { visible: ReturnType<typeof visibility> }) {
  const outline = apartment.polygon([...data.perimeter, data.perimeter[0]]).map(([x, z]): Vec3 => [x, .015, z]);
  return <group>
    {data.rooms.map(room => <Slab key={room.id} polygon={room.polygon} color={room.color} />)}
    {data.walls.map(wall => <WallMesh key={wall.id} wall={wall} plan={visible.planWalls} />)}
    {visible.interior && data.fixtures.map(fixture => <Fixture key={fixture.id} fixture={fixture} />)}
    {visible.interior && <group name="soffits">{data.soffits.map(soffit => <SoffitMesh key={soffit.id} soffit={soffit} />)}</group>}
    {visible.ceilingMesh && <group name="ceiling">
      {data.rooms.map(room => <Slab key={room.id} polygon={room.polygon} y={room.ceiling.height} color="#faf7ef" />)}
    </group>}
    <Line points={outline} color="#6d756c" lineWidth={1} />
  </group>;
}

function Box({ position, size, color }: { position: number[]; size: number[]; color: string }) {
  return <mesh position={position as Vec3}>
    <boxGeometry args={size as Vec3} />
    <meshStandardMaterial color={color} />
  </mesh>;
}

function Slab({ polygon, y = 0, color }: { polygon: string[]; y?: number; color: string }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    apartment.polygon(polygon).forEach(([x, z], i) => i === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z));
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, [polygon]);
  return <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
    <meshStandardMaterial color={color} side={THREE.DoubleSide} />
  </mesh>;
}

function SoffitMesh({ soffit }: { soffit: Soffit }) {
  const { min, max } = apartment.soffitBox(soffit);
  return <Box position={min.map((v, i) => (v + max[i]) / 2)} size={min.map((v, i) => max[i] - v)} color="#e7e3db" />;
}

function Fixture({ fixture }: { fixture: (typeof data.fixtures)[number] }) {
  const { position: [x, y, z], size: [w, h, d] } = fixture;
  return <group>
    <Box position={[x, y, z]} size={[w, h, d]} color={fixture.kind === 'hob' ? '#484d4a' : '#f5f5ef'} />
    {fixture.kind === 'sink' && <Box position={[x, h + .01, z]} size={[w * .7, .025, d * .7]} color="#91a5aa" />}
  </group>;
}

/** A wall in its own frame: x runs along the wall from vertex a, y is up. */
function WallMesh({ wall, plan }: { wall: Wall; plan: boolean }) {
  const axis = apartment.wallAxis(wall);
  const top = plan ? .10 : wall.height;
  const color = wall.id.startsWith('exterior') ? '#e7e3db' : '#f6f2eb';
  const block = (key: string, start: number, end: number, bottom: number, height: number) =>
    end - start < .001 || height - bottom < .001 ? null
      : <Box key={key} position={[(start + end) / 2, (height + bottom) / 2, 0]} size={[end - start, height - bottom, wall.thickness]} color={color} />;
  return <group position={[axis.a[0], 0, axis.a[1]]} rotation={[0, -axis.angle, 0]}>
    {apartment.wallRuns(wall).map(run => block('run' + run.start, run.start, run.end, 0, top))}
    {apartment.openingsOf(wall).map(o => <group key={o.id}>
      {block('below', o.offset, o.offset + o.width, 0, Math.min(top, o.sill))}
      {block('above', o.offset, o.offset + o.width, o.sill + o.height, top)}
      {!plan && <OpeningFill opening={o} framed={o.type === 'window' || wall.id === 'balcony-glazing'} />}
    </group>)}
  </group>;
}

/** What fills an opening: a frame (windows, balcony glazing) or a threshold strip, plus glass for windows. */
function OpeningFill({ opening: o, framed }: { opening: Opening; framed: boolean }) {
  const f = frameWidth, midY = o.sill + o.height / 2;
  return <>
    {framed ? <group>
      {[o.offset + f / 2, o.offset + o.width - f / 2].map(x => <Box key={x} position={[x, midY, 0]} size={[f, o.height, frameDepth]} color={FRAME_COLOR} />)}
      {[o.sill + f / 2, o.sill + o.height - f / 2].map(y => <Box key={y} position={[o.offset + o.width / 2, y, 0]} size={[o.width, f, frameDepth]} color={FRAME_COLOR} />)}
    </group> : <Box position={[o.offset + o.width / 2, midY, 0]} size={[o.width, .025, .035]} color="#a7845f" />}
    {o.type === 'window' && <Glazing opening={o} />}
  </>;
}

/** One fixed pane, or overlapping framed sliding panels offset in depth. */
function Glazing({ opening: o }: { opening: Opening }) {
  const sliding = o.operation === 'sliding', panels = sliding ? o.panels! : 1, f = frameWidth;
  const width = o.width / panels + (panels > 1 ? f / 2 : 0);
  return <group name={sliding ? 'bedroom-sliding-window' : undefined}>
    {Array.from({ length: panels }, (_, i) => {
      const x = o.offset + (panels > 1 ? width / 2 + i * (o.width - width) / (panels - 1) : o.width / 2);
      const z = panels > 1 ? (i - .5) * frameDepth : 0;
      return <group key={i} position={[x, o.sill + o.height / 2, z]}>
        <mesh>
          <boxGeometry args={[width, o.height, .012]} />
          <meshStandardMaterial color="#a8d1db" transparent opacity={.22} />
        </mesh>
        {panels > 1 && [-1, 1].map(side => <Box key={'stile' + side} position={[side * (width - f) / 2, 0, 0]} size={[f, o.height, frameDepth]} color={FRAME_COLOR} />)}
        {panels > 1 && [-1, 1].map(side => <Box key={'rail' + side} position={[0, side * (o.height - f) / 2, 0]} size={[width, f, frameDepth]} color={FRAME_COLOR} />)}
      </group>;
    })}
  </group>;
}
