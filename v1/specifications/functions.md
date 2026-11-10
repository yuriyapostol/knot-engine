# Functions

Import core APIs from `knot-engine/core`; this entry point uses no Vue, Three.js or DOM. Validation and selection do not mutate inputs; prepared `Knot` objects support explicit editing methods. URI references never trigger network access.

| Function | Result |
| --- | --- |
| `Knot.validate(raw, options?)` / `knot.validate(options?)` | Validation report for raw or prepared data |
| `validateGridDiagram(value)` | `{valid:true,data,diagram,warnings,componentCount,crossingCount}` or issues; independent grid diagram validation with `xo` or `vertex-pairs` encoding |
| `validateDTCode(value)` | `{valid:true,data,code,warnings,componentCount,crossingCount}` or issues; numeric knot/link DT with planar-realizability validation |
| `validatePDCode(value)` | `{valid:true,data,code,warnings,componentCount,crossingCount}` or issues; independent planar diagram code validation |
| `validateGeometry2D(value)` / `validateGeometry3D(value)` | `{valid:true,data,warnings}` or issues |
| `parsePLinkProjection(source)` / `importPLink2D(source)` | Parse PLink projection text / convert it to 2D geometry; see [import guide](../guide/import-plink.md) |
| `importSVGPath2D(d, {idPrefix, yAxis})` | Array of segmented 2D curves; invalid or unsupported path data throws |
| `exportSVGPath2D(curve, {yAxis})` | Normalized absolute SVG path data |
| `validateMosaicDiagram(value)` | `{valid:true,data,diagram,warnings,componentCount,occupiedTileCount,crossingCount}` or issues; independent mosaic diagram validation |
| `validateView(value)` | `{valid:true,data,warnings}` or issues |
| `validateResourceDocument(value)` | Validated resource envelope or issues; does not establish dependency closure |
| `validateResourceRegistry(value)` | Validated registry and conflict check or issues; does not establish dependency closure |
| `validateRepresentationDocument(value, options?)` | Standalone representation validation report |
| `Knot.from(raw, options?)` / `knot.select(selection)` / `Knot.compose(parts)` | Prepare, select and compose documents |
| `selectRepresentation(knot, query?, options?)` | Select and validate one representation; structured diagnostics |
| `resolveRepresentationView(requested, views?, registries?, namespaces?)` | Resolve an application-owned view without fetching |
| `resolveResourceURI(value, kind, namespaces?)` | Canonical URI for a reserved standard name or an absolute/declared compact URI; kind scopes the name |
| `expandURI(value, namespaces?)` | Exact expanded URI; undeclared prefixes throw |

`Knot.validate()` and `knot.validate()` accept `registries` (array of `RawResourceRegistry`). The `ValidationOptions` used by representation validation/selection additionally accept `schemas` (explicit JSON Schema objects). Known objects are always closed; `strict: false` does not relax validation. `STANDARD_RESOURCES` publishes the immutable standard representation types, object types, algorithm purposes, tile sets and conventions; these definitions are always available without passing a registry. Type definitions, `ViewerError`, `KNOT_LIMITS`, namespace and type URI constants are exported.

Built-in viewers render 2D curves, 3D curves and meshes, and SVG grids and mosaics. Rendering requires complete validation of the selected representation and its dependencies; extraction requires a complete document. Unknown type data can be preserved with an incomplete report. No operation proves the mathematical identity of a knot.

See [data semantics](knot.md) and [component API](components.md).

Sources, flat contributions and licenses are optional metadata. Validation checks structure, contacts and calendar dates, not authorship or license compatibility. Selection retains required sources, root contributions and license; composition checks license conflicts. See the [shared contract](sources.md).

## SVG path conversion

Both functions are exported from `knot-engine/core`, `knot-engine/2d`, and the root entry. They use no DOM and do not mutate input. `yAxis:'up'|'down'` is required and describes the external path coordinates: `down` explicitly reflects Y when converting to/from Knot's Y-up system. Coordinates are not translated, rescaled, or assigned a physical scale.

```ts
import { importSVGPath2D, exportSVGPath2D } from 'knot-engine/core'

const curves = importSVGPath2D('M0 0 Q1 2 2 0 S4 -2 5 0', {
  idPrefix: 'rope', yAxis: 'down',
})
const d = exportSVGPath2D(curves[0], { yAxis: 'down' })
```

The importer accepts SVG `M/L/H/V/Q/T/C/S/Z` and their relative lowercase forms, repeated parameter groups, implicit lines after moveto, compact numbers and exponent notation. `S/T` resolve reflected control points only after the corresponding cubic/quadratic command family; otherwise the implicit handle is the current point. Coordinates and handles are stored explicitly. Each nonempty subpath gets a separate curve with ID `${idPrefix}-1`, `${idPrefix}-2`, etc. Move-only subpaths are omitted. Drawing after `Z` creates another curve starting at the closed subpath's start. Empty path data returns `[]`. Crossing records are not inferred.

Malformed data is rejected in full instead of displaying a valid prefix. Elliptical arcs `A/a` are explicitly unsupported. This API reads path data, not SVG XML, styling or element transforms. Input is limited to 1,000,000 characters and 200,000 lexical tokens, with 4096 segments per curve and 65536 authored points across the import.

Export uses absolute `M/L/Q/C/Z`, preserves quadratic and cubic segment degrees, and exports Catmull–Rom as equivalent cubics. Round trips preserve geometry, not original shorthand or formatting. Multiple curves can be combined into one SVG path by joining their exported strings with spaces; Knot retains them as separate elements for crossing traversal.
