# Reusable resources

The [standard registry](standard.json) publishes immutable definitions for 2D/3D geometry, grid and mosaic diagrams, PD and DT codes, ropes, supports, carabiners, algorithm purposes, tile sets and PD/DT conventions. Core exports it as `STANDARD_RESOURCES` and makes these definitions available automatically. Ordinary knots use standard short names such as `3d`, `rope`, `untying`, `lomonaco-kauffman-11` and `dt-signed-even` without embedding these definitions or passing a registry.

Every standard name has a canonical URI under the `knot-engine` namespace. This mapping is part of the v1 contract for all consumers. External types and purposes use absolute or declared compact URIs and definitions embedded in the Knot or passed through explicit registries. Missing external definitions are not fetched. Self-contained selection includes the required definitions and expands identities to canonical URIs.

The [current contract](../specifications/knot.md) lists reserved names, resource definitions and conflict rules. [Algorithm-purpose definitions](../schema/algorithm-purpose.schema.json) describe a purpose with `id`, `name`, `description`, `specification` and optional localized labels. These resources classify algorithms; they do not define an executable data format.

Resource identifiers are independent of navigation and source directories. Moving documentation does not change the `knot-engine` namespace.

[Tile-set definitions](../schema/tile-set.schema.json) and [convention definitions](../schema/convention.schema.json) have the same descriptive fields as algorithm purposes. Their presence does not install a renderer or extend the fixed mosaic/PD/DT profiles.
