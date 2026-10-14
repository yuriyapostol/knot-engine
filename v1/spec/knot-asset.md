# Knot Engine — KnotAsset v1

[English](knot-asset.md) | [Українська](knot-asset.uk.md) · [Documentation](../../README.md)

This is the authoritative domain-data specification for knot-engine. [Implementation policies and migration architecture](../../design/architecture.md) separately document numeric limits, unspecified details and the boundaries of the first renderer.

## 1. Purpose

`KnotAsset` is the canonical machine-readable description of a single knot in the broad sense.

One asset may contain:

- one or more physical elements;
- multiple independent 2D and 3D representations;
- static and step-by-step representations;
- multiple tying algorithms;
- alternative final forms and artistic variants;
- closed-rope representations for knot theory;
- recommended viewing parameters.

The format describes knot data independently of Vue, Three.js, any particular renderer, UI, localization and storage method.

JSON is the authored source of data. Three.js objects, meshes, textures, previews and other rendering-specific outputs are derived data.

---

# 2. Root structure

```ts
interface KnotAsset {
  schema?: 'KnotAsset'
  $schema?: string
  name?: string
  aliases?: string[]
  diagrams?: GridDiagram[]
  schemaVersion: 1
  id: string

  units: 'm'

  elements: KnotElement[]
  representations: Representation[]

  algorithms?: Algorithm[]
  variants?: Variant[]
}
```

Example:

```json
{
  "schema": "KnotAsset",
  "schemaVersion": 1,
  "id": "bowline",
  "units": "m",

  "elements": [],
  "representations": [],
  "algorithms": [],
  "variants": []
}
```

`id` is an opaque, stable knot identifier. It is not a URL, file path or localized name.

`schemaVersion` versions the `KnotAsset` contract itself.

The `knot-engine` npm package version, renderer version and presentation preset versions are independent of `schemaVersion`.

---

# 3. Elements

`Element` is a physical or conceptual object that forms part of the knot composition.

Three types are initially defined:

```ts
type KnotElement =
  | RopeElement
  | SupportElement
  | CarabinerElement
```

The list may be extended in the future.

## 3.1 Rope

```ts
interface RopeElement {
  id: string
  type: 'rope'

  topology: 'open' | 'closed'

  ends: RopeEnd[]

  length?: number
  diameter?: number

  subtype?: string
}
```

Example of an ordinary rope:

```json
{
  "id": "rope-1",
  "type": "rope",

  "topology": "open",

  "ends": [
    { "id": "a" },
    { "id": "b" }
  ],

  "length": 2.0,
  "diameter": 0.01
}
```

### topology

`topology` describes the physical structure of the rope, not the geometric shape of a particular representation.

```text
open
```

means a physically open rope.

```text
closed
```

means a closed cord/loop with no physical ends.

This concept must not be confused with `geometry.closed`.

### ends

`ends` contains the ends accessible for manipulation within the task being described.

An open rope may have:

```text
2 accessible ends
1 accessible end
0 accessible ends
```

For example:

```json
{
  "topology": "open",
  "ends": [
    { "id": "a" },
    { "id": "b" }
  ]
}
```

— both ends are accessible.

```json
{
  "topology": "open",
  "ends": [
    { "id": "a" }
  ]
}
```

— one end is accessible; the other may be fixed, attached to a load, a person, etc.

```json
{
  "topology": "open",
  "ends": []
}
```

— only part of the rope is accessible, but neither physical end is accessible.

For:

```json
{
  "topology": "closed",
  "ends": []
}
```

the rope is physically closed.

For `topology: "closed"`, a nonempty `ends` array is a validation error.

`ends` does not describe connections to other objects.

Connections are not defined in KnotAsset v1.

### length and diameter

Physical dimensions are specified in meters.

```json
{
  "length": 1.5,
  "diameter": 0.01
}
```

means 1.5 m and 10 mm.

Both fields are optional.

The length of `geometry` does not have to exactly match `length`.

---

## 3.2 Support

```ts
interface SupportElement {
  id: string
  type: 'support'
  subtype?: string
}
```

`support` represents a support around or relative to which a knot is formed.

Specific construction parameters are added only when an actual need arises.

---

## 3.3 Carabiner

```ts
interface CarabinerElement {
  id: string
  type: 'carabiner'
  subtype?: string
}
```

Carabiner construction parameters are not standardized in KnotAsset v1.

---

# 4. Representations

`Representation` is a particular coordinate representation of a knot.

One KnotAsset may contain any number of independent representations.

