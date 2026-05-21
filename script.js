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

// Default input until the custom-input text box arrives (next step).
const defaultArray = [5, 2, 8, 1, 9, 3, 7, 4, 6];

function loadAlgorithm(key) {
  const algo = ALGORITHMS[key];
  if (!algo) return;
  pause();
  frames = algo.fn(defaultArray.slice());
  cursor = 0;
  render();
}

algoSelect.addEventListener('change', () => loadAlgorithm(algoSelect.value));

// ---- Boot ------------------------------------------------------------------
speedValue.textContent = `${fps} fps`;
resizeCanvas();    // sizes the canvas
loadAlgorithm(algoSelect.value);   // generates frames + paints first frame
updateButtons();
