// ============================================================================
// Frame model
// ----------------------------------------------------------------------------
// Algorithms produce frames. The engine plays them back. Algorithm code never
// touches the canvas; rendering code never touches algorithm logic.
//
// Frame shape (all fields except `array` are optional; absent = inactive):
//   {
//     array:        number[],
//     highlighted?: number[],                              // indices being touched
//     sorted?:      number[],                              // locked in final place
//     key?:         { value, index },                      // insertion sort: held element
//     minIndex?:    number,                                // selection sort: running min
//     activeRange?: [lo, hi],                              // merge sort: active sub-array
//     midIndex?:    number,                                // merge sort: split position
//     aux?:         { values, leftPtr, rightPtr, midOffset }, // merge sort: aux buffer
//     writeIndex?:  number,                                // merge sort: next write target
//     message?:     string
//   }
//
// Visual conventions:
//   - `key` present  ⇒ slot at key.index drawn as dashed gap; floating bar above chart.
//   - `minIndex`     ⇒ that slot is purple.
//   - `activeRange`  ⇒ bars outside the range are dimmed; a divider sits at midIndex.
//   - `aux`          ⇒ auxiliary buffer rendered as a second strip below the chart,
//                      aligned horizontally with the active range. Two arrow markers
//                      sit on top of the strip at leftPtr / rightPtr. Consumed slots
//                      (null) appear faded.
//   - `writeIndex`   ⇒ a small triangle above the main chart points at the next slot
//                      that the merge step will write into.
//   - `pivotIndex`         ⇒ quicksort: that bar is drawn in pink as the active pivot.
//   - `partitionBoundary`  ⇒ quicksort: bars left of this index (within activeRange)
//                            shade lighter to mark the "≤ pivot" prefix; a labelled
//                            'i' triangle sits above the boundary slot.
//   - `scanIndex`          ⇒ quicksort: a labelled 'j' triangle marks the cell being
//                            compared this step.
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

// Colours — kept as a single palette so the algorithm files don't have to
// know about them and so adding a new state means editing one place.
const COLOURS = {
  bg:        '#111',
  bar:       '#4a9eff',  // default in-play
  barDim:    '#2a3b4d',  // outside the active sub-array (merge sort, quicksort)
  barLE:     '#3a6fa5',  // quicksort: bar in the "≤ pivot" prefix (within active range)
  sorted:    '#3ddc97',
  minRun:    '#c084fc',  // selection sort running minimum
  highlight: '#ff9f43',
  held:      '#e94560',  // insertion sort floating key
  pivot:     '#ec4899',  // quicksort: active pivot
  divider:   '#888',     // mid-line in active range
  pointer:   '#ffd166',  // aux strip pointers, partition pointers
  writeMark: '#ff9f43',  // arrow above next write slot
  text:      '#fff',
  textDim:   '#777',
  dashGap:   '#555',
};

const FONT_MONO = '12px ui-monospace, "SF Mono", Menlo, Consolas, monospace';

