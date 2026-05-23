// ============================================================================
// Input parsing and array generation
// ----------------------------------------------------------------------------
// Pure helpers, no DOM. The UI layer reads from the text input and feeds it to
// `parseInput`; the result is either `{ values }` or `{ error }`. Random input
// is handled here too so generation rules live in one place.
// ============================================================================

export const MAX_INPUT_LENGTH = 200;

export function parseInput(text) {
  const tokens = text.split(/[\s,]+/).filter(t => t.length > 0);
  if (tokens.length === 0) {
    return { error: 'Enter at least one number.' };
  }
  if (tokens.length > MAX_INPUT_LENGTH) {
    return { error: `Too many values (max ${MAX_INPUT_LENGTH}).` };
  }
  const nums = [];
  for (const t of tokens) {
    if (!/^\d+$/.test(t)) {
      return { error: `"${t}" is not a non-negative integer.` };
    }
    nums.push(Number(t));
  }
  return { values: nums };
}

export function randomArray(size = 12, maxVal = 50) {
  const arr = [];
  for (let i = 0; i < size; i++) {
    arr.push(Math.floor(Math.random() * maxVal) + 1);
  }
  return arr;
}
