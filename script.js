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
// is frame-agnostic). Two layouts:
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
    updateButtons();
  },
});

// ---- Buttons reflect playing state ----------------------------------------
function updateButtons() {
  btnPlay.disabled  = engine.isPlaying();
  btnPause.disabled = !engine.isPlaying();
}

// ---- State ----------------------------------------------------------------
let currentArray  = [5, 2, 8, 1, 9, 3, 7, 4, 6];
let currentTarget = 7;

// Remember the last algorithm picked per kind so switching kind round-trips
// nicely. Defaults below are arbitrary but match the first option in each list.
const lastAlgoByKind = {
  sort:   'bubble',
  search: 'linear',
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

// Search algorithms get a 'Target' input next to the array input; sorts don't.
function syncTargetVisibility(kind) {
  targetRow.hidden = kind !== 'search';
}

function loadAlgorithm(key) {
  const algo = ALGORITHMS[key];
  if (!algo) return;
  renderLegend(legendEl, key);
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
btnReset.addEventListener('click',    () => engine.reset());

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
  syncTargetVisibility(kind);
  loadAlgorithm(algoSelect.value);
});

algoSelect.addEventListener('change', () => {
  // Remember the choice so toggling kind back later restores it.
  const algo = ALGORITHMS[algoSelect.value];
  if (algo) lastAlgoByKind[algo.kind] = algoSelect.value;
  loadAlgorithm(algoSelect.value);
});

btnApply.addEventListener('click',    applyInput);
btnRandom.addEventListener('click',   () => setArray(randomArray()));
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
syncTargetVisibility(kindSelect.value);
renderer.resize();
loadAlgorithm(algoSelect.value);
updateButtons();
