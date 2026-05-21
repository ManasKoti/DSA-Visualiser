// ============================================================================
// Frame model
// ----------------------------------------------------------------------------
// Algorithms produce frames. The engine plays them back. Algorithm code never
// touches the canvas; rendering code never touches algorithm logic.
//
// Frame shape:
//   { array: number[], highlighted: number[], message?: string }
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

function drawArray(arr, highlighted = []) {
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

  const hi = new Set(highlighted);

  for (let i = 0; i < arr.length; i++) {
    const v         = arr[i];
    const barHeight = (v / maxVal) * (H - topPad);
    const x         = i * slotWidth + padding / 2;
    const y         = H - barHeight;

    ctx.fillStyle = hi.has(i) ? '#ff9f43' : '#4a9eff';
    ctx.fillRect(x, y, barWidth, barHeight);
  }
}

function render() {
  const f = frames[cursor] ?? { array: [], highlighted: [], message: 'No frames loaded.' };
  drawArray(f.array, f.highlighted);
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
// Hand-written fake frames
// ----------------------------------------------------------------------------
// Purpose: exercise the engine before any real algorithm exists.
// Covers: empty highlights, single highlight, multi highlight, array mutation.
// ============================================================================

frames = [
  { array: [4, 2, 7, 1, 9, 3, 5], highlighted: [],            message: 'Initial state'                       },
  { array: [4, 2, 7, 1, 9, 3, 5], highlighted: [0],           message: 'Looking at index 0'                  },
  { array: [4, 2, 7, 1, 9, 3, 5], highlighted: [0, 4],        message: 'Comparing indices 0 and 4'           },
  { array: [4, 2, 7, 1, 9, 3, 5], highlighted: [4],           message: 'Max so far is at index 4'            },
  { array: [9, 2, 7, 1, 4, 3, 5], highlighted: [0, 4],        message: 'Swapped indices 0 and 4'             },
  { array: [9, 2, 7, 1, 4, 3, 5], highlighted: [],            message: 'Brief pause...'                      },
  { array: [9, 2, 7, 1, 4, 3, 5], highlighted: [1,2,3,4,5,6], message: 'Highlighting the rest of the array' },
  { array: [9, 2, 7, 1, 4, 3, 5], highlighted: [],            message: 'Engine works.'                       },
];

// ---- Boot ------------------------------------------------------------------
speedValue.textContent = `${fps} fps`;
resizeCanvas();    // also paints first frame via render()
updateButtons();
