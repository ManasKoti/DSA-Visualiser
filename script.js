// ============================================================================
// Entry point
// ----------------------------------------------------------------------------
// Boots the app:
//   1. Grab every DOM handle once.
//   2. Build a renderer bound to the canvas.
//   3. Build an engine whose onFrame callback updates the canvas + status bar.
//   4. Populate the algorithm dropdown from the registry based on the current
//      kind (Sorting / Searching), and wire kind/algo selectors.
//   5. Wire buttons, keyboard shortcuts, and input controls.
//
// Everything substantial lives in the focused modules below. This file is the
// glue and nothing more.
//
// Frame model (shared contract between algorithms and the renderer; the engine
// is frame-agnostic). Three layouts:
//
// Bar-layout frame (sort algorithms):
//   {
//     layout?: 'bars',   // default; field optional
//     array:        number[],
//     highlighted?: number[],
//     sorted?:      number[],
//     key?:         { value, index },
//     minIndex?:    number,
//     activeRange?: [lo, hi],
//     midIndex?:    number,
//     aux?:         { values, leftPtr, rightPtr, midOffset },
//     writeIndex?:  number,
//     pivotIndex?:  number,
//     partitionBoundary?: number,
//     scanIndex?:   number,
//     foundIndex?:  number,
//     message?:     string,
//     comparisons?: number,
//     writes?:      number
//   }
//
// Box-layout frame (search algorithms):
//   {
//     layout: 'boxes',
//     array:        number[],
//     current?:     number,    // pointer position; null on terminal frames
//     visited?:     number[],  // dimmed trail
//     foundIndex?:  number,    // present on the match frame only
//     message?:     string,
//     comparisons?: number,
//     writes?:      number
//   }
//
// Nodes-layout frame (structures: queue, eventually stack / linked list):
//   {
//     layout: 'nodes',
//     nodes:        [{ value }, ...],
//     pointers:     { front?, rear?, top? },
//     highlighted?: number[],
//     incoming?:    number,    // node entering this frame (enqueue)
//     outgoing?:    number,    // node leaving  this frame (dequeue)
//     message?:     string
//   }
// ============================================================================

import { createRenderer }          from './renderer.js';
import { renderLegend }            from './legend.js';
import { createEngine }            from './engine.js';
import { parseInput, randomArray } from './input.js';
import { ALGORITHMS }              from './algorithms/index.js';

// ---- DOM handles -----------------------------------------------------------
const canvas       = document.getElementById('stage');
const statusText   = document.getElementById('status-text');
const frameCounter = document.getElementById('frame-counter');

const btnPlay     = document.getElementById('btn-play');
const btnPause    = document.getElementById('btn-pause');
const btnStepFwd  = document.getElementById('btn-step-forward');
const btnStepBack = document.getElementById('btn-step-back');
const btnReset    = document.getElementById('btn-reset');
const speedInput  = document.getElementById('speed');
const speedValue  = document.getElementById('speed-value');
const kindSelect  = document.getElementById('kind');
const algoSelect  = document.getElementById('algo');
const inputField  = document.getElementById('input-array');
const targetRow   = document.getElementById('target-row');
const targetField = document.getElementById('input-target');
const btnApply    = document.getElementById('btn-apply');
const btnRandom   = document.getElementById('btn-random');
const inputError  = document.getElementById('input-error');
const legendEl    = document.getElementById('legend');
const statCounter = document.getElementById('stat-counter');
const opsRow      = document.getElementById('ops-row');
const opsValue    = document.getElementById('ops-value');
const opsButtons  = document.getElementById('ops-buttons');

// ---- Renderer and engine ---------------------------------------------------
const renderer = createRenderer(canvas);
const engine   = createEngine({
  initialFps: Number(speedInput.value),
  onFrame(frame, cursor, total) {
    renderer.drawFrame(frame);
    statusText.textContent   = frame?.message ?? '';
    frameCounter.textContent = `frame ${total ? cursor + 1 : 0} / ${total}`;
    if (frame != null && frame.comparisons !== undefined) {
      statCounter.textContent =
        `· ${frame.comparisons} comparisons  · ${frame.writes} write${frame.writes !== 1 ? 's' : ''}`;
    } else {
      statCounter.textContent = '';
    }
    // Structures: promote the staged nextState into the held state once the
    // op stream reaches its last frame. The engine pauses at that point, so
    // this fires exactly once per op (subsequent step-backs and replays do
    // not re-promote because pendingState is null after the first promotion).
    if (pendingState !== null && total > 0 && cursor === total - 1) {
      currentState = pendingState;
      pendingState = null;
    }
    updateButtons();
  },
});

// ---- Buttons reflect playing state ----------------------------------------
function updateButtons() {
  btnPlay.disabled  = engine.isPlaying();
  btnPause.disabled = !engine.isPlaying();
  // Op buttons (structures): disabled mid-playback to avoid races between an
  // in-flight operation's frame stream and a freshly-requested one.
  updateOpsButtons();
}

function updateOpsButtons() {
  const playing = engine.isPlaying();
  for (const btn of opsButtons.querySelectorAll('button')) {
    btn.disabled = playing;
  }
}

