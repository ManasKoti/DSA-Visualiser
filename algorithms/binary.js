// ============================================================================
// Binary search
// ----------------------------------------------------------------------------
// Pure function: takes a *sorted* array and a target value, returns a list of
// frames. No DOM, no canvas.
//
// Follows the same conventions as linear.js:
//   1. fn(array, target) signature
//   2. emits 'boxes'-layout frames so the renderer shows labelled cells with a
//      pointer
//
// Extra frame fields used by this algorithm:
//   low       - current left bound index  (rendered in accent colour)
//   high      - current right bound index (rendered in accent colour)
//   mid       - the index currently being compared (acts as `current`)
//   eliminated - indices outside [low, high] already ruled out (dimmed)
//
// Granularity: one frame per iteration — the mid pointer is placed, compared,
// then the bounds collapse before the next frame. On a hit a final frame
// promotes mid to `foundIndex`. On a miss a terminal frame notes the failure.
//
// Frame shape:
//   {
//     layout: 'boxes',
//     array, low?, high?, mid?, eliminated?, foundIndex?,
//     message, comparisons, writes
//   }
//
// comparisons: element comparisons performed up to and including this frame.
// writes:      always 0 (read-only search).
//
// NOTE: the input array must already be sorted. Binary search produces
// meaningless results on unsorted data; the caller / UI is responsible for
// ensuring this or sorting first.
// ============================================================================

export function binarySearch(input, target) {
  const arr        = input.slice();
  const n          = arr.length;
  const frames     = [];
  const eliminated = [];

  let comparisons = 0;
  const writes    = 0;

  // Initial frame ─ show the full array before any work begins.
  frames.push({
    layout: 'boxes',
    array: arr.slice(),
    low: 0,
    high: n - 1,
    mid: null,
    eliminated: [],
    message: n > 0
      ? `Binary search for ${target} in ${n} sorted elements.`
      : 'Empty array.',
    comparisons,
    writes,
  });

  if (n === 0) return frames;

  let low  = 0;
  let high = n - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);

    // Comparison frame ─ show where the mid pointer has landed.
    comparisons++;
    frames.push({
      layout: 'boxes',
      array: arr.slice(),
      low,
      high,
      mid,
      eliminated: eliminated.slice(),
      message: `low=${low}, high=${high} → mid=${mid}. Comparing arr[${mid}]=${arr[mid]} with target ${target}.`,
      comparisons,
      writes,
    });

    if (arr[mid] === target) {
      // Found ─ promote mid to foundIndex, clear the pointer.
      frames.push({
        layout: 'boxes',
        array: arr.slice(),
        low,
        high,
        mid: null,
        eliminated: eliminated.slice(),
        foundIndex: mid,
        message: `Found ${target} at index ${mid}.`,
        comparisons,
        writes,
      });
      return frames;
    }

    // Eliminate the half that cannot contain the target.
    if (arr[mid] < target) {
      // Left half (low … mid) is too small — discard it.
      for (let i = low; i <= mid; i++) eliminated.push(i);
      low = mid + 1;
      if (low <= high) {
        frames.push({
          layout: 'boxes',
          array: arr.slice(),
          low,
          high,
          mid: null,
          eliminated: eliminated.slice(),
          message: `arr[${mid}]=${arr[mid]} < ${target}. Discard left half. New range: [${low}, ${high}].`,
          comparisons,
          writes,
        });
      }
    } else {
      // Right half (mid … high) is too large — discard it.
      for (let i = mid; i <= high; i++) eliminated.push(i);
      high = mid - 1;
      if (low <= high) {
        frames.push({
          layout: 'boxes',
          array: arr.slice(),
          low,
          high,
          mid: null,
          eliminated: eliminated.slice(),
          message: `arr[${mid}]=${arr[mid]} > ${target}. Discard right half. New range: [${low}, ${high}].`,
          comparisons,
          writes,
        });
      }
    }
  }

  // Exhausted the search space — target not present.
  frames.push({
    layout: 'boxes',
    array: arr.slice(),
    low: null,
    high: null,
    mid: null,
    eliminated: eliminated.slice(),
    message: `${target} not found after ${comparisons} comparison${comparisons === 1 ? '' : 's'}.`,
    comparisons,
    writes,
  });

  return frames;
}
