# Representation selection and viewer contracts

**Status:** `selectRepresentation` supports targeted validation of the selected representation; arbitrary partial root structures and a basic UI compositor and registry are implemented; remaining UI contracts are still in design. Supplements the [architecture](../../design/modular-viewers.md).

## Input and selection

All viewer components receive `asset: KnotAsset` (complete or permitted partial), `representationId?: string` and separate `settings`. Schema, namespaces, resources, constructions, procedures and states are checked according to the selected representation's needs. Core uses the same asset container without depending on Vue.

Proposed core operations:

```ts
type RepresentationQuery = { representationId?: string; type?: string }
type SelectionResult =
  | { ok: true; asset: KnotAsset; representation: Representation; typeUri: string }
  | { ok: false; issues: SelectionIssue[] }
type SelectionIssue = {
  code: 'INVALID_ASSET' | 'REPRESENTATION_NOT_FOUND' | 'AMBIGUOUS_REPRESENTATION'
      | 'UNSUPPORTED_REPRESENTATION' | 'MISSING_DEPENDENCY' | 'INVALID_REPRESENTATION'
  message: string
  path?: string
}
function selectRepresentation(asset: KnotAsset, query?: RepresentationQuery, options?: SelectionOptions): SelectionResult
```

This operation returns data without UI, mutation or resource fetching. Type matching uses expanded URIs. An explicit ID must also match the requested type; missing and ambiguous matches have distinct diagnostics. Without an ID, the generic viewer may select only under an unambiguous rule; silently choosing the first representation is forbidden. Partial assets require validation of a minimally sufficient dependency closure. The root must conform to the v1 `KnotAsset` structure; optional sections may be omitted. By default, only the selected representation and required context are validated, not unrelated representations or procedures. `scope: 'all'` validates the entire document. Missing dependencies of the selected representation remain errors.

## UI contract

`KnotViewer` selects the component by `typeUri`; specialized viewers call `selectRepresentation` with a fixed type. Shared states: `empty | initializing | ready | error`; events: `ready`, `error`, `view-change`; methods: `resetView()`, `fitToView()`, `capture(options?)`. `camera-change` is 3D-specific. Events do not mutate the asset.

```ts
type ViewerRegistration = {
  typeUri: string
  component: unknown // Vue component type in UI package
  capabilities: {
    orbit?: boolean; pan?: boolean; zoom?: boolean; edit?: boolean
    capture?: readonly ('png' | 'svg')[]
    sequences?: boolean
  }
}
type ViewerRegistry = ReadonlyMap<string, ViewerRegistration>
```

Registry is explicit or locally assembled from built-ins, never mutable global state. Sequence support is a declared capability; step schemas and navigation APIs will be defined separately.

## Settings and migration

`settings` lives outside `KnotAsset`; 3D settings include camera/viewpoint and rendering options, while mosaic settings include pan, zoom and styling. Meaningful steps, states and sequences remain in the asset. Before removing `views`, `defaultView`, `preferredView`, agree on mapping old fields to new settings and documented defaults. A temporary compatibility layer is not required.

## Tests

Cover complete and partial assets; explicit ID; missing and ambiguous selection; prefix expansion; unknown type; missing resources; immutable inputs; independent viewer instances; and procedures without conflating tying steps with camera viewpoints.


## Dedicated package entry points

The package publishes `knot-engine/core` for headless validation, `knot-engine/3d` for `Knot3DViewer`, and `knot-engine/mosaic` for `KnotMosaicViewer`. The root entry retains `KnotViewer` and both specialized components for compatibility. Import `knot-engine/styles.css` when using the visual components. Each dedicated entry is tested from the packed npm tarball, including its generated TypeScript declarations.


## Generic viewer selection rule

Without `representationId`, `KnotViewer` filters available representations by the effective viewer registry, then selects **only if exactly one supported representation exists**. Unsupported siblings are ignored for dispatch, not deleted or modified. Multiple supported representations require an explicit ID, even when they share a type; zero supported representations return `UNSUPPORTED_REPRESENTATION`. An explicit ID selects that representation without fallback and reports an unsupported viewer if its type is not registered. A caller-provided registry replaces the built-in registry. The selected representation is then validated by `core` using its dependency context.


### Event forwarding

The generic compositor emits a structured `error` when dispatch itself fails (including ambiguous or unsupported selections), not only when a mounted specialized viewer fails. The 3D viewer emits the shared `view-change` alongside its existing `camera-change`; the compositor forwards both without changing their payloads. No new interaction capability is implied.
