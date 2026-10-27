# Modular viewers

The modular viewers are implemented. Exact inputs, selection, events and capture behavior are defined in the [component API](../v1/specifications/components.md) and [viewer contracts](../v1/specifications/viewer-contracts.md).

## Responsibilities

Core validates domain data, expands namespaces, selects representations and resolves explicitly supplied dependencies. `KnotViewer` maps the selected expanded type URI to a registered Vue component and forwards props, slots, methods and events. Specialized viewers independently select and validate their supported representation type; they work without the compositor.

`Knot3DViewer` owns Three.js geometry, cameras, interaction, GPU lifecycle and PNG capture. `KnotMosaicViewer` owns SVG tile paths, plane framing, pan/zoom and SVG capture. A registry entry declares component capabilities; registering a domain type alone does not provide rendering. Custom viewer registries replace the compositor's built-ins and perform no dynamic code loading.

## Data and presentation

Each viewer accepts a `RawKnot` or prepared `Knot` containing the required domain context. Inputs remain immutable. Presentation is supplied through `view`, `views`, 3D `initialCamera` and rendering props. Coordinate conventions, physical units, geometry, topology and meaningful construction states belong to domain data.

A formation step, representation and camera viewpoint are separate concepts. Sequence navigation needs a future contract; a capability flag does not define its schema or public methods. Additional viewer types must declare their capabilities and preserve explicit diagnostics for unsupported operations.

## Packaging and verification

Use `knot-engine/core` for headless operations, `knot-engine/3d` for the 3D viewer and `knot-engine/mosaic` for a mosaic-only import without Three.js. The root exports all viewers and registry helpers. All visual entries use `knot-engine/styles.css` and the shared viewer styling namespace.

Coverage includes direct and delegated rendering, selected-context validation, URI lookup, ambiguous/unsupported selection, independent views, immutable inputs, event forwarding, SVG/PNG capture, 3D lifecycle, mosaic crossing semantics, SSR/hydration, packed entry points and site integration. Device-specific touch/WebView checks remain separate.
