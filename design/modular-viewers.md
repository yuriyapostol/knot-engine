# Modular viewers architecture (contract design)

**Status:** agreed direction; first-stage design, not an implemented API. The current API remains defined in [components](../v1/specifications/components.md).

## Architecture

`KnotViewer` becomes a generic compositor. It uses independent core operations to validate input and select a representation, expands its type URI using document namespaces, resolves an explicitly supplied or built-in viewer registry, and delegates rendering, events and methods. It must not contain Three.js or representation-specific geometry.

`Knot3DViewer` renders `spatial-curve`; `KnotMosaicViewer` renders `mosaic-diagram`. Both must also work independently, but **every viewer accepts only a complete or permitted partial `Knot`**. A representation-type resource does not imply that a renderer exists. Invalid data, incomplete dependencies, unsupported types and missing renderers require distinct diagnostics.

Core owns data contracts, JSON Schema, validation, URI expansion, resource resolution and domain semantics without Vue, DOM, Three.js or network access. The compositor owns viewer-component routing, shared states and delegation; core owns representation selection and validation. Each specialized viewer owns its renderer, interactions, lifecycle, snapshots and type-specific settings. The registry maps **expanded absolute URIs** to implementations/capabilities; it is explicitly provided or instance-local, never mutable global state. Applications may explicitly override built-ins. Registry lookup must not fetch code or data.

## Independent selection and validation

`core` exposes public operations for validating complete `Knot` documents, validating permitted partial inputs, selecting representations by ID or type, expanding type URIs, validating selected representations and resolving their required dependencies. These operations are usable independently of any viewer for data inspection or transformation. The normative specification will define exact names and signatures; results must expose structured diagnostics without a UI dependency.

`KnotViewer` and specialized viewers are peers consuming these core operations. `KnotViewer` additionally determines **which viewer component** to use. `Knot3DViewer` and `KnotMosaicViewer` know their supported types, yet each can independently accept a complete or permitted partial `Knot`, select its representation via core, validate it and prepare its dependencies. No specialized viewer depends on `KnotViewer` for validation or selection.

Full-document validation differs from targeted partial-input validation: unrelated optional portions are not required, but necessary dependencies and domain constraints are checked. Selection among multiple matching representations must be deterministic or require an explicit ID; ambiguity must not be silently ignored.

## Common contract

Inputs: `knot` (complete or permitted partial `Knot`), optional `representationId`, `settings`, `label`, `description`, `locale`, `theme`, `active`, `interactive`, `showControls`. The knot input type is shared, while settings are viewer-specific; input objects are immutable. States: `empty`, `initializing`, `ready`, `error`. Events: `ready`, `error`, `view-change`; `camera-change` remains 3D-specific. Methods: `resetView()`, `fitToView()`, `capture(options?)`. Zoom, orbit, pan, editing and capture formats must be declared as capabilities rather than simulated for unsupported viewers. Exact TS signatures and event/error payloads must be finalized before implementation.

Preserve existing 3D SSR fallback, accessibility, lifecycle, resource cleanup, visibility/active handling, recovery and instance independence.

## Sequences and step-by-step tying

Future representations may describe sequences of construction/tying states or steps and related views. The contract must leave room for step/state selection and sequence navigation without prematurely defining schema fields or public methods. **Representation**, **tying step/state** and **display settings** are distinct: a step is not necessarily a separate representation, and camera orientation is not a tying step. All required sequences and context arrive within `Knot`; user interactions never mutate the input knot.

## Display settings and domain boundaries

Pass display settings **outside** `Knot` and `Representation.data`: camera, projection, zoom/pan, framing, visual styling and interaction. Coordinate conventions, units, authored geometry, topology, tile conventions, construction objects and meaningful states remain domain data. Rotating the mosaic viewport does not rewrite its matrix; a topological mirror is not a camera setting.

Migration completed: `Representation.views`, `defaultView`, and `preferredView` are removed from the knot contract and bundled schemas. Applications provide `view`, optional `views` presets and 3D `initialCamera` through viewer props. Without an explicit view, viewers use default framing. Screen and capture share the selected viewer state; `model-preview` requests default framing. User interaction never mutates the knot.

## Package, CSS and delivery

Keep one `knot-engine` package with direct exports for all three viewers. Consider `knot-engine/3d` and `knot-engine/mosaic` entry points to keep Three.js out of mosaic-only imports; retain `knot-engine/core`. CSS classes and public variables use component-scoped `knot-engine-v1-viewer`, `knot-engine-v1-3d-viewer`, `knot-engine-v1-mosaic-viewer` prefixes. No global styling; components and major generations must coexist.

Sequence: (1) finalize settings/registry/capability/event/error contracts and view migration; (2) extract 3D and convert compositor without regression; (3) implement SVG mosaic tiles 0–10 without an editor; (4) expand only after testing both rendering engines.

Acceptance: all viewers accept only complete or permitted partial `Knot`; standalone and delegated rendering; consistent absolute/prefixed URI lookup; explicit unsupported diagnostics; independent settings and immutable data; consistent captures; preserved 3D touch/keyboard/SSR/lifecycle; mosaic crossings 9/10 and noncrossing tiles 7/8; no Three.js in mosaic-only entry; isolated CSS; type, unit, browser, SSR, package and site checks. Keep package `0.1.0` and `schemaVersion: 1` during initial development; no legacy compatibility layer.
