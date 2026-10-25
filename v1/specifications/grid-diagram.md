# Grid diagram

Supported data and validation profile. Rendering is deferred.

## xo encoding: contract and conventions

Type: `https://yuriyapostol.github.io/knot-engine/v1/representation-types/grid-diagram`.

`xo` is the package's primary grid diagram encoding, corresponding to the standard model of grid diagrams with X/O markings. It is the default wherever a grid diagram's encoding is not specified.

For `encoding:"xo"`, `data` is exactly `{encoding:"xo",size,x,o}`. Size is an integer from 2 through 512. Arrays `x` and `o` are permutations of `0..size-1`, indexed by column, and must differ at every column. Column zero is leftmost; row zero is bottommost. These conditions give one X and one O in every row and column, with no shared marker position, and guarantee closed components.

Horizontal segments run O→X; vertical segments run X→O and pass over horizontal segments. Connections are ordinary straight planar segments, without wrapping across boundaries. Several oriented closed components are allowed in X/O. Swapping X and O reverses every component's orientation without changing the underlying crossing diagram. Reflecting coordinates without changing crossing conventions can change chirality; it is not an identity-preserving normalization.

For plane views, marker (column c, row r) has coordinates [c+0.5,r+0.5]. The grid occupies [0,n] × [0,n]. Center [n/2,n/2], height n, rotation 0 includes its full vertical extent. This is a display convention, not stored geometry. Views must use `space:"plane"`; `preferredView` is rejected. `KnotViewer` and the 3D resolver remain spatial-curve-only.

## Vertex-pairs encoding

`data` is exactly `{encoding:"vertex-pairs",size,vertices}`. `size` is an integer 2–512. `vertices` contains exactly 2×size distinct pairs `[column,row]`; both coordinates are integers `0..size-1`. Each row and column must contain exactly two vertices. Duplicates, unknown fields and mixing with `x`/`o` are forbidden. Vertex array order has no semantic significance.

Join each row's pair horizontally and each column's pair vertically; vertical segments pass over horizontal ones. There is no boundary wraparound. The diagram is unoriented. Coordinate origin, views and crossing counting are shared with X/O. Schema checks structure and pair uniqueness; runtime additionally checks exact count, coordinates relative to size and two vertices per row/column.

`GridDiagram` is a discriminated union of `GridXODiagram` and `GridVertexPairsDiagram`, selected by `encoding`. Validation returns the original encoding, order and values unchanged. Extraction/composition do not convert or sort data; reordered lists describe equivalent geometry but are not automatically deduplicated as identical documents. Both encodings support completeness when resources are available. A temporary orientation for shared analysis is not added to stored data.

```json
{"encoding":"vertex-pairs","size":2,"vertices":[[0,0],[0,1],[1,0],[1,1]]}
```

See the self-contained [example](../examples/assets/grid-vertex-pairs.json). This geometry has one component and zero crossings.

## Validation and derived values

`validateGridDiagram(data)` returns either `{valid:false,issues}` or `{valid:true,data,diagram,warnings,componentCount,crossingCount}`. Counts are derived and are not accepted fields of `data`.

Component count follows O→X in each row, then X→O in that column, iteratively counting each cycle once. A crossing requires a strict interior intersection of a horizontal and a vertical segment. Marker corners are excluded. Crossing count describes this diagram; it is not the knot's minimum crossing number. Likewise `size` is not a claim of minimal grid number or arc index. No knot identity, equivalence or chirality is proved.

Validation uses O(n) storage, O(n) component tracing and O(n²) crossing counting. Size is bounded at 512 before analysis. General bounded-JSON checks apply before schema validation: depth 64, 262,144 entries and strings up to 1,048,576 characters. Multiple representations share the document's JSON budget; there is no additional aggregate grid-area allocation.

The [standalone schema](../schema/grid-diagram.schema.json) checks fields, encoding, scalar bounds and array lengths. Runtime additionally checks permutations, agreement with size and non-overlap. Supported semantics do not produce `uncheckedTypes`; `complete` still requires available resources, such as `STANDARD_RESOURCES`. Standalone representation documents, extraction and same-document composition use ordinary `Asset` rules, preserving arrays and orientation exactly.

## Standard conventions and KnotInfo interoperability

The X/O model and orientation agree with standard grid diagrams: see [Grid Homology for Knots and Links](https://web.math.princeton.edu/~petero/GridHomologyBook.pdf) and the [grid presentation definition](https://utheme.univ-tlse3.fr/files/original/2b0da59299d83875bafaa3ea21891fe057e81d0f.pdf).

[KnotInfo Grid Notation](https://linkinfo.knotinfo.org/descriptions/grid_notation.html) describes the same rectilinear geometry using 2n distinct coordinate pairs [column,row], indexed 1 through n, with two points per row and column and vertical overpasses. It does not label points X/O. Our JSON serialization is project-specific, not a verbatim KnotInfo format.

Export geometry as the set of points [c+1,x[c]+1] and [c+1,o[c]+1]. Import requires validating two distinct points per row/column and choosing an orientation independently on each closed component, then alternating O/X along its vertices. For k components there are 2^k orientation choices; an unlabeled point list cannot recover the original choices. Do not transpose axes or reflect coordinates silently. For zero-based `vertex-pairs`, subtract 1 from both coordinates on import from KnotInfo and add 1 on export. No public converter is introduced here. Orientation choice may be fully automatic; it cannot recover a source orientation that was never specified.

KnotInfo's documented 6_2 example is:

```json
[[1,1],[1,3],[2,2],[2,4],[3,3],[3,5],[4,4],[4,7],[5,6],[5,8],[6,1],[6,7],[7,5],[7,8],[8,2],[8,6]]
```

One compatible orientation in our encoding is:

```json
{"encoding":"xo","size":8,"x":[2,3,4,6,5,0,7,1],"o":[0,1,2,3,7,6,4,5]}
```

Tests check exact point-set recovery and one component. The catalog label is source attribution, not an independent knot identification.

## Acceptance cases

Tests include a 2×2 loop, separate loops, a two-crossing/two-component diagram, a three-crossing/one-component diagram, the KnotInfo geometry, reversal of all orientations, sizes 2 and 512, invalid indices/permutations/overlaps, sparse arrays, non-JSON numbers, unsupported encodings, unknown fields, plane views, standalone documents and extraction/composition round trips.

## Attribution of concrete data

Optional `sources` and `contributions` belong to the `Representation` envelope, outside `data`. Shared source definitions and the global license belong to the Asset. Convention references in this specification explain the contract; representation sources identify where its concrete data came from. See the [shared metadata specification](sources.md).
