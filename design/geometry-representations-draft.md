# 2D/3D geometry and procedure states — design contract

> Design notes for the implemented 2D/3D contracts. See the [v1 specification](../v1/specifications/knot.md) for the current normative contract and the implementation status below for limitations.

## Scope and compatibility

The representation type URIs end in `representation-types/2d` and `representation-types/3d`. Short names in examples stand for the full type URIs. The existing `grid-diagram`, `mosaic-diagram`, `pd-code`, and `dt-code` are independent types and remain available.

The existing `Representation`, `target`, `Construction.objects`, `Construction.states`, `target.kind: "state"`, and `Procedure.steps[].representations` are retained.

## Geometry

Both representation types contain `data.elements`, a nonempty array of heterogeneous geometry elements with locally unique `id` values. Each element has a `type` and an optional `object` referencing an object ID in the target construction. Omitting `object` allows the geometry to describe the document subject directly. All elements use **one shared representation coordinate system**. Per-element transforms, instancing, and geometry reuse are deferred.

Initial primitives: `curve` in 2D and 3D, `mesh` in 3D only. A curve retains the existing `closed`, `interpolation`, and `points` semantics. Points are numeric pairs in 2D and numeric triples in 3D. A mesh contains `vertices` (3D triples) and `faces` (triples of zero-based vertex indices). A mesh describes a surface, not necessarily a closed solid.

`3d.coordinateSystem` uses `handedness: "right"`, `upAxis: "y"`, and `scale: {kind:"relative"}` or `{kind:"physical",metersPerUnit: ...}`. `2d.coordinateSystem` uses `xAxis: "right"`, `yAxis: "up"`, and the same scale rules.

### 3D example

```json
{
  "id": "final-3d",
  "type": "3d",
  "data": {
    "coordinateSystem": {
      "handedness": "right",
      "upAxis": "y",
      "scale": { "kind": "relative" }
    },
    "elements": [
      {
        "id": "rope-path",
        "type": "curve",
        "object": "rope-1",
        "closed": false,
        "interpolation": { "type": "polyline" },
        "points": [[0, 0, 0], [1, 1, 0], [2, 0, 0]]
      },
      {
        "id": "support-surface",
        "type": "mesh",
        "object": "support-1",
        "vertices": [[0, 0, -1], [2, 0, -1], [2, 1, -1]],
        "faces": [[0, 1, 2]]
      }
    ]
  }
}
```

## 2D crossings

`data.crossings` is an optional ordered array of strand passages at ordinary transverse intersections of curves. Each geometric crossing is represented by **exactly two records** sharing the same `id`. A record contains `element` (the curve currently being traversed) and **exactly one** of `underElement` (the other curve passes below the current curve) or `overElement` (the other curve passes above the current curve). Records sharing an `id` must agree on their over/under relationship. A self-crossing has two entries for the same curve, one above and one below.

For each `element`, its subsequence within the shared crossings array is ordered from the beginning of the curve. A closed curve begins at its first control point. Crossings store no coordinates, segment parameters, or arc-length fractions. The viewer computes geometric intersections and matches them using order along both curves and shared IDs. Ambiguous mappings must not be assigned arbitrarily.

```json
{
  "crossings": [
    { "id": "x1", "element": "rope-a", "underElement": "rope-b" },
    { "id": "x2", "element": "rope-a", "overElement": "rope-b" },
    { "id": "x2", "element": "rope-b", "underElement": "rope-a" },
    { "id": "x1", "element": "rope-b", "overElement": "rope-a" }
  ]
}
```

Self-crossing:

```json
{
  "crossings": [
    { "id": "x1", "element": "rope-a", "underElement": "rope-a" },
    { "id": "x1", "element": "rope-a", "overElement": "rope-a" }
  ]
}
```

Implementation must verify correspondence with actual geometry for repeated intersections of the same curves, self-crossings, closed curves, and Catmull–Rom interpolation. Tangencies, coincident spans, and ambiguous intersections are outside the initial supported crossing profile. Numerical tolerances and validation/viewer behavior must be specified.

## Intermediate procedure geometry

Full `Representation` objects describe self-contained states, especially final states. A procedure may reference a **base representation**, and steps may contain **local geometry overrides**. Every step is derived **independently from the same base**, never by applying sequential patches to earlier steps. The base may be the final representation. Existing step representation references remain supported.

Agreed operations: `replace` replaces an **entire** element by ID, `add` inserts a complete element with a new ID, and `remove` omits an element by ID from this step only. In 2D, a step may override the complete `crossings` array, including with an empty array, since geometric crossings can change. Elements not overridden are inherited from the base.

Field names and exact nesting for the base, operations, and crossing overrides are to be established in the normative `Procedure` schema; the above defines their semantics, not a second incompatible JSON syntax. The normative specification must also state whether changing representation dimension/type requires referencing a different complete representation.

Intermediate animation phases, material coordinates along rope, local transforms, geometry reuse, and patches to individual point coordinates are deferred.

## Implementation status

Implemented: `2d` and `3d` representation types, JSON Schemas, structural validation, `Procedure.base` and independent `Step.data` overrides, 3D curves and triangle meshes, the 2D SVG viewer, and the `v1/examples/knots/geometry-crossing-demo.json` example.

**Current limitation:** matching `crossings` records to actual intersections is implemented in the 2D viewer for `polyline` only. `validateGeometry2D` validates paired crossing records but does not compute geometric intersections. Catmull–Rom crossings in the 2D viewer, tangencies, overlapping spans, and ambiguous intersections are not yet supported.

## Step data contract

A procedure may declare `base: Reference` pointing to a complete `2d` or `3d` representation. Each step may declare `data` containing optional `remove` (element IDs), `replace` (complete existing elements), `add` (complete new elements), and, for 2D only, `crossings` (a complete replacement of the crossings array). Every step is evaluated independently against the same base. Omitted operations are empty; omitted `crossings` are inherited. A step with `data` requires a procedure `base`. A step without `data` inherits the base unchanged. Element IDs must not conflict across operations, and the derived representation must remain valid. Steps do not change the representation type or coordinate system. Existing `Step.representations` remain supported. Animation subphases are deferred.
