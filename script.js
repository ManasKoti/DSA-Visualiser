// ============================================================================
// Frame model
// ----------------------------------------------------------------------------
// Algorithms produce frames. The engine plays them back. Algorithm code never
// touches the canvas; rendering code never touches algorithm logic.
//
// Frame shape:
//   { array: number[], highlighted: number[], sorted?: number[], message?: string }
// ============================================================================

// ---- DOM handles -----------------------------------------------------------
const canvas       = document.getElementById('stage');
const ctx          = canvas.getContext('2d');
const statusText   = document.getElementById('status-text');
const frameCounter = document.getElementById('frame-counter');

const btnPlay        = document.getElementById('btn-play');
const btnPause       = document.getElementById('btn-pause');
const btnStepFwd     = document.getElementById('btn-step-forward');
const btnStepBack    = document.getElementById('btn-step-back');
const btnReset       = document.getElementById('btn-reset');
const speedInput     = document.getElementById('speed');
const speedValue     = document.getElementById('speed-value');
const algoSelect     = document.getElementById('algo');
const inputField     = document.getElementById('input-array');
const btnApply       = document.getElementById('btn-apply');
const btnRandom      = document.getElementById('btn-random');
const inputError     = document.getElementById('input-error');

// ---- Player state ----------------------------------------------------------
let frames  = [];
let cursor  = 0;        // index of frame currently displayed
let playing = false;
let timerId = null;
let fps     = Number(speedInput.value);

// ============================================================================
// Rendering
// ============================================================================

// Resize backing store to match CSS size so bars stay crisp on any viewport.
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width  = Math.floor(rect.width);
  canvas.height = Math.floor(rect.height);
  render();
}

function drawArray(arr, highlighted = [], sorted = []) {
  const W = canvas.width;
  const H = canvas.height;

  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, W, H);

  if (!arr || arr.length === 0) return;

  const slotWidth = W / arr.length;
  const padding   = Math.min(6, slotWidth * 0.15);
  const barWidth  = Math.max(1, slotWidth - padding);
  const maxVal    = Math.max(...arr, 1);
  const topPad    = 20;

  const hi  = new Set(highlighted);
  const sor = new Set(sorted);

  for (let i = 0; i < arr.length; i++) {
    const v         = arr[i];
    const barHeight = (v / maxVal) * (H - topPad);
    const x         = i * slotWidth + padding / 2;
    const y         = H - barHeight;

    // Colour priority: active highlight beats sorted beats default.
    let colour = '#4a9eff';                      // default: in-play, unsorted
    if (sor.has(i)) colour = '#3ddc97';          // locked in final position
    if (hi.has(i))  colour = '#ff9f43';          // actively being touched
    ctx.fillStyle = colour;
    ctx.fillRect(x, y, barWidth, barHeight);
  }
}

function render() {
  const f = frames[cursor] ?? { array: [], highlighted: [], sorted: [], message: 'No frames loaded.' };
  drawArray(f.array, f.highlighted, f.sorted);
  statusText.textContent   = f.message ?? '';
  frameCounter.textContent = `frame ${frames.length ? cursor + 1 : 0} / ${frames.length}`;
}

// ============================================================================
// Player
// ============================================================================

function updateButtons() {
  btnPlay.disabled  = playing;
  btnPause.disabled = !playing;
}

function tick() {
  if (!playing) return;
  if (cursor < frames.length - 1) {
    cursor++;
    render();
    timerId = setTimeout(tick, 1000 / fps);
  } else {
    pause();   // reached end
  }
}

function play() {
  if (frames.length === 0) return;
  if (cursor >= frames.length - 1) cursor = 0;   // replay from start
  playing = true;
  updateButtons();
  tick();
}

function pause() {
  playing = false;
  if (timerId !== null) {
    clearTimeout(timerId);
    timerId = null;
  }
  updateButtons();
}

function stepForward() {
  pause();
  if (cursor < frames.length - 1) {
    cursor++;
    render();
  }
}

