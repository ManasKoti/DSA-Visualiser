// ============================================================================
// Queue (FIFO)
// ----------------------------------------------------------------------------
// First entry of the 'structure' kind. Sort and search are one-shot: feed in
// an array, get back the entire frame stream. A structure is different -- it
// holds state across operations. Each call (enqueue / dequeue) is its own
// short frame stream that the UI loads into the engine on the spot, then
// promotes `nextState` into the held state once the stream is done.
//
// Modelled as a plain JS array. nodes[0] is the FRONT, nodes[length - 1] is
// the REAR. Enqueue pushes to the end, dequeue shifts from the start. There's
// no circular-buffer modelling here -- visualisation doesn't benefit from it
// and a plain array reads more cleanly on the canvas.
//
// State shape:
//   { items: number[] }   // ordered front -> rear
//
// Frame shape (nodes layout):
//   {
//     layout: 'nodes',
//     nodes:    [{ value }, ...],
//     pointers: { front?, rear? },
//     incoming?: index,    // node arriving this frame (enqueue)
//     outgoing?: index,    // node leaving  this frame (dequeue)
//     highlighted?: [indices],
//     message?, comparisons?, writes?
//   }
//
// Each operation returns `{ frames, nextState }`. The UI loads the frames
// into the engine and, once playback settles, copies nextState into the held
// state so the next op starts from the right baseline.
// ============================================================================

// ---- State helpers ---------------------------------------------------------

function initialState(arr = []) {
  return { items: arr.slice() };
}

// Frame builder. Centralises the boilerplate so each op reads as a story
// rather than a wall of object literals.
function frame(items, opts = {}) {
  const n = items.length;
  const pointers = n === 0
    ? {}
    : { front: 0, rear: n - 1 };
  return {
    layout: 'nodes',
    nodes:        items.map((value) => ({ value })),
    pointers,
    highlighted:  opts.highlighted ?? [],
    incoming:     opts.incoming    ?? null,
    outgoing:     opts.outgoing    ?? null,
    message:      opts.message     ?? '',
    // structures don't have comparison/write semantics in the sort/search
    // sense, but the engine reads these fields to drive the stat counter.
    // Leaving them undefined hides the counter, which is what we want.
  };
}

// ---- Operations ------------------------------------------------------------

// enqueue(state, value)
//   2 frames: arrival (new node highlighted at the rear, dashed border)
//   then settled (rear pointer moved to the new node, plain colour).
function enqueue(state, value) {
  // Defensive: coerce to a number when possible, otherwise pass through so
  // the caller can see what they typed in the message.
  const v = Number.isFinite(Number(value)) ? Number(value) : value;

  const before = state.items.slice();
  const after  = before.concat([v]);
  const newIdx = after.length - 1;

  const frames = [
    // Frame 1: the new value is sliding into place at the rear. Render it
    // already in the layout (so positions don't jump) but mark it as
    // `incoming` so the renderer dashes the border and uses the highlight
    // colour. REAR still points at the previous last node when there was
    // one; if the queue was empty, both pointers will land on the new node
    // in frame 2 -- show it as the only node here too.
    {
      layout: 'nodes',
      nodes: after.map((value) => ({ value })),
      pointers: before.length === 0
        ? {}
        : { front: 0, rear: before.length - 1 },
      incoming: newIdx,
      message: before.length === 0
        ? `Enqueueing ${v} into the empty queue.`
        : `Enqueueing ${v} at the rear.`,
    },
    // Frame 2: settled. REAR now sits on the new node; FRONT is unchanged
    // (or established, if the queue had been empty).
    frame(after, {
      message: after.length === 1
        ? `${v} is the only element; FRONT and REAR both point to it.`
        : `${v} is now at the rear.`,
    }),
  ];

  return { frames, nextState: { items: after } };
}

// dequeue(state)
//   Empty queue:    one no-op frame explaining why nothing happened.
//   Otherwise:      2 frames: outgoing (front highlighted, dashed) then
//                   settled (front removed, FRONT pointer moved).
function dequeue(state) {
  const before = state.items.slice();

  if (before.length === 0) {
    return {
      frames: [
        frame([], { message: 'Queue is empty — nothing to dequeue.' }),
      ],
      nextState: { items: [] },
    };
  }

  const removedValue = before[0];
  const after        = before.slice(1);

  const frames = [
    // Frame 1: the front node is about to leave. Mark it `outgoing` so the
    // renderer dashes it. Pointers stay where they were so the viewer sees
    // exactly which node is being removed.
    {
      layout: 'nodes',
      nodes: before.map((value) => ({ value })),
      pointers: { front: 0, rear: before.length - 1 },
      outgoing: 0,
      message: `Dequeueing front (${removedValue}).`,
    },
    // Frame 2: settled. Node gone, indices have shifted; FRONT pointer
    // re-anchors on whatever is now at index 0 (or no pointers at all if
    // the queue is now empty).
    frame(after, {
      message: after.length === 0
        ? `Removed ${removedValue}; queue is now empty.`
        : `Removed ${removedValue}; new front is ${after[0]}.`,
    }),
  ];

  return { frames, nextState: { items: after } };
}

// ---- Registry export -------------------------------------------------------

export const queue = {
  name: 'Queue',
  kind: 'structure',
  initialState,
  operations: {
    enqueue: { argLabel: 'value', fn: enqueue },
    dequeue: {                    fn: dequeue },
  },
  legendKeys: ['cell', 'highlight', 'pointer'],
};
