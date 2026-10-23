# KnotAsset v1

Implemented initial profile of the [contract redesign](../../design/knot-asset-draft.md). Package version remains 0.1.0; `schemaVersion` remains 1. The previous contracts and APIs have been removed. This profile supports spatial curves, grid diagrams, mosaic diagrams, planar diagram codes, Dowker–Thistlethwaite codes, constructions, named states, procedures and reusable resources. Other representation formats, animation, properties, relations and classifications remain separate future work; they are not accepted as untyped fields.

## Terminology

Use descriptive concepts in prose. Name `KnotAsset` explicitly when referring to that data object; use “document” for serialized documents or documentation rather than as a blanket replacement for the type name. Use the same code formatting at corresponding locations in both language editions. Headings use plain text, including technical names. Format exact type, function and field names and code values in body text as code; retain product and source names such as KnotInfo and Gridlink. X/O names a marking system; `xo` and `vertex-pairs` are exact `encoding` values. Do not substitute file or type identifiers for descriptive concepts in feature lists.

| Concept | Technical identifier |
| --- | --- |
| Knot data object | `KnotAsset`, `asset` |
| Subject | `subject` |
| Representation | `Representation`, `representations` |
| Spatial curves | `spatial-curve` |
| Grid diagrams | `grid-diagram` |
| Mosaic diagrams | `mosaic-diagram` |
| Planar diagram codes | `pd-code` |
| Dowker–Thistlethwaite codes | `dt-code` |
| Construction | `Construction`, `constructions` |
| Construction object | `ConstructionObject`, `objects` |
| Named state | `states` |
| Procedure and step | `Procedure`, `procedures`, `Step`, `steps` |
| View and camera | Viewer-owned `ViewDefinition`, `view`, `views`, `initialCamera` |
| Catalog definition | `CatalogDefinition`, `catalogs` |
| Source and contribution | `SourceDefinition`, `SourceUse`, `Contribution` |
| License | `License` |
| Resource registry | `KnotResourceRegistry` |
| Viewer component | `KnotViewer` |

## Documents and identity

`KnotAsset` requires `schema: "KnotAsset"`, `schemaVersion: 1`, `id` and `subject: {id}`. Optional collections are `catalogs`, `representationTypes`, `objectTypes`, `constructions`, `representations`, `procedures`, `dependencies`. `$schema` is optional and, when present, must identify the corresponding published JSON Schema. `namespaces` declares compact URI prefixes. Known objects are closed: unknown fields are errors even if a caller passes `strict: false`.

`asset.id` identifies the document; `subject.id` identifies its subject. Initial-profile IDs may be local strings or absolute/compact URIs. Independent documents are not merged by subject identity. `subject.names` and `subject.descriptions` contain `{language,value}` records for localized display names and descriptions; both fields are optional arrays, each limited to 128 records. `language` and `value` are nonempty strings; language tags should follow BCP 47 (`uk`, `en`, etc.). Neither array sets a viewer locale or implies a fallback policy. `subject.identifiers` contains `{catalog,value}` records. A catalog is an identification system, not a collection of all its entries. Its rules validate a designation, not the truth of the author's identification.

Omitted collections and empty collections do not establish completeness of knowledge. Metadata-only assets are valid; a 3D viewer requires a renderable representation.

## Namespaces and references

Global identifiers use absolute `http`, `https` or `urn` URIs, or a declared `prefix:suffix`. Expansion concatenates the namespace URI and suffix. Prefixes `http`, `https`, `urn` are reserved, case-insensitively. Undeclared prefixes are errors. Expanded URIs compare exactly; no fetching, case folding or URL canonicalization occurs. The built-in namespace is `https://yuriyapostol.github.io/knot-engine/v1/`.

