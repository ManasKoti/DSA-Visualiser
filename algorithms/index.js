// ============================================================================
// Algorithm registry
// ----------------------------------------------------------------------------
// Single source of truth for which algorithms exist, their display names, the
// pure functions that produce frames, and their kind. The UI reads this
// registry to populate the <select> and to decide which extra inputs (e.g. the
// search target) to surface; the engine reads it to dispatch a run.
//
// kind: 'sort'   -> fn(array) -> frames
//       'search' -> fn(array, target) -> frames
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
import { linearSearch }  from './linear.js';

export const ALGORITHMS = {
  bubble:    { name: 'Bubble Sort',    kind: 'sort',   fn: bubbleSort    },
  insertion: { name: 'Insertion Sort', kind: 'sort',   fn: insertionSort },
  selection: { name: 'Selection Sort', kind: 'sort',   fn: selectionSort },
  merge:     { name: 'Merge Sort',     kind: 'sort',   fn: mergeSort     },
  quick:     { name: 'Quick Sort',     kind: 'sort',   fn: quickSort     },
  linear:    { name: 'Linear Search',  kind: 'search', fn: linearSearch  },
};
