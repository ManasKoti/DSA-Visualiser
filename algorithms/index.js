// ============================================================================
// Algorithm registry
// ----------------------------------------------------------------------------
// Single source of truth for which algorithms exist, their display names, and
// the pure functions that produce frames. The UI reads this registry to
// populate the <select>; the engine reads it to dispatch a run.
//
// Adding a new algorithm is a two-step change: write the algorithm file with
// an `export function`, then add one entry here. Nothing else in the app
// needs to know.
// ============================================================================

import { bubbleSort }    from './bubble.js';
import { insertionSort } from './insertion.js';
import { selectionSort } from './selection.js';
import { mergeSort }     from './merge.js';
import { quickSort }     from './quick.js';

export const ALGORITHMS = {
  bubble:    { name: 'Bubble Sort',    fn: bubbleSort    },
  insertion: { name: 'Insertion Sort', fn: insertionSort },
  selection: { name: 'Selection Sort', fn: selectionSort },
  merge:     { name: 'Merge Sort',     fn: mergeSort     },
  quick:     { name: 'Quick Sort',     fn: quickSort     },
};
