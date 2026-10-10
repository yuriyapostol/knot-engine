# knot-engine

[English](README.md) | [Українська](README.uk.md)

Knot modeling and rendering package with a Vue 3 `KnotViewer` component. KnotAsset v1 is the authoritative domain format; legacy KnotModelV1 remains supported during migration. Includes validation, static 3D snapshot rendering, camera controls, SSR fallback, PNG capture and a local demo.

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
npm run test:browser
npm run test:package
npm pack --dry-run
```

Generate a card PNG with `npm run preview:model -- --model examples/models/twisted-loop.json --out /tmp/knot-preview.png`. The script uses local Chrome (or `CHROME_PATH`) and caches output by model, size, browser and renderer version.

The working package name is `knot-engine`; no npm release has been published. The library build is in `dist/`, and the demo build is in `demo-dist/`. To build the demo for a project subpath, set `BASE_PATH=/your-path/`.

## GitHub Pages demo

The [Pages workflow](.github/workflows/pages.yml) builds and publishes `demo-dist/` after a push to `main`, or when manually run on `main`. Typecheck and unit tests must pass first. The Vite base path comes from GitHub Pages metadata, giving `/knot-engine/` for this repository and `/` for a configured custom domain. No personal access token or additional secrets are required.

1. In the repository, open **Settings → Pages → Build and deployment** and choose **GitHub Actions** as the **Source**. See [GitHub's publishing-source instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
2. Commit and push the workflow and demo changes to `main`.
3. Open **Actions → Deploy demo to GitHub Pages** and check that both `build` and `deploy` succeed. To retry manually, select **Run workflow** with branch `main`.
4. Open the URL shown by the `github-pages` deployment. The expected default URL is [yuriyapostol.github.io/knot-engine/](https://yuriyapostol.github.io/knot-engine/).

If Actions are disabled, enable them in **Settings → Actions → General** and allow the official `actions/*` actions used by the workflow. If the `github-pages` environment restricts deployment branches, allow `main` under **Settings → Environments → github-pages**. The workflow grants its own required token permissions. Generated files do not need to be committed to a `gh-pages` branch. Local verification does not mean the site has already been published.

## Use

```vue
<script setup lang="ts">
import { KnotViewer, type KnotModelV1 } from 'knot-engine'
import 'knot-engine/styles.css'
defineProps<{ model: KnotModelV1 }>()
</script>

<template>
  <KnotViewer :model="model" label="Rope model" locale="en" />
</template>
```

Import `validateKnotAsset`, `validateKnotModelV1` (legacy alias: `validateModel`) and types from `knot-engine/core` to check author data without loading the viewer. A new model object reference triggers a rebuild; mutating point arrays in place is unsupported. The component never fetches model data.

The exposed methods are `resetView()`, `fitToView()` and `capture({ width, height, view, transparent })`, which resolves to a PNG `Blob`. `view` is `current` (default) or `model-preview`; dimensions default to 512×512 and are capped at 2048×2048. Events are `ready`, `error` and `camera-change`. See [the API specification](docs/specification.md), [model format](docs/model-format.md), and [JSON Schema](schema/knot-model-v1.schema.json).

The viewer has a 4:3 aspect ratio and a 260px minimum height by default. Override these on the host element. Toolbar colors can be changed with the `--knot-viewer-*` CSS properties in `src/styles.css`. On touch screens, drag to orbit and pinch to zoom. Vertical dragging beyond the orbit angle limits scrolls the page; reversing direction resumes rotation.

## KnotAsset v1

```vue
<script setup lang="ts">
import { KnotViewer, type KnotAsset } from 'knot-engine'
import 'knot-engine/styles.css'
defineProps<{ asset: KnotAsset }>()
</script>

<template>
  <KnotViewer :asset="asset" representation-id="view-3d" snapshot-id="rest" label="Rope snapshot" />
</template>
```

Supply either `asset` or legacy `model`. Omitted selection IDs choose the first 3D representation and its first snapshot. Selection changes rebuild a static view; they do not animate steps. Validation completes before geometry allocation. Rope diameter determines tube thickness; missing dimensions and non-rope curves use a documented display radius with a warning.

[**KnotAsset v1 specification**](docs/knot-asset-v1.md) · [KnotAsset JSON Schema](schema/knot-asset-v1.schema.json) · [Architecture, migration and implementation policies](docs/architecture.md) · [Technical fixtures](examples/assets/)

The domain supports 2D representations, crossings, algorithms and variants. This first rendering path displays one 3D snapshot. Importing `knot-engine/core` loads neither Vue nor Three.js/DOM code. `validateKnotAsset(value, { strict: true })` checks authoring data against the structural and semantic contract without mutating it. `resolveKnotAsset` and `resolveKnotModelV1` provide explicit adapters to internal rendering data. The two formats are never inferred from their shared version number.

## Documentation

[English](README.md) and [Ukrainian](README.uk.md) are equivalent versions of the documentation. Update both versions together when changing a requirement, API or implementation policy. Keep technical identifiers, executable examples and numeric limits consistent; explanatory text and UI labels may be localized. Links within each version lead to documents in the same language.

| Document | Scope |
| --- | --- |
| [KnotAsset v1](docs/knot-asset-v1.md) | Authoritative domain-data specification |
| [Architecture and migration](docs/architecture.md) | Implementation policies, compatibility and current limits |
| [KnotViewer specification](docs/specification.md) | Component API and retained acceptance criteria |
| [Legacy model format](docs/model-format.md) | KnotModelV1 static rendering contract |
| [Demo application](docs/demo.md) | Demo behavior and acceptance plan |

## Current limits

Automated checks cover validation, geometry, SSR/hydration, browser capture and a tarball consumer. Hardware touch/WebView behavior, minimum supported peer versions and CI image generation on a runner still need verification. Browser capture uses GPU rendering, so pixels may differ between devices. The bundled geometry uses a plain rope surface and a simple outline; it does not validate the physical correctness of a knot.

The repository is licensed under [LICENSE](LICENSE).