```ts
interface Representation {
  id: string
  dimension: 2 | 3

  snapshots: Snapshot[]

  presentation?: Presentation
}
```

For example:

```json
{
  "id": "primary-3d",
  "dimension": 3,
  "snapshots": []
}
```

or:

```json
{
  "id": "instruction-diagram",
  "dimension": 2,
  "snapshots": []
}
```

`id` has no hidden semantics. Do not infer a representation type from values such as `spatial`, `diagram`, etc.

`dimension` formally specifies dimensionality.

One asset may contain multiple representations with the same dimensionality.

---

# 5. Snapshots

`Snapshot` is the geometry state of a representation at a particular moment or logical stage.

```ts
interface Snapshot {
  id: string
  elements: SnapshotElement[]

  crossings?: Crossing[]
}
```

Example:

```json
{
  "id": "finished",

  "elements": [
    {
      "id": "rope-1",
      "geometry": {
        "type": "curve",
        "closed": false,
        "interpolation": {
          "type": "catmullrom",
          "tension": 0.7
        },
        "points": [
          [0, 0, 0],
          [0.1, 0.2, 0.1],
          [0.3, 0.4, 0.2]
        ]
      }
    }
  ]
}
```

Snapshots belong to a particular Representation.

2D and 3D representations do not have to contain the same set of snapshots.

For example:

```text
primary-3d
├── start
├── loop
├── pass-through
├── wrap
└── finished

instruction-2d
├── start
├── loop
├── wrap
└── finished
```

They may describe the same process with different numbers of logical states.

A Representation may contain just one Snapshot. A static representation does not require an Algorithm.

---

# 6. SnapshotElement

```ts
interface SnapshotElement {
  id: string
  geometry: Geometry
}
```

`id` references `KnotAsset.elements[].id`.

The physical properties of an Element are not duplicated in a Snapshot.

A Snapshot contains only state that may change between snapshots.

---

# 7. Geometry

`geometry` is the general name for the coordinate geometry of an Element.

KnotAsset v1 defines:

```ts
type Geometry = CurveGeometry
```

The architecture must allow other types to be added in the future:

```text
curve
mesh
primitive
...
```

without changing the semantics of the `geometry` field.

## 7.1 CurveGeometry

```ts
interface CurveGeometry {
  type: 'curve'

  closed: boolean

  interpolation: {
    type: 'catmullrom'
    tension: number
  }

  points: Point[]
}
```

`Point` depends on `Representation.dimension`.

For 3D:

```ts
type Point3D = [number, number, number]
```

For 2D:

```ts
type Point2D = [number, number]
```

All coordinates use `KnotAsset.units`.

### geometry.closed

`geometry.closed` means only the geometric closure of a particular curve.

It does not determine the physical topology of an Element.

For example, a physically open rope may have a special theoretical representation with closed geometry.

The first point is not repeated as the last point. Closure is specified with `closed: true`.

---

# 8. Stable Element parameterization

A position along a rope is addressed by a normalized coordinate:

```text
u ∈ [0, 1]
```

For an open rope:

```text
u = 0   → one end of the parameterized Element
u = 1   → the other end
```

`u` describes a stable position along the Element itself, not the index of a particular control point or a fraction of the current spline length.

This allows `u` to be used after geometry resampling.

The identity of the Element parameterization direction must remain stable between snapshots.

---

# 9. Control-point correspondence

For snapshots used consecutively by one Algorithm for animation, the corresponding Element must have the same number of control points and a stable order of those points.

Thus:

```text
snapshot A points[i]
```

corresponds to:

```text
snapshot B points[i]
```

for the same Element.

This allows the renderer to interpolate control-point coordinates.

The KnotAsset v1 format does not guarantee that simple linear interpolation produces physically correct rope motion.

Transitions and trajectories are not specified in KnotAsset v1.

---

# 10. Crossings

`crossings` applies only to a 2D Representation.

Crossings are not part of `Geometry`, because they describe a relationship between two sections of geometry.

```ts
interface CrossingPoint {
  element: string
  u: number
}

interface Crossing {
  id?: string
  over: CrossingPoint
  under: CrossingPoint
}
```

Example:

```json
{
  "over": {
    "element": "rope-1",
    "u": 0.27
  },

  "under": {
    "element": "rope-1",
    "u": 0.73
  }
}
```

Crossings are stored in a particular Snapshot of a 2D Representation, because the relative over/under arrangement of sections may change between snapshots.

For `dimension: 3`, the presence of `crossings` is a validation error.

In 3D, relative spatial position is determined by the geometry coordinates.

---

# 11. Algorithms

