# knot-engine architecture

The initial `Knot` redesign profile is implemented. The authoritative current contracts are [data](../v1/specifications/knot.md), [functions](../v1/specifications/functions.md) and [component](../v1/specifications/components.md). The [broader design](knot-draft.md) still contains future work; it does not mean every proposed field is accepted.

```text
Knot / standalone data / explicitly provided registries
  → bounded structural validation
  → URI expansion, reference and domain validation
  → completeness report
  → representation and view selection
  → RenderableModel
  → geometry builder + camera preparation
  → KnotViewer / PNG capture
```

Core contains no Vue, Three.js, browser access or network resolver. JSON Schema contracts share one source, `src/core/contracts.json`; published independent schemas are generated using `npm run build:schemas`. Semantic validation handles cross-record references and geometric/combinatorial rules separately.

`KnotViewer` accepts knot, representation selection and optional registry/view context. Old model inputs, adapters, schemas and compatibility tests have been removed. Shared errors and rendering types no longer belong to a legacy module. Geometry supports polyline and explicit uniform/centripetal/chordal Catmull–Rom. Perspective and orthographic cameras share preparation code between viewport and capture.

The site demo uses only the public API. It edits the whole knot, preserves a still-existing representation selection, and retains the last valid rendered knot when an edit is invalid. Named states belong to constructions; each static representation identifies its state. Procedures select representations without imposing interpolation correspondence.

Extraction includes required constructions and resources. Composition is limited to fragments of the same document; independent-author merges are not inferred. Unknown type data is structurally readable but does not receive a complete semantic report. Additional formats, assertions and animation need their own contracts and tests.

Verification: typecheck, unit/schema tests, library/example builds, browser tests, tarball consumer and site/link tests. Hardware touch, WebView and physical knot correctness are not established by these checks. Versions remain package 0.1.0 and `schemaVersion` 1.

CSS uses the package namespace `knot-engine`, followed by the major generation and component name: `.knot-engine-v1-viewer…` and `--knot-engine-v1-viewer-*` for `KnotViewer`. Other components receive their own names within the same package/generation namespace. Different major versions can be used on the same page. CSS, like the rest of the package, has no backward compatibility requirement during initial development. See the [publication policy](publication.md#css-namespace-for-major-generations) and [component contract](../v1/specifications/components.md#css-namespace-and-styling).

## Planned viewer composition and separate view settings

This is the agreed direction for future implementation. The current data and component contracts linked above still describe the implemented behavior.

Develop separate viewer components for the different representation types. The main `KnotViewer` will select the appropriate component by the expanded representation type URI and delegate rendering to it. Individual viewers must also be usable directly. Adding a representation viewer must not require adding its rendering logic to the main component. A type definition alone does not install a viewer; unsupported types must produce an explicit unsupported-state diagnostic.

The viewers must have a consistent API for representation data and required domain context, separately supplied view settings, accessible labels, locale/theme, lifecycle and error events, and applicable methods such as reset, fit and capture. Shared behavior and error meanings must be consistent. Type-specific settings and capabilities must be explicit; a textual or planar viewer need not pretend to support a 3D camera. The main component forwards settings, methods and events through this common contract.

Separate presentation settings from knot/domain data. The application will pass view settings as a separate viewer input rather than embedding them in `Knot` or representation data. This includes camera position and orientation, projection, framing, zoom/pan, visual styling and interaction settings. Review the existing `Representation.views`, `defaultView` and `preferredView` fields and move their presentation role into the separate settings contract. Named view presets may be stored independently and associated with a representation ID; their storage and exact API remain to be designed. Changing a camera, selecting a preset or interacting with a viewer must not mutate knot data. Viewport rendering and capture must use the separately supplied settings consistently.

Coordinate systems, units, authored geometry, topology, mathematical conventions and meaningful construction states remain domain data. A camera orientation is a view setting; the orientation convention that gives coordinates or a diagram their meaning is domain data. Knot files must remain valid and useful without saved view settings; viewers supply documented defaults when settings are absent.

Before implementation is considered complete, define the common viewer and settings contracts, migrate the existing spatial viewer behind the main component, add the appropriate viewers for supported representation types, update schemas/examples and document the separation from the current embedded view fields. Acceptance must cover direct and delegated use, type switching, unsupported capabilities, independent settings for two viewers of the same data, capture consistency and preservation of the input data.
