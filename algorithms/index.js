// ============================================================================
// Algorithm registry
// ----------------------------------------------------------------------------
// Single source of truth for which algorithms exist, their display names, the
// pure functions that produce frames, and their kind. The UI reads this
// registry to populate the <select> and to decide which extra inputs (e.g. the
// search target, or the per-operation buttons for a data structure) to
// surface; the engine reads it to dispatch a run.
//
// kind: 'sort'      -> { fn(array) -> frames }
//       'search'    -> { fn(array, target) -> frames }
//       'structure' -> { initialState(array) -> state,
//                        operations: { [op]: { argLabel?, fn(state, value?) ->
//                                              { frames, nextState } } } }
//
// Sort and search are one-shot: feed input, get frames, render. A structure is
// different -- it persists state across operations. Each operation is its own
// short frame stream that is applied to the held state on click.
//
// Adding a new algorithm is a two-step change: write the algorithm file with
// an `export function` (or an export of the structure descriptor), then add
// one entry here. Nothing else in the app needs to know.
// ============================================================================

import { bubbleSort }    from './bubble.js';
import { insertionSort } from './insertion.js';
import { selectionSort } from './selection.js';
import { mergeSort }     from './merge.js';
import { quickSort }     from './quick.js';
import { linearSearch }  from './linear.js';
import { binarySearch }  from './binary.js';
import { queue }         from './queue.js';

export const ALGORITHMS = {
  bubble:    { name: 'Bubble Sort',    kind: 'sort',   fn: bubbleSort    },
  insertion: { name: 'Insertion Sort', kind: 'sort',   fn: insertionSort },
  selection: { name: 'Selection Sort', kind: 'sort',   fn: selectionSort },
  merge:     { name: 'Merge Sort',     kind: 'sort',   fn: mergeSort     },
  quick:     { name: 'Quick Sort',     kind: 'sort',   fn: quickSort     },
  linear:    { name: 'Linear Search',  kind: 'search', fn: linearSearch  },
  binary:    { name: 'Binary Search',  kind: 'search', fn: binarySearch  },
  queue:     queue,
};