`Algorithm` describes one way of tying a knot.

```ts
interface Algorithm {
  id: string
  representation: string
  steps: Step[]
}
```

An Algorithm operates within one Representation.

This allows independent algorithms/sequences for 3D and 2D:

```text
algorithm: standard-3d
representation: primary-3d

algorithm: standard-diagram
representation: instruction-2d
```

They do not have to contain the same number of Steps.

## Step

```ts
interface Step {
  id: string
  snapshot: string
}
```

`snapshot` references a Snapshot within the Representation specified by `Algorithm.representation`.

`Step` is not a Snapshot.

A Step is a semantic element of an algorithm, while a Snapshot is a geometry state.

This allows the following to be added to a Step in the future:

- localized instructions;
- annotations;
- active elements/ends;
- hints;
- timing;
- other educational metadata,

without changing the geometry model of a Snapshot.

In KnotAsset v1, an Algorithm is a linear sequence of Steps.

Branching is not defined. An alternative tying method is described by a separate Algorithm.

Transitions between Steps are not described in KnotAsset v1.

Their runtime implementation remains the responsibility of knot-engine/viewer.

---

# 12. Variants

`Variant` is a named reference to a particular Snapshot of a particular Representation.

```ts
interface Variant {
  id: string
  representation: string
  snapshot: string
}
```

For example:

```json
{
  "id": "standard",
  "representation": "primary-3d",
  "snapshot": "finished"
}
```

or:

```json
{
  "id": "decorative-spread",
  "representation": "primary-3d",
  "snapshot": "decorative-spread"
}
```

One Snapshot may simultaneously:

- be a Variant;
- be a Step of one Algorithm;
- be a Step of multiple Algorithms.

A Variant does not duplicate geometry.

---

# 13. Presentation

Presentation parameters belong to a Representation, not a Snapshot.

Initially, the following is supported:

```ts
interface Presentation {
  camera?: CameraView
  preset?: string
}
```

For 3D:

```ts
interface CameraView {
  position: [number, number, number]
  target: [number, number, number]
  fov?: number
}
```

Presentation does not change the semantics of geometry.

The same geometry may be displayed using different renderers/presentation presets.

Multiple named camera views may be added in the future if needed.

---

# 14. Minimal KnotAsset example

```json
{
  "schema": "KnotAsset",
  "schemaVersion": 1,
  "id": "bowline",
  "units": "m",

  "elements": [
    {
      "id": "rope-1",
      "type": "rope",
      "topology": "open",
      "ends": [
        { "id": "a" },
        { "id": "b" }
      ],
      "length": 2,
      "diameter": 0.01
    }
  ],

  "representations": [
    {
      "id": "primary-3d",
      "dimension": 3,

      "snapshots": [
        {
          "id": "start",
          "elements": [
            {
              "id": "rope-1",
              "geometry": {
                "type": "curve",
                "closed": false,
                "interpolation": {
                  "type": "catmullrom",
                  "tension": 0.7
                },
                "points": [
                  [0, 0, 0],
                  [0.5, 0, 0],
                  [1, 0, 0]
                ]
              }
            }
          ]
        },

        {
          "id": "finished",
          "elements": [
            {
              "id": "rope-1",
              "geometry": {
                "type": "curve",
                "closed": false,
                "interpolation": {
                  "type": "catmullrom",
                  "tension": 0.7
                },
                "points": [
                  [0, 0, 0],
                  [0.4, 0.3, 0.1],
                  [1, 0, 0]
                ]
              }
            }
          ]
        }
      ]
    }
  ],

  "algorithms": [
    {
      "id": "standard",
      "representation": "primary-3d",

      "steps": [
        {
          "id": "start",
          "snapshot": "start"
        },
        {
          "id": "finished",
          "snapshot": "finished"
        }
      ]
    }
  ],

  "variants": [
    {
      "id": "standard",
      "representation": "primary-3d",
      "snapshot": "finished"
    }
  ]
}
```

---

# 15. Validation

The validator must check at least:

- supported `schemaVersion`;
- unique Element IDs;
- unique Representation IDs;
- unique Snapshot IDs within a Representation;
- unique Algorithm IDs;
- unique Variant IDs;
- existence of all referenced IDs;
- `units === "m"` for v1;
- finite coordinates;
- correct point dimensionality;
- valid `tension`;
- minimum number of points;
- no consecutive identical points;
- no repetition of the first point at the end of a closed curve;
- `u ∈ [0,1]`;
- crossings only for dimension=2;
- `topology:"closed"` → `ends.length === 0`;
- no more than two accessible ends for `topology:"open"`;
- unique RopeEnd IDs;
- equal numbers of corresponding control points in snapshots used consecutively by an Algorithm for animation.

