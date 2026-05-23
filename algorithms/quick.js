// ============================================================================
// Quick sort (top-down, recursive, Lomuto partition with last-element pivot)
// ----------------------------------------------------------------------------
// Second algorithm in the project that uses recursion. Reuses the
// activeRange / sorted machinery from merge sort, but the moving parts are
// different: instead of two halves being merged, a pivot anchors one end of
// the range and two pointers walk through it.
//
// Lomuto partition in one paragraph:
//   pivot = arr[hi]. Maintain a boundary index i = lo - 1 such that everything
//   in arr[lo..i] is <= pivot. Scan j from lo to hi-1: whenever arr[j] <= pivot,
//   advance i and swap arr[i] with arr[j] (extending the <=pivot prefix by one).
//   At the end, swap arr[i+1] with arr[hi] -- the pivot lands at index i+1,
//   permanently in its final sorted position. Recurse on the two sides.
//
// Frame shape (additions on top of the common fields):
//   activeRange?:      [lo, hi]
//   pivotIndex?:       number      index of the pivot (= hi during a partition)
//   partitionBoundary? number      Lomuto's i -- last index of the <=pivot prefix
//   scanIndex?:        number      Lomuto's j -- currently being compared
//
// Locking semantics:
//   Once a partition call finishes, the pivot's final index is permanent.
//   We add it to `sorted` immediately.
//
// comparisons: number of element comparisons made during partition scans.
// writes:      number of swap operations (prefix-extending swaps + pivot placement).
// ============================================================================

export function quickSort(input) {
  const arr    = input.slice();
  const n      = arr.length;
  const frames = [];
  const sorted = new Set();

  let comparisons = 0;
  let writes      = 0;

  frames.push({
    array: arr.slice(),
    highlighted: [],
    sorted: [],
    message: n > 1
      ? `Sorting ${n} elements with quick sort.`
      : (n === 1 ? 'arr[0] is a single element -- already sorted.' : 'Empty array.'),
    comparisons,
    writes,
  });

  function sortedArr() {
    return Array.from(sorted);
  }

  function sort(lo, hi) {
    if (lo > hi) return;
    if (lo === hi) {
      sorted.add(lo);
      frames.push({
        array: arr.slice(),
        highlighted: [],
        sorted: sortedArr(),
        activeRange: [lo, hi],
        message: `arr[${lo}] is a single element -- locked in place.`,
        comparisons,
        writes,
      });
      return;
    }

    frames.push({
      array: arr.slice(),
      highlighted: [],
      sorted: sortedArr(),
      activeRange: [lo, hi],
      pivotIndex: hi,
      message: `Partitioning arr[${lo}..${hi}]. Pivot: arr[${hi}] = ${arr[hi]}.`,
      comparisons,
      writes,
    });

    const p = partition(lo, hi);

    sorted.add(p);
    frames.push({
      array: arr.slice(),
      highlighted: [p],
      sorted: sortedArr(),
      activeRange: [lo, hi],
      message: `Pivot ${arr[p]} locked at arr[${p}].`,
      comparisons,
      writes,
    });

    sort(lo, p - 1);
    sort(p + 1, hi);
  }

  function partition(lo, hi) {
    const pivot = arr[hi];
    let i = lo - 1;

    for (let j = lo; j < hi; j++) {
      // Comparison frame.
      comparisons++;
      frames.push({
        array: arr.slice(),
        highlighted: [],
        sorted: sortedArr(),
        activeRange: [lo, hi],
        pivotIndex: hi,
        partitionBoundary: i + 1,
        scanIndex: j,
        message: `Comparing arr[${j}] = ${arr[j]} with pivot ${pivot}.`,
        comparisons,
        writes,
      });

      if (arr[j] <= pivot) {
        i++;
        if (i !== j) {
          [arr[i], arr[j]] = [arr[j], arr[i]];
          writes++;
          frames.push({
            array: arr.slice(),
            highlighted: [i, j],
            sorted: sortedArr(),
            activeRange: [lo, hi],
            pivotIndex: hi,
            partitionBoundary: i + 1,
            scanIndex: j,
            message: `Swapped arr[${i}] and arr[${j}] (${arr[i]} <= ${pivot}, extending the <=pivot prefix).`,
            comparisons,
            writes,
          });
        } else {
          frames.push({
            array: arr.slice(),
            highlighted: [i],
            sorted: sortedArr(),
            activeRange: [lo, hi],
            pivotIndex: hi,
            partitionBoundary: i + 1,
            scanIndex: j,
            message: `arr[${j}] = ${arr[j]} <= ${pivot}, already in the <=pivot prefix.`,
            comparisons,
            writes,
          });
        }
      }
    }

    // Final placement: swap pivot into its sorted home.
    const home = i + 1;
    if (home !== hi) {
      [arr[home], arr[hi]] = [arr[hi], arr[home]];
      writes++;
      frames.push({
        array: arr.slice(),
        highlighted: [home, hi],
        sorted: sortedArr(),
        activeRange: [lo, hi],
        message: `Swapped arr[${home}] and arr[${hi}] (placing pivot at its sorted position).`,
        comparisons,
        writes,
      });
    } else {
      frames.push({
        array: arr.slice(),
        highlighted: [home],
        sorted: sortedArr(),
        activeRange: [lo, hi],
        message: `Pivot already at arr[${home}].`,
        comparisons,
        writes,
      });
    }

    return home;
  }

  sort(0, n - 1);

  // Terminal frame.
  frames.push({
    array: arr.slice(),
    highlighted: [],
    sorted: Array.from({ length: n }, (_, k) => k),
    message: n > 0 ? 'Sorted.' : 'Empty array.',
    comparisons,
    writes,
  });

  return frames;
}
