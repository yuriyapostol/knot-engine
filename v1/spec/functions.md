# Functions

Import core APIs from `knot-engine/core`; this entry point uses no Vue, Three.js or DOM. Inputs are immutable to the library. URI references never trigger network access.

| Function | Result |
| --- | --- |
| `validateKnotAsset(value, options?)` | `{valid:true,asset,warnings,complete,missingDependencies,uncheckedTypes}` or `{valid:false,issues}` |
| `validateGridDiagram(value)` | `{valid:true,data,diagram,warnings,componentCount,crossingCount}` or issues; independent grid diagram validation with X/O or `vertex-pairs` encoding |
| `validateSpatialCurve(value)` | `{valid:true,data,warnings}` or issues |
| `validateView(value)` | `{valid:true,data,warnings}` or issues |
| `validateResourceDocument(value)` | Validated resource envelope or issues; does not establish dependency closure |
| `validateResourceRegistry(value)` | Validated registry and conflict check or issues; does not establish dependency closure |
| `validateRepresentationDocument(value, options?)` | Standalone representation validation report |
| `resolveKnotAsset(value, {representationId?,view?}?, options?)` | Internal `RenderableModel`; throws `ViewerError` on invalid, unresolved or unsupported data |
| `resolveRepresentation(representation, options?)` | Standalone subject-level spatial representation to rendering data; explicit resource context required |
| `selectKnotAsset(value, {representations?,procedures?}, options?)` | Cloned self-contained fragment with dependencies |
| `composeKnotAsset(values, options?)` | Cloned merged fragments of the same document; conflicts are errors |
| `expandURI(value, namespaces?)` | Exact expanded URI; undeclared prefixes throw |

Validation options accept `registries` (array of `KnotResourceRegistry`) and `schemas` (explicit JSON Schema objects). Known objects are always closed; the retained `strict` option does not relax validation. `STANDARD_RESOURCES` provides the built-in representation and object type definitions when passed explicitly. Type definitions, `ViewerError`, `KNOT_ASSET_LIMITS`, namespace and type URI constants are exported.

The renderer currently supports only `spatial-curve`. `valid:true` alone is insufficient to render or extract: these operations also require `complete:true`. Unknown type data can be preserved with an incomplete report. No operation proves the mathematical identity of a knot.

See [data semantics](knot-asset.md) and [component API](components.md).
