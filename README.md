# DSA Visualiser

A browser-based visualiser for classic data-structures and algorithms problems. Built from scratch in vanilla HTML, CSS and JavaScript. No build tools, no frameworks. This is a learning project to understand how algorithms behave step by step.

The current scope is sorting and searching algorithms with live performance metrics. More algorithm families are planned (see [Future Scope](#future-scope)).

## Algorithms currently supported

**Sorting**
- Bubble Sort
- Insertion Sort
- Selection Sort
- Merge Sort
- Quick Sort

**Searching**
- Linear Search
- Binary Search

## Features

- Seven algorithms across two families (sorting and searching), selectable via a Kind dropdown
- Sorting algorithms animate on a bar chart while searching algorithms use a boxes layout with labelled cells.
- Target-value input shown automatically when a search algorithm is selected
- Custom input (comma-separated values) or one-click random array generation
- Full playback controls: play, pause, step forward, step back, reset
- Speed control (1–60 fps)
- Keyboard shortcuts (Space to play/pause, ←/→ to step, R to reset)
- Per-algorithm colour legend that updates based on which algorithm is selected
- Frame counter showing current position in the animation
- Live comparison and swap counters to track algorithm efficiency in real-time
- Modular architecture: pure algorithm functions separated from rendering

## Running locally

The project uses ES modules, so it needs to be served over HTTP rather than opened directly as a `file://` URL. To run it:

1. Clone the repo.
2. Open the `DSA Visualiser` folder in VS Code (or any editor).
3. Open `index.html` with the Live Server extension (or any static file server).

## Project structure

```
DSA Visualiser/
├── index.html              ← markup, controls, canvas
├── style.css               ← dark theme, layout
├── script.js               ← thin entry point: imports, boots the app
├── engine.js               ← player state, tick loop, play/pause/step/reset
├── renderer.js             ← createRenderer(canvas), drawFrame, colours
├── legend.js               ← renderLegend, per-algorithm colour keys
├── input.js                ← parseInput, randomArray, input validation
└── algorithms/
    ├── index.js            ← algorithm registry (imports and re-exports all)
    ├── bubble.js
    ├── insertion.js
    ├── selection.js
    ├── merge.js
    ├── quick.js
    ├── linear.js
    └── binary.js
```

`script.js` was split into focused ES modules for maintainability and testability. Each module has a single responsibility: `engine.js` owns playback state and tick loop, `renderer.js` owns canvas drawing and frame visualization, `legend.js` owns the colour key, and `input.js` owns input parsing and validation. The renderer is a factory (`createRenderer(canvas)`) so its canvas dependency is explicit; the engine is similarly a factory (`createEngine({ onFrame, initialFps })`). Algorithm files use named exports and are wired together via `algorithms/index.js` with a registry pattern — no globals, no separate `<script>` tags. This design makes it easy to add new algorithms without touching the core engine or renderer.

## Future scope

Things planned but not yet built:

- **Linear data structures** — stacks, queues, linked lists.
- **Trees and graphs** — traversals, BSTs, BFS/DFS, shortest path.
- **Framework rewrite** — port to React/Svelte/TypeScript once the vanilla version has earned its complexity.
- **Adding README screenshot / GIF** — a short clip of the visualiser running, plus a link to a live deployed URL.
