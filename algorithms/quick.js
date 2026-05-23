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
//   in arr[lo..i] is ≤ pivot. Scan j from lo to hi-1: whenever arr[j] ≤ pivot,
//   advance i and swap arr[i] with arr[j] (extending the ≤-pivot prefix by one).
//   At the end, swap arr[i+1] with arr[hi] — the pivot lands at index i+1,
//   permanently in its final sorted position. Recurse on the two sides.
//
// Frame shape (additions on top of the common fields):
//   activeRange?:      [lo, hi]
//   pivotIndex?:       number      index of the pivot (= hi during a partition)
//   partitionBoundary? number      Lomuto's i — last index of the ≤-pivot prefix
//                                  (-1 -ish: we report i, the caller decodes).
//                                  We pass `i + 1` so the renderer can draw a
//                                  marker at the slot that would be filled next.
//   scanIndex?:        number      Lomuto's j — currently being compared
//
// Locking semantics:
//   Once a partition call finishes, the pivot's final index is permanent.
//   We add it to `sorted` immediately. Subarrays of size ≤ 1 are also
//   trivially locked. This is a real visual payoff of quicksort: the green
//   cells appear scattered first (as pivots) and fill in over time, very
//   different from merge sort where green only appears at the end.
// ============================================================================

export function quickSort(input) {
  const arr    = input.slice();
  const n      = arr.length;
  const frames = [];
  const sorted = new Set();

  frames.push({
    array: arr.slice(),
    highlighted: [],
    sorted: [],
    message: n > 1
      ? `Sorting ${n} elements with quick sort.`
      : (n === 1 ? 'arr[0] is a single element — already sorted.' : 'Empty array.'),
  });

  function sortedArr() {
    // Stable order isn't important — the renderer reads it as a set.
    return Array.from(sorted);
  }

  // Recursive driver. Pushes its own frames; returns nothing.
  function sort(lo, hi) {
    if (lo > hi) return;
    if (lo === hi) {
      // Single-element sub-array: trivially in place.
      sorted.add(lo);
      frames.push({
        array: arr.slice(),
        highlighted: [],
        sorted: sortedArr(),
        activeRange: [lo, hi],
        message: `arr[${lo}] is a single element — locked in place.`,
      });
      return;
    }

    // Announce the recursive call so the user can see the recursion tree
    // unfolding (sub-array boundaries shrink each level).
    frames.push({
      array: arr.slice(),
      highlighted: [],
      sorted: sortedArr(),
      activeRange: [lo, hi],
      pivotIndex: hi,
      message: `Partitioning arr[${lo}..${hi}]. Pivot: arr[${hi}] = ${arr[hi]}.`,
    });

    const p = partition(lo, hi);

    sorted.add(p);
    frames.push({
      array: arr.slice(),
      highlighted: [p],
      sorted: sortedArr(),
      activeRange: [lo, hi],
      message: `Pivot ${arr[p]} locked at arr[${p}].`,
    });

    sort(lo, p - 1);
    sort(p + 1, hi);
  }

  function partition(lo, hi) {
    const pivot = arr[hi];
    let i = lo - 1;             // boundary: arr[lo..i] all ≤ pivot

    for (let j = lo; j < hi; j++) {
      // Comparison frame.
      frames.push({
        array: arr.slice(),
        highlighted: [],
        sorted: sortedArr(),
        activeRange: [lo, hi],
        pivotIndex: hi,
        partitionBoundary: i + 1,   // slot that would receive the next ≤-pivot value
        scanIndex: j,
        message: `Comparing arr[${j}] = ${arr[j]} with pivot ${pivot}.`,
      });

      if (arr[j] <= pivot) {
        i++;
        if (i !== j) {
          [arr[i], arr[j]] = [arr[j], arr[i]];
          frames.push({
            array: arr.slice(),
            highlighted: [i, j],
            sorted: sortedArr(),
            activeRange: [lo, hi],
            pivotIndex: hi,
            partitionBoundary: i + 1,
            scanIndex: j,
            message: `Swapped arr[${i}] and arr[${j}] (${arr[i]} ≤ ${pivot}, extending the ≤-pivot prefix).`,
          });
        } else {
          // i === j means the element is already in the correct prefix slot;
          // emit a frame so the prefix-grew event is still visible.
          frames.push({
            array: arr.slice(),
            highlighted: [i],
            sorted: sortedArr(),
            activeRange: [lo, hi],
            pivotIndex: hi,
            partitionBoundary: i + 1,
            scanIndex: j,
            message: `arr[${j}] = ${arr[j]} ≤ ${pivot}, already in the ≤-pivot prefix.`,
          });
        }
      }
    }

    // Final placement: swap pivot into its sorted home.
    const home = i + 1;
    if (home !== hi) {
      [arr[home], arr[hi]] = [arr[hi], arr[home]];
      frames.push({
        array: arr.slice(),
        highlighted: [home, hi],
        sorted: sortedArr(),
        activeRange: [lo, hi],
        message: `Swapped arr[${home}] and arr[${hi}] (placing pivot at its sorted position).`,
      });
    } else {
      frames.push({
        array: arr.slice(),
        highlighted: [home],
        sorted: sortedArr(),
        activeRange: [lo, hi],
        message: `Pivot already at arr[${home}].`,
      });
    }

    return home;
  }

  sort(0, n - 1);

  // Terminal frame: paint everything green.
  frames.push({
    array: arr.slice(),
    highlighted: [],
    sorted: Array.from({ length: n }, (_, k) => k),
    message: n > 0 ? 'Sorted.' : 'Empty array.',
  });

  return frames;
}
