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

export const ALGO_LEGEND_KEYS = {
  bubble:    ['bar', 'highlight', 'sorted'],
  insertion: ['bar', 'highlight', 'spotlight', 'sorted'],
  selection: ['bar', 'highlight', 'minRun', 'sorted'],
  merge:     ['bar', 'barDim', 'highlight', 'pointer', 'divider', 'sorted'],
  quick:     ['bar', 'barDim', 'barLE', 'highlight', 'spotlight', 'pointer', 'sorted'],
  linear:    ['cell', 'cellDim', 'highlight', 'found'],
};

export function renderLegend(legendEl, algoKey) {
  if (!legendEl) return;
  const keys = ALGO_LEGEND_KEYS[algoKey] ?? Object.keys(LEGEND_LABELS);
  legendEl.innerHTML = '';
  for (const k of keys) {
    const label = LEGEND_LABELS[k];
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
