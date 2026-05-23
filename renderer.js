// ============================================================================
// Renderer
// ----------------------------------------------------------------------------
// All canvas drawing lives here. Algorithm code never touches the canvas; the
// engine never touches drawing primitives. This module exposes:
//
//   - COLOURS         : the single colour palette
//   - LEGEND_LABELS   : human-readable label for each colour key
//   - FONT_MONO       : the monospace font used for status text & markers
//   - createRenderer(canvas) → { resize, drawFrame, clear }
//
// `createRenderer` captures the canvas + 2D context once. `drawFrame(frame)`
// reads the frame fields it understands and dispatches to the right primitive.
// Adding a new visual primitive means editing this file and nothing else.
// ============================================================================

// Single source of truth for every colour the renderer can use. Each entry
// has a stable semantic meaning; the legend below the canvas reads from
// LEGEND_LABELS to surface only the ones active for the current algorithm.
export const COLOURS = {
  bg:        '#111',
  bar:       '#4a9eff',  // default in-play / unsorted within active region
  barDim:    '#2a3b4d',  // outside the active sub-array (recursive sorts)
  barLE:     '#3a6fa5',  // quicksort: the "≤ pivot" prefix (within active range)
  sorted:    '#3ddc97',  // locked in final sorted position
  minRun:    '#c084fc',  // selection sort: running minimum
  highlight: '#ff9f43',  // actively touched this frame (comparison, swap target)
  spotlight: '#e94560',  // the anchor element of the step (insertion key, quicksort pivot)
  pointer:   '#ffd166',  // index markers above the chart (i, j, write head, aux pointers)
  divider:   '#888',     // mid-line in active range; aux-strip half divider
  text:      '#fff',
  textDim:   '#777',
  dashGap:   '#555',
};

// Human-readable label for each colour. Keep in sync with COLOURS. Algorithms
// pick a subset of these keys to populate the legend.
export const LEGEND_LABELS = {
  bar:       'unsorted',
  barDim:    'outside active range',
  barLE:     '≤ pivot',
  sorted:    'sorted',
  minRun:    'running minimum',
  highlight: 'comparing / writing',
  spotlight: 'key / pivot',
  pointer:   'index marker',
  divider:   'split',
};

export const FONT_MONO = '12px ui-monospace, "SF Mono", Menlo, Consolas, monospace';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  // Resize backing store to match CSS size so bars stay crisp on any viewport.
  function resize() {
    const rect = canvas.getBoundingClientRect();
    canvas.width  = Math.floor(rect.width);
    canvas.height = Math.floor(rect.height);
  }

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

    // Vertical budget: the chart never reflows when switching algorithms.
    // Top region houses the held key (insertion) and index markers (i, j,
    // write head). Bottom region houses the aux strip (merge). Both are
    // permanently reserved — empty on algorithms that don't use them — so
    // the bar heights and positions stay stable across the whole tool.
    const heldArea  = 80;
    const auxArea   = 90;
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
      if (pivotIndex === i)   colour = COLOURS.spotlight;
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
    drawSlotMarker(writeIndex, COLOURS.pointer, null);
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

      ctx.fillStyle = COLOURS.spotlight;
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
  // destination slot.
  function drawAuxStrip({ aux, activeLo, slotWidth, padding, barWidth, maxVal, chartBottom, auxArea }) {
    const { values, leftPtr, rightPtr, midOffset } = aux;
    const gapAbove = 14;
    const stripTop = chartBottom + gapAbove;
    const stripH   = auxArea - gapAbove - 8;
    const stripBot = stripTop + stripH;

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(activeLo * slotWidth, stripTop, values.length * slotWidth, stripH);

    for (let i = 0; i < values.length; i++) {
      const x = (activeLo + i) * slotWidth + padding / 2;
      const v = values[i];

      if (v === null) {
        ctx.strokeStyle = COLOURS.dashGap;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(x, stripTop + 2, barWidth, stripH - 4);
        ctx.setLineDash([]);
        continue;
      }

      const h = Math.max(2, (v / maxVal) * (stripH - 4));
      const y = stripBot - h - 2;
      ctx.fillStyle = i < midOffset ? '#5d7fbf' : '#bf7f5d';
      ctx.fillRect(x, y, barWidth, h);
    }

    const dividerX = (activeLo + midOffset) * slotWidth;
    ctx.strokeStyle = COLOURS.divider;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(dividerX, stripTop);
    ctx.lineTo(dividerX, stripBot);
    ctx.stroke();
    ctx.setLineDash([]);

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

  // Draw a single frame from the algorithm output. Unknown fields are
  // ignored, which means new algorithms can ship new frame fields without
  // breaking the renderer for the others.
  function drawFrame(frame) {
    const f = frame ?? { array: [] };
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
  }

  return { resize, drawFrame };
}
