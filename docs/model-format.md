# Legacy KnotModelV1 — render-oriented format

[English](model-format.md) | [Українська](model-format.uk.md) · [Documentation](../README.md)

This static-geometry contract is retained for compatibility. The authoritative domain format of knot-engine is [KnotAsset v1](knot-asset-v1.md); it is a separate contract, not KnotModelV2. Both have their own schemaVersion: 1. See the [migration architecture](architecture.md).

The format describes geometry independently of the interface, localization and storage method. JSON with control points is the authored source; meshes and previews are derived outputs. The machine-readable JSON Schema is in schema/knot-model-v1.schema.json; TypeScript types and the runtime validator are in src/core. Semantic checks such as duplicate points are performed by the runtime validator.

Example: [prototype-loop.json](../examples/models/prototype-loop.json). This is a technical model for demonstrating geometry; its name does not certify that it represents a particular practical knot.

## Fields

| Field | Contract |
| --- | --- |
| schemaVersion | Required integer 1 |
| id | Optional nonempty string, up to 256 characters; opaque model ID, may be hierarchical |
| coordinateSystem | Required right-handed-y-up |
| units | Required relative; v1 does not describe absolute units or loads |
| curves | 1–8 curves with independent IDs |
| preview | Optional preset and camera; without them, the camera uses auto-fit |

Curve: id (unique string up to 128 characters), closed:boolean, interpolation:{type:'catmullrom', tension:number}, radius:number, points:[number, number, number][]. All these fields are required. The initial v1 specifically supports catmullrom with explicit tension in 0..1 to define the curve shape explicitly; other modes may be added as versioned capabilities after fixture verification, and are not applied silently.

Preview: preset='light-outline-v1'; optionally cameraPosition:[x, y, z], target:[x, y, z], fov:number. Position and target are supplied together. fov is in 10..100 degrees, default 55. An unknown preset produces an UNSUPPORTED_SCHEMA diagnostic/validation issue, rather than an arbitrary appearance substitution. A future preset registry will be extended with explicit compatibility. Switching the demo theme does not rewrite preview data.

## Geometry rules

- Open curve: 2–512 points. Closed curve: 3–512; do not repeat the first point as the last, as closure is specified by closed.
- At most 2048 points per model in total. Coordinates are finite, |coordinate| ≤ 100000; radius > 0 and ≤ 10000. These are initial resource limits, not physical units.
- Consecutive identical points and zero extent are prohibited. Near-point checks use a scale-aware epsilon; specify it in validator tests rather than choosing an arbitrary threshold by eye.
- closed is passed consistently to the curve and TubeGeometry. For closed curves, verify the seam through positions/normals and visually. For open curves in v1, ends are closed with flat caps; this resembles a cut rope end without changing the centerline topology.
- Segmentation is controlled by renderer quality, not authored JSON. Proposed profiles: low 64/8, medium 128/12, high 256/16 (longitudinal/radial per curve), with a total budget ≤ 100000 rendered triangles (including caps and the outline pass) and DPR ≤ 2. Before allocation, reduce tessellation to a lower profile with a warning if the profile exceeds the budget; if even low does not fit, report LIMIT_EXCEEDED. For complex models, insufficient sampling produces a warning; verify the final profiles on real assets.
- The camera cannot have position=target; a position outside the visible bounds/too close to the model produces a warning and auto-fit. Invalid types/NaN produce an error, not a fallback that hides an authoring mistake.

Numeric bounds are checked before allocating large typed arrays. The validator checks plain JSON-compatible data, rejects unknown keys in strict authoring/CI mode, does not execute code and does not read external references. Runtime mode performs the same required semantic checks; it does not guess support for future schema versions.

Crossings/self-intersections of the centerline or surface are not checked with a complete physical model. Successful schema validation does not guarantee the physical feasibility or correctness of an instructional knot. The format does not describe mathematical classification or mechanical knot strength.

## Versioning

Schema version, npm package version and renderer preset version are separate values. A breaking change to field/interpolation semantics increments schemaVersion; a new preset appearance gets a new name. Geometry builder fixes may change images: rendererVersion is included in the preview cache key.

JSON contains no JS, custom shaders, image URLs, ready-made Three.js objects or functions. The host's own model loader passes parsed/validated data to the viewer. The format resolver must not introduce hidden fetching. The component can use data from any source that conforms to this format.

## Example model

The fixture specifies six points, tension 0.7 and closed=true. Closure applies to all geometry, and the seam is checked separately. Camera [0,10,26], target [0,0,0], fov 55 and the light-outline preset define the initial view. Outline thickness is defined by the preset relative to radius so that it works consistently across scales.

## Historical guidance for future steps

Legacy KnotModelV1 does not gain steps/timeline. Representations, snapshots, algorithms and steps are already defined by the separate KnotAsset v1. Historical ideas for named poses, control-point IDs, durations, easing and localized text are not implemented KnotModelV1 fields or promises of KnotAsset v1. Transitions and trajectories remain outside the new contract. Older consumers need an explicit static model or adapter.

Coordinate interpolation without intersection control does not prove that tying is correct. Authored intermediate poses/trajectories and verified transitions are required; a physical solver is not an implicit promise of the format.
