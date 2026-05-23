// ============================================================================
// Selection sort
// ----------------------------------------------------------------------------
// For each pass i: scan arr[i..n-1] for the index of the minimum, then swap
// it into arr[i]. The sorted region grows from the left, one element per pass.
//
// Two "pointers" matter visually:
//   - the scan position j         -> carried in `highlighted` (orange)
//   - the running minimum minIdx  -> carried in `minIndex`    (purple)
//
// Granularity: per inner step, one comparison frame and (when a new minimum
// is found) one update frame. Per pass: one swap frame, or a no-swap notice
// when arr[i] was already the minimum.
//
// comparisons: number of element comparisons performed up to this frame.
// writes:      number of swap operations (each swap = 1; no-swap passes = 0).
// ============================================================================

export function selectionSort(input) {
  const arr    = input.slice();
  const n      = arr.length;
  const frames = [];

  let comparisons = 0;
  let writes      = 0;

  frames.push({
    array: arr.slice(),
    highlighted: [],
    sorted: [],
    message: n > 0
      ? `Sorting ${n} elements with selection sort.`
      : 'Empty array.',
    comparisons,
    writes,
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
      comparisons,
      writes,
    });

    for (let j = i + 1; j < n; j++) {
      // Comparison frame.
      comparisons++;
      frames.push({
        array: arr.slice(),
        highlighted: [j],
        sorted: sortedSoFar,
        minIndex: minIdx,
        message: `Comparing arr[${j}] = ${arr[j]} with current minimum arr[${minIdx}] = ${arr[minIdx]}.`,
        comparisons,
        writes,
      });

      if (arr[j] < arr[minIdx]) {
        minIdx = j;
        frames.push({
          array: arr.slice(),
          highlighted: [],
          sorted: sortedSoFar,
          minIndex: minIdx,
          message: `New minimum: arr[${j}] = ${arr[j]}.`,
          comparisons,
          writes,
        });
      }
    }

    // Swap (or note that no swap is needed).
    if (minIdx !== i) {
      [arr[i], arr[minIdx]] = [arr[minIdx], arr[i]];
      writes++;
      frames.push({
        array: arr.slice(),
        highlighted: [i, minIdx],
        sorted: sortedSoFar,
        message: `Swapped arr[${i}] and arr[${minIdx}].`,
        comparisons,
        writes,
      });
    } else {
      frames.push({
        array: arr.slice(),
        highlighted: [i],
        sorted: sortedSoFar,
        message: `arr[${i}] = ${arr[i]} is already the minimum.`,
        comparisons,
        writes,
      });
    }
  }

  // Terminal frame: every index marked sorted.
  frames.push({
    array: arr.slice(),
    highlighted: [],
    sorted: Array.from({ length: n }, (_, k) => k),
    message: 'Sorted.',
    comparisons,
    writes,
  });

  return frames;
}
