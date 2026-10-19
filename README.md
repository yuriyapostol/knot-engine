# knot-engine

[English](README.md) | [Українська](README.uk.md)

Knot modeling and rendering package with Vue 3 `KnotViewer`. The current `KnotAsset` supports spatial curves, grid diagrams, mosaic diagrams, planar diagram codes, Dowker–Thistlethwaite codes, constructions, states, procedures and explicit resource registries. The component renders static 3D representations with perspective/orthographic cameras, SSR fallback and PNG capture.

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

Run `npm run build:site` to build `site-dist/`. The site includes the guide at `/v1/guide.html`, specifications with schemas and examples at `/v1/spec.html`, resources at `/v1/resources.html`, and design material at `/design/index.html`. The interactive editor is embedded in the generation home page and guide. English is the default; page URLs retain `.html`, and Ukrainian pages use `.uk.html`, for example `/v1/guide/getting-started.uk.html` and `/design/architecture.uk.html`. Version `v1` includes pre-1.0 packages. Existing snapshots from `site/releases/` are preserved under `/releases/<package-version>/`.

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

Import `validateKnotAsset`, `resolveKnotAsset` and types from `knot-engine/core`: this entry point loads no Vue, Three.js or DOM. Validation separately reports `valid`, `complete`, `missingDependencies` and `uncheckedTypes`; rendering requires complete validation. Unknown fields are rejected. Registries are passed explicitly; URI references do not fetch data.

`representation-id` selects one static representation; by default the first `spatial-curve` is selected. Constructions contain objects and states; procedures reference representations. There is no animation. Replace the asset object to update geometry.

Methods: `resetView()`, `fitToView()`, `capture({width,height,view,transparent})`. PNG defaults to 512×512 with a 2048×2048 maximum. Capture modes are `current` and `model-preview`. Events: `ready({assetId,schemaVersion,warnings})`, `error`, `camera-change`. `initialCamera` accepts complete fit/fixed modes with perspective or orthographic projection; FOV is in radians.

[Data contract](v1/spec/knot-asset.md) · [Functions](v1/spec/functions.md) · [Component](v1/spec/components.md) · [JSON Schema](v1/schema/knot-asset.schema.json) · [Examples](v1/spec/examples/assets)

Styling uses `.knot-engine-v1-viewer…` classes and inherited `--knot-engine-v1-viewer-*` variables. The package namespace includes the major generation and component name, allowing different major versions on the same page; initial development requires no backward compatibility, including CSS. See [current variables, defaults and examples](v1/spec/components.md#css-namespace-and-styling).

## Documentation

Explain consequential contract decisions in the relevant specifications, with sources for definitions and implementations, checked examples and reasons for deviations from adopted conventions. Identify local project decisions as such rather than external standards. Data attribution, contributions and licensing follow the [metadata contract](v1/spec/sources.md).

[English](README.md) and [Ukrainian](README.uk.md) are equivalent versions of the documentation. Update both versions together when changing a requirement, API or implementation policy. Keep technical identifiers, executable examples and numeric limits consistent; explanatory text and UI labels may be localized. Links within each version lead to documents in the same language.

| Document | Scope |
| --- | --- |
| [`KnotAsset` v1](v1/spec/knot-asset.md) | Authoritative domain-data specification |
| [Architecture and migration](design/architecture.md) | Implementation policies, compatibility and current limits |
| [`KnotViewer` specification](v1/spec/components.md) | Component API and retained acceptance criteria |
| [Demo application](design/interactive-example-requirements.md) | Demo behavior and acceptance plan |

## Current limits

Automated checks cover validation, geometry, SSR/hydration, browser capture and a tarball consumer. Hardware touch/WebView behavior, minimum supported peer versions and CI image generation on a runner still need verification. Browser capture uses GPU rendering, so pixels may differ between devices. The bundled geometry uses a plain rope surface and a simple outline; it does not validate the physical correctness of a knot.

The repository is licensed under [LICENSE](LICENSE).

Source materials for each contract generation live in root `vN/` directories. The site publishes all generations together. `package.json#knotEngine.resourceDirectory` selects the current package generation; npm files and exports include only its resources. Each generation has its own `version.json`.
