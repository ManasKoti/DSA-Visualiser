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

**Data Structures**
- Stack (LIFO)
- Queue (FIFO)

## Features

- Nine algorithms and structures across three families (sorting, searching and data structures), selectable via a Kind dropdown
- Sorting algorithms animate on a bar chart; searching algorithms use a boxes layout with labelled cells; data structures use a nodes layout
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
    ├── binary.js
    ├── queue.js
    └── stack.js
```

## Future scope

Things planned but not yet built:

- **More linear data structures** — linked lists.
- **Trees and graphs** — traversals, BSTs, BFS/DFS, shortest path.
- **Adding README screenshot / GIF** — a short clip of the visualiser running, plus a link to a live deployed URL.
