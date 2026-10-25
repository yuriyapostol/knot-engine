# Knot evolution

**Historical proposal, superseded by the [current redesign](knot-draft.md).** The separate diagrams/notations collections suggested below are not the agreed target architecture.

The implemented format separates physical elements, geometric states, tying algorithms and camera settings. Its main limitation was treating coordinates as the only way to describe a knot. Grid diagrams do not need splines, physical diameter or meters. A standalone `GridDiagram` and reduced self-contained knots were therefore added.

The [KnotInfo 3_1 page](https://knotinfo.org/diagram_display.php?3_1) shows KnotScape, SnapPy, 3D, Grid and mosaics, including mirror diagrams. The [database](https://knotinfo.org/) contains Gauss, DT, PD, Conway and braid notation, Seifert matrices and numerical/polynomial invariants. These require different data and validation conventions.

The earlier proposal suggested:

- `diagrams` as a discriminated union of grid, mosaic and combinatorial formats, with orientation/tile/adjacency rules;
- typed `notations` with explicit orientation, crossing signs, indexing and component conventions;
- `mathematicalPresentations` for groups, matrices and similar data, distinct from camera/style presentation;
- `invariants` with exact/bound/interval/unknown distinctions and exact polynomial/rational coefficients;
- `sources` describing provenance, licensing, retrieval date and bibliography, without implicit network fetching;
- typed mirror/reverse `relations`, rather than treating mathematical mirrors as decorative variants.

These collections were not implemented. An arbitrary metadata bag would blur missing, unknown and proven information. New records need concrete source data, contracts, subschemas, conventions and checks.

Schema names identify document kinds; `schemaVersion` identifies the contract and `$schema` the editor schema. Nested values obtain their type from context/`type` without repeating envelopes. Subschema entry points share definitions to avoid duplicated rules. Independent versioning was an earlier possibility, superseded by the agreed shared release policy.

`composeKnot` merges self-contained fragments for one knot and validates IDs/conflicts/results; `selectKnot` extracts requested data with dependencies. These are in-memory operations, not manifest/storage/loading mechanisms. `validateGridDiagram` checks grid diagram data without an knot. The current 3D renderer still handles coordinate representations only; a specialized grid diagram viewer need not understand every knot section.
