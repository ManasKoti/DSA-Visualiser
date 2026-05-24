// ============================================================================
// Legend
// ----------------------------------------------------------------------------
// Per-algorithm legend rendered below the canvas. Each algorithm names the
// COLOURS keys it actually uses; the renderer surfaces only those swatches so
// the legend stays minimal.
//
// Adding a new algorithm with a new visual element is a two-step change:
//   1. add the colour to COLOURS + a label to LEGEND_LABELS in renderer.js
//   2. add the algorithm's key list to ALGO_LEGEND_KEYS below
// ============================================================================

import { COLOURS, LEGEND_LABELS } from './renderer.js';

// Each entry is either a colour-key string (use the shared LEGEND_LABELS text)
// or a [colourKey, labelOverride] tuple when the shared label doesn't read
// naturally in this algorithm's context (e.g. binary search uses the
// 'divider' colour for its low/high bracket, not for a "split").
export const ALGO_LEGEND_KEYS = {
  bubble:    ['bar', 'highlight', 'sorted'],
  insertion: ['bar', 'highlight', 'spotlight', 'sorted'],
  selection: ['bar', 'highlight', 'minRun', 'sorted'],
  merge:     ['bar', 'barDim', 'highlight', 'pointer', 'divider', 'sorted'],
  quick:     ['bar', 'barDim', 'barLE', 'highlight', 'spotlight', 'pointer', 'sorted'],
  linear:    ['cell', 'cellDim', 'highlight', 'found'],
  binary: [
    'cell',
    ['cellDim',   'eliminated'],
    ['highlight', 'mid (comparing)'],
    ['divider',   'low / high range'],
    ['found',     'match'],
  ],
};

export function renderLegend(legendEl, algoKey) {
  if (!legendEl) return;
  const entries = ALGO_LEGEND_KEYS[algoKey] ?? Object.keys(LEGEND_LABELS);
  legendEl.innerHTML = '';
  for (const entry of entries) {
    const [k, override] = Array.isArray(entry) ? entry : [entry, null];
    const label = override ?? LEGEND_LABELS[k];
    if (!label) continue;
    const item = document.createElement('span');
    item.className = 'legend-item';
    const swatch = document.createElement('span');
    swatch.className = 'legend-swatch';
    swatch.style.background = COLOURS[k];
    const text = document.createElement('span');
    text.className = 'legend-label';
    text.textContent = label;
    item.appendChild(swatch);
    item.appendChild(text);
    legendEl.appendChild(item);
  }
}