function drawArray(arr, opts = {}) {
  const {
    highlighted       = [],
    sorted            = [],
    keyHeld           = null,
    minIndex          = null,
    activeRange       = null,   // [lo, hi]
    midIndex          = null,
    aux               = null,   // { values, leftPtr, rightPtr, midOffset }
    writeIndex        = null,
    pivotIndex        = null,   // quicksort: pivot bar
    partitionBoundary = null,   // quicksort: i + 1 (slot the next ≤-pivot value would land in)
    scanIndex         = null,   // quicksort: j (currently being compared)
  } = opts;

  const W = canvas.width;
  const H = canvas.height;

  ctx.fillStyle = COLOURS.bg;
  ctx.fillRect(0, 0, W, H);

  if (!arr || arr.length === 0) return;

  // Vertical budget: top region for held key (insertion), bottom region for
  // aux strip (merge). Either can be zero. The main chart claims whatever
  // is left.
  const heldArea  = keyHeld ? 80 : 0;
  const auxArea   = aux ? 90 : 0;       // strip + labels + gap
  const bottomPad = 20;

  const chartTop    = heldArea;
  const chartHeight = H - heldArea - auxArea - bottomPad;
  const chartBottom = chartTop + chartHeight;

  const slotWidth = W / arr.length;
  const padding   = Math.min(6, slotWidth * 0.15);
  const barWidth  = Math.max(1, slotWidth - padding);
  // Held key participates in scale so the floating bar is directly comparable.
  // Aux values do too, since they are the same numbers in flight.
  const auxMax    = aux ? Math.max(...aux.values.filter(v => v !== null), 1) : 1;
  const maxVal    = Math.max(...arr, keyHeld ? keyHeld.value : 1, auxMax, 1);

  const hiSet  = new Set(highlighted);
  const sorSet = new Set(sorted);
  const gap    = keyHeld ? keyHeld.index : -1;

  // Active sub-array bounds; default to "all of arr is active" so the dim
  // logic below doesn't have to special-case the no-activeRange case.
  const [aLo, aHi] = activeRange ?? [0, arr.length - 1];

  // ---- Main chart bars -----------------------------------------------------
  for (let i = 0; i < arr.length; i++) {
    const x = i * slotWidth + padding / 2;

    if (i === gap) {
      // Dashed outline marks the slot where the held key was lifted from.
      ctx.strokeStyle = COLOURS.dashGap;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(x, chartTop, barWidth, chartHeight);
      ctx.setLineDash([]);
      continue;
    }

    const v         = arr[i];
    const barHeight = (v / maxVal) * chartHeight;
    const y         = chartBottom - barHeight;

    const inActive = i >= aLo && i <= aHi;
    // Quicksort: indices in [aLo, partitionBoundary - 1] form the "≤ pivot"
    // prefix and get a slightly different shade so the prefix is visible at
    // a glance even without the marker.
    const inLEPrefix =
      inActive && partitionBoundary !== null && i < partitionBoundary && i >= aLo;

    // Colour priority: highlight > pivot > sorted > running min > ≤-prefix > active > dim.
    let colour = inActive ? COLOURS.bar : COLOURS.barDim;
    if (inLEPrefix)         colour = COLOURS.barLE;
    if (minIndex === i)     colour = COLOURS.minRun;
    if (sorSet.has(i))      colour = COLOURS.sorted;
    if (pivotIndex === i)   colour = COLOURS.pivot;
    if (hiSet.has(i))       colour = COLOURS.highlight;
    ctx.fillStyle = colour;
    ctx.fillRect(x, y, barWidth, barHeight);
  }

  // ---- Mid divider inside the active range --------------------------------
  if (activeRange !== null && midIndex !== null) {
    const dx = (midIndex + 1) * slotWidth;       // line between mid and mid+1
    ctx.strokeStyle = COLOURS.divider;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(dx, chartTop);
    ctx.lineTo(dx, chartBottom);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ---- Index markers above the main chart ---------------------------------
  // A small downward triangle pointing at a slot, optionally labelled.
  // Used for the merge-sort write head and quicksort's i / j pointers.
  const drawSlotMarker = (slot, colour, label, yOffset = 0) => {
    if (slot === null || slot === undefined) return;
    // Allow slot === arr.length so we can point "just past the end" if needed.
    if (slot < 0 || slot > arr.length) return;
    const cx = slot * slotWidth + slotWidth / 2;
    const ty = chartTop - 2 - yOffset;
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(cx, ty);
    ctx.lineTo(cx - 5, ty - 8);
    ctx.lineTo(cx + 5, ty - 8);
    ctx.closePath();
    ctx.fill();
    if (label) {
      ctx.fillStyle    = colour;
      ctx.font         = FONT_MONO;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(label, cx, ty - 9);
    }
  };

  // Merge sort write head.
  drawSlotMarker(writeIndex, COLOURS.writeMark, null);
  // Quicksort partition pointers. Stack them vertically when they collide so
  // the labels remain readable.
  if (partitionBoundary !== null && scanIndex !== null && partitionBoundary === scanIndex) {
    drawSlotMarker(partitionBoundary, COLOURS.pointer, 'i', 0);
    drawSlotMarker(scanIndex,         COLOURS.pointer, 'j', 16);
  } else {
    drawSlotMarker(partitionBoundary, COLOURS.pointer, 'i', 0);
    drawSlotMarker(scanIndex,         COLOURS.pointer, 'j', 0);
  }

  // ---- Floating held key (insertion sort) ---------------------------------
  if (keyHeld) {
    const x          = gap * slotWidth + padding / 2;
    const fullHeight = (keyHeld.value / maxVal) * chartHeight;
    const cappedH    = Math.min(fullHeight, heldArea - 12);
    const heldBottom = chartTop - 6;
    const heldTop    = heldBottom - cappedH;

    ctx.fillStyle = COLOURS.held;
    ctx.fillRect(x, heldTop, barWidth, cappedH);

    ctx.fillStyle    = COLOURS.text;
    ctx.font         = FONT_MONO;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(keyHeld.value), x + barWidth / 2, heldTop + 2);
  }

  // ---- Aux strip (merge sort) ---------------------------------------------
  if (aux) {
    drawAuxStrip({
      aux,
      activeLo:    aLo,
      slotWidth,
      padding,
      barWidth,
      maxVal,
      chartBottom,
      auxArea,
    });
  }
}

