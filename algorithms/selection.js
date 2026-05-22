// ============================================================================
// Selection sort
// ----------------------------------------------------------------------------
// For each pass i: scan arr[i..n-1] for the index of the minimum, then swap
// it into arr[i]. The sorted region grows from the left, one element per pass.
//
// Two "pointers" matter visually:
//   - the scan position j         → carried in `highlighted` (orange)
//   - the running minimum minIdx  → carried in `minIndex`    (purple)
//
// Granularity: per inner step, one comparison frame and (when a new minimum
// is found) one update frame. Per pass: one swap frame, or a 'no swap' notice
// when arr[i] was already the minimum.
// ============================================================================

function selectionSort(input) {
  const arr    = input.slice();
  const n      = arr.length;
  const frames = [];

  frames.push({
    array: arr.slice(),
    highlighted: [],
    sorted: [],
    message: n > 0
      ? `Sorting ${n} elements with selection sort.`
      : 'Empty array.',
  });

  for (let i = 0; i < n - 1; i++) {
    const sortedSoFar = Array.from({ length: i }, (_, k) => k);
    let   minIdx      = i;

    // Pass init: the candidate minimum starts at index i.
    frames.push({
      array: arr.slice(),
      highlighted: [],
      sorted: sortedSoFar,
      minIndex: minIdx,
      message: `Searching arr[${i}..${n - 1}] for the minimum. Candidate: arr[${i}] = ${arr[i]}.`,
    });

    for (let j = i + 1; j < n; j++) {
      // Comparison frame.
      frames.push({
        array: arr.slice(),
        highlighted: [j],
        sorted: sortedSoFar,
        minIndex: minIdx,
        message: `Comparing arr[${j}] = ${arr[j]} with current minimum arr[${minIdx}] = ${arr[minIdx]}.`,
      });

      if (arr[j] < arr[minIdx]) {
        minIdx = j;
        // Update-min frame: pointer moves, no scan highlight so the colour swap is obvious.
        frames.push({
          array: arr.slice(),
          highlighted: [],
          sorted: sortedSoFar,
          minIndex: minIdx,
          message: `New minimum: arr[${j}] = ${arr[j]}.`,
        });
      }
    }

    // Swap (or note that no swap is needed).
    if (minIdx !== i) {
      [arr[i], arr[minIdx]] = [arr[minIdx], arr[i]];
      frames.push({
        array: arr.slice(),
        highlighted: [i, minIdx],
        sorted: sortedSoFar,
        message: `Swapped arr[${i}] and arr[${minIdx}].`,
      });
    } else {
      frames.push({
        array: arr.slice(),
        highlighted: [i],
        sorted: sortedSoFar,
        message: `arr[${i}] = ${arr[i]} is already the minimum.`,
      });
    }
  }

  // Terminal frame: every index marked sorted.
  frames.push({
    array: arr.slice(),
    highlighted: [],
    sorted: Array.from({ length: n }, (_, k) => k),
    message: 'Sorted.',
  });

  return frames;
}

// Expose for the browser (global) and for node test runs (CommonJS).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { selectionSort };
}
