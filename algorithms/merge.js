// ============================================================================
// Merge sort (top-down, recursive)
// ----------------------------------------------------------------------------
// First algorithm in this project that uses recursion. The whole point of
// doing it now is the exercise of flattening recursive control flow into a
// linear list of frames. The recursion lives in the algorithm function; the
// player has no idea any of this was recursive.
//
// Frame shape (in addition to the common { array, highlighted, sorted, message }):
//   activeRange?: [lo, hi]   inclusive range currently being merged
//   midIndex?:    number     position of the split inside activeRange
//                            (left half is [lo..mid], right half is [mid+1..hi])
//   aux?: {
//     values:   (number|null)[]  copy of arr[lo..hi] at merge start;
//                                slots are nulled out as elements are consumed
//     leftPtr:  number|null      index in `values` of next left-half candidate
//                                (null once the left half is exhausted)
//     rightPtr: number|null      same for the right half
//     midOffset: number          index in `values` where the right half starts
//                                (= mid - lo + 1)
//   }
//   writeIndex?: number      next index in the main array that will be written
//
// Two-strip visual:
//   - main array on top, with activeRange highlighted and a divider at mid
//   - auxiliary buffer below, holding the two sorted halves; pointers tick
//     through it, consumed slots fade out
//
// Sorted set semantics:
//   We only mark an index as `sorted` once the top-level call has finished
//   covering it. Intermediate merges produce locally-sorted regions but those
//   are not final until everything above them is done.
//
// comparisons: number of element comparisons made during merge steps.
//              Drain writes (no opponent left) are not comparisons.
// writes:      number of elements written back from aux to the main array.
// ============================================================================

export function mergeSort(input) {
  const arr    = input.slice();
  const n      = arr.length;
  const frames = [];

  let comparisons = 0;
  let writes      = 0;

  // Initial frame.
  frames.push({
    array: arr.slice(),
    highlighted: [],
    sorted: [],
    message: n > 1
      ? `Sorting ${n} elements with merge sort.`
      : (n === 1 ? 'arr[0] is a single element -- already sorted.' : 'Empty array.'),
    comparisons,
    writes,
  });

  // Recursive helper. Pushes its own frames; returns nothing.
  function sort(lo, hi) {
    if (lo >= hi) return;
    const mid = Math.floor((lo + hi) / 2);

    frames.push({
      array: arr.slice(),
      highlighted: [],
      sorted: [],
      activeRange: [lo, hi],
      midIndex: mid,
      message: `Splitting arr[${lo}..${hi}] at index ${mid} into arr[${lo}..${mid}] and arr[${mid + 1}..${hi}].`,
      comparisons,
      writes,
    });

    sort(lo, mid);
    sort(mid + 1, hi);
    merge(lo, mid, hi);
  }

  function merge(lo, mid, hi) {
    const midOffset = mid - lo + 1;
    const auxValues = arr.slice(lo, hi + 1);

    // Snapshot frame: aux now holds the two sorted halves, ready to merge.
    frames.push({
      array: arr.slice(),
      highlighted: [],
      sorted: [],
      activeRange: [lo, hi],
      midIndex: mid,
      aux: {
        values: auxValues.slice(),
        leftPtr: 0,
        rightPtr: midOffset,
        midOffset,
      },
      writeIndex: lo,
      message: `Merging arr[${lo}..${mid}] with arr[${mid + 1}..${hi}]. Halves copied to aux.`,
      comparisons,
      writes,
    });

    let i = 0;
    let j = midOffset;
    let k = lo;

    const leftEnd  = midOffset;
    const rightEnd = hi - lo + 1;

    const auxSnapshot = () => ({
      values: auxValues.slice(),
      leftPtr:  i < leftEnd  ? i : null,
      rightPtr: j < rightEnd ? j : null,
      midOffset,
    });

    while (i < leftEnd && j < rightEnd) {
      // Comparison frame.
      comparisons++;
      frames.push({
        array: arr.slice(),
        highlighted: [],
        sorted: [],
        activeRange: [lo, hi],
        midIndex: mid,
        aux: auxSnapshot(),
        writeIndex: k,
        message: `Comparing aux[${i}] = ${auxValues[i]} with aux[${j}] = ${auxValues[j]}.`,
        comparisons,
        writes,
      });

      let takenFromLeft;
      let takenValue;
      if (auxValues[i] <= auxValues[j]) {
        takenFromLeft = true;
        takenValue    = auxValues[i];
        arr[k]        = auxValues[i];
        auxValues[i]  = null;
        i++;
      } else {
        takenFromLeft = false;
        takenValue    = auxValues[j];
        arr[k]        = auxValues[j];
        auxValues[j]  = null;
        j++;
      }
      k++;
      writes++;

      // Write frame.
      frames.push({
        array: arr.slice(),
        highlighted: [k - 1],
        sorted: [],
        activeRange: [lo, hi],
        midIndex: mid,
        aux: auxSnapshot(),
        writeIndex: k,
        message: `Wrote ${takenValue} to arr[${k - 1}] (from ${takenFromLeft ? 'left' : 'right'} half).`,
        comparisons,
        writes,
      });
    }

    // Drain whichever half still has elements.
    while (i < leftEnd) {
      const value  = auxValues[i];
      arr[k]       = value;
      auxValues[i] = null;
      i++; k++;
      writes++;
      frames.push({
        array: arr.slice(),
        highlighted: [k - 1],
        sorted: [],
        activeRange: [lo, hi],
        midIndex: mid,
        aux: auxSnapshot(),
        writeIndex: k,
        message: `Wrote ${value} to arr[${k - 1}] (draining left half).`,
        comparisons,
        writes,
      });
    }
    while (j < rightEnd) {
      const value  = auxValues[j];
      arr[k]       = value;
      auxValues[j] = null;
      j++; k++;
      writes++;
      frames.push({
        array: arr.slice(),
        highlighted: [k - 1],
        sorted: [],
        activeRange: [lo, hi],
        midIndex: mid,
        aux: auxSnapshot(),
        writeIndex: k,
        message: `Wrote ${value} to arr[${k - 1}] (draining right half).`,
        comparisons,
        writes,
      });
    }

    // Merge-complete frame.
    frames.push({
      array: arr.slice(),
      highlighted: [],
      sorted: [],
      activeRange: [lo, hi],
      midIndex: mid,
      message: `Merged arr[${lo}..${hi}].`,
      comparisons,
      writes,
    });
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