Resource limits must be defined and tested separately, not implicitly inherited from the old KnotModelV1.

---

# 16. Deliberately outside KnotAsset v1

KnotAsset v1 does not define:

- transitions;
- easing;
- trajectories;
- physical simulation;
- collision/contact model;
- connections between Elements;
- automatic determination of knot correctness;
- mechanical strength;
- loads;
- arbitrary executable code;
- Three.js objects;
- shaders;
- external URLs;
- how an asset is loaded;
- localized educational text.

These features may be added as separate versioned capabilities once specific requirements arise.

---

# 17. Relationship to legacy KnotModelV1

The existing `KnotModelV1` is not KnotAsset v1.

It is treated as a legacy, render-oriented format for static geometry.

During migration, knot-engine may temporarily support:

```text
KnotModelV1
      ↓
legacy adapter
      ↓
KnotAsset v1
```

or convert a legacy model directly to an internal renderable representation.

Do not change the meaning of the old `schemaVersion: 1` so that it silently means the new KnotAsset.

`KnotAsset.schemaVersion: 1` belongs to a new, separate schema contract.

The root object type must be determined by an explicit validator/entry point, not inferred solely from the `schemaVersion` number.

---

# 18. Architectural principle of knot-engine

Recommended dependency flow:

```text
KnotAsset
   │
   ▼
core / validation
   │
   ▼
representation resolver
   │
   ▼
geometry builder
   │
   ▼
renderer
   │
   ├── viewer
   ├── preview
   └── future editor
```

The viewer does not own the KnotAsset format.

The renderer must not mutate authored data.

A future editor works with KnotAsset as the source of truth, rather than a Three.js scene.

## Modular assets and grid diagrams

`schema: "KnotAsset"` identifies the document contract; `schemaVersion` identifies its version. `$schema` optionally points editors to the JSON Schema. New examples include both. These fields remain optional when reading initial v1 assets. `name` and `aliases` are optional display/catalogue names; `id` remains the stable identity.

Coordinate `representations` retain their existing geometry semantics. `diagrams` holds combinatorial views, initially `GridDiagram`:

```ts
interface GridDiagram {
  id: string
  type: 'grid'
  size: number
  x: number[]
  o: number[]
}
```

Rows are indexed from the bottom, columns from the left, starting at zero. `x[row]` and `o[row]` give marker columns. Each array is a permutation of `0..size-1`; X and O occupy different cells in each row. Horizontal arcs run O→X, vertical arcs X→O, with vertical arcs over horizontal arcs. Size is bounded to 2–256. These are integer cell coordinates, not meter coordinates. A grid may describe multiple components; validation does not establish knot identity or component count.

Use `validateGridDiagram(value, { strict: true })` for standalone runtime validation. A component displaying a grid should accept `GridDiagram`, optionally together with `KnotIdentity`, rather than the whole asset. Standalone subschemas are exported at `knot-engine/schema/grid-diagram.schema.json`, `representation-2d.schema.json`, `representation-3d.schema.json` and `element.schema.json`. Their `$ref` dependencies must be registered/resolved alongside the root schema. Schema validation is structural; runtime validation additionally enforces grid length, bounds relative to size, and X/O separation.

```ts
const gridOnly = selectKnotAsset(asset, { diagrams: ['grid'] })
const spatialOnly = selectKnotAsset(asset, { representations: ['view-3d'] })
const combined = composeKnotAsset([gridOnly, spatialOnly])
```

Selections retain identity, requested views, referenced physical elements, and algorithms/variants belonging to retained coordinate representations. They return independent copies. A grid-only asset has empty `elements` and `representations`; it is valid domain data and cannot be rendered by the current 3D viewer. Composition accepts self-contained, valid fragments of the same asset ID and units. Equal collection IDs deduplicate only when content matches; conflicts are errors. Partial snapshots and dangling references are rejected. Composition does not merge different versions of a representation or fetch external data.

The former relative-unit overhand and twisted-loop examples now live in `examples/assets`. Their explicit demonstration scale is **1 former unit = 0.01 m**, applied to points, radius/diameter and camera coordinates. This preserves proportions and is not a measured rope size. Original documents live only in `tests/fixtures/legacy` to check compatibility.

See [format analysis and extension plan](../../design/asset-evolution.uk.md) for notation, mathematical presentations, invariants, provenance and further diagram types. These are design proposals, not accepted arbitrary fields in v1.