// Auxiliary buffer strip — drawn beneath the main chart, horizontally
// aligned with the active range so cells map one-to-one to their eventual
// destination slot. The two pointers sit above the strip; the divider
// between the left and right halves sits inside it.
function drawAuxStrip({ aux, activeLo, slotWidth, padding, barWidth, maxVal, chartBottom, auxArea }) {
  const { values, leftPtr, rightPtr, midOffset } = aux;
  const gapAbove   = 14;                            // breathing room below main chart
  const stripTop   = chartBottom + gapAbove;
  const stripH     = auxArea - gapAbove - 8;        // leave a little room for labels
  const stripBot   = stripTop + stripH;

  // Background band so the strip reads as a unit even when many cells are null.
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(activeLo * slotWidth, stripTop, values.length * slotWidth, stripH);

  for (let i = 0; i < values.length; i++) {
    const x = (activeLo + i) * slotWidth + padding / 2;
    const v = values[i];

    if (v === null) {
      // Consumed slot: a faint dashed outline so the eye can still see it was there.
      ctx.strokeStyle = COLOURS.dashGap;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(x, stripTop + 2, barWidth, stripH - 4);
      ctx.setLineDash([]);
      continue;
    }

    const h = Math.max(2, (v / maxVal) * (stripH - 4));
    const y = stripBot - h - 2;
    // Tint left half vs. right half so the two sorted runs are visually distinct.
    ctx.fillStyle = i < midOffset ? '#5d7fbf' : '#bf7f5d';
    ctx.fillRect(x, y, barWidth, h);
  }

  // Divider between the two halves of the strip.
  const dividerX = (activeLo + midOffset) * slotWidth;
  ctx.strokeStyle = COLOURS.divider;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(dividerX, stripTop);
  ctx.lineTo(dividerX, stripBot);
  ctx.stroke();
  ctx.setLineDash([]);

  // Pointers — small downward triangles hovering just above the strip.
  const drawPtr = (ptr, label) => {
    if (ptr === null || ptr === undefined) return;
    const cx = (activeLo + ptr) * slotWidth + slotWidth / 2;
    const ty = stripTop - 2;
    ctx.fillStyle = COLOURS.pointer;
    ctx.beginPath();
    ctx.moveTo(cx, ty);
    ctx.lineTo(cx - 5, ty - 8);
    ctx.lineTo(cx + 5, ty - 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle    = COLOURS.pointer;
    ctx.font         = FONT_MONO;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, cx, ty - 9);
  };
  drawPtr(leftPtr, 'i');
  drawPtr(rightPtr, 'j');
}

function render() {
  const f = frames[cursor] ?? { array: [], message: 'No frames loaded.' };
  drawArray(f.array, {
    highlighted:       f.highlighted       ?? [],
    sorted:            f.sorted            ?? [],
    keyHeld:           f.key               ?? null,
    minIndex:          f.minIndex          ?? null,
    activeRange:       f.activeRange       ?? null,
    midIndex:          f.midIndex          ?? null,
    aux:               f.aux               ?? null,
    writeIndex:        f.writeIndex        ?? null,
    pivotIndex:        f.pivotIndex        ?? null,
    partitionBoundary: f.partitionBoundary ?? null,
    scanIndex:         f.scanIndex         ?? null,
  });
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
  bubble:    { name: 'Bubble Sort',    fn: bubbleSort    },
  insertion: { name: 'Insertion Sort', fn: insertionSort },
  selection: { name: 'Selection Sort', fn: selectionSort },
  merge:     { name: 'Merge Sort',     fn: mergeSort     },
  quick:     { name: 'Quick Sort',     fn: quickSort     },
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
