// ============================================================================
// Bubble sort
// ----------------------------------------------------------------------------
// Pure function: takes an array, returns a list of frames. No DOM, no canvas.
//
// Granularity: one frame per comparison, one frame per swap.
// Sorted suffix: after each pass the last unsorted index is locked; the
// sorted set on subsequent frames reflects that.
// Optimisation: classic early-exit when a full pass makes no swaps.
//
// Frame shape:
//   { array, highlighted, sorted, message, comparisons, writes }
//
// comparisons: number of element comparisons performed up to and including
//              this frame.
// writes:      number of swap operations performed (each swap = 1 write,
//              because both elements move together as one exchange).
// ============================================================================

export function bubbleSort(input) {
  const arr    = input.slice();
  const n      = arr.length;
  const frames = [];
  const sorted = [];

  let comparisons = 0;
  let writes      = 0;

  // Initial frame: clean view of the unsorted array.
  frames.push({
    array: arr.slice(),
    highlighted: [],
    sorted: sorted.slice(),
    message: n > 0
      ? `Sorting ${n} elements with bubble sort.`
      : 'Empty array.',
    comparisons,
    writes,
  });

  for (let pass = 0; pass < n - 1; pass++) {
    let swapped = false;
    const end   = n - 1 - pass;

    for (let i = 0; i < end; i++) {
      // Comparison frame.
      comparisons++;
      frames.push({
        array: arr.slice(),
        highlighted: [i, i + 1],
        sorted: sorted.slice(),
        message: `Comparing arr[${i}] = ${arr[i]} with arr[${i + 1}] = ${arr[i + 1]}.`,
        comparisons,
        writes,
      });

      if (arr[i] > arr[i + 1]) {
        [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
        swapped = true;
        writes++;

        // Swap frame.
        frames.push({
          array: arr.slice(),
          highlighted: [i, i + 1],
          sorted: sorted.slice(),
          message: `Swapped arr[${i}] and arr[${i + 1}].`,
          comparisons,
          writes,
        });
      }
    }

    // After this pass, arr[end] is in its final position.
    sorted.unshift(end);

    if (!swapped) {
      // No swaps this pass: everything to the left is also sorted.
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
    comparisons,
    writes,
  });

  return frames;
}
