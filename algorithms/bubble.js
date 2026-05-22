// ============================================================================
// Bubble sort
// ----------------------------------------------------------------------------
// Pure function: takes an array, returns a list of frames. No DOM, no canvas.
//
// Granularity: one frame per comparison, one frame per swap.
// Sorted suffix: after each pass the last unsorted index is locked; the
// `sorted` set on subsequent frames reflects that.
// Optimisation: classic early-exit when a full pass makes no swaps.
//
// Frame shape:
//   { array, highlighted, sorted, message }
// ============================================================================

function bubbleSort(input) {
  const arr    = input.slice();
  const n      = arr.length;
  const frames = [];
  const sorted = [];

  // Initial frame: clean view of the unsorted array.
  frames.push({
    array: arr.slice(),
    highlighted: [],
    sorted: sorted.slice(),
    message: n > 0
      ? `Sorting ${n} elements with bubble sort.`
      : 'Empty array.',
  });

  for (let pass = 0; pass < n - 1; pass++) {
    let swapped = false;
    const end   = n - 1 - pass;   // last index still in play this pass

    for (let i = 0; i < end; i++) {
      // Comparison frame.
      frames.push({
        array: arr.slice(),
        highlighted: [i, i + 1],
        sorted: sorted.slice(),
        message: `Comparing arr[${i}] = ${arr[i]} with arr[${i + 1}] = ${arr[i + 1]}.`,
      });

      if (arr[i] > arr[i + 1]) {
        [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
        swapped = true;

        // Swap frame.
        frames.push({
          array: arr.slice(),
          highlighted: [i, i + 1],
          sorted: sorted.slice(),
          message: `Swapped arr[${i}] and arr[${i + 1}].`,
        });
      }
    }

    // After this pass, arr[end] is in its final position.
    sorted.unshift(end);

    if (!swapped) {
      // No swaps this pass ⇒ everything to the left is also sorted.
      for (let i = end - 1; i >= 0; i--) sorted.unshift(i);
      break;
    }
  }

  // Catch the index-0 case if we exited the outer loop normally.
  if (sorted[0] !== 0) sorted.unshift(0);

  // Terminal frame so the viewer sees the fully sorted state with no highlights.
  frames.push({
    array: arr.slice(),
    highlighted: [],
    sorted: sorted.slice(),
    message: 'Sorted.',
  });

  return frames;
}

// Expose for the browser (script.js reads it off window) and for node test runs.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { bubbleSort };
}
