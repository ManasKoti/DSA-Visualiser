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
//   We only mark an index as `sorted` once the *top-level* call has finished
//   covering it. Intermediate merges produce locally-sorted regions but those
//   aren't final until everything above them is done. This is closer to how
//   bubble/selection report progress and avoids prematurely-green elements
//   that might still be moved by a higher-level merge.
// ============================================================================

function mergeSort(input) {
  const arr    = input.slice();
  const n      = arr.length;
  const frames = [];

  // Initial frame.
  frames.push({
    array: arr.slice(),
    highlighted: [],
    sorted: [],
    message: n > 1
      ? `Starting merge sort on ${n} elements.`
      : (n === 1 ? 'Single element — already sorted.' : 'Empty array.'),
  });

  // Recursive helper. Pushes its own frames; returns nothing.
  function sort(lo, hi) {
    if (lo >= hi) return;                       // base case: 0 or 1 element
    const mid = Math.floor((lo + hi) / 2);

    // Split notice — useful to see the recursion tree even though we don't
    // render the call stack explicitly.
    frames.push({
      array: arr.slice(),
      highlighted: [],
      sorted: [],
      activeRange: [lo, hi],
      midIndex: mid,
      message: `Splitting arr[${lo}..${hi}] at ${mid} → left arr[${lo}..${mid}], right arr[${mid + 1}..${hi}].`,
    });

    sort(lo, mid);
    sort(mid + 1, hi);
    merge(lo, mid, hi);
  }

  // Standard in-place-with-aux merge: copy the active range out, then walk
  // two pointers back into the main array.
  function merge(lo, mid, hi) {
    const midOffset = mid - lo + 1;             // index in aux where right half starts
    const auxValues = arr.slice(lo, hi + 1);    // snapshot of the two sorted halves

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
      message: `Merging arr[${lo}..${mid}] with arr[${mid + 1}..${hi}]. Copied both halves into the auxiliary buffer.`,
    });

    let i = 0;             // pointer into left half of aux:  [0 .. midOffset-1]
    let j = midOffset;     // pointer into right half of aux: [midOffset .. hi-lo]
    let k = lo;            // write head in main array

    const leftEnd  = midOffset;
    const rightEnd = hi - lo + 1;

    // Helper to make frame construction less verbose. Captures current i/j/k.
    const auxSnapshot = () => ({
      values: auxValues.slice(),
      leftPtr:  i < leftEnd  ? i : null,
      rightPtr: j < rightEnd ? j : null,
      midOffset,
    });

    while (i < leftEnd && j < rightEnd) {
      // Comparison frame.
      frames.push({
        array: arr.slice(),
        highlighted: [],
        sorted: [],
        activeRange: [lo, hi],
        midIndex: mid,
        aux: auxSnapshot(),
        writeIndex: k,
        message: `Comparing left aux[${i}] = ${auxValues[i]} with right aux[${j}] = ${auxValues[j]}.`,
      });

      let takenFromLeft;
      let takenValue;
      if (auxValues[i] <= auxValues[j]) {
        takenFromLeft = true;
        takenValue    = auxValues[i];
        arr[k]        = auxValues[i];
        auxValues[i]  = null;                   // mark consumed for the renderer
        i++;
      } else {
        takenFromLeft = false;
        takenValue    = auxValues[j];
        arr[k]        = auxValues[j];
        auxValues[j]  = null;
        j++;
      }
      k++;

      // Write frame: the consumed cell in aux is now null; arr[k-1] holds the value.
      frames.push({
        array: arr.slice(),
        highlighted: [k - 1],
        sorted: [],
        activeRange: [lo, hi],
        midIndex: mid,
        aux: auxSnapshot(),
        writeIndex: k,
        message: `Took ${takenValue} from the ${takenFromLeft ? 'left' : 'right'} half → wrote to arr[${k - 1}].`,
      });
    }

    // Drain whichever half still has elements. One frame per write so the
    // animation stays uniform with the merge phase above.
    while (i < leftEnd) {
      const value  = auxValues[i];
      arr[k]       = value;
      auxValues[i] = null;
      i++; k++;
      frames.push({
        array: arr.slice(),
        highlighted: [k - 1],
        sorted: [],
        activeRange: [lo, hi],
        midIndex: mid,
        aux: auxSnapshot(),
        writeIndex: k,
        message: `Draining left half: wrote ${value} to arr[${k - 1}].`,
      });
    }
    while (j < rightEnd) {
      const value  = auxValues[j];
      arr[k]       = value;
      auxValues[j] = null;
      j++; k++;
      frames.push({
        array: arr.slice(),
        highlighted: [k - 1],
        sorted: [],
        activeRange: [lo, hi],
        midIndex: mid,
        aux: auxSnapshot(),
        writeIndex: k,
        message: `Draining right half: wrote ${value} to arr[${k - 1}].`,
      });
    }

    // Merge-complete frame: drop the aux strip so the eye can see the merged
    // region as a single sorted block. Don't mark it `sorted` yet — that's
    // reserved for the final frame, see the header comment.
    frames.push({
      array: arr.slice(),
      highlighted: [],
      sorted: [],
      activeRange: [lo, hi],
      midIndex: mid,
      message: `Merged arr[${lo}..${hi}] — region is now sorted.`,
    });
  }

  sort(0, n - 1);

  // Terminal frame.
  frames.push({
    array: arr.slice(),
    highlighted: [],
    sorted: Array.from({ length: n }, (_, k) => k),
    message: n > 0 ? 'Sorted.' : 'Empty array.',
  });

  return frames;
}

// Expose for the browser (global) and for node test runs (CommonJS).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { mergeSort };
}
