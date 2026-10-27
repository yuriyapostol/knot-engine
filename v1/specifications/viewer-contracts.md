# Representation selection and viewer contracts

The package implements representation selection, registry dispatch, 3D and SVG mosaic viewers, and application-owned view settings. See the [component API](components.md) for props and [data contract](knot.md) for domain semantics.

## Core selection

```ts
import { selectRepresentation, type RawKnot, type Knot } from 'knot-engine/core'

type RepresentationQuery = { representationId?: string; type?: string }
// selectRepresentation(knot: RawKnot | Knot, query?, options?): SelectionResult
// Success: { ok: true, knot: RawKnot, representation: RawRepresentation, typeUri: string }
// Failure: { ok: false, issues: SelectionIssue[] }
```

The result contains normalized raw data without UI, input mutation or fetching. Type matching uses expanded URIs. An explicit ID must match any requested type. Missing, ambiguous and unsupported matches return distinct issue codes: `INVALID_KNOT`, `REPRESENTATION_NOT_FOUND`, `AMBIGUOUS_REPRESENTATION`, `UNSUPPORTED_REPRESENTATION`, `MISSING_DEPENDENCY`, `INVALID_REPRESENTATION`.

The root must satisfy the `RawKnot` structure; optional sections may be omitted. By default, validation checks the selected representation and required context, including subject catalog identifiers. Unrelated representations and procedures do not prevent targeted rendering. `scope: 'all'` validates the entire document. `registries` and `schemas` supply explicit dependencies. Success requires complete validation of that scope and retains the full normalized knot context.

## Viewer dispatch

`KnotViewer` uses a `ViewerRegistry`, a `ReadonlyMap<string, ViewerRegistration>` keyed by expanded absolute type URI. `createViewerRegistry(entries)` rejects duplicate keys; each entry has `typeUri`, Vue `component` and readonly `capabilities`. `findViewer(knot, type, registry)` expands a type in the knot's namespaces. `selectViewerRepresentation(knot, registry, representationId?)` applies compositor selection independently of rendering.

Built-ins map `spatial-curve` to `Knot3DViewer` and `mosaic-diagram` to `KnotMosaicViewer`. A caller's `registry` replaces the built-ins. Without `representationId`, exactly one registered representation must exist; multiple supported representations require an ID, even of the same type. Unsupported siblings are ignored for dispatch. An explicit ID has no fallback. Zero registered candidates produce `UNSUPPORTED_REPRESENTATION`; missing or malformed representation collections receive core diagnostics.

Specialized viewers call core selection with their fixed type and also require an ID when multiple matches exist. All viewers accept `RawKnot` or prepared `Knot` with the selected representation's required context. A type resource alone does not register a renderer. Registries neither load code nor fetch data.

Capabilities declare `orbit`, `pan`, `zoom`, `edit`, capture formats `png`/`svg`, and `sequences`. Built-in 3D supports orbit/pan/zoom and PNG; mosaic supports pan/zoom and SVG. Sequence schemas and navigation are not implemented.

## Application-owned views

Applications pass `view`, optional local presets `views`, 3D `initialCamera` and presentation props separately from knot data. `resolveRepresentationView(requested, views?, registries?, namespaces?)` resolves an inline `ViewDefinition`, local `{id}` or global `{ref}`. Local lookup requires one matching preset; global lookup expands declared prefixes and reads explicit registries. Missing/conflicting definitions and invalid views are errors. Omitted `view` resolves to `null`, leaving default framing to the viewer.

A `ViewDefinition` requires `id`, `name`, `space`, `camera`; `description` is optional. `space: 'space'` uses `Camera3D`; `space: 'plane'` uses `{mode:'plane',center:[x,y],height:positive}`. Rotation is not accepted. A view must match the specialized viewer's space.

Spatial `fit` requires finite, nonzero, noncollinear `direction` and `up` vectors and `projection`. Direction points from focus to camera. Optional `padding` is at least 1, default 1.1. `fixed` requires distinct `position`/`target`, nonparallel `up` and projection. Perspective uses `0 < fovY < π` radians; fixed orthographic projection additionally requires positive `height`. Viewport aspect and geometry bounds determine fitting. `initialCamera` overrides the 3D display camera after view resolution; invalid requested views are still errors.

Camera presets are not part of `RawKnot`. View changes, interaction and capture leave domain data unchanged. Construction states and procedure steps have independent meaning.

## Events, methods and capture

Shared methods are `resetView()`, `fitToView()` and `capture(options?): Promise<Blob>`. Shared events are `ready`, `error` and `view-change`; 3D additionally emits `camera-change` with the same camera payload. Mosaic `view-change` carries `{center:[x,y],height}`. The compositor forwards events and emits structured dispatch errors itself.

`CaptureOptions` contains `width`, `height`, `format`, `view` and `transparent`. Dimensions are integers in 1..2048. 3D produces PNG, default 512×512; mosaic produces SVG, default 1024×1024. Omitted format uses the viewer's format; explicitly unsupported formats reject. `current` captures local viewer state; `model-preview` uses the resolved spatial view/default camera or the full mosaic extent. The 3D `initialCamera` override is not used for preview capture. Capturing leaves the live view unchanged. PNG supports transparent backgrounds; mosaic SVG has no background fill.

## Package entries and checks

`knot-engine/core` provides headless operations, `knot-engine/3d` exports `Knot3DViewer`, and `knot-engine/mosaic` exports `KnotMosaicViewer` without Three.js. The root exports all viewers and registry helpers. Import `knot-engine/styles.css` for visual components.

Checks cover selected/full validation, complete and partial contexts, URI expansion, ambiguous/unsupported selection, independent settings, immutable inputs, direct/delegated DOM rendering, event forwarding, 3D/mosaic switching in Chromium, SVG/PNG captures and packed JavaScript/TypeScript entry points.
