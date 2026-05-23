// ============================================================================
// Insertion sort (shift-based)
// ----------------------------------------------------------------------------
// Lift arr[i] out as a "key", walk left through the sorted prefix shifting
// any larger element one slot right, then drop the key into the gap.
//
// Each frame snapshots `arr` literally. While a key is held, the slot at
// `key.index` in the array contains stale data (either the original key or a
// duplicate from the most recent shift) -- the renderer ignores that slot and
// draws the dashed gap + floating key instead.
//
// Frame extension: { key: { value, index } } where index = current gap.
//
// comparisons: number of element comparisons performed up to this frame.
// writes:      number of shift operations performed (each shift moves one
//              element one slot right). The final "drop" write is also counted.
// ============================================================================

export function insertionSort(input) {
  const arr    = input.slice();
  const n      = arr.length;
  const frames = [];

  let comparisons = 0;
  let writes      = 0;

  // Initial frame.
  frames.push({
    array: arr.slice(),
    highlighted: [],
    sorted: n > 0 ? [0] : [],
    message: n > 0
      ? `Sorting ${n} elements with insertion sort. arr[0] is a trivial sorted prefix.`
      : 'Empty array.',
    comparisons,
    writes,
  });

  for (let i = 1; i < n; i++) {
    const key         = arr[i];
    const sortedSoFar = Array.from({ length: i }, (_, k) => k);
    let   hover       = i;

    // Lift frame.
    frames.push({
      array: arr.slice(),
      highlighted: [],
      sorted: sortedSoFar,
      key: { value: key, index: hover },
      message: `Lifting arr[${i}] = ${key} as the key.`,
      comparisons,
      writes,
    });

    let j = i - 1;
    while (j >= 0) {
      // Comparison frame.
      comparisons++;
      frames.push({
        array: arr.slice(),
        highlighted: [j],
        sorted: sortedSoFar,
        key: { value: key, index: hover },
        message: `Comparing key ${key} with arr[${j}] = ${arr[j]}.`,
        comparisons,
        writes,
      });

      if (arr[j] > key) {
        arr[j + 1] = arr[j];
        hover      = j;
        writes++;

        // After-shift frame.
        frames.push({
          array: arr.slice(),
          highlighted: [j + 1],
          sorted: sortedSoFar,
          key: { value: key, index: hover },
          message: `Shifted arr[${j}] to arr[${j + 1}] (${arr[j]} > ${key}).`,
          comparisons,
          writes,
        });

        j--;
      } else {
        break;
      }
    }

    // Drop the key into its slot (counts as one write).
    arr[j + 1] = key;
    writes++;
    const newSorted = Array.from({ length: i + 1 }, (_, k) => k);
    frames.push({
      array: arr.slice(),
      highlighted: [j + 1],
      sorted: newSorted,
      message: `Dropped key ${key} into arr[${j + 1}].`,
      comparisons,
      writes,
      // no `key` field -- key has landed, the gap is gone
    });
  }

  // Terminal frame.
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