Prefixes also apply to our `dataSchema.ref` field, `data.convention` in standard DT/PD representations, and `data.tileSet` in standard mosaic representations. The representation type is expanded first and determines which data fields may be expanded. Arbitrary data of unknown types, source URLs and `dataSchema.inline` contents are not rewritten. Each document or registry has its own `namespaces`; moving a compact fragment into another document requires carrying its declarations or expanding its URIs first.

JSON Schema does not expand data values using our `namespaces`. Before checking extracted `data` with a standalone DT/PD/mosaic schema, expand the corresponding fields. Direct validators `validateDTCode`, `validatePDCode` and `validateMosaicDiagram` accept full URIs; the `KnotAsset` and `KnotRepresentationDocument` validators expand them in the document context. Canonical schema `$id` and `const` values remain full URIs.

Local references use `{id: string}`; external resource references use `{ref: URI}`. These forms are exclusive. Local references resolve only in their declared scope; a global resource may be included in an asset and addressed with `{ref}`. JSON Schema `$id`/`$ref` and editor `$schema` retain ordinary URI semantics and do not use compact prefixes.

Resource registries are explicitly passed as `options.registries`. `STANDARD_RESOURCES` is a convenience registry exported by core; it is not implicitly inserted. Bundled examples embed the definitions they need. Different definitions with the same global ID are an error; identical JSON objects, ignoring key order, may be deduplicated. Array order remains significant. Unknown representation data is preserved without rewriting arbitrary fields.

## Constructions and procedures

A construction requires `id` and nonempty `objects`; optional fields are `name`, `description`, `states`. Objects require local `id` and URI `type`. IDs are unique within a construction; the same local ID in a different construction denotes a different object. Named states require `id`, optionally `name` and `description`. State IDs are local to the construction.

Built-in rope objects have `topology: open | closed` and `ends`. Open ropes have two ends with distinct IDs; closed ropes have none. Optional `length` and `diameter` are positive finite meters. Support and carabiner profiles currently contain only `id` and `type`; their curves do not define a standardized equipment shape. Additional types need a definition and schema, and remain semantically unchecked without a supported validator.

A representation's omitted `target` means the document subject. Explicit forms are `{kind:"subject"}`, `{kind:"construction",construction:Reference}`, or `{kind:"state"|"object",construction:Reference,id:string}`. State and object references resolve within that construction.

A procedure requires `id` and nonempty `steps`; optional `name` and `construction` provide context. Each step has a unique local `id`, optional `instructions` (array of `{language,value}` records) and `representations` (local `{id}` references in this profile). A step may have no image or several images. Procedures impose no equality of point counts, interpolation or animation timing. A state can be shared by multiple procedures and representations.

Representations may carry optional `names` and `descriptions` arrays of `{language,value}` records, like `subject`. Procedure steps may carry `names` in the same format; actionable text uses `instructions` as an array of `{language,value}` records. These fields do not determine UI locale or fallback language.

## Representations

A representation requires `id`, URI `type` and `data`; optional fields are `target`, `sources`, `contributions`. IDs are unique in the asset. Type definitions require `id`, `name`, `description`, `dataSchema`, `specification`; optional `viewSpace` is `none` (default), `plane` or `space`. Object type definitions use the same fields except `viewSpace`.

`dataSchema` is `{ref: absolute-or-compact-schema-URI}` or `{inline: JSON-Schema-object}` with an explicit `$schema` dialect. External schemas must be supplied through `options.schemas`; no network resolver is installed. The current custom schema engine supports draft 2020-12. A schema cannot prove domain semantics. Unknown types may pass structural validation while remaining in `uncheckedTypes`; they cannot be rendered or exported as verified self-contained fragments.

### Spatial curves

Type: `https://yuriyapostol.github.io/knot-engine/v1/representation-types/spatial-curve`.

`data` contains `coordinateSystem` and nonempty `curves`. The initial coordinate profile is right-handed with Y up: `{handedness:"right",upAxis:"y",scale}`. Scale is `{kind:"relative"}` or `{kind:"physical",metersPerUnit: positive-number}`. Import does not infer a physical scale or silently move points.

