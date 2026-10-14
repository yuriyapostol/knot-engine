# knot-engine

[English](README.md) | [Українська](README.uk.md)

Knot modeling and rendering package with a Vue 3 `KnotViewer` component. KnotAsset v1 is the authoritative domain format; legacy KnotModelV1 remains supported during migration. Includes validation, static 3D snapshot rendering, camera controls, SSR fallback, PNG capture and a local demo.

## Run locally

Requires Node 20.19+ and npm.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. Verification commands:

```sh
npm run typecheck
npm test
npm run build
npm run build:example
npm run test:browser
npm run test:package
npm pack --dry-run
```

Generate a card PNG with `npm run preview:model -- --model v1/spec/examples/assets/twisted-loop.json --out /tmp/knot-preview.png`. The script uses local Chrome (or `CHROME_PATH`) and caches output by model, size, browser and renderer version.

The working package name is `knot-engine`; no npm release has been published. The library build is in `dist/`, and the demo build is in `site-runtime-dist/`. To build the demo for a project subpath, set `BASE_PATH=/your-path/`.

## GitHub Pages site

To preview the complete site locally, run `npm run preview:site` and open `http://localhost:5174/`. This rebuilds the site before serving it. `npm run dev` on port `5173` serves the complete site and rebuilds it automatically after source changes.

Run `npm run build:site` to build `site-dist/`. The site includes the guide at `/v1/guide/`, specifications with schemas and examples at `/v1/spec/`, resources at `/v1/resources/`, and design material at `/design/`. The interactive editor is embedded in the generation home page and guide. English is the default; Ukrainian pages live under `/v1/uk/` and `/design/uk/`. Version `v1` includes pre-1.0 packages. Existing snapshots from `site/releases/` are preserved under `/releases/<package-version>/`.

The [Pages workflow](.github/workflows/pages.yml) publishes the complete site after a push to `main`, or a manual run on `main`, after typecheck and tests. In **Settings → Pages**, select **GitHub Actions**. The default site address is [Knot Engine](https://yuriyapostol.github.io/knot-engine/). Pages and demo assets use relative links and also work under a custom domain.

For an explicitly prepared release, `npm run site:archive` creates a snapshot of the current package version. Review and commit `site/releases/<version>/` with that release. Existing snapshots cannot be overwritten by the command; ordinary builds do not create releases or change version numbers. See [archive instructions](site/README.md) and [publication policy](design/publication.md). Local builds do not deploy the site.

## Use

```vue
<script setup lang="ts">
import { KnotViewer, type KnotAsset } from 'knot-engine'
import 'knot-engine/styles.css'
defineProps<{ asset: KnotAsset }>()
</script>

<template>
  <KnotViewer :asset="asset" label="Rope model" locale="en" />
</template>
```

Import `validateKnotAsset`, `validateKnotModelV1` (legacy alias: `validateModel`) and types from `knot-engine/core` to check author data without loading the viewer. A new model object reference triggers a rebuild; mutating point arrays in place is unsupported. The component never fetches model data.

The exposed methods are `resetView()`, `fitToView()` and `capture({ width, height, view, transparent })`, which resolves to a PNG `Blob`. `view` is `current` (default) or `model-preview`; dimensions default to 512×512 and are capped at 2048×2048. Events are `ready`, `error` and `camera-change`. See [the API specification](v1/spec/components.md), [model format](v1/spec/model-format.md), and [JSON Schema](v1/spec/schema/knot-model.schema.json).

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

[**KnotAsset v1 specification**](v1/spec/knot-asset.md) · [KnotAsset JSON Schema](v1/spec/schema/knot-asset.schema.json) · [Architecture, migration and implementation policies](design/architecture.md) · [Technical fixtures](v1/spec/examples/assets)

The domain supports 2D representations, crossings, algorithms and variants. This first rendering path displays one 3D snapshot. Importing `knot-engine/core` loads neither Vue nor Three.js/DOM code. `validateKnotAsset(value, { strict: true })` checks authoring data against the structural and semantic contract without mutating it. `resolveKnotAsset` and `resolveKnotModelV1` provide explicit adapters to internal rendering data. The two formats are never inferred from their shared version number.

## Documentation

[English](README.md) and [Ukrainian](README.uk.md) are equivalent versions of the documentation. Update both versions together when changing a requirement, API or implementation policy. Keep technical identifiers, executable examples and numeric limits consistent; explanatory text and UI labels may be localized. Links within each version lead to documents in the same language.

| Document | Scope |
| --- | --- |
| [KnotAsset v1](v1/spec/knot-asset.md) | Authoritative domain-data specification |
| [Architecture and migration](design/architecture.md) | Implementation policies, compatibility and current limits |
| [KnotViewer specification](v1/spec/components.md) | Component API and retained acceptance criteria |
| [Legacy model format](v1/spec/model-format.md) | KnotModelV1 static rendering contract |
| [Demo application](design/interactive-example-requirements.md) | Demo behavior and acceptance plan |

## Current limits

Automated checks cover validation, geometry, SSR/hydration, browser capture and a tarball consumer. Hardware touch/WebView behavior, minimum supported peer versions and CI image generation on a runner still need verification. Browser capture uses GPU rendering, so pixels may differ between devices. The bundled geometry uses a plain rope surface and a simple outline; it does not validate the physical correctness of a knot.

The repository is licensed under [LICENSE](LICENSE).

Source materials for each contract generation live in root `vN/` directories. The site publishes all generations together. `package.json#knotEngine.resourceDirectory` selects the current package generation; npm files and exports include only its resources. Each generation has its own `version.json`.