// ---- State ----------------------------------------------------------------
let currentArray  = [5, 2, 8, 1, 9, 3, 7, 4, 6];
let currentTarget = 7;

// Structures hold state across operations. `currentState` is the live state
// object the active structure works with -- swapped in by `loadAlgorithm`
// (via initialState) and advanced after each operation finishes playing.
let currentState  = null;
let pendingState  = null;   // becomes currentState once the op stream stops

// Remember the last algorithm picked per kind so switching kind round-trips
// nicely. Defaults below are arbitrary but match the first option in each list.
const lastAlgoByKind = {
  sort:      'bubble',
  search:    'linear',
  structure: 'queue',
};

// ---- Algorithm dropdown population ----------------------------------------
// Rebuilds the algorithm <select> with only the entries matching `kind`.
function populateAlgoOptions(kind) {
  algoSelect.innerHTML = '';
  for (const [key, def] of Object.entries(ALGORITHMS)) {
    if (def.kind !== kind) continue;
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = def.name;
    algoSelect.appendChild(opt);
  }
  // Restore the remembered algorithm for this kind, if it still exists in the
  // registry; otherwise fall back to the first option.
  const remembered = lastAlgoByKind[kind];
  if (remembered && ALGORITHMS[remembered]?.kind === kind) {
    algoSelect.value = remembered;
  } else {
    algoSelect.selectedIndex = 0;
    lastAlgoByKind[kind] = algoSelect.value;
  }
}

// Toggle per-kind UI surfaces:
//   - 'search'    -> Target field next to the array input
//   - 'structure' -> Operations row visible; input toolbar + playback-only
//                    footer elements hidden (driven by `body.mode-structure`
//                    rules in style.css; keeps the show/hide logic in CSS).
function syncKindRows(kind) {
  targetRow.hidden = kind !== 'search';
  opsRow.hidden    = kind !== 'structure';
  document.body.classList.remove('mode-sort', 'mode-search', 'mode-structure');
  document.body.classList.add(`mode-${kind}`);
}

// Build the op-button row from algo.operations. Each button captures its op
// name; the click handler reads currentState + the value input, runs the op,
// loads the resulting frame stream, and stages nextState to be promoted once
// playback settles.
function buildOpsRow(algo) {
  opsButtons.innerHTML = '';
  if (!algo?.operations) return;

  // Show the value input only if any operation actually accepts one. (For
  // queue both ops are present; dequeue doesn't consume the value.)
  const anyArg = Object.values(algo.operations).some((op) => op.argLabel);
  opsValue.parentElement.style.display = anyArg ? '' : 'none';

  for (const [name, op] of Object.entries(algo.operations)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    // Capitalise the op name for the label.
    btn.textContent = name.charAt(0).toUpperCase() + name.slice(1);
    btn.addEventListener('click', () => runOperation(name, op));
    opsButtons.appendChild(btn);
  }
  updateOpsButtons();
}

// Run a single structure operation: parse the value (if required), call the
// pure op fn, load the resulting frames into the engine, and stage the
// nextState. The state promotes to `currentState` either when playback
// finishes naturally (frame cursor hits the last frame) or when the user
// pauses -- both surfaces flow through engine.onFrame, where we promote
// pendingState if the cursor is on the last frame.
function runOperation(name, op) {
  // Defensive: structures use a held state. Initialise from the input array
  // if somehow it's missing (e.g. on first click after a hot reload).
  if (currentState === null) {
    const algo = ALGORITHMS[algoSelect.value];
    currentState = algo.initialState ? algo.initialState(currentArray) : { items: [] };
  }

  let arg;
  if (op.argLabel) {
    const parsed = parseTarget(opsValue.value);
    if (parsed.error) {
      inputError.textContent = `${op.argLabel}: ${parsed.error}`;
      return;
    }
    arg = parsed.value;
  }
  inputError.textContent = '';

  const result = op.fn(currentState, arg);
  if (!result || !Array.isArray(result.frames)) return;

  // Stage the next state. It promotes to currentState once the frame stream
  // settles (see onFrame).
  pendingState = result.nextState;
  engine.loadFrames(result.frames);
  // Auto-play so a click reads as a single user action rather than "click,
  // then press play". The engine pauses naturally at the end.
  engine.play();
}

function loadAlgorithm(key) {
  const algo = ALGORITHMS[key];
  if (!algo) return;
  renderLegend(legendEl, key);

  if (algo.kind === 'structure') {
    // Seed the structure from the current array, then render the resting
    // state as a single frame. No operation has been performed yet, so the
    // "frame stream" is just this initial snapshot.
    currentState = algo.initialState(currentArray);
    pendingState = null;
    buildOpsRow(algo);
    engine.loadFrames([buildSeedFrame(algo, currentState)]);
    return;
  }

  // Binary search requires a sorted array. Sort a copy so the visualizer's
  // displayed array matches what the algorithm actually walks over, without
  // mutating the user's input order for other algorithms.
  const arrForAlgo = key === 'binary'
    ? currentArray.slice().sort((a, b) => a - b)
    : currentArray.slice();
  const frames = algo.kind === 'search'
    ? algo.fn(arrForAlgo, currentTarget)
    : algo.fn(arrForAlgo);
  engine.loadFrames(frames);
}

