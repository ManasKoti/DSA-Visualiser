// ============================================================================
// Linear search
// ----------------------------------------------------------------------------
// Pure function: takes an array and a target value, returns a list of frames.
// No DOM, no canvas.
//
// First search algorithm in the project -- establishes two conventions for the
// search family:
//   1. fn(array, target) instead of fn(array)
//   2. emits 'boxes'-layout frames so the renderer switches from bars to
//      labelled cells with a pointer
//
// Granularity: one frame per visited index. The pointer (`current`) advances
// one slot at a time; `visited` accumulates the indices already checked so
// the renderer can dim them. On a hit, a final frame promotes the cell to
// `foundIndex` (green) and clears `current`. On a miss, a terminal frame
// clears `current` and leaves the trail fully dim.
//
// Frame shape:
//   {
//     layout: 'boxes',
//     array, current?, visited?, foundIndex?,
//     message, comparisons, writes
//   }
//
// comparisons: number of element comparisons performed up to and including
//              this frame.
// writes:      always 0 for a read-only search; carried so the footer stat
//              counter renders uniformly across algorithms.
// ============================================================================

export function linearSearch(input, target) {
  const arr    = input.slice();
  const n      = arr.length;
  const frames = [];
  const visited = [];

  let comparisons = 0;
  const writes    = 0;

  // Initial frame: clean view of the array with the target announced.
  frames.push({
    layout: 'boxes',
    array: arr.slice(),
    current: null,
    visited: [],
    message: n > 0
      ? `Linear search for ${target} in ${n} elements.`
      : 'Empty array.',
    comparisons,
    writes,
  });

  // Nothing to scan -> bail early so we don't emit a redundant "not found" frame.
  if (n === 0) return frames;

  for (let i = 0; i < n; i++) {
    // Comparison frame: pointer parks on the index currently under inspection.
    comparisons++;
    frames.push({
      layout: 'boxes',
      array: arr.slice(),
      current: i,
      visited: visited.slice(),
      message: `Comparing arr[${i}] = ${arr[i]} with target ${target}.`,
      comparisons,
      writes,
    });

    if (arr[i] === target) {
      // Match: promote the cell to the 'found' colour, drop the pointer.
      frames.push({
        layout: 'boxes',
        array: arr.slice(),
        current: null,
        visited: visited.slice(),
        foundIndex: i,
        message: `Found ${target} at index ${i}.`,
        comparisons,
        writes,
      });
      return frames;
    }

    // No match: this cell joins the visited trail before we move on.
    visited.push(i);
  }

  // Fell off the end with no match.
  frames.push({
    layout: 'boxes',
    array: arr.slice(),
    current: null,
    visited: visited.slice(),
    message: `${target} not found after scanning all ${n} elements.`,
    comparisons,
    writes,
  });

  return frames;
}
