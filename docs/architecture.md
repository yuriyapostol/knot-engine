# knot-engine architecture and migration

[English](architecture.md) | [Українська](architecture.uk.md) · [Documentation](../README.md)

[**KnotAsset v1**](knot-asset-v1.md) is the authoritative domain-data specification. [KnotModelV1](model-format.md) remains a separate, legacy, render-oriented static format. Their `schemaVersion: 1` values belong to different contracts. Neither validator nor viewer dispatches by that number.

```text
KnotAsset → validateKnotAsset → resolveKnotAsset (3D representation + snapshot) ─┐
                                                                          ├→ RenderableModel → geometry builder → renderer
KnotModelV1 → validateKnotModelV1 → resolveKnotModelV1 ────────────────────────┘                                  ├→ KnotViewer
                                                                                                              └→ capture/preview
Future editor → authors KnotAsset data, not the renderer's Three.js scene
```

Core types, validators and resolvers have no Vue, Three.js, browser or file-loading dependency. `RenderableModel` contains copied curves, an optional resolved camera and warnings; it is an internal rendering structure, not another versioned authoring format. The geometry builder only consumes this structure. The renderer owns camera controls, scene lifecycle and capture, and never traverses representations or algorithms.

`KnotViewer` remains the Vue component name, including its existing CSS classes and `--knot-viewer-*` tokens. The npm/project identity is `knot-engine`. The legacy JSON Schema retains its historical `$id` so existing schema references remain valid; the new schema has a distinct `knot-asset-v1.schema.json` filename and ID. Both are package exports.

## Additive APIs

- `validateKnotAsset(value, { strict? })` returns `{ valid: true, asset, warnings }` or `{ valid: false, issues }`.
- `validateKnotModelV1(value, { strict? })` is the explicit legacy API. Existing `validateModel` and its return shape are retained as an alias.
- `resolveKnotAsset(value, { representationId?, snapshotId? })` validates the **whole** asset, selects a 3D snapshot and returns rendering data. Invalid unselected snapshots still fail validation.
- `resolveKnotModelV1(value)` validates and adapts legacy models, preserving radii and preview cameras.
- The existing `KnotViewer :model="legacyModel"` API remains supported. `:asset="asset"`, `representation-id` and `snapshot-id` add a separate domain entry point. Providing both non-null inputs reports `INVALID_MODEL`; neither input means the existing empty state.

Without selection IDs, the resolver chooses the first representation with `dimension: 3`, then its first snapshot. Explicit IDs must exist in that scope. Selection never interprets ID spelling. Selecting 2D reports `UNSUPPORTED_SCHEMA`; an empty representation or snapshot cannot render. Empty domain collections are valid data, as in the specification's root example.

A replacement asset or a changed selection rebuilds the viewer; in-place deep mutation is unsupported. No step animation occurs. `ready`, `error`, `camera-change`, slots and capture methods retain their legacy shapes; `ready.modelId` contains the asset ID for asset inputs. Validation and selection finish before WebGL or geometry allocation.

`AssetCameraView` names the domain camera type with optional `fov`. The existing viewer `CameraView` keeps its required `fov` to avoid breaking consumers. Resolution defaults an omitted domain FOV to 55°. A representation's camera is shared by all its snapshots. `initialCamera` remains the viewer override; `model-preview` capture uses the resolved representation camera.

## Explicit implementation policies and specification ambiguities

The domain document requires valid tension, minimum point counts and separate resource limits but does not supply numbers. This implementation uses the following explicit policy, reflected in the new schema and tests rather than importing the legacy validator's limits:

