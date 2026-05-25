// ============================================================================
// Stack (LIFO)
// ----------------------------------------------------------------------------
// Second entry of the 'structure' kind (queue.js is the first; this file
// mirrors its shape so the contract stays uniform). Sort and search are
// one-shot: feed in an array, get back the entire frame stream. A structure
// is different -- it holds state across operations. Each call (push / pop)
// is its own short frame stream that the UI loads into the engine on the
// spot, then promotes `nextState` into the held state once the stream is
// done.
//
// Modelled as a plain JS array. nodes[0] is the BOTTOM of the stack,
// nodes[length - 1] is the TOP. push() appends to the end, pop() removes
// from the end -- matching Array.prototype.push / pop semantics so the code
// reads as expected. The renderer flips the visual axis: top of stack
// renders at the *top* of the canvas, so push animations look like values
// dropping in from above.
//
// State shape:
//   { items: number[] }   // ordered bottom -> top
//
// Frame shape (nodes layout, vertical orientation):
//   {
//     layout: 'nodes',
//     orientation: 'vertical',
//     nodes:    [{ value }, ...],
//     pointers: { top? },        // map of label -> node index
//     incoming?: index,          // node arriving this frame (push)
//     outgoing?: index,          // node leaving  this frame (pop)
//     highlighted?: [indices],
//     message?
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
    : { top: n - 1 };
  return {
    layout: 'nodes',
    orientation: 'vertical',
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

// push(state, value)
//   2 frames: arrival (new node highlighted on top, dashed border)
//   then settled (TOP pointer moved to the new node, plain colour).
function push(state, value) {
  // Defensive: coerce to a number when possible, otherwise pass through so
  // the caller can see what they typed in the message.
  const v = Number.isFinite(Number(value)) ? Number(value) : value;

  const before = state.items.slice();
  const after  = before.concat([v]);
  const newIdx = after.length - 1;

  const frames = [
    // Frame 1: the new value is dropping onto the top. Render it already in
    // the layout (so positions don't jump) but mark it as `incoming` so the
    // renderer dashes the border and uses the highlight colour. TOP still
    // points at the previous top node when there was one; if the stack was
    // empty, TOP simply isn't drawn yet -- the new node is the only thing
    // visible and frame 2 will anchor TOP onto it.
    {
      layout: 'nodes',
      orientation: 'vertical',
      nodes: after.map((value) => ({ value })),
      pointers: before.length === 0
        ? {}
        : { top: before.length - 1 },
      incoming: newIdx,
      message: before.length === 0
        ? `Pushing ${v} onto the empty stack.`
        : `Pushing ${v} onto the top.`,
    },
    // Frame 2: settled. TOP now sits on the new node.
    frame(after, {
      message: after.length === 1
        ? `${v} is the only element; TOP points to it.`
        : `${v} is now on top.`,
    }),
  ];

  return { frames, nextState: { items: after } };
}

// pop(state)
//   Empty stack:    one no-op frame explaining why nothing happened.
//   Otherwise:      2 frames: outgoing (top highlighted, dashed) then
//                   settled (top removed, TOP pointer moved down).
function pop(state) {
  const before = state.items.slice();

  if (before.length === 0) {
    return {
      frames: [
        frame([], { message: 'Stack is empty — nothing to pop.' }),
      ],
      nextState: { items: [] },
    };
  }

  const topIdx       = before.length - 1;
  const removedValue = before[topIdx];
  const after        = before.slice(0, -1);

  const frames = [
    // Frame 1: the top node is about to leave. Mark it `outgoing` so the
    // renderer dashes it. TOP pointer stays on it so the viewer sees
    // exactly which node is being removed.
    {
      layout: 'nodes',
      orientation: 'vertical',
      nodes: before.map((value) => ({ value })),
      pointers: { top: topIdx },
      outgoing: topIdx,
      message: `Popping top (${removedValue}).`,
    },
    // Frame 2: settled. Node gone; TOP pointer re-anchors on whatever is
    // now at the new top (or no pointer at all if the stack is now empty).
    frame(after, {
      message: after.length === 0
        ? `Removed ${removedValue}; stack is now empty.`
        : `Removed ${removedValue}; new top is ${after[after.length - 1]}.`,
    }),
  ];

  return { frames, nextState: { items: after } };
}

// ---- Registry export -------------------------------------------------------

export const stack = {
  name: 'Stack',
  kind: 'structure',
  initialState,
  operations: {
    push: { argLabel: 'value', fn: push },
    pop:  {                    fn: pop  },
  },
  legendKeys: ['cell', 'highlight', 'pointer'],
};
