import { apartment } from './apartment-model';
import type { Layers, View } from './view-mode';

const LAYER_LABELS: [keyof Layers, string][] = [['ceiling', 'Ceiling'], ['labels', 'Room labels'], ['measurements', 'Measurements']];

/** Study notes, view mode buttons, layer toggles and the room legend. */
export function Sidebar({ view, layers, onSelect, onWalk, onLayer }: {
  view: View; layers: Layers; onSelect(view: '3d' | '2d'): void; onWalk(): void; onLayer(layer: keyof Layers, on: boolean): void;
}) {
  return <aside>
    <div className="eyebrow">ARCHITECTURAL STUDY / 01</div>
    <h1>Apartment 09<span>A place in perspective.</span></h1>
    <p className="intro">Explore the shared geometry of your home. A measured starting point, ready to refine.</p>
    <div className="stats">
      <div><strong>41.64 <small>m²</small></strong><span>Printed total area</span></div>
      <div><strong>2.10–2.44 <small>m</small></strong><span>Approx. room ceilings</span></div>
    </div>
    <h2>View & layers</h2>
    <div className="views">
      <button aria-pressed={view === '3d'} onClick={() => onSelect('3d')}>3D perspective</button>
      <button aria-pressed={view === '2d'} onClick={() => onSelect('2d')}>2D floor plan</button>
    </div>
    <button className="walk-entry" onClick={onWalk}>Walk inside</button>
    {LAYER_LABELS.map(([layer, label]) => <label className="toggle" key={layer}>
      {label}<input type="checkbox" checked={layers[layer]} onChange={e => onLayer(layer, e.target.checked)} />
    </label>)}
    <h2>Spaces</h2>
    <div className="legend">{apartment.measurements.rooms.map(r => <div key={r.id}><i style={{ background: r.color }} />{r.name}</div>)}</div>
    <div className="note">
      <strong>Provisional reconstruction</strong>
      <p>Room heights are approximate owner measurements. Soffit footprints and window proportions are provisional. Full-span bedroom window relationship to balcony/living remains unresolved.</p>
    </div>
    <a href="/source-plan.svg" target="_blank" rel="noreferrer">Original traced reference ↗</a>
  </aside>;
}