// One-frame snapshot of a freshly-seeded structure. Walks the same nodes
// layout the operations produce so the canvas reads identically before and
// after any op.
function buildSeedFrame(algo, state) {
  const items = state.items ?? [];
  const n     = items.length;
  return {
    layout: 'nodes',
    nodes:    items.map((value) => ({ value })),
    pointers: n === 0 ? {} : { front: 0, rear: n - 1 },
    message:  n === 0
      ? `${algo.name} is empty.`
      : `${algo.name} seeded with ${n} element${n === 1 ? '' : 's'}.`,
  };
}

function setArray(arr) {
  currentArray = arr.slice();
  inputField.value = currentArray.join(', ');
  loadAlgorithm(algoSelect.value);
}

// Parse the 'Target' text field. Same rules as a single element of the array.
function parseTarget(text) {
  const trimmed = text.trim();
  if (trimmed === '')         return { error: 'Enter a target value.' };
  if (!/^\d+$/.test(trimmed)) return { error: `"${trimmed}" is not a non-negative integer.` };
  return { value: Number(trimmed) };
}

// ---- Input handling --------------------------------------------------------
function applyInput() {
  const result = parseInput(inputField.value);
  if (result.error) {
    inputError.textContent = result.error;
    return;
  }

  // For search algorithms, also validate the target before loading anything.
  const algo = ALGORITHMS[algoSelect.value];
  if (algo?.kind === 'search') {
    const t = parseTarget(targetField.value);
    if (t.error) {
      inputError.textContent = `Target: ${t.error}`;
      return;
    }
    currentTarget = t.value;
  }

  inputError.textContent = '';
  setArray(result.values);
}

// ---- Event wiring ----------------------------------------------------------
btnPlay.addEventListener('click',     () => engine.play());
btnPause.addEventListener('click',    () => engine.pause());
btnStepFwd.addEventListener('click',  () => engine.stepForward());
btnStepBack.addEventListener('click', () => engine.stepBack());
btnReset.addEventListener('click',    () => {
  // In structure mode, "Reset" means re-seed the queue from currentArray,
  // not just rewind the last op's frame stream. The array toolbar is hidden
  // in this mode, so this is the only built-in path back to a clean state.
  const algo = ALGORITHMS[algoSelect.value];
  if (algo?.kind === 'structure') {
    loadAlgorithm(algoSelect.value);
    return;
  }
  engine.reset();
});

speedInput.addEventListener('input', () => {
  const fps = Number(speedInput.value);
  engine.setFps(fps);
  speedValue.textContent = `${fps} fps`;
});

window.addEventListener('resize', () => {
  renderer.resize();
  engine.redraw();
});

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  switch (e.key) {
    case ' ':           e.preventDefault(); engine.isPlaying() ? engine.pause() : engine.play(); break;
    case 'ArrowRight':  engine.stepForward(); break;
    case 'ArrowLeft':   engine.stepBack();    break;
    case 'r': case 'R': engine.reset();       break;
  }
});

kindSelect.addEventListener('change', () => {
  const kind = kindSelect.value;
  populateAlgoOptions(kind);
  syncKindRows(kind);
  loadAlgorithm(algoSelect.value);
});

algoSelect.addEventListener('change', () => {
  // Remember the choice so toggling kind back later restores it.
  const algo = ALGORITHMS[algoSelect.value];
  if (algo) lastAlgoByKind[algo.kind] = algoSelect.value;
  loadAlgorithm(algoSelect.value);
});

btnApply.addEventListener('click',    applyInput);
btnRandom.addEventListener('click',   () => {
  const arr = randomArray();
  // In search mode, also synthesise a sensible target. With a fixed target
  // and a fresh random array, the visualisation almost always plays out as
  // a fruitless full scan -- pedagogically dull. Bias toward picking a value
  // that's actually in the array (80% of the time), and occasionally pick a
  // value outside it so the "not found" path is still reachable.
  if (ALGORITHMS[algoSelect.value]?.kind === 'search') {
    const hit = Math.random() < 0.8;
    if (hit) {
      currentTarget = arr[Math.floor(Math.random() * arr.length)];
    } else {
      // Guaranteed miss: any value strictly above the max of `arr`.
      currentTarget = Math.max(...arr) + 1 + Math.floor(Math.random() * 10);
    }
    targetField.value = String(currentTarget);
  }
  setArray(arr);
});
inputField.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); applyInput(); }
});
inputField.addEventListener('input', () => { inputError.textContent = ''; });
targetField.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); applyInput(); }
});
targetField.addEventListener('input', () => { inputError.textContent = ''; });

// ---- Boot ------------------------------------------------------------------
speedValue.textContent = `${speedInput.value} fps`;
inputField.value  = currentArray.join(', ');
targetField.value = String(currentTarget);
populateAlgoOptions(kindSelect.value);
syncKindRows(kindSelect.value);
renderer.resize();
loadAlgorithm(algoSelect.value);
updateButtons();
