# knot-viewer

Vue 3 component for interactive 3D rope models defined by control points. It supports SSR fallback, validation, camera controls and PNG capture. A local Vite demo is included.

## Run locally

Requires Node 20.19+ and npm.

```sh
npm ci
npm run dev:demo
```

Open the URL printed by Vite. Verification commands:

```sh
npm run typecheck
npm test
npm run build
npm run build:demo
npm pack
```

Generate a card PNG with `npm run preview:model -- --model examples/models/prototype-loop.json --out /tmp/knot-preview.png`. The script uses local Chrome (or `CHROME_PATH`) and caches output by model, size, browser and renderer version.

The working package name is `knot-viewer`; no npm release has been published. The library build is in `dist/`, and the demo build is in `demo-dist/`. To build the demo for a project subpath, set `BASE_PATH=/your-path/`.

## Use

```vue
<script setup lang="ts">
import { KnotViewer, type KnotModelV1 } from 'knot-viewer'
import 'knot-viewer/styles.css'
defineProps<{ model: KnotModelV1 }>()
</script>

<template>
  <KnotViewer :model="model" label="Rope model" locale="en" />
</template>
```

Import `validateModel` and model types from `knot-viewer/core` to check author data without loading the viewer. A new model object reference triggers a rebuild; mutating point arrays in place is unsupported. The component never fetches model data.

The exposed methods are `resetView()`, `fitToView()` and `capture({ width, height, view, transparent })`, which resolves to a PNG `Blob`. `view` is `current` (default) or `model-preview`; dimensions default to 512×512 and are capped at 2048×2048. Events are `ready`, `error` and `camera-change`. See [the API specification](docs/specification.md), [model format](docs/model-format.md), and [JSON Schema](schema/knot-model-v1.schema.json).

The viewer has a 4:3 aspect ratio and a 260px minimum height by default. Override these on the host element. Toolbar colors can be changed with the `--knot-viewer-*` CSS properties in `src/styles.css`. On touch screens, drag to orbit and pinch to zoom. Vertical dragging beyond the orbit angle limits scrolls the page; reversing direction resumes rotation.

## Current limits

The demo and library build are verified locally. Hardware touch and WebView behavior, SSR hydration in a separate consumer, and CI image generation on a runner still need verification. Browser capture uses GPU rendering, so pixels may differ between devices. The bundled geometry uses a plain rope surface and a simple outline; it does not validate the physical correctness of a knot.

The repository is licensed under [LICENSE](LICENSE).
