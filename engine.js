// ============================================================================
// Player engine
// ----------------------------------------------------------------------------
// Owns the playback state machine: which frame is current, whether we're
// playing, and the tick loop. It does NOT draw anything — drawing is delegated
// to the `onFrame` callback supplied at construction time. The UI layer is
// expected to wire `onFrame` to a renderer call and a status/counter update.
//
// API surface (returned by createEngine):
//   loadFrames(frames)   load a new frame sequence, reset to frame 0
//   play() / pause()     standard transport
//   stepForward()        pause + advance one frame
//   stepBack()           pause + retreat one frame
//   reset()              pause + jump to frame 0
//   setFps(n)            change playback speed (affects next tick)
//   isPlaying()          for UI button enable/disable
//   getCursor()          current frame index
//   getFrameCount()      total frames in current sequence
// ============================================================================

export function createEngine({ onFrame, initialFps = 6 }) {
  let frames  = [];
  let cursor  = 0;
  let playing = false;
  let timerId = null;
  let fps     = initialFps;

  function notify() {
    onFrame(frames[cursor] ?? null, cursor, frames.length);
  }

  function tick() {
    if (!playing) return;
    if (cursor < frames.length - 1) {
      cursor++;
      notify();
      timerId = setTimeout(tick, 1000 / fps);
    } else {
      pause();
    }
  }

  function play() {
    if (frames.length === 0) return;
    if (cursor >= frames.length - 1) cursor = 0;
    playing = true;
    notify();
    tick();
  }

  function pause() {
    playing = false;
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    notify();
  }

  function stepForward() {
    pause();
    if (cursor < frames.length - 1) {
      cursor++;
      notify();
    }
  }

  function stepBack() {
    pause();
    if (cursor > 0) {
      cursor--;
      notify();
    }
  }

  function reset() {
    pause();
    cursor = 0;
    notify();
  }

  function loadFrames(newFrames) {
    pause();
    frames = newFrames ?? [];
    cursor = 0;
    notify();
  }

  function setFps(n) {
    fps = n;
  }

  function redraw() {
    notify();
  }

  return {
    loadFrames,
    play,
    pause,
    stepForward,
    stepBack,
    reset,
    setFps,
    redraw,
    isPlaying:     () => playing,
    getCursor:     () => cursor,
    getFrameCount: () => frames.length,
  };
}
