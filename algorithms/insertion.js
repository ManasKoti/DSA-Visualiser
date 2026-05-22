// ============================================================================
// Insertion sort (shift-based)
// ----------------------------------------------------------------------------
// Lift arr[i] out as a "key", walk left through the sorted prefix shifting
// any larger element one slot right, then drop the key into the gap.
//
// Each frame snapshots `arr` literally. While a key is held, the slot at
// `key.index` in the array contains stale data (either the original key or a
// duplicate from the most recent shift) — the renderer ignores that slot and
// draws the dashed gap + floating key instead.
//
// Frame extension: { key: { value, index } } where index = current gap.
// ============================================================================

function insertionSort(input) {
  const arr    = input.slice();
  const n      = arr.length;
  const frames = [];

  // Initial frame.
  frames.push({
    array: arr.slice(),
    highlighted: [],
    sorted: n > 0 ? [0] : [],
    message: n > 0
      ? `Sorting ${n} elements with insertion sort. arr[0] is a trivial sorted prefix.`
      : 'Empty array.',
  });

  for (let i = 1; i < n; i++) {
    const key         = arr[i];
    const sortedSoFar = Array.from({ length: i }, (_, k) => k);
    let   hover       = i;     // index of the current gap above which the key floats

    // Lift frame.
    frames.push({
      array: arr.slice(),
      highlighted: [],
      sorted: sortedSoFar,
      key: { value: key, index: hover },
      message: `Lifting arr[${i}] = ${key} as the key.`,
    });

    let j = i - 1;
    while (j >= 0) {
      // Comparison frame.
      frames.push({
        array: arr.slice(),
        highlighted: [j],
        sorted: sortedSoFar,
        key: { value: key, index: hover },
        message: `Comparing key ${key} with arr[${j}] = ${arr[j]}.`,
      });

      if (arr[j] > key) {
        arr[j + 1] = arr[j];
        hover      = j;

        // After-shift frame.
        frames.push({
          array: arr.slice(),
          highlighted: [j + 1],
          sorted: sortedSoFar,
          key: { value: key, index: hover },
          message: `Shifted arr[${j}] to arr[${j + 1}] (${arr[j]} > ${key}).`,
        });

        j--;
      } else {
        // Comparison failed — show it once more without the shift, then break.
        // (Already emitted above; just exit the loop.)
        break;
      }
    }

    // Drop the key into its slot.
    arr[j + 1] = key;
    const newSorted = Array.from({ length: i + 1 }, (_, k) => k);
    frames.push({
      array: arr.slice(),
      highlighted: [j + 1],
      sorted: newSorted,
      message: `Dropped key ${key} into arr[${j + 1}].`,
      // no `key` field — key has landed, the gap is gone
    });
  }

  // Terminal frame.
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
  module.exports = { insertionSort };
}