- Catmull–Rom tension is finite and in `[0, 1]`. Open curves require at least 2 points; closed curves require at least 3.
- Points must have exactly the representation's dimension and finite coordinates. Consecutive duplicates and repeated closed endpoints use **exact coordinate equality**. The legacy scale-dependent epsilon and coordinate bounds do not apply to domain validation.
- IDs and references are nonempty strings, without the legacy ID-length cap. Element, representation, algorithm and variant IDs are unique in their root collections. Snapshot IDs are unique per representation, snapshot element IDs per snapshot, step IDs per algorithm, and RopeEnd IDs per rope. Different ropes may reuse end IDs such as `a` and `b`. The specification does not explicitly state the RopeEnd scope; this follows their ownership and absence of global end references.
- Optional physical length and diameter must be positive finite meters. Geometric length is not compared with physical length, and geometric closure is not compared with rope topology.
- Crossings reference elements present in their own snapshot, because they relate geometry in that state. The specification does not require those elements to have a particular physical type. An optional crossing ID is not used as a reference target or assigned an extra uniqueness rule.
- Camera vectors contain three finite coordinates, position differs from target, and optional perspective FOV is in `(0, 180)` degrees. The document only describes 3D camera behavior; camera data can be retained on a 2D representation, but no 2D camera or rendering semantics are invented.
- Consecutive algorithm steps compare point counts for curve elements present in both snapshots. Elements absent from one snapshot do not form an animated pair. Stable point order and the meaning/direction of `u` are author obligations; numeric validation cannot prove them.
- Runtime accepts unknown fields by default for consistency with the legacy API. `{ strict: true }` rejects unknown fields at every defined object boundary, matching the closed JSON Schema. Unknown element/geometry/interpolation types and schema versions always fail.

`KNOT_ASSET_LIMITS` defines the resource profile:

| Collection/budget | Maximum |
| --- | ---: |
| Elements | 256 |
| Representations | 32 |
| Snapshots per representation | 256 |
| Elements per snapshot | 256 |
| Algorithms | 256 |
| Steps per algorithm | 1024 |
| Variants | 1024 |
| Crossings per snapshot | 4096 |
| Points per curve | 4096 |
| Points across all snapshots | 65536 |
| Total entries across all traversed arrays | 262144 |

The last budget counts entries in domain collection arrays, end arrays and point arrays, not individual coordinate components. Oversized arrays are rejected before traversing them. Aggregate budgets, ID uniqueness, reference integrity, repeated points, camera separation and algorithm correspondence are **runtime semantic checks**; JSON Schema alone is insufficient. Structural schema tests cover both dimensions and all valid fixtures, and distinguish semantic-only failures.

## First rendering policy

Each selected curve uses the existing tube pipeline. A rope with a diameter uses `diameter / 2` as its radius. With no diameter, or for a support/carabiner curve, the renderer uses a **display radius of 0.005 m and emits a warning**. This does not invent physical dimensions or standardized support/carabiner construction. Only authored curve geometry is displayed. Physical topology does not change caps or closure: those follow `geometry.closed`.

The domain does not standardize appearance or a preset registry. The first renderer uses its existing appearance; an unsupported presentation preset produces a warning. Renderer policy separately rejects coordinates/camera components outside ±1,000,000 m and radii outside `(0, 1,000,000]` m before geometry allocation. These are renderer limits, not KnotAsset coordinate constraints. Existing tessellation profiles and the 100,000-triangle budget remain: quality is reduced before allocation, or `LIMIT_EXCEEDED` is reported if low quality cannot fit. Legacy data retains its own validation limits.

## Fixtures and verification

`examples/models/` remains unchanged for legacy regression tests. `examples/assets/` contains neutral technical fixtures for open/closed rope, two ropes, support, carabiner, multiple snapshots, algorithms sharing a final snapshot, variants and 2D crossings. These curves do not claim to be verified practical knots. `examples/assets/invalid/` contains malformed examples; tests additionally exercise non-JSON values such as NaN/Infinity, reference scopes, frozen input and resource boundaries.

Run `npm run typecheck`, `npm test`, `npm run build`, `npm run build:demo`, `npm run test:browser` and `npm run test:package`. The browser script requires local Chrome or `CHROME_PATH`; it tests real WebGL using software rendering, both legacy fixtures, asset snapshot replacement, capture, rejection before WebGL allocation and demo selection. The package test extracts the actual npm tarball into an isolated consumer; only Vue/Three/type dependencies are linked from the workspace. It checks core-only imports, SSR, public declarations and a client build including CSS. This is not a fresh network dependency installation or a minimum-peer-version matrix.

There are no formatting or lint scripts in this repository. The existing `preview:model` CLI remains a legacy-file interface; both Vue input paths share capture. Hardware touch/WebView and cross-device pixel equivalence remain outside these automated checks.

## Deferred capabilities

The model and validator support 2D; this migration renders only static 3D snapshots. Animation, editing, transitions, trajectories, physics, collisions, connections, automatic knot correctness and mesh/primitive geometry are not implemented. A future editor will use KnotAsset as its source of truth. Publishing, pushing commits and repository renaming are separate operations.
