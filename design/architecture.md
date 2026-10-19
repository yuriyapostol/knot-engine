# knot-engine architecture

The initial `KnotAsset` redesign profile is implemented. The authoritative current contracts are [data](../v1/spec/knot-asset.md), [functions](../v1/spec/functions.md) and [component](../v1/spec/components.md). The [broader design](knot-asset-draft.md) still contains future work; it does not mean every proposed field is accepted.

```text
KnotAsset / standalone data / explicitly provided registries
  → bounded structural validation
  → URI expansion, reference and domain validation
  → completeness report
  → representation and view selection
  → RenderableModel
  → geometry builder + camera preparation
  → KnotViewer / PNG capture
```

Core contains no Vue, Three.js, browser access or network resolver. JSON Schema contracts share one source, `src/core/contracts.json`; published independent schemas are generated using `npm run build:schemas`. Semantic validation handles cross-record references and geometric/combinatorial rules separately.

`KnotViewer` accepts asset, representation selection and optional registry/view context. Old model inputs, adapters, schemas and compatibility tests have been removed. Shared errors and rendering types no longer belong to a legacy module. Geometry supports polyline and explicit uniform/centripetal/chordal Catmull–Rom. Perspective and orthographic cameras share preparation code between viewport and capture.

The site demo uses only the public API. It edits the whole asset, preserves a still-existing representation selection, and retains the last valid rendered asset when an edit is invalid. Named states belong to constructions; each static representation identifies its state. Procedures select representations without imposing interpolation correspondence.

Extraction includes required constructions and resources. Composition is limited to fragments of the same document; independent-author merges are not inferred. Unknown type data is structurally readable but does not receive a complete semantic report. Additional formats, assertions and animation need their own contracts and tests.

Verification: typecheck, unit/schema tests, library/example builds, browser tests, tarball consumer and site/link tests. Hardware touch, WebView and physical knot correctness are not established by these checks. Versions remain package 0.1.0 and `schemaVersion` 1.

Classes `.knot-viewer-v1…` and `--knot-viewer-v1-*` variables separate the first generation's styling namespace. Suffixes allow different major viewers on one documentation page when needed. CSS, like the rest of the package, has no backward compatibility requirement during initial development. See the [publication policy](publication.md#css-namespace-for-major-generations) and [component contract](../v1/spec/components.md#css-namespace-and-styling).
