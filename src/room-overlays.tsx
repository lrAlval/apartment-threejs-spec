import { useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import data from '../data/measurements.json';

type Container = RefObject<HTMLDivElement | null>;
const points = data.vertices as Record<string, number[]>;
const rooms = data.rooms.map(room => {
  const xs = room.polygon.map(id => points[id][0]);
  const zs = room.polygon.map(id => points[id][1]);
  return { ...room, bounds: `${(Math.max(...xs) - Math.min(...xs)).toFixed(2)} × ${(Math.max(...zs) - Math.min(...zs)).toFixed(2)}` };
});

// Keep labels in the application's single React DOM root. Drei Html creates
// separate roots whose teardown can race React 19 commits when layers change.
export function RoomOverlays({ container, labels, dimensions }: { container: Container; labels: boolean; dimensions: boolean }) {
  return <div ref={container} className="room-overlays">
    {rooms.map(room => <div key={room.id} className="room-overlay">
      <div className="room-label" hidden={!labels}>{room.name}</div>
      <div className="dimension" hidden={!dimensions}>~{room.bounds} m<br/>estimated bounds</div>
    </div>)}
  </div>;
}

export function ProjectRoomOverlays({ container, plan }: { container: Container; plan: boolean }) {
  const point = useRef(new Vector3());
  useFrame(({ camera, size }) => {
    if (!container.current) return;
    for (let i = 0; i < rooms.length; i++) {
      const node = container.current.children[i] as HTMLElement;
      const [x, z] = rooms[i].label;
      point.current.set(x, plan ? 0.15 : 0.2, z).project(camera);
      node.style.transform = `translate3d(${(point.current.x + 1) * size.width / 2}px,${(1 - point.current.y) * size.height / 2}px,0) translate(-50%,-50%)`;
      node.style.visibility = point.current.z >= -1 && point.current.z <= 1 ? 'visible' : 'hidden';
    }
  });
  return null;
}
