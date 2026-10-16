# Reusable resources

The [standard registry](standard.json) contains definitions for `spatial-curve`, Grid X/O, rope, support and carabiner. These are type contracts, not a catalog of verified knots. Core exports the same data as `STANDARD_RESOURCES`; pass it explicitly through `registries` or embed the required definitions in an asset.

The [current contract](../spec/knot-asset.md) defines registries, standalone documents, ID conflicts and dependency resolution. Catalogs, categories and additional formats need their own verified definitions.

Resource identifiers are independent of navigation and source directories. Moving documentation does not change the `knot-engine` namespace.
