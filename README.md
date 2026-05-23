# DSA Visualiser

A browser-based visualiser for classic data-structures-and-algorithms problems. Built from scratch in vanilla HTML, CSS and JavaScript. No build tools, no frameworks. This is a learning project to understand how algorithms behave step by step, and to feel the friction of writing UI code without a framework before reaching for one.

The current scope is sorting algorithms. More algorithm families are planned (see [Future Scope](#future-scope)).

## Algorithms currently supported

- Bubble Sort
- Insertion Sort
- Selection Sort
- Merge Sort
- Quick Sort

Each algorithm is implemented as a pure function: it takes an array and returns a list of frames describing every comparison, swap, and intermediate state. The renderer plays those frames back on a canvas. Algorithm code never touches the DOM, and the renderer doesn't know which algorithm produced the frames.

## Features

- Five sorting algorithms with step-by-step animation on an HTML canvas
- Custom input (comma-separated values) or one-click random array generation
- Full playback controls: play, pause, step forward, step back, reset
- Speed control (1–60 fps)
- Keyboard shortcuts (Space to play/pause, ←/→ to step, R to reset)
- Per-algorithm colour legend that updates based on which algorithm is selected
- Frame counter showing current position in the animation

## Running locally

The project has no build step and no dependencies. To run it:

1. Clone the repo.
2. Open the `DSA Visualiser` folder in VS Code (or any editor).
3. Open `index.html` with the Live Server extension (or any static file server).

A plain `file://` open will also work for the current version since everything is wired up via classic `<script>` tags, but a local server is recommended for consistency.

## Project structure

```
DSA Visualiser/
├── index.html              ← markup, controls, canvas
├── style.css               ← dark theme, layout
├── script.js               ← engine, renderer, input parsing, DOM wiring
└── algorithms/
    ├── bubble.js
    ├── insertion.js
    ├── selection.js
    ├── merge.js
    └── quick.js
```

## Future scope

Things planned but not yet built:

- **Search algorithms** — linear search, binary search, and array techniques.
- **Linear data structures** — stacks, queues, linked lists.
- **Trees and graphs** — traversals, BSTs, BFS/DFS, shortest path.
- **Framework rewrite** — port to React/Svelte/TypeScript once the vanilla version has earned its complexity.
- **Comparison and swap counters** — show live counts of operations so two algorithms on the same input can be meaningfully compared.
- **Modular architecture** — split `script.js` into focused ES modules (engine, renderer, legend, input, algorithm registry).
- **README screenshot / GIF** — a short clip of the visualiser running, plus a link to a live deployed URL.
