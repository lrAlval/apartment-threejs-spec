import { assign, setup, type SnapshotFrom } from 'xstate';

// View mode: which of the three views is active, and what each view shows. Pure.
export type View = '3d' | '2d' | 'walk';
export type Layers = { ceiling: boolean; labels: boolean; measurements: boolean };

export function visibility(view: View, chosen: Layers) {
  const walk = view === 'walk', plan = view === '2d';
  // Walking forces the ceiling on and hides annotation; the plan never draws a ceiling.
  const layers = { ceiling: chosen.ceiling || walk, labels: chosen.labels && !walk, measurements: chosen.measurements && !walk };
  return { layers, ceilingMesh: layers.ceiling && !plan, interior: !plan, planWalls: plan, grid: !walk };
}

export type Vec3 = [number, number, number];
export type Pose = { position: Vec3; target: Vec3 };
/** Where each orbit view starts. The walk view starts at WALK_START in walk-motion. */
export const OVERVIEW_POSE: Pose = { position: [11, 10, 13], target: [3.8, 0, 3] };
export const PLAN_POSE: Pose = { position: [3.8, 14, 3], target: [3.8, 0, 3] };

type ViewEvent =
  | { type: 'SELECT_3D' } | { type: 'SELECT_2D' }
  | { type: 'ENTER_WALK'; overview?: Pose } | { type: 'EXIT_WALK' } | { type: 'RESET_WALK' };

/**
 * Transitions between view modes. Walking remembers which orbit view it was entered from
 * (history state), and entering from the overview keeps that camera pose for the return.
 */
export const viewMachine = setup({
  types: {} as { context: { overview: Pose; walkResets: number }; events: ViewEvent },
}).createMachine({
  id: 'view',
  context: { overview: OVERVIEW_POSE, walkResets: 0 },
  initial: 'orbit',
  on: { SELECT_3D: '.orbit.overview', SELECT_2D: '.orbit.plan' },
  states: {
    orbit: {
      initial: 'overview',
      states: {
        overview: { on: { ENTER_WALK: { target: '#view.walk', actions: assign({ overview: ({ context, event }) => event.overview ?? context.overview }) } } },
        plan: { on: { ENTER_WALK: '#view.walk' } },
        previous: { type: 'history' },
      },
    },
    walk: {
      on: {
        EXIT_WALK: 'orbit.previous',
        RESET_WALK: { actions: assign({ walkResets: ({ context }) => context.walkResets + 1 }) },
      },
    },
  },
});

export const viewOf = (snapshot: SnapshotFrom<typeof viewMachine>): View =>
  snapshot.matches('walk') ? 'walk' : snapshot.matches({ orbit: 'plan' }) ? '2d' : '3d';
