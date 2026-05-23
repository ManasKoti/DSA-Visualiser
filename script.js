// ============================================================================
// Entry point
// ----------------------------------------------------------------------------
// Boots the app:
//   1. Grab every DOM handle once.
//   2. Build a renderer bound to the canvas.
//   3. Build an engine whose onFrame callback updates the canvas + status bar.
//   4. Wire buttons, keyboard shortcuts, and input controls.
//
// Everything substantial lives in the focused modules below. This file is the
// glue and nothing more — if it grows past ~100 lines, something belongs in a
// module instead.
//
// Frame model (shared contract between algorithms and the renderer; the engine
// is frame-agnostic):
//   {
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
const algoSelect  = document.getElementById('algo');
const inputField  = document.getElementById('input-array');
const btnApply    = document.getElementById('btn-apply');
const btnRandom   = document.getElementById('btn-random');
const inputError  = document.getElementById('input-error');
const legendEl    = document.getElementById('legend');

// ---- Renderer and engine ---------------------------------------------------
const renderer = createRenderer(canvas);
const engine   = createEngine({
  initialFps: Number(speedInput.value),
  onFrame(frame, cursor, total) {
    renderer.drawFrame(frame);
    statusText.textContent   = frame?.message ?? '';
    frameCounter.textContent = `frame ${total ? cursor + 1 : 0} / ${total}`;
    updateButtons();
  },
});

// ---- Buttons reflect playing state ----------------------------------------
function updateButtons() {
  btnPlay.disabled  = engine.isPlaying();
  btnPause.disabled = !engine.isPlaying();
}

// ---- Algorithm loading -----------------------------------------------------
let currentArray = [5, 2, 8, 1, 9, 3, 7, 4, 6];

function loadAlgorithm(key) {
  const algo = ALGORITHMS[key];
  if (!algo) return;
  renderLegend(legendEl, key);
  engine.loadFrames(algo.fn(currentArray.slice()));
}

function setArray(arr) {
  currentArray = arr.slice();
  inputField.value = currentArray.join(', ');
  loadAlgorithm(algoSelect.value);
}

// ---- Input handling --------------------------------------------------------
function applyInput() {
  const result = parseInput(inputField.value);
  if (result.error) {
    inputError.textContent = result.error;
    return;
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

algoSelect.addEventListener('change', () => loadAlgorithm(algoSelect.value));
btnApply.addEventListener('click',    applyInput);
btnRandom.addEventListener('click',   () => setArray(randomArray()));
inputField.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); applyInput(); }
});
inputField.addEventListener('input', () => { inputError.textContent = ''; });

// ---- Boot ------------------------------------------------------------------
speedValue.textContent = `${speedInput.value} fps`;
inputField.value = currentArray.join(', ');
renderer.resize();
loadAlgorithm(algoSelect.value);
updateButtons();