Each curve requires `id`, `closed`, `interpolation`, `points`; optional `object` identifies an object in the target construction. Curves may describe the subject without a physical construction when no object reference is present. Points are finite XYZ triples, at least two for open curves and three for closed ones. Consecutive duplicates and a repeated closing endpoint are rejected by exact coordinate equality. Geometry closure is separate from rope topology.

Interpolation is one of:

- `{type:"polyline"}`;
- `{type:"catmull-rom",parameterization:"uniform",tension: number-in-[0,1]}`;
- `{type:"catmull-rom",parameterization:"centripetal"}`;
- `{type:"catmull-rom",parameterization:"chordal"}`.

The renderer uses data coordinates. A physical rope diameter becomes radius `diameter / (2 * metersPerUnit)`. Otherwise display radius is 0.006 times the largest control-point span, with a warning; it is not a physical measurement. The renderer rejects coordinate/camera components above ±1,000,000 and nonpositive or greater-than-1,000,000 radii. These are rendering limits, separate from domain validation. Tube meshes approximate curves and do not prove knot topology or collision freedom.

### Grid diagrams (xo, vertex-pairs)

Type: `https://yuriyapostol.github.io/knot-engine/v1/representation-types/grid-diagram`.

`data` is `{encoding:"xo",size,x,o}`. Size is an integer from 2 to 512; both arrays are permutations of row indices `0..size-1`, indexed by column. X and O must differ in each column. Row zero is the bottom row, columns increase rightward. Horizontal arcs run O→X; vertical arcs run X→O and pass over horizontal arcs. This profile supports multiple components and does not infer knot identity. It is data/validation support; the current `KnotViewer` renders only spatial curves. The alternative `{encoding:"vertex-pairs",size,vertices}` profile stores unoriented distinct `[column,row]` pairs indexed from 0, exactly two per row and column.

See the detailed [grid diagram specification](grid-diagram.md) for derived counts, coordinates and KnotInfo interoperability.

### Mosaic diagram (data and validation)

The profile is defined in the [mosaic specification](mosaic-diagram.md). Types, JSON Schema, a standard resource and semantic validation via `validateMosaicDiagram` are implemented. Rendering is deferred.

### Planar diagram codes

The [PD specification](pd-code.md) defines `pd-code` data: `convention`, `crossings` and optional `unlinkedComponents`. Types, schemas and semantic validation are implemented, including planar rotation systems, direction consistency and component counting. PD has `viewSpace:"none"`; layout and rendering are separate work.

### Dowker–Thistlethwaite codes

The [DT specification](dt-code.md) defines `dt-code` for knots and links: an explicit sign convention and flat or component-divided numeric arrays of even traversal labels. Schemas, permutation validation and a full planar-realizability criterion are implemented. `viewSpace:"none"`; sources and contributions use the ordinary envelope. Layout and conversions remain separate work.

## Viewer-owned views and settings

`KnotAsset` contains representation data, constructions, states, and procedures, but **no camera presets or rendering settings**. In particular, `views`, `defaultView`, and `preferredView` are not representation fields. Their presence is rejected by the JSON Schema.

The application passes a `view` (inline `ViewDefinition`, local `{id}`, or registry `{ref}`) and optional `views` preset collection directly to `KnotViewer`, `Knot3DViewer`, or `KnotMosaicViewer`. `initialCamera` is a separate 3D viewer prop. With no requested view, each viewer uses its own default framing. Plane views use `{mode:"plane",center:[x,y],height:positive}`; rotation is not supported. Capture settings belong to the viewer API, not the asset. See [viewer contracts](viewer-contracts.md).

## Standalone contracts and resources

Independent schemas are available for grid diagrams, mosaic diagrams, planar diagram codes, Dowker–Thistlethwaite codes, spatial curves, representation, construction, view, catalog, representation type, object type and rope/equipment objects. Each published schema includes only its needed definitions and can be compiled without the root asset schema. Generated schemas come from `src/core/contracts.json` via `npm run build:schemas`.

