# Functions

Import core APIs from `knot-engine/core`; this entry point uses no Vue, Three.js or DOM. Validation and selection do not mutate inputs; prepared `Knot` objects support explicit editing methods. URI references never trigger network access.

| Function | Result |
| --- | --- |
| `Knot.validate(raw, options?)` / `knot.validate(options?)` | Validation report for raw or prepared data |
| `validateGridDiagram(value)` | `{valid:true,data,diagram,warnings,componentCount,crossingCount}` or issues; independent grid diagram validation with `xo` or `vertex-pairs` encoding |
| `validateDTCode(value)` | `{valid:true,data,code,warnings,componentCount,crossingCount}` or issues; numeric knot/link DT with planar-realizability validation |
| `validatePDCode(value)` | `{valid:true,data,code,warnings,componentCount,crossingCount}` or issues; independent planar diagram code validation |
| `validateSpatialCurve(value)` | `{valid:true,data,warnings}` or issues |
| `validateMosaicDiagram(value)` | `{valid:true,data,diagram,warnings,componentCount,occupiedTileCount,crossingCount}` or issues; independent mosaic diagram validation |
| `validateView(value)` | `{valid:true,data,warnings}` or issues |
| `validateResourceDocument(value)` | Validated resource envelope or issues; does not establish dependency closure |
| `validateResourceRegistry(value)` | Validated registry and conflict check or issues; does not establish dependency closure |
| `validateRepresentationDocument(value, options?)` | Standalone representation validation report |
| `Knot.from(raw, options?)` / `knot.select(selection)` / `Knot.compose(parts)` | Prepare, select and compose documents |
| `selectRepresentation(knot, query?, options?)` | Select and validate one representation; structured diagnostics |
| `resolveRepresentationView(requested, views?, registries?, namespaces?)` | Resolve an application-owned view without fetching |
| `expandURI(value, namespaces?)` | Exact expanded URI; undeclared prefixes throw |

`Knot.validate()` and `knot.validate()` accept `registries` (array of `RawResourceRegistry`). The `ValidationOptions` used by representation validation/selection additionally accept `schemas` (explicit JSON Schema objects). Known objects are always closed; `strict: false` does not relax validation. `STANDARD_RESOURCES` provides the built-in representation and object type definitions when passed explicitly. Type definitions, `ViewerError`, `KNOT_LIMITS`, namespace and type URI constants are exported.

Built-in viewers render spatial curves and SVG mosaics. Rendering requires complete validation of the selected representation and its dependencies; extraction requires a complete document. Unknown type data can be preserved with an incomplete report. No operation proves the mathematical identity of a knot.

See [data semantics](knot.md) and [component API](components.md).

Sources, flat contributions and licenses are optional metadata. Validation checks structure, contacts and calendar dates, not authorship or license compatibility. Selection retains required sources, root contributions and license; composition checks license conflicts. See the [shared contract](sources.md).