function stepBack() {
  pause();
  if (cursor > 0) {
    cursor--;
    render();
  }
}

function reset() {
  pause();
  cursor = 0;
  render();
}

// ============================================================================
// Event wiring
// ============================================================================

btnPlay.addEventListener('click', play);
btnPause.addEventListener('click', pause);
btnStepFwd.addEventListener('click', stepForward);
btnStepBack.addEventListener('click', stepBack);
btnReset.addEventListener('click', reset);

speedInput.addEventListener('input', () => {
  fps = Number(speedInput.value);
  speedValue.textContent = `${fps} fps`;
});

window.addEventListener('resize', resizeCanvas);

// Keyboard shortcuts (handy for testing).
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  switch (e.key) {
    case ' ':            e.preventDefault(); playing ? pause() : play(); break;
    case 'ArrowRight':   stepForward(); break;
    case 'ArrowLeft':    stepBack();    break;
    case 'r': case 'R':  reset();       break;
  }
});

// ============================================================================
// Algorithm registry
// ----------------------------------------------------------------------------
// Each entry maps a key (matching an <option value> in the algo dropdown) to a
// pure function that takes an array and returns a list of frames. Adding a
// new sort = drop a file in /algorithms, add a <script> tag, add one line here
// and one <option> in index.html.
// ============================================================================

const ALGORITHMS = {
  bubble: { name: 'Bubble Sort', fn: bubbleSort },
};

// The current working array. Mutated only via setArray() so the input field,
// frame stream, and on-screen state never drift apart.
let currentArray = [5, 2, 8, 1, 9, 3, 7, 4, 6];

const MAX_INPUT_LENGTH = 200;   // cap to keep frame count sane

function loadAlgorithm(key) {
  const algo = ALGORITHMS[key];
  if (!algo) return;
  pause();
  frames = algo.fn(currentArray.slice());
  cursor = 0;
  render();
}

function setArray(arr) {
  currentArray = arr.slice();
  inputField.value = currentArray.join(', ');
  loadAlgorithm(algoSelect.value);
}

// ============================================================================
// Custom input
// ----------------------------------------------------------------------------
// Permissive parser: splits on commas and whitespace, both work and mix freely.
// Strict validation: non-negative integers only. Anything else returns an error
// for inline display so the user knows exactly what they got wrong.
// ============================================================================

function parseInput(text) {
  const tokens = text.split(/[\s,]+/).filter(t => t.length > 0);
  if (tokens.length === 0) {
    return { error: 'Enter at least one number.' };
  }
  if (tokens.length > MAX_INPUT_LENGTH) {
    return { error: `Too many values (max ${MAX_INPUT_LENGTH}).` };
  }
  const nums = [];
  for (const t of tokens) {
    if (!/^\d+$/.test(t)) {
      return { error: `"${t}" is not a non-negative integer.` };
    }
    nums.push(Number(t));
  }
  return { values: nums };
}

function randomArray(size = 12, maxVal = 50) {
  const arr = [];
  for (let i = 0; i < size; i++) {
    arr.push(Math.floor(Math.random() * maxVal) + 1);
  }
  return arr;
}

function applyInput() {
  const result = parseInput(inputField.value);
  if (result.error) {
    inputError.textContent = result.error;
    return;
  }
  inputError.textContent = '';
  setArray(result.values);
}

algoSelect.addEventListener('change', () => loadAlgorithm(algoSelect.value));
btnApply.addEventListener('click', applyInput);
btnRandom.addEventListener('click', () => setArray(randomArray()));
inputField.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); applyInput(); }
});
inputField.addEventListener('input', () => { inputError.textContent = ''; });

// ---- Boot ------------------------------------------------------------------
speedValue.textContent = `${fps} fps`;
inputField.value = currentArray.join(', ');
resizeCanvas();                       // sizes the canvas
loadAlgorithm(algoSelect.value);      // generates frames + paints first frame
updateButtons();
