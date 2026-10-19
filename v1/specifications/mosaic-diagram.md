# Mosaic diagram

**Data support implemented.** Types, semantic validation, JSON Schema and the standard registry entry are available. Rendering is deferred.

## Identity and scope

Representation type: `https://yuriyapostol.github.io/knot-engine/v1/representation-types/mosaic-diagram`.

The profile describes an unoriented closed knot or link diagram on a square array of tiles. Multiple closed components are allowed. Open ends, tangles, virtual crossings, physical lengths, component orientations and arbitrary tile sets are outside this profile. Neither one component nor a catalog identity is inferred from the representation type.

The standard type uses `viewSpace: "plane"` and references the standalone [JSON Schema](../schema/mosaic-diagram.schema.json) and this specification.

## Data contract

`data` is a closed object with exactly two required fields:

| Field | Contract |
| --- | --- |
| `tileSet` | Exact absolute URI `https://yuriyapostol.github.io/knot-engine/v1/tile-sets/lomonaco-kauffman-11` |
| `tiles` | Nonempty square matrix of integer tile codes 0–10 |

Size is `tiles.length`; every row has that length. No duplicated `size`, per-tile rotation, scale or coordinate-system fields are stored. Only the tile set above is supported. Its URI identifies the fixed convention defined here; it is not a new registry resource kind and never triggers network access.

The `tileSet` value is type-specific data, not a generic resource reference. This profile requires the absolute URI, even if the enclosing asset declares namespaces. Compact forms are not accepted or silently rewritten. Representation `type` still follows ordinary `KnotAsset` namespace expansion.

A 1×1 blank matrix is structurally a square matrix but is semantically invalid: at least one closed component is required. Blank border tiles are allowed and preserved; no trimming, padding, rotation or reflection occurs during validation, extraction or composition.

## Coordinates and tile set

`tiles[row][column]` is row-major: row 0 is at the top, column 0 at the left. N/E/S/W mean top/right/bottom/left. Each port lies at the midpoint of a tile edge; neighboring edge midpoints coincide. Tile orientation is already encoded by its integer.

| Code | Internal connections | Overpass |
| --- | --- | --- |
| 0 | None | — |
| 1 | W–S | — |
| 2 | S–E | — |
| 3 | N–E | — |
| 4 | N–W | — |
| 5 | W–E | — |
| 6 | N–S | — |
| 7 | W–S and N–E | None; disjoint arcs |
| 8 | N–W and S–E | None; disjoint arcs |
| 9 | W–E and N–S | W–E |
| 10 | W–E and N–S | N–S |

At codes 7 and 8, the two arcs remain separate and do not intersect. At codes 9 and 10, opposite ports form two separate strands; the crossing is not a four-way graph vertex. A visible gap in an underpass is a drawing convention, not an endpoint.

