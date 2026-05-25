// ============================================================================
// Renderer
// ----------------------------------------------------------------------------
// All canvas drawing lives here. Algorithm code never touches the canvas; the
// engine never touches drawing primitives. This module exposes:
//
//   - COLOURS         : the single colour palette
//   - LEGEND_LABELS   : human-readable label for each colour key
//   - FONT_MONO       : the monospace font used for status text & markers
//   - createRenderer(canvas) -> { resize, drawFrame, clear }
//
// `createRenderer` captures the canvas + 2D context once. `drawFrame(frame)`
// reads the frame fields it understands and dispatches to the right primitive.
// Three layouts are supported:
//   - 'bars'  (default; sort algorithms)
//   - 'boxes' (search algorithms; pointer + dimmed visited trail)
//   - 'nodes' (linear structures; rounded-rect nodes with named pointers)
// Adding a new visual primitive means editing this file and nothing else.
// ============================================================================

// Single source of truth for every colour the renderer can use. Each entry
// has a stable semantic meaning; the legend below the canvas reads from
// LEGEND_LABELS to surface only the ones active for the current algorithm.
export const COLOURS = {
  bg:        '#111',
  bar:       '#4a9eff',  // default in-play / unsorted within active region
  barDim:    '#2a3b4d',  // outside the active sub-array (recursive sorts)
  barLE:     '#3a6fa5',  // quicksort: the "<= pivot" prefix (within active range)
  sorted:    '#3ddc97',  // locked in final sorted position
  minRun:    '#c084fc',  // selection sort: running minimum
  highlight: '#ff9f43',  // actively touched this frame (comparison, swap target)
  spotlight: '#e94560',  // the anchor element of the step (insertion key, quicksort pivot)
  pointer:   '#ffd166',  // index markers above the chart (i, j, write head, aux pointers)
  divider:   '#888',     // mid-line in active range; aux-strip half divider
  found:     '#3ddc97',  // search: index whose value matches the target
  // Box-layout aliases (point at existing colours; legend uses these labels).
  cell:      '#4a9eff',  // alias of `bar`:    unvisited cell
  cellDim:   '#2a3b4d',  // alias of `barDim`: visited cell (dimmed trail)
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
  found:     'match',
  // Box-layout aliases: the bar-flavoured keys ('bar', 'barDim') don't read
  // naturally in a cell-and-pointer visual. These point at existing colour
  // values so no new palette entries are needed.
  cell:      'unvisited',
  cellDim:   'visited',
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
      partitionBoundary = null,   // quicksort: i + 1 (slot the next <=-pivot value would land in)
      scanIndex         = null,   // quicksort: j (currently being compared)
      foundIndex        = null,   // linear/binary search: index whose value matches the target
    } = opts;

    const W = canvas.width;
    const H = canvas.height;

    ctx.fillStyle = COLOURS.bg;
    ctx.fillRect(0, 0, W, H);

    if (!arr || arr.length === 0) return;

    // Vertical budget: the chart never reflows when switching algorithms.
    // Top region houses the held key (insertion) and index markers (i, j,
    // write head). Bottom region houses the aux strip (merge). Both are
    // permanently reserved -- empty on algorithms that don't use them -- so
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
      // Quicksort: indices in [aLo, partitionBoundary - 1] form the "<= pivot"
      // prefix and get a slightly different shade so the prefix is visible at
      // a glance even without the marker.
      const inLEPrefix =
        inActive && partitionBoundary !== null && i < partitionBoundary && i >= aLo;

      // Colour priority: found > highlight > pivot > sorted > running min > <=-prefix > active > dim.
      let colour = inActive ? COLOURS.bar : COLOURS.barDim;
      if (inLEPrefix)         colour = COLOURS.barLE;
      if (minIndex === i)     colour = COLOURS.minRun;
      if (sorSet.has(i))      colour = COLOURS.sorted;
      if (pivotIndex === i)   colour = COLOURS.spotlight;
      if (hiSet.has(i))       colour = COLOURS.highlight;
      if (foundIndex === i)   colour = COLOURS.found;
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

  // Auxiliary buffer strip -- drawn beneath the main chart, horizontally
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

  // ===========================================================================
  // Box layout -- used by search algorithms.
  // ---------------------------------------------------------------------------
  // Each array slot renders as a labelled square. A downward arrow above the
  // 'current' index acts as the pointer; the 'visited' set dims past slots so
  // the scan history is visible at a glance. No bar heights, no aux strip.
  // Frame shape understood by drawBoxes:
  //   { array, current, visited[], foundIndex }
  // ===========================================================================
  function drawBoxes(arr, opts = {}) {
    const {
      current    = null,
      visited    = [],
      foundIndex = null,
      // Binary search extras: the active [low, high] window, the mid pointer,
      // and the indices already ruled out. `mid` is treated like `current`
      // (it's the cell being compared this frame); `eliminated` is treated
      // like `visited` (dimmed trail of indices the algorithm has discarded).
      low        = null,
      high       = null,
      mid        = null,
      eliminated = [],
    } = opts;

    // Normalise binary-search fields onto the same names the rest of this
    // function already understands.
    const effCurrent = current ?? mid;
    const effVisited = visited.length ? visited : eliminated;

    const W = canvas.width;
    const H = canvas.height;

    ctx.fillStyle = COLOURS.bg;
    ctx.fillRect(0, 0, W, H);

    if (!arr || arr.length === 0) return;

    // Layout: a centred row of square-ish cells. Reserve a band on top for the
    // pointer arrow + label, and a band on the bottom for the index labels.
    const topBand    = 60;   // pointer + 'i' label
    const bottomBand = 28;   // index numerals
    const sidePad    = 24;
    const cellGap    = 8;

    const usableW = W - sidePad * 2;
    const usableH = H - topBand - bottomBand;
    const n       = arr.length;

    // Cell width is constrained by both the horizontal budget and a cap so
    // short arrays don't blow up to canvas-wide bricks.
    const cellW    = Math.min(96, (usableW - cellGap * (n - 1)) / n);
    const cellH    = Math.min(96, usableH);
    const cellSize = Math.max(20, Math.min(cellW, cellH));

    const rowWidth = n * cellSize + (n - 1) * cellGap;
    const xStart   = (W - rowWidth) / 2;
    const yCell    = topBand + (usableH - cellSize) / 2;

    const visSet = new Set(effVisited);

    // ---- Cells -------------------------------------------------------------
    for (let i = 0; i < n; i++) {
      const x = xStart + i * (cellSize + cellGap);
      const y = yCell;

      // Colour priority: found > current/mid > visited/eliminated > unvisited.
      let fill       = COLOURS.cell;
      let textColour = COLOURS.text;
      if (visSet.has(i)) {
        fill       = COLOURS.cellDim;
        textColour = COLOURS.textDim;
      }
      if (effCurrent === i) {
        fill       = COLOURS.highlight;
        textColour = COLOURS.text;
      }
      if (foundIndex === i) {
        fill       = COLOURS.found;
        textColour = '#0a2a1a';   // dark text on the bright green fill
      }

      // Filled square with a subtle border.
      ctx.fillStyle = fill;
      roundRect(ctx, x, y, cellSize, cellSize, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      roundRect(ctx, x + 0.5, y + 0.5, cellSize - 1, cellSize - 1, 8);
      ctx.stroke();

      // Value, centred.
      ctx.fillStyle    = textColour;
      ctx.font         = '600 ' + Math.floor(cellSize * 0.36) + 'px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(arr[i]), x + cellSize / 2, y + cellSize / 2);

      // Index, dim, beneath the cell.
      ctx.fillStyle    = COLOURS.textDim;
      ctx.font         = FONT_MONO;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(String(i), x + cellSize / 2, y + cellSize + 6);
    }

    // ---- Low/High bracket (binary search) ----------------------------------
    // A thin bracket below the active window plus 'low' / 'high' labels.
    // Only drawn when both bounds are present and form a valid range.
    if (low !== null && high !== null && low >= 0 && high < n && low <= high) {
      const xLo    = xStart + low  * (cellSize + cellGap);
      const xHi    = xStart + high * (cellSize + cellGap) + cellSize;
      const yBrack = yCell + cellSize + 22;   // sits below the index numerals
      const tick   = 6;
      ctx.strokeStyle = COLOURS.divider;
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.moveTo(xLo, yBrack - tick);
      ctx.lineTo(xLo, yBrack);
      ctx.lineTo(xHi, yBrack);
      ctx.lineTo(xHi, yBrack - tick);
      ctx.stroke();

      ctx.fillStyle    = COLOURS.divider;
      ctx.font         = FONT_MONO;
      ctx.textBaseline = 'top';
      ctx.textAlign    = 'left';
      ctx.fillText('low',  xLo + 2, yBrack + 2);
      ctx.textAlign    = 'right';
      ctx.fillText('high', xHi - 2, yBrack + 2);
    }

    // ---- Pointer arrow above current/mid cell ------------------------------
    if (effCurrent !== null && effCurrent >= 0 && effCurrent < n) {
      const cx    = xStart + effCurrent * (cellSize + cellGap) + cellSize / 2;
      const tipY  = yCell - 6;
      const baseY = tipY - 14;
      ctx.fillStyle = COLOURS.pointer;
      ctx.beginPath();
      ctx.moveTo(cx, tipY);
      ctx.lineTo(cx - 8, baseY);
      ctx.lineTo(cx + 8, baseY);
      ctx.closePath();
      ctx.fill();

      // Label above the arrow: 'mid' for binary search, 'i' for linear.
      const label = (mid !== null && mid === effCurrent) ? 'mid' : 'i';
      ctx.fillStyle    = COLOURS.pointer;
      ctx.font         = FONT_MONO;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(label, cx, baseY - 2);
    }
  }

  // ===========================================================================
  // Nodes layout -- used by linear structures (stack, queue, eventually linked
  // list).
  // ---------------------------------------------------------------------------
  // Renders a horizontal (queue) or vertical (stack) sequence of rounded-rect
  // nodes with optional named pointer labels (FRONT, REAR, TOP, ...) hovering
  // beside the node they point to. A node may be marked as `incoming`
  // (entering this frame, e.g. push / enqueue) or `outgoing` (leaving this
  // frame, e.g. pop / dequeue); both render with the highlight colour and a
  // dashed outline to read as "in flight".
  //
  // Frame shape understood by drawNodes:
  //   { nodes:    [{ value }, ...],
  //     pointers: { front?, rear?, top? },     // map of label -> node index
  //     highlighted?: [indices],
  //     incoming?:    index,
  //     outgoing?:    index,
  //     orientation?: 'horizontal' | 'vertical' }  // defaults to 'horizontal'
  // ===========================================================================
  function drawNodes(opts = {}) {
    const {
      nodes        = [],
      pointers     = {},
      highlighted  = [],
      incoming     = null,
      outgoing     = null,
      orientation  = 'horizontal',
    } = opts;

    const W = canvas.width;
    const H = canvas.height;

    ctx.fillStyle = COLOURS.bg;
    ctx.fillRect(0, 0, W, H);

    // Even on an empty structure we still want to communicate "there is a
    // queue here, just nothing in it" rather than leaving the canvas blank.
    const n = nodes.length;
    if (n === 0) {
      ctx.fillStyle    = COLOURS.textDim;
      ctx.font         = FONT_MONO;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('(empty)', W / 2, H / 2);
      return;
    }

    // Two orientations: 'horizontal' (queue) and 'vertical' (stack).
    // Horizontal arranges nodes left-to-right with pointer labels above each
    // node; vertical arranges them top-to-bottom (last item highest = top of
    // stack) with pointer labels to the right of each node.
    if (orientation === 'vertical') {
      drawNodesVertical({ nodes, pointers, highlighted, incoming, outgoing, n, W, H });
    } else {
      drawNodesHorizontal({ nodes, pointers, highlighted, incoming, outgoing, n, W, H });
    }
  }

  // ---- Horizontal node layout (queue) --------------------------------------
  function drawNodesHorizontal({ nodes, pointers, highlighted, incoming, outgoing, n, W, H }) {
    // Reserve bands for pointer labels above and index numerals below.
    const topBand    = 70;   // pointer label + arrow
    const bottomBand = 28;   // index numerals
    const sidePad    = 24;
    const nodeGap    = 12;

    const usableW = W - sidePad * 2;
    const usableH = H - topBand - bottomBand;

    const nodeW    = Math.min(96, (usableW - nodeGap * (n - 1)) / n);
    const nodeH    = Math.min(96, usableH);
    const nodeSize = Math.max(28, Math.min(nodeW, nodeH));

    const rowWidth = n * nodeSize + (n - 1) * nodeGap;
    const xStart   = (W - rowWidth) / 2;
    const yNode    = topBand + (usableH - nodeSize) / 2;

    const hiSet = new Set(highlighted);

    // Helper: x-centre of node i.
    const nodeCx = (i) => xStart + i * (nodeSize + nodeGap) + nodeSize / 2;

    // ---- Nodes -------------------------------------------------------------
    for (let i = 0; i < n; i++) {
      const x = xStart + i * (nodeSize + nodeGap);
      const y = yNode;
      drawNodeCell({
        x, y, size: nodeSize, value: nodes[i].value, i,
        isIncoming: incoming === i,
        isOutgoing: outgoing === i,
        isHighlit:  hiSet.has(i) || incoming === i || outgoing === i,
        indexBelow: true,
      });
    }

    // ---- Pointer labels above nodes ----------------------------------------
    // Each named pointer ('front', 'rear', ...) draws a downward triangle
    // pointing at its node plus an uppercase label above it. When two
    // pointers fall on the same node (single-element queue: front === rear),
    // stack the labels vertically so both remain legible.
    const pointerEntries = Object.entries(pointers).filter(
      ([, idx]) => idx !== null && idx !== undefined && idx >= 0 && idx < n
    );

    // Group by target node so we can stack collisions.
    const groups = new Map();
    for (const [name, idx] of pointerEntries) {
      if (!groups.has(idx)) groups.set(idx, []);
      groups.get(idx).push(name);
    }

    for (const [idx, names] of groups) {
      const cx   = nodeCx(idx);
      const tipY = yNode - 6;
      const baseY = tipY - 12;

      // Triangle.
      ctx.fillStyle = COLOURS.pointer;
      ctx.beginPath();
      ctx.moveTo(cx, tipY);
      ctx.lineTo(cx - 7, baseY);
      ctx.lineTo(cx + 7, baseY);
      ctx.closePath();
      ctx.fill();

      // Stacked labels (lowest first, going up).
      ctx.fillStyle    = COLOURS.pointer;
      ctx.font         = FONT_MONO;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'bottom';
      let labelY = baseY - 2;
      for (const name of names) {
        ctx.fillText(name.toUpperCase(), cx, labelY);
        labelY -= 14;
      }
    }
  }

  // ---- Vertical node layout (stack) ----------------------------------------
  // nodes[0] is the bottom of the stack, nodes[length-1] is the top. We
  // render with the top of the stack at the *top* of the canvas so push/pop
  // animations look like values appearing from above. Pointer labels live to
  // the right of the node they target.
  function drawNodesVertical({ nodes, pointers, highlighted, incoming, outgoing, n, W, H }) {
    const topPad    = 32;
    const bottomPad = 32;
    const nodeGap   = 10;

    const usableH = H - topPad - bottomPad;
    const maxSize = 72;
    const nodeH   = Math.min(maxSize, (usableH - nodeGap * (n - 1)) / n);
    const nodeW   = Math.min(maxSize * 1.4, W * 0.35);
    const nodeSize = Math.max(28, Math.min(nodeH, nodeW));

    // Centre the column horizontally.
    const xStart = (W - nodeSize) / 2;
    // Place the TOP of the stack near the top of the canvas. nodes[n-1] (top
    // of stack) renders highest; nodes[0] (bottom of stack) renders lowest.
    const colHeight = n * nodeSize + (n - 1) * nodeGap;
    const yStart    = topPad + Math.max(0, (usableH - colHeight) / 2);

    const hiSet = new Set(highlighted);

    // Helper: y-centre of node i (where i is the array index; top of stack is
    // n-1, drawn at the smallest y).
    const yForIndex = (i) => yStart + (n - 1 - i) * (nodeSize + nodeGap);
    const nodeCy    = (i) => yForIndex(i) + nodeSize / 2;

    // ---- Nodes -------------------------------------------------------------
    for (let i = 0; i < n; i++) {
      const x = xStart;
      const y = yForIndex(i);
      drawNodeCell({
        x, y, size: nodeSize, w: nodeSize, value: nodes[i].value, i,
        isIncoming: incoming === i,
        isOutgoing: outgoing === i,
        isHighlit:  hiSet.has(i) || incoming === i || outgoing === i,
        indexSide:  'left',   // index numerals to the left of each node
      });
    }

    // ---- Pointer labels to the right of nodes ------------------------------
    // For stack, the typical labels are TOP (and optionally BOTTOM). When
    // multiple pointers fall on the same node we stack them vertically next
    // to the cell.
    const pointerEntries = Object.entries(pointers).filter(
      ([, idx]) => idx !== null && idx !== undefined && idx >= 0 && idx < n
    );
    const groups = new Map();
    for (const [name, idx] of pointerEntries) {
      if (!groups.has(idx)) groups.set(idx, []);
      groups.get(idx).push(name);
    }

    for (const [idx, names] of groups) {
      const cy   = nodeCy(idx);
      const tipX = xStart + nodeSize + 6;
      const baseX = tipX + 12;

      // Leftward-pointing triangle pointing at the node's right edge.
      ctx.fillStyle = COLOURS.pointer;
      ctx.beginPath();
      ctx.moveTo(tipX, cy);
      ctx.lineTo(baseX, cy - 7);
      ctx.lineTo(baseX, cy + 7);
      ctx.closePath();
      ctx.fill();

      // Labels to the right of the triangle, stacked horizontally if more
      // than one shares this node.
      ctx.fillStyle    = COLOURS.pointer;
      ctx.font         = FONT_MONO;
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'middle';
      let labelX = baseX + 4;
      for (const name of names) {
        const text = name.toUpperCase();
        ctx.fillText(text, labelX, cy);
        labelX += ctx.measureText(text).width + 8;
      }
    }
  }

  // Shared node-cell drawer. The fill colour and dashed-border treatment are
  // identical between horizontal and vertical layouts; only the position and
  // index-label placement differ.
  function drawNodeCell({ x, y, size, w, value, i, isIncoming, isOutgoing, isHighlit, indexBelow, indexSide }) {
    const width  = w ?? size;
    const height = size;

    ctx.fillStyle = isHighlit ? COLOURS.highlight : COLOURS.cell;
    roundRect(ctx, x, y, width, height, 10);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = isHighlit ? 1.5 : 1;
    if (isIncoming || isOutgoing) ctx.setLineDash([5, 3]);
    roundRect(ctx, x + 0.5, y + 0.5, width - 1, height - 1, 10);
    ctx.stroke();
    ctx.setLineDash([]);

    // Value, centred.
    ctx.fillStyle    = COLOURS.text;
    ctx.font         = '600 ' + Math.floor(size * 0.36) + 'px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(value), x + width / 2, y + height / 2);

    // Index label: below the cell (horizontal layout) or to its left
    // (vertical layout).
    ctx.fillStyle    = COLOURS.textDim;
    ctx.font         = FONT_MONO;
    if (indexBelow) {
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(String(i), x + width / 2, y + height + 6);
    } else if (indexSide === 'left') {
      ctx.textAlign    = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i), x - 8, y + height / 2);
    }
  }

  // Small helper: rounded rectangle path (no built-in on older canvas APIs).
  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  // Draw a single frame from the algorithm output. Dispatches on layout:
  // 'bars' (the default, sort algorithms) or 'boxes' (search algorithms).
  // Unknown fields are ignored, which means new algorithms can ship new frame
  // fields without breaking the renderer for the others.
  function drawFrame(frame) {
    const f = frame ?? { array: [] };
    if (f.layout === 'nodes') {
      drawNodes({
        nodes:       f.nodes       ?? [],
        pointers:    f.pointers    ?? {},
        highlighted: f.highlighted ?? [],
        incoming:    f.incoming    ?? null,
        outgoing:    f.outgoing    ?? null,
        orientation: f.orientation ?? 'horizontal',
      });
      return;
    }
    if (f.layout === 'boxes') {
      drawBoxes(f.array, {
        current:    f.current    ?? null,
        visited:    f.visited    ?? [],
        foundIndex: f.foundIndex ?? null,
        // Binary-search-specific fields. drawBoxes folds these onto its
        // existing pointer + dimmed-trail concepts and adds a low/high
        // bracket beneath the active window.
        low:        f.low        ?? null,
        high:       f.high       ?? null,
        mid:        f.mid        ?? null,
        eliminated: f.eliminated ?? [],
      });
      return;
    }
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
      foundIndex:        f.foundIndex        ?? null,
    });
  }

  return { resize, drawFrame };
}
