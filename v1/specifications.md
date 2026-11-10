# Specifications and API reference

These documents define the **implemented** contract. Start with the core data model; use the narrower references for individual features.

## Data model

- [Knot v1](specifications/knot.md) — document structure, representations, resources, validation.
- [Prepared model](specifications/prepared-model.md) — runtime objects and editing.
- [Sources and contributions](specifications/sources.md) — provenance, attribution, licensing.

## Representation formats

- [2D and 3D geometry](specifications/knot.md#2d-and-3d-geometry) — curves, meshes and crossing semantics.
- [Image](specifications/image.md) — external or embedded raster/vector image.
- [Grid diagrams](specifications/grid-diagram.md).
- [Mosaic diagrams](specifications/mosaic-diagram.md).
- [PD codes](specifications/pd-code.md).
- [DT codes](specifications/dt-code.md).

## Standard resources and registries

- [Standard definitions](resources/index.md) — built-in types, algorithm purposes, tile sets and conventions.
- [JSON registry](resources/standard.json) — machine-readable definitions.

## Runtime and integration

- [Functions](specifications/functions.md) — validation, selection and import APIs.
- [Viewer components](specifications/components.md) — props, events, capture, styling.
- [Viewer contracts](specifications/viewer-contracts.md) — selection and view behavior.

## Machine-readable resources

- [JSON Schemas](schema.html).
- [Example data](examples.html).

For step-by-step instructions, use the [guide](guide.md). For decisions and exploratory work, see [design](../design/index.md).