The mathematical model follows Lomonaco and Kauffman, [Quantum Knots and Mosaics](https://arxiv.org/abs/0805.0339). The explicit numerical mapping above follows the inspected [drawing implementation](https://github.com/amheap/knot-mosaics/blob/4d1c78ea5a1e8cf4783806f822c63e9bf3c1aaac/pythonFiles/mosaic_drawing.py). This JSON wrapper and tile-set URI are the project's serialization convention, not the original CSV format.

## Semantic validation

A complete validator shall perform these checks in addition to the existing bounded JSON and asset validation:

1. Require exactly the fields above, the supported tile-set URI, a nonempty square matrix and integer codes in 0–10. Reject ragged/sparse rows, non-JSON values, fractions and unknown fields.
2. For every horizontal neighbor pair, require E-port presence on the left to equal W-port presence on the right. For every vertical pair, require S-port presence above to equal N-port presence below. Two absent ports match.
3. Reject any N port on the first row, S port on the last row, W port on the first column or E port on the last column. There is no wraparound.
4. Trace components using the internal port pairings in the table and matching ports across tile edges. Every occupied port has one internal partner and one external partner. Count each resulting cycle once; two crossing strands are never joined.
5. Require at least one component. Multiple components, disconnected diagrams and components without crossings are valid.

Occupied tile count is the number of nonzero cells. Diagram crossing count is the number of cells with code 9 or 10. Component count comes from tracing, not from counting crossings. These are derived values, not fields accepted in `data`. They are not minimum crossing number, mosaic number or tile number invariants, and validation does not prove the subject's knot type or equivalence to another representation.

Traversal is iterative. `KNOT_ASSET_LIMITS.mosaicCells` limits each document (or standalone diagram) to 65,536 aggregate cells before tracing, allowing squares up to 256×256. General JSON budgets also apply: 262,144 entries and depth 64. The mathematical contract itself imposes no maximum size.

## KnotAsset integration

Use the ordinary `Representation` envelope: `id`, `type`, `data`, optional `target`, `views` and `defaultView`. An omitted target describes the asset subject. Explicit targets follow the existing scoped target rules; this profile supplies no mapping from traced components to construction objects.

Views must have `space: "plane"`. `preferredView` is a 3D hint and is not accepted for this type. For plane camera coordinates, tile (row r, column c) occupies x in [c,c+1] and y in [n-r-1,n-r], with Y upward. Thus the unrotated mosaic fills [0,n] × [0,n], its center is [n/2,n/2], and a plane view with that center, height n and rotation 0 shows its full vertical extent. Aspect ratio and padding remain viewer concerns. Row indexing stays downward; this mapping is not a data reflection.

Extraction shall retain the representation, its view/type resources and any target dependencies under the ordinary rules, preserving the matrix exactly. The fixed tile-set convention needs no new dependency kind or hidden registry. Composition follows the existing same-document identity and conflict rules; visually equivalent rotated matrices are not automatically deduplicated.

`validateMosaicDiagram(data)` checks structure and semantics. Success returns `diagram`, `data`, `componentCount`, `occupiedTileCount` and `crossingCount`. JSON Schema checks structure; square shape, port matching, boundaries and components are runtime checks.

The type is semantically checked without `uncheckedTypes`; completeness still requires its resources, for example via `STANDARD_RESOURCES`. The 3D resolver and `KnotViewer` remain spatial-curve-only. Mosaic rendering is deferred.

## Examples and acceptance cases

The following is a representation fragment; see also the self-contained [mosaic-diagram.json](../examples/assets/mosaic-diagram.json) asset.

```json
{
  "id": "mosaic",
  "type": "https://yuriyapostol.github.io/knot-engine/v1/representation-types/mosaic-diagram",
  "data": {
    "tileSet": "https://yuriyapostol.github.io/knot-engine/v1/tile-sets/lomonaco-kauffman-11",
    "tiles": [
      [2, 1],
      [3, 4]
    ]
  }
}
```

Its four occupied tiles form one component without crossings. A two-component example is:

```json
{
  "tileSet": "https://yuriyapostol.github.io/knot-engine/v1/tile-sets/lomonaco-kauffman-11",
  "tiles": [
    [2, 1, 2, 1],
    [3, 4, 3, 4],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ]
}
```

The researched 4×4 source example is:

```json
{
  "tileSet": "https://yuriyapostol.github.io/knot-engine/v1/tile-sets/lomonaco-kauffman-11",
  "tiles": [
    [0, 2, 1, 0],
    [2, 9, 10, 1],
    [3, 10, 8, 4],
    [0, 3, 4, 0]
  ]
}
```

It has 12 occupied tiles, three diagram crossings and one component. Source: [allKnots.csv](https://github.com/amheap/knot-mosaics/blob/4d1c78ea5a1e8cf4783806f822c63e9bf3c1aaac/websiteFunctions/flaskApp/allKnots.csv), record 3_1. That designation records source attribution; this specification does not independently prove identity, chirality or minimality. CSV vectors using layout templates must be expanded with their original template; arbitrary vectors must not simply be reshaped into squares.

Acceptance cases:

| Case | Expected result |
| --- | --- |
| Four-corner loop; two separate loops; sourced 4×4 example | Valid; component counts 1, 2, 1 |
| Empty matrix; all-zero matrix; ragged rows; code 11; fractional code | Invalid |
| Change loop's top-left code 2 to code 1 | Invalid: boundary and/or neighbor mismatch |
| Unknown tile-set URI or compact tile-set URI | Unsupported profile; never complete |
| Codes 7/8 versus 9/10 | Preserve distinct internal pairings and crossing semantics |
| Swap 9 and 10 everywhere in the source example | Valid mirror diagram; same port matching and counts, no identity inference |
| Quarter-turn with correctly remapped codes | Preserve connectivity/counts; 9 and 10 interchange |
| Select/compose fragments and JSON round trip | Preserve all tile codes and required resources |
| Excessive input | Fail before expensive traversal under documented implementation limits |

A rotation or reflection must remap tile codes as well as matrix positions. Swapping over/under at all crossings gives a mirror diagram; it is not an ordinary camera change. Neither transform may silently change the stored representation or reuse a subject identity as a proved mathematical conclusion.

## Attribution of concrete data

Optional `sources` and `contributions` belong to the `Representation` envelope, outside `data`. Shared source definitions and the global license belong to the KnotAsset. Convention references in this specification explain the contract; representation sources identify where its concrete data came from. See the [shared metadata specification](sources.md).