`KnotResourceDocument` requires `schema`, `schemaVersion`, `kind`, `resource`; optional `$schema`, `namespaces`, `dependencies`. Kinds: `catalog`, `representation-type`, `object-type`, `view`, `construction`, `source`. A standalone resource requires a global ID. `KnotResourceRegistry` requires `schema`, `schemaVersion`, `resources:[{kind,resource}]`, with optional `$schema`, `namespaces`, `id`. A registry is an ordinary document, not a server or singleton. `KnotRepresentationDocument` requires `schema`, `schemaVersion`, `representation`, with optional `$schema`, `namespaces`, `dependencies`, `subject`, `sources`.

Catalog definitions require global `id`, `name`, `description`; optional `homepage`, `edition`, `identifierRules`. Rules support `pattern` (ECMA-262 without flags) and `caseSensitive` (default true). Case-insensitive identity comparison, when needed by a consumer, folds only ASCII A–Z; stored values remain unchanged. The runtime checks patterns as written and does not perform catalog lookup or infer identity. Anchor a pattern with `^`/`$` to match the whole designation.

Dependencies are `{kind,ref}` records. Asset validation reports unresolved resource needs; envelope-only registry/resource validation does not claim dependency closure. URI schema dependencies for custom types are additionally represented by unchecked type status until semantics are supported.

## Sources, contributions and license

Optional `KnotAsset.sources` stores shared source definitions with IDs; `Representation.sources` stores inline descriptions or references with use-specific notes. Optional flat `contributions` are available at both levels. Optional `license` belongs only to the KnotAsset; source licenses stay in their descriptions. A standalone representation document may include `sources` for local references. Resources support the additional `source` kind.

The [shared metadata contract](sources.md) defines fields, roles, validation, extraction preservation and composition conflicts. Absent metadata does not affect validity; declared references require resolution. URLs are never fetched automatically. A source definition is neither an identifier catalog nor proof of knot identity.

## Validation and extraction

`validateKnotAsset` returns either `{valid:false,issues}` or `{valid:true,asset,warnings,complete,missingDependencies,uncheckedTypes}`. `valid` means known structures and resolvable references are consistent; `complete` additionally requires all required definitions and supported domain semantics. Rendering and extraction require `complete`. Validation never mutates input or fetches data. JSON Schema is structural; runtime additionally checks scopes, uniqueness, curve continuity, camera vectors, grid diagram permutations and aggregate budgets. It does not prove mathematical identity or practical safety.

Before traversal, a resource profile bounds nesting at 64, total visited values at 262144 and individual strings at 1048576 characters. Non-JSON values, sparse arrays, accessors and cycles are rejected. Additional structural limits include 1024 representations, 256 constructions/objects/states, 256 procedures, 1024 steps per procedure, 4096 points per curve, and 65536 points across the asset. Limits protect this implementation and do not define every possible domain object.

`selectKnotAsset(asset,{representations?,procedures?},options?)` returns a cloned self-contained asset with requested procedures, their referenced representations, required complete constructions and type/catalog definitions. Unrelated procedures and representations are omitted. Global references remain valid after external resources are embedded. Only supported types may be extracted; unknown URI fields cannot be safely rewritten. Assertions are outside this initial profile, so there are no hidden relation traversals or assertion omissions.

`composeKnotAsset(parts,options?)` merges fragments with equal document IDs and equal subjects, after namespace expansion. Conflicting collection IDs are errors; omitted fields do not delete data. It is not a patch format or a merger of independent documents. Both operations return independent copies and revalidate the result.

[Open rope](../examples/assets/open-rope.json) · [Two procedures sharing states](../examples/assets/procedures.json) · [Grid](../examples/assets/grid-diagram.json) · [API](functions.md)
