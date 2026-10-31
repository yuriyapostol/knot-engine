# Reusable resources

The [standard registry](standard.json) contains definitions for 2D and 3D geometry, grid and mosaic diagrams, planar diagram codes, Dowker–Thistlethwaite codes, ropes, supports and carabiners. These are type contracts, not a catalog of verified knots. Core exports the same data as `STANDARD_RESOURCES`; pass it explicitly through `registries` or embed the required definitions in a `Knot` object.

The [current contract](../specifications/knot.md) defines registries, standalone documents, ID conflicts and dependency resolution. Catalogs, categories and additional formats need their own verified definitions.

Resource identifiers are independent of navigation and source directories. Moving documentation does not change the `knot-engine` namespace.
