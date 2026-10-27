# knot-engine architecture

The package separates domain data, validation and presentation. Current contracts: [data](../v1/specifications/knot.md), [prepared objects](../v1/specifications/prepared-model.md), [functions](../v1/specifications/functions.md) and [components](../v1/specifications/components.md). [Open design questions](knot-draft.md) describe extensions beyond those contracts.

```text
RawKnot / Knot + explicitly supplied resource registries
  → bounded structural validation
  → namespace expansion and dependency validation
  → representation selection
  → viewer registry dispatch
      → Knot3DViewer → geometry + camera → WebGL / PNG
      → KnotMosaicViewer → tile paths + plane view → SVG
```

## Core and prepared objects

`knot-engine/core` contains raw types, prepared `Knot` objects, localization, validation, selection, resource resolution and extraction/composition. It loads no Vue, Three.js or DOM and performs no network access. JSON Schema contracts share `src/core/contracts.json`; `npm run build:schemas` generates the standalone published schemas. Semantic validators separately check references and geometric/combinatorial rules.

`RawKnot` is serialized data; `Knot.from()` prepares a runtime object with methods. `toRaw()` produces an independent serializable copy. Document validation and selected-representation validation have different scopes: rendering requires complete validation of the selected representation and its required context. Unrelated representations do not have to be renderable.

Extraction includes required constructions, type/catalog definitions and source metadata. Composition merges fragments of the same document and rejects conflicts; matching subjects alone do not merge independent documents.

## Viewers and settings

`KnotViewer` delegates to a component selected by expanded type URI. The built-in registry contains `Knot3DViewer` and `KnotMosaicViewer`; both also work directly. Without an explicit ID, the compositor selects only when exactly one supported representation exists. A custom registry replaces the built-ins. Resource definitions and viewer registrations serve different purposes: a type definition does not install a renderer.

Applications supply `view`, `views`, 3D `initialCamera` and presentation props separately from knot data. Camera changes, pan, zoom and capture do not mutate the input. Coordinate systems, scale, topology and construction states remain domain data. See [viewer composition](modular-viewers.md) and [selection and settings contracts](../v1/specifications/viewer-contracts.md).

The 3D viewer builds polyline or uniform/centripetal/chordal Catmull–Rom geometry with perspective/orthographic cameras. The mosaic viewer draws the fixed 11-tile convention as SVG without WebGL. Dedicated `knot-engine/3d` and `knot-engine/mosaic` entries isolate their dependencies. Grid diagrams, PD and DT have validation support without built-in viewers.

## Site and verification

The site editor uses public package APIs, edits the full knot, preserves a supported representation selection and retains the last valid result after an invalid edit. Procedures select illustrations without imposing animation correspondence. PNG and SVG exports follow the selected viewer's capabilities.

Checks cover types, schemas, semantic validation, geometry, SSR/hydration, DOM integration, Chromium rendering/capture, tarball consumers and site links. Hardware touch/WebView behavior and physical knot correctness require separate verification.

Components share `.knot-engine-v1-viewer…` classes and `--knot-engine-v1-viewer-*` styling variables; mosaic SVG also uses `.knot-engine-v1-mosaic`. See [styling](../v1/specifications/components.md#css-namespace-and-styling) and [publication policy](publication.md) for namespaces, generations and releases.
